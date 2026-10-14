'use strict';

const express = require('express');
const db = require('../db/pool');
const { asyncHandler, badRequest, notFound, toId } = require('../utils/errors');
const { requireAuth } = require('../middleware/auth');
const { extractKeywords } = require('../services/jd/extractKeywords');
const { fetchJobPosting } = require('../services/jd/fetchUrl');
const { sha256 } = require('../utils/crypto');

const router = express.Router();
router.use(requireAuth);

const TIERS = new Set(['required', 'preferred', 'implied']);

function toJobView(row) {
  const ex = row.extracted_keywords || {};
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
    rawText: row.raw_text,
    keywords: ex.keywords || [],
    experienceYears: ex.experienceYears ?? null,
  };
}

async function getOwnedJob(userId, id) {
  const { rows } = await db.query('SELECT * FROM job_descriptions WHERE id = $1 AND user_id = $2', [toId(id, 'Job description'), userId]);
  if (!rows[0]) throw notFound('Job description');
  return rows[0];
}

function hashJd(text) {
  return sha256(text.toLowerCase().replace(/\s+/g, ' ').trim());
}

/** Submit a JD as pasted text or a URL -> extract and classify keywords (REQ-2.1 to 2.4). */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    let text = String(req.body.text || '').trim();
    const url = String(req.body.url || '').trim();
    let title = String(req.body.title || '').trim();
    let source = 'text';

    if (!text && url) {
      const fetched = await fetchJobPosting(url);
      text = fetched.text;
      if (!title && fetched.title) title = fetched.title;
      source = 'url';
    }
    if (!text) throw badRequest('NO_JD', 'Please paste the job description text or a link to the job posting.');
    if (text.length < 120) {
      throw badRequest('JD_TOO_SHORT', 'This job description is too short to analyse. Please paste the full posting, including requirements.');
    }
    if (text.length > 20000) text = text.slice(0, 20000);

    const extracted = extractKeywords(text);
    if (!title) title = extracted.title;
    title = title.slice(0, 200);

    // Reuse the same JD row if the user pastes the same text again, so score trends line up (REQ-6.2).
    const { rows } = await db.query(
      `INSERT INTO job_descriptions (user_id, title, raw_text, text_hash, extracted_keywords, source, source_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, text_hash) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING *, (xmax <> 0) AS reused`,
      [req.userId, title, text, hashJd(text), JSON.stringify(extracted), source, source === 'url' ? url : null]
    );
    res.status(201).json({ job: { ...toJobView(rows[0]), reused: rows[0].reused } });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT jd.id, jd.title, jd.source, jd.created_at,
              COUNT(s.id)::int AS scan_count,
              MAX(s.created_at) AS last_scan_at,
              (SELECT (s2.score_breakdown->>'composite')::int FROM scans s2
                WHERE s2.job_description_id = jd.id ORDER BY s2.created_at DESC LIMIT 1) AS latest_score,
              (SELECT (s3.score_breakdown->>'composite')::int FROM scans s3
                WHERE s3.job_description_id = jd.id ORDER BY s3.created_at ASC LIMIT 1) AS first_score
         FROM job_descriptions jd
         LEFT JOIN scans s ON s.job_description_id = jd.id
        WHERE jd.user_id = $1
        GROUP BY jd.id
        ORDER BY COALESCE(MAX(s.created_at), jd.created_at) DESC`,
      [req.userId]
    );
    res.json({
      jobs: rows.map((r) => ({
        id: r.id,
        title: r.title,
        source: r.source,
        createdAt: r.created_at,
        scanCount: r.scan_count,
        lastScanAt: r.last_scan_at,
        latestScore: r.latest_score,
        firstScore: r.first_score,
      })),
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ job: toJobView(await getOwnedJob(req.userId, req.params.id)) });
  })
);

/** User confirms / edits the extracted keyword list before scoring (SRS 4.2.2). */
router.put(
  '/:id/keywords',
  asyncHandler(async (req, res) => {
    const row = await getOwnedJob(req.userId, req.params.id);
    const input = Array.isArray(req.body.keywords) ? req.body.keywords : null;
    if (!input) throw badRequest('INVALID_KEYWORDS', 'Keywords must be a list.');
    if (input.length > 80) throw badRequest('INVALID_KEYWORDS', 'Please keep the list to 80 keywords or fewer.');

    const ex = row.extracted_keywords || {};
    const previous = new Map((ex.keywords || []).map((k) => [k.term.toLowerCase(), k]));
    const seen = new Set();
    const keywords = [];
    for (const k of input) {
      const term = String((k && k.term) || '').trim().slice(0, 60);
      const tier = TIERS.has(k && k.tier) ? k.tier : 'required';
      if (!term || seen.has(term.toLowerCase())) continue;
      seen.add(term.toLowerCase());
      const prev = previous.get(term.toLowerCase());
      keywords.push({ term, tier, category: prev ? prev.category : 'custom', count: prev ? prev.count : 1, context: prev ? prev.context : '' });
    }
    const title = req.body.title ? String(req.body.title).trim().slice(0, 200) : row.title;
    const { rows } = await db.query(
      'UPDATE job_descriptions SET extracted_keywords = $1, title = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
      [JSON.stringify({ ...ex, keywords }), title || row.title, row.id, req.userId]
    );
    res.json({ job: toJobView(rows[0]) });
  })
);

/** REQ-6.2: chronological score trend for every scan against this JD. */
router.get(
  '/:id/trend',
  asyncHandler(async (req, res) => {
    const job = await getOwnedJob(req.userId, req.params.id);
    const { rows } = await db.query(
      `SELECT s.id, s.created_at, s.score_breakdown, r.file_ref
         FROM scans s JOIN resumes r ON r.id = s.resume_id
        WHERE s.job_description_id = $1 AND s.user_id = $2
        ORDER BY s.created_at ASC`,
      [job.id, req.userId]
    );
    res.json({
      job: { id: job.id, title: job.title, createdAt: job.created_at },
      points: rows.map((r) => ({
        scanId: r.id,
        createdAt: r.created_at,
        resumeName: r.file_ref,
        composite: r.score_breakdown.composite,
        keyword: r.score_breakdown.keyword.score,
        semantic: r.score_breakdown.semantic.score,
        completeness: r.score_breakdown.completeness.score,
      })),
    });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await db.query('DELETE FROM job_descriptions WHERE id = $1 AND user_id = $2', [toId(req.params.id, 'Job description'), req.userId]);
    if (!rowCount) throw notFound('Job description');
    res.json({ ok: true });
  })
);

module.exports = router;
