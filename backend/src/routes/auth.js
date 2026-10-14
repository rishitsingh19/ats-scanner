'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/pool');
const { asyncHandler, badRequest, unauthorized } = require('../utils/errors');
const { requireAuth, signToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, onboarded: u.onboarded, createdAt: u.created_at });

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!name || name.length > 120) throw badRequest('INVALID_NAME', 'Please enter your name.');
    if (!EMAIL_RE.test(email) || email.length > 255) throw badRequest('INVALID_EMAIL', 'Please enter a valid email address.');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw badRequest('WEAK_PASSWORD', 'Password must be at least 8 characters and include a letter and a number.');
    }
    if (password.length > 128) throw badRequest('WEAK_PASSWORD', 'Password must be 128 characters or fewer.');

    const exists = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rowCount) throw badRequest('EMAIL_TAKEN', 'An account with this email already exists. Try signing in instead.');

    const hash = await bcrypt.hash(password, 10); // SRS 5.3: passwords are hashed, never stored as plain text
    const { rows } = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [name, email, hash]
    );
    const token = signToken(rows[0]);
    setAuthCookie(res, token);
    res.status(201).json({ user: publicUser(rows[0]), token });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!ok) throw unauthorized('Incorrect email or password.');
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ user: publicUser(user), token });
  })
);

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (!rows[0]) throw unauthorized();
    res.json({ user: publicUser(rows[0]) });
  })
);

/** Marks the first-scan walkthrough as seen. */
router.post(
  '/onboarded',
  requireAuth,
  asyncHandler(async (req, res) => {
    await db.query('UPDATE users SET onboarded = TRUE WHERE id = $1', [req.userId]);
    res.json({ ok: true });
  })
);

module.exports = router;
