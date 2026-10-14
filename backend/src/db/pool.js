'use strict';

const { Pool } = require('pg');
const { config } = require('../config');

function sslOption(url) {
  if (!url || /localhost|127\.0\.0\.1/.test(url)) return false;
  // Neon and Supabase both require TLS. Strict CA checking is optional (see .env.example).
  return { rejectUnauthorized: config.dbSslStrict };
}

const pool = new Pool({
  connectionString: config.databaseUrl.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, ''),
  ssl: sslOption(config.databaseUrl),
  // Long-running server: 10 connections comfortably handle 20+ concurrent scans.
  // On Vercel each function instance has its own pool, so keep it small to avoid exhausting the database.
  max: process.env.VERCEL ? 3 : 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
