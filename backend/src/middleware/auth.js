'use strict';

const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { unauthorized } = require('../utils/errors');

const COOKIE_NAME = 'ats_token';

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

function clearAuthCookie(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
}

/** Accepts the token from the HTTP-only cookie or an "Authorization: Bearer" header (SRS 3.4). */
function requireAuth(req, res, next) {
  let token = req.cookies && req.cookies[COOKIE_NAME];
  const header = req.headers.authorization || '';
  if (!token && header.startsWith('Bearer ')) token = header.slice(7);
  if (!token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.userId = Number(payload.sub);
    return next();
  } catch {
    return next(unauthorized('Your session has expired. Please sign in again.'));
  }
}

module.exports = { requireAuth, signToken, setAuthCookie, clearAuthCookie };
