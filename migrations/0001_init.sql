-- QairuHub landing D1 schema (V3-BUILD-PLAN §WP4). Owned by WP4.
-- Apply: npx wrangler d1 migrations apply qairuhub-landing --local | --remote

-- Join form + QairuHub Accelerator waitlist. Rows expire after SUBMISSION_RETENTION_DAYS (180).
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,                       -- crypto.randomUUID()
  kind TEXT NOT NULL CHECK (kind IN ('join','waitlist')),
  created_at INTEGER NOT NULL,               -- unix seconds
  expires_at INTEGER NOT NULL,               -- created_at + retention
  locale TEXT NOT NULL CHECK (locale IN ('en','kk')),
  name TEXT, email TEXT NOT NULL, telegram TEXT, interest TEXT, message TEXT
);
CREATE INDEX submissions_kind_created ON submissions (kind, created_at);
CREATE UNIQUE INDEX submissions_waitlist_email ON submissions (email) WHERE kind = 'waitlist';
CREATE INDEX submissions_expires ON submissions (expires_at);

-- Rate-limit and cost-cap counters for /api/ask (keys `ask:…`) and /api/join (keys `join:…`).
-- Keys hold a salted IP hash, never a raw IP.
CREATE TABLE counters (key TEXT PRIMARY KEY, n INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX counters_expires ON counters (expires_at);
