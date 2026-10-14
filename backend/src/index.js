'use strict';

const { config, assertConfig } = require('./config');

assertConfig();

const app = require('./app');
const { pool } = require('./db/pool');

async function start() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('[db] Could not connect to PostgreSQL:', err.message);
    console.error('[db] Check DATABASE_URL in backend/.env, then run "npm run db:migrate".');
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`ATS Scanner API running on http://localhost:${config.port}`);
    console.log(`  Relevance scoring: ${config.hf.token ? 'Hugging Face API' : 'built-in local model'}`);
    console.log(`  Rewrite ideas:     ${config.gemini.apiKey ? `Gemini (${config.gemini.model})` : 'built-in local writer'}`);
  });
}

start();
