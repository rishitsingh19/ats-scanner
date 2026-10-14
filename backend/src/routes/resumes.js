'use strict';

const express = require('express');
const db = require('../db/pool');
const { config } = require('../config');
const { asyncHandler, badRequest, notFound, toId } = require('../utils/errors');
const { requireAuth } = require('../middleware/auth');
const { resumeUpload } = require('../middleware/upload');
const { parseResume } = require('../services/parsing');
const { encrypt, decrypt } = require('../utils/crypto');

const router = express.Router();
router.use(requireAuth);

const SECTION_LABELS = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
  certifications: 'Certifications',
  other: 'Other',
};

/** What the client sees: a structured preview for confirmation (SRS 4.1.2). */
function toResumeView(row) {
  const p = row.parsed_sections;
  const sections = Object.entries(SECTION_LABELS)
    .filter(([k]) => p.sections[k] && p.sections[k].trim())
    .map(([k, label]) => ({ key: k, label, preview: p.sections[k].slice(0, 600) }));
  return {
    id: row.id,
    fileName: row.file_ref,
    fileSize: row.file_size,
    uploadedAt: row.uploaded_at,
    lowConfidence: row.low_confidence,
    contact: p.contact,
    sections,
    missingSections: ['summary', 'skills', 'experience', 'education', 'projects'].filter((k) => !p.detectedSections.includes(k)).map((k) => SECTION_LABELS[k]),
    bullets: p.bullets,
    formatFlags: row.format_flags,
  };
}

async function getOwnedResume(userId, id) {
  const { rows } = await db.query('SELECT * FROM resumes WHERE id = $1 AND user_id = $2', [toId(id, 'Resume'), userId]);
  if (!rows[0]) throw notFound('Resume');
  return rows[0];
}

router.post(
  '/',
  resumeUpload,
  asyncHandler(async (req, res) => {
    const { originalname, buffer, mimetype, size } = req.file;
    const result = await parseResume(buffer, originalname);
    const parsedSections = { ...result.parsed, kind: result.kind, pages: result.pages };
    const { rows } = await db.query(
      `INSERT INTO resumes (user_id, file_ref, mime_type, file_size, file_data, parsed_sections, format_flags, low_confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.userId,
        originalname.slice(0, 255),
        mimetype,
        size,
        encrypt(buffer, config.encryptionKey),
        JSON.stringify(parsedSections),
        JSON.stringify(result.formatFlags),
        result.parsed.lowConfidence,
      ]
    );
    res.status(201).json({ resume: toResumeView(rows[0]) });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT id, file_ref, file_size, uploaded_at, low_confidence
         FROM resumes WHERE user_id = $1 ORDER BY uploaded_at DESC`,
      [req.userId]
    );
    res.json({
      resumes: rows.map((r) => ({ id: r.id, fileName: r.file_ref, fileSize: r.file_size, uploadedAt: r.uploaded_at, lowConfidence: r.low_confidence })),
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ resume: toResumeView(await getOwnedResume(req.userId, req.params.id)) });
  })
);

/** Download the original file (decrypted on the fly, owner only). */
router.get(
  '/:id/file',
  asyncHandler(async (req, res) => {
    const row = await getOwnedResume(req.userId, req.params.id);
    let data;
    try {
      data = decrypt(row.file_data, config.encryptionKey);
    } catch {
      throw badRequest('DECRYPT_FAILED', 'This file cannot be opened because the server encryption key has changed.');
    }
    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.file_ref)}"`);
    res.send(data);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await db.query('DELETE FROM resumes WHERE id = $1 AND user_id = $2', [toId(req.params.id, 'Resume'), req.userId]);
    if (!rowCount) throw notFound('Resume');
    res.json({ ok: true });
  })
);

module.exports = router;
