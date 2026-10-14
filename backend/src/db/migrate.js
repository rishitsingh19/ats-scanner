'use strict';

const fs = require('fs');
const path = require('path');
const { config } = require('../config');

async function main() {
  if (!config.databaseUrl) {
    console.error('DATABASE_URL is empty. Add your Neon/Supabase connection string to backend/.env first.');
    process.exit(1);
  }
  const { pool } = require('./pool');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('Database schema is ready.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
