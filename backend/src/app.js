'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { config, configProblems } = require('./config');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// This file is the Vercel entrypoint (see vercel.json -> services.backend.entrypoint).
// Vercel serves every request under /api/* to this app with the full path, e.g. /api/scans,
// so the routes below stay mounted under /api. Locally, src/index.js imports it and calls listen().
const app = express();

app.set('trust proxy', 1); // Vercel (and Render/Railway) sit behind a proxy
app.use(helmet());

// On Vercel there is no startup step that can exit, so report missing env vars on each request instead.
const missingConfig = configProblems();
if (missingConfig.length) {
  console.error(`[config] Missing or invalid environment variables: ${missingConfig.join(', ')}`);
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') return next();
    res.status(503).json({
      error: {
        code: 'SERVER_NOT_CONFIGURED',
        message: 'The server is not set up yet. Please try again later.',
      },
    });
  });
}
app.use(
  cors({
    origin: config.frontendUrl.split(',').map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Basic abuse protection: auth endpoints are stricter.
app.use('/api/', rateLimit({ windowMs: 60 * 1000, limit: 200, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(
  '/api/auth/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.' } },
  })
);

app.get('/api/health', (req, res) => {
  res.json({
    ok: missingConfig.length === 0,
    ...(missingConfig.length ? { missingConfig } : {}),
    services: {
      semantic: config.hf.token ? 'huggingface' : 'local',
      rewrites: config.gemini.apiKey ? 'gemini' : 'local',
    },
    weights: config.weights,
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/resumes', require('./routes/resumes'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/scans', require('./routes/scans'));
app.use('/api/account', require('./routes/account'));

app.use('/api', notFoundHandler);
app.use(errorHandler);

module.exports = app;
