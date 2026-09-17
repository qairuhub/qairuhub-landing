-- Leaner rate-limit counters (perf audit v3.1, A2-08).
-- Apply with the deploy: npx wrangler d1 migrations apply qairuhub-landing --remote
--
-- `counters` becomes a WITHOUT ROWID table keyed by `key`, and loses the `counters_expires` index
-- (dropping the table drops the index). An upsert then writes 1 row instead of 2–3, so an AI ask
-- writes 3 rows instead of 6–9 and a join writes 1 counter row instead of 3.
--
-- Safe to recreate: rate-limit windows are ephemeral. Recreating the table only resets the windows
-- that are open right now (per-IP minute/day, the global daily AI count), once. Columns and
-- semantics are unchanged, so code before and after this migration works with either table.
-- The 1% purge (`DELETE FROM counters WHERE expires_at <= ?`) now scans the table, which is fine:
-- it only holds keys created since the previous purge.
DROP TABLE counters;
CREATE TABLE counters (key TEXT PRIMARY KEY, n INTEGER NOT NULL, expires_at INTEGER NOT NULL) WITHOUT ROWID;
