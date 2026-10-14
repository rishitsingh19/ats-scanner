-- AI-Powered Resume & ATS Compatibility Scanner
-- Relational schema (SRS Appendix B.1). Safe to run more than once.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  onboarded     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resumes (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_ref        VARCHAR(255) NOT NULL,          -- original file name shown to the user
  mime_type       VARCHAR(120) NOT NULL,
  file_size       INTEGER NOT NULL,
  file_data       BYTEA NOT NULL,                 -- AES-256-GCM encrypted file bytes (SRS 5.3)
  parsed_sections JSONB NOT NULL,                 -- sections, bullets, contact, raw text
  format_flags    JSONB NOT NULL DEFAULT '[]'::jsonb,
  low_confidence  BOOLEAN NOT NULL DEFAULT FALSE, -- REQ-1.4
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS job_descriptions (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title              VARCHAR(200) NOT NULL,
  raw_text           TEXT NOT NULL,
  text_hash          CHAR(64) NOT NULL,           -- lets the same JD be reused for score trends
  extracted_keywords JSONB NOT NULL,
  source             VARCHAR(10) NOT NULL CHECK (source IN ('text', 'url')),
  source_url         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, text_hash)
);
CREATE INDEX IF NOT EXISTS idx_jd_user ON job_descriptions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS scans (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_id          INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_description_id INTEGER NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  score_breakdown    JSONB NOT NULL,
  flags              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_jd ON scans(job_description_id, created_at);

CREATE TABLE IF NOT EXISTS rewrite_suggestions (
  id                 SERIAL PRIMARY KEY,
  scan_id            INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  bullet_id          VARCHAR(20) NOT NULL,
  original_bullet    TEXT NOT NULL,
  suggested_bullets  JSONB NOT NULL,
  keywords_addressed JSONB NOT NULL,
  cache_key          CHAR(64) NOT NULL,           -- REQ-5.4: hash of bullet + keyword set
  provider           VARCHAR(20) NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rewrite_cache ON rewrite_suggestions(cache_key);
CREATE INDEX IF NOT EXISTS idx_rewrite_scan ON rewrite_suggestions(scan_id, bullet_id);
