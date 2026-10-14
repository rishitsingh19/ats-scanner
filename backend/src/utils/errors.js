'use strict';

/**
 * An error whose message is safe to show to the user.
 * SRS 5.4 (Reliability): failures must produce a visible, specific error.
 */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (code, message, details) => new AppError(400, code, message, details);
const notFound = (what = 'Item') => new AppError(404, 'NOT_FOUND', `${what} not found.`);
const unauthorized = (message = 'Please sign in to continue.') => new AppError(401, 'UNAUTHORIZED', message);

/** Parses a numeric id from the URL/body; anything else is treated as "not found". */
function toId(value, what) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 2147483647) throw notFound(what);
  return n;
}

/** Wraps an async route handler so thrown errors reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { AppError, badRequest, notFound, unauthorized, asyncHandler, toId };
