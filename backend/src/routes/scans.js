'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db/pool');
const { config } = require('../config');
const { asyncHandler, badRequest, notFound, toId } = require('../utils/errors');
const { requireAuth } = require('../middleware/auth');
const { runScoring } = require('../services/scoring');
const { planRewrite, generateRewrites, cacheKey } = require('../services/rewrite');

const router = express.Router();
router.use(requireAuth);

function toScanView(row, extras = {}) {
  return {
    id: row.id,
    createdAt: row.created_at,
    resumeId: row.resume_id,
    jobDescriptionId: row.job_description_id,
    resumeName: row.file_ref,
    jobTitle: row.title,
    breakdown: row.score_breakdown,
    formatFlags: (row.flags && row.flags.format) || [],
    ...extras,
  };
}

/** Run a scan. Business rule (SRS 5.5): both the resume and the JD must already be parsed. */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const resumeId = toId(req.body.resumeId, 'Resume');
    const jdId = toId(req.body.jobDescriptionId, 'Job description');

    const [resumeQ, jdQ] = await Promise.all([
      db.query('SELECT id, file_ref, parsed_sections, format_flags, low_confidence FROM resumes WHERE id = $1 AND user_id = $2', [resumeId, req.userId]),
      db.query('SELECT id, title, raw_text, extracted_keywords FROM job_descriptions WHERE id = $1 AND user_id = $2', [jdId, req.userId]),
    ]);
    const resume = resumeQ.rows[0];
    const jd = jdQ.rows[0];
    if (!resume) throw notFound('Resume');
    if (!jd) throw notFound('Job description');
    if (!resume.parsed_sections || !resume.parsed_sections.rawText) {
      throw badRequest('RESUME_NOT_PARSED', 'This resume has not been processed yet. Please upload it again.');
    }
    const activeKeywords = ((jd.extracted_keywords && jd.extracted_keywords.keywords) || []).filter((k) => !k.excluded);
    if (!activeKeywords.length) {
      throw badRequest('NO_KEYWORDS', 'No keywords were found for this job. Add a few key skills from the posting before scanning.');
    }

    const breakdown = await runScoring({ parsed: resume.parsed_sections, jd, weights: config.weights, hf: config.hf });
    const flags = { format: resume.format_flags, lowConfidence: resume.low_confidence };

    const { rows } = await db.query(
      `INSERT INTO scans (user_id, resume_id, job_description_id, score_breakdown, flags)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId, resume.id, jd.id, JSON.stringify(breakdown), JSON.stringify(flags)]
    );
    res.status(201).json({ scan: toScanView({ ...rows[0], file_ref: resume.file_ref, title: jd.title }) });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT s.id, s.created_at, s.resume_id, s.job_description_id,
              (s.score_breakdown->>'composite')::int AS composite, r.file_ref, jd.title
         FROM scans s
         JOIN resumes r ON r.id = s.resume_id
         JOIN job_descriptions jd ON jd.id = s.job_description_id
        WHERE s.user_id = $1
        ORDER BY s.created_at DESC
        LIMIT 200`,
      [req.userId]
    );
    res.json({
      scans: rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        resumeId: r.resume_id,
        jobDescriptionId: r.job_description_id,
        composite: r.composite,
        resumeName: r.file_ref,
        jobTitle: r.title,
      })),
    });
  })
);

async function getOwnedScan(userId, id) {
  const { rows } = await db.query(
    `SELECT s.*, r.file_ref, jd.title
       FROM scans s
       JOIN resumes r ON r.id = s.resume_id
       JOIN job_descriptions jd ON jd.id = s.job_description_id
      WHERE s.id = $1 AND s.user_id = $2`,
    [toId(id, 'Scan'), userId]
  );
  if (!rows[0]) throw notFound('Scan');
  return rows[0];
}

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = await getOwnedScan(req.userId, req.params.id);
    const rw = await db.query(
      `SELECT DISTINCT ON (bullet_id) bullet_id, original_bullet, suggested_bullets, keywords_addressed, provider
         FROM rewrite_suggestions WHERE scan_id = $1 ORDER BY bullet_id, created_at DESC`,
      [row.id]
    );
    const rewrites = {};
    for (const r of rw.rows) {
      rewrites[r.bullet_id] = { suggestions: r.suggested_bullets, keywordsAddressed: r.keywords_addressed, provider: r.provider };
    }
    const prev = await db.query(
      `SELECT id, (score_breakdown->>'composite')::int AS composite FROM scans
        WHERE job_description_id = $1 AND user_id = $2 AND created_at < $3
        ORDER BY created_at DESC LIMIT 1`,
      [row.job_description_id, req.userId, row.created_at]
    );
    res.json({ scan: toScanView(row, { rewrites, previous: prev.rows[0] || null }) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await db.query('DELETE FROM scans WHERE id = $1 AND user_id = $2', [toId(req.params.id, 'Scan'), req.userId]);
    if (!rowCount) throw notFound('Scan');
    res.json({ ok: true });
  })
);

// Rewrite generation calls a paid API, so it gets its own per-user limit (SRS 2.5).
const rewriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  keyGenerator: (req) => `user:${req.userId}`,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'You have asked for a lot of rewrites. Please wait a few minutes and try again.' } },
});

/** REQ-5.3 / REQ-5.4: 2-3 rewrites for one flagged bullet, cached per bullet + keyword set. */
router.post(
  '/:id/rewrites',
  rewriteLimiter,
  asyncHandler(async (req, res) => {
    const scan = await getOwnedScan(req.userId, req.params.id);
    const bulletId = String(req.body.bulletId || '');
    const resume = await db.query('SELECT parsed_sections FROM resumes WHERE id = $1 AND user_id = $2', [scan.resume_id, req.userId]);
    const bullet = ((resume.rows[0] && resume.rows[0].parsed_sections.bullets) || []).find((b) => b.id === bulletId);
    if (!bullet) throw badRequest('BULLET_NOT_FOUND', 'That bullet point could not be found in this resume.');

    const missing = (scan.score_breakdown.keyword && scan.score_breakdown.keyword.missing) || [];
    const plan = planRewrite(bullet.text, missing, config.gemini);

    const cached = await db.query(
      `SELECT rs.* FROM rewrite_suggestions rs JOIN scans s ON s.id = rs.scan_id
        WHERE s.user_id = $1 AND rs.cache_key = $2 ORDER BY rs.created_at DESC LIMIT 1`,
      [req.userId, plan.key]
    );

    let result;
    let fromCache = false;
    if (cached.rows[0]) {
      const c = cached.rows[0];
      result = { suggestions: c.suggested_bullets, keywordsAddressed: c.keywords_addressed, provider: c.provider };
      fromCache = true;
    } else {
      result = await generateRewrites({ bullet: bullet.text, keywords: plan.keywords, jobTitle: scan.title, gemini: config.gemini });
    }

    // Save against this scan (also when served from cache, so the report shows it next time).
    const alreadyHere = cached.rows[0] && cached.rows[0].scan_id === scan.id;
    if (!alreadyHere) {
      await db.query(
        `INSERT INTO rewrite_suggestions (scan_id, bullet_id, original_bullet, suggested_bullets, keywords_addressed, cache_key, provider)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          scan.id,
          bullet.id,
          bullet.text,
          JSON.stringify(result.suggestions),
          JSON.stringify(result.keywordsAddressed),
          cacheKey(bullet.text, plan.keywords, result.provider),
          result.provider,
        ]
      );
    }

    res.json({ bulletId: bullet.id, original: bullet.text, ...result, cached: fromCache });
  })
);

module.exports = router;
