'use strict';

const { AppError } = require('../utils/errors');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'The request was too large.' } });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'The request body was not valid JSON.' } });
  }
  console.error('[error]', err);
  return res.status(500).json({
    error: { code: 'SERVER_ERROR', message: 'Something went wrong on our side. Please try again in a moment.' },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'This API route does not exist.' } });
}

module.exports = { errorHandler, notFoundHandler };
