'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/pool');
const { asyncHandler, unauthorized, notFound } = require('../utils/errors');
const { requireAuth, clearAuthCookie } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT (SELECT COUNT(*) FROM resumes WHERE user_id = $1)::int AS resumes,
              (SELECT COUNT(*) FROM job_descriptions WHERE user_id = $1)::int AS jobs,
              (SELECT COUNT(*) FROM scans WHERE user_id = $1)::int AS scans`,
      [req.userId]
    );
    res.json(rows[0]);
  })
);

/** SRS 5.3: permanently delete the account and every resume, JD, scan and rewrite (ON DELETE CASCADE). */
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    if (!rows[0]) throw notFound('Account');
    const ok = await bcrypt.compare(String(req.body.password || ''), rows[0].password_hash);
    if (!ok) throw unauthorized('Incorrect password. Your account was not deleted.');
    await db.query('DELETE FROM users WHERE id = $1', [req.userId]);
    clearAuthCookie(res);
    res.json({ ok: true });
  })
);

module.exports = router;
