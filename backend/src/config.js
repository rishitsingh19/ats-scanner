'use strict';

require('dotenv').config();

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normaliseWeights(w) {
  const total = w.keyword + w.semantic + w.completeness;
  if (total <= 0) return { keyword: 0.5, semantic: 0.3, completeness: 0.2 };
  return {
    keyword: w.keyword / total,
    semantic: w.semantic / total,
    completeness: w.completeness / total,
  };
}

const isProd = process.env.NODE_ENV === 'production';

const config = {
  isProd,
  port: num(process.env.PORT, 5000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  dbSslStrict: process.env.DB_SSL_STRICT === 'true',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: '7d',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  maxUploadBytes: 5 * 1024 * 1024, // REQ-1.1 / 2.5: 5 MB
  hf: {
    token: process.env.HF_API_TOKEN || '',
    model: process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
    timeoutMs: 6000,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    timeoutMs: 20000,
  },
  weights: normaliseWeights({
    keyword: num(process.env.WEIGHT_KEYWORD, 0.5),
    semantic: num(process.env.WEIGHT_SEMANTIC, 0.3),
    completeness: num(process.env.WEIGHT_COMPLETENESS, 0.2),
  }),
};

/** Returns the list of required settings that are missing or invalid (empty when everything is set). */
function configProblems() {
  const missing = [];
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (!config.jwtSecret) missing.push('JWT_SECRET');
  if (!/^[0-9a-fA-F]{64}$/.test(config.encryptionKey)) missing.push('ENCRYPTION_KEY (64 hex characters)');
  return missing;
}

/** Used by the long-running server (npm start). On Vercel, app.js reports problems per request instead of exiting. */
function assertConfig() {
  const missing = configProblems();
  if (missing.length) {
    console.error(`\n[config] Missing or invalid settings in backend/.env: ${missing.join(', ')}`);
    console.error('[config] Copy .env.example to .env and fill them in. Run "npm run gen:key" to create keys.\n');
    process.exit(1);
  }
}

module.exports = { config, assertConfig, configProblems, normaliseWeights };
