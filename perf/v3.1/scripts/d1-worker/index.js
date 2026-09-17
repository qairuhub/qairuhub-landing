// generated from ../d1-rows.mjs by the probe setup; local wrangler dev only
const schema = "-- QairuHub landing D1 schema (V3-BUILD-PLAN §WP4). Owned by WP4.\n-- Apply: npx wrangler d1 migrations apply qairuhub-landing --local | --remote\n\n-- Join form + QairuHub Accelerator waitlist. Rows expire after SUBMISSION_RETENTION_DAYS (180).\nCREATE TABLE submissions (\n  id TEXT PRIMARY KEY,                       -- crypto.randomUUID()\n  kind TEXT NOT NULL CHECK (kind IN ('join','waitlist')),\n  created_at INTEGER NOT NULL,               -- unix seconds\n  expires_at INTEGER NOT NULL,               -- created_at + retention\n  locale TEXT NOT NULL CHECK (locale IN ('en','kk')),\n  name TEXT, email TEXT NOT NULL, telegram TEXT, interest TEXT, message TEXT\n);\nCREATE INDEX submissions_kind_created ON submissions (kind, created_at);\nCREATE UNIQUE INDEX submissions_waitlist_email ON submissions (email) WHERE kind = 'waitlist';\nCREATE INDEX submissions_expires ON submissions (expires_at);\n\n-- Rate-limit and cost-cap counters for /api/ask (keys `ask:…`) and /api/join (keys `join:…`).\n-- Keys hold a salted IP hash, never a raw IP.\nCREATE TABLE counters (key TEXT PRIMARY KEY, n INTEGER NOT NULL, expires_at INTEGER NOT NULL);\nCREATE INDEX counters_expires ON counters (expires_at);\n"
const UPSERT = `INSERT INTO counters (key, n, expires_at) VALUES (?1, 1, ?2)
ON CONFLICT(key) DO UPDATE SET
  n = CASE WHEN counters.expires_at <= ?3 THEN 1 ELSE counters.n + 1 END,
  expires_at = CASE WHEN counters.expires_at <= ?3 THEN excluded.expires_at ELSE counters.expires_at END
RETURNING n, expires_at`
// Proposed: count the global AI request only when both per-IP counters (written earlier in the same batch) are within limits.
const GUARDED_GLOBAL = `INSERT INTO counters (key, n, expires_at)
SELECT ?1, 1, ?2
 WHERE (SELECT n FROM counters WHERE key = ?4) <= ?5
   AND (SELECT n FROM counters WHERE key = ?6) <= ?7
ON CONFLICT(key) DO UPDATE SET
  n = CASE WHEN counters.expires_at <= ?3 THEN 1 ELSE counters.n + 1 END,
  expires_at = CASE WHEN counters.expires_at <= ?3 THEN excluded.expires_at ELSE counters.expires_at END
RETURNING n, expires_at`

async function run(db, ddl) {
  await db.batch(["DROP TABLE IF EXISTS counters","DROP TABLE IF EXISTS submissions"].map((s)=>db.prepare(s)))
  for (const stmt of ddl.split(';').map((s) => s.replace(/--.*$/gm, '').trim()).filter(Boolean)) await db.prepare(stmt).run()
  const now = 1_800_000_000
  const out = {}
  const meta = (r) => ({ read: r.meta.rows_read, written: r.meta.rows_written, ms: r.meta.duration })
  out.upsertInsert = meta(await db.prepare(UPSERT).bind('ask:ipm:a', now + 60, now).run())
  out.upsertIncrement = meta(await db.prepare(UPSERT).bind('ask:ipm:a', now + 60, now).run())
  out.upsertExpiredReset = meta(await db.prepare(UPSERT).bind('ask:ipm:a', now + 200, now + 100).run())
  // current /api/ask: batch(2) then batch(1)
  const b1 = await db.batch([db.prepare(UPSERT).bind('ask:ipm:b', now + 60, now), db.prepare(UPSERT).bind('ask:ipd:b', now + 86400, now)])
  const b2 = await db.batch([db.prepare(UPSERT).bind('ask:ai:day', now + 90000, now)])
  out.askCurrentRoundTrips = 2
  out.askCurrentWritten = [...b1, ...b2].reduce((a, r) => a + r.meta.rows_written, 0)
  // proposed: one batch of 3; limits 6/min, 40/day
  const b3 = await db.batch([
    db.prepare(UPSERT).bind('ask:ipm:c', now + 60, now),
    db.prepare(UPSERT).bind('ask:ipd:c', now + 86400, now),
    db.prepare(GUARDED_GLOBAL).bind('ask:ai:day', now + 90000, now, 'ask:ipm:c', 6, 'ask:ipd:c', 40),
  ])
  out.askProposedRoundTrips = 1
  out.askProposedWritten = b3.reduce((a, r) => a + r.meta.rows_written, 0)
  out.guardedGlobalCounted = b3[2].results
  // guarded statement must NOT count when the per-IP minute limit is exceeded
  for (let i = 0; i < 6; i++) await db.prepare(UPSERT).bind('ask:ipm:d', now + 60, now).run()
  const b4 = await db.batch([
    db.prepare(UPSERT).bind('ask:ipm:d', now + 60, now),
    db.prepare(UPSERT).bind('ask:ipd:d', now + 86400, now),
    db.prepare(GUARDED_GLOBAL).bind('ask:ai:day', now + 90000, now, 'ask:ipm:d', 6, 'ask:ipd:d', 40),
  ])
  out.guardedWhenLimited = { ipm: b4[0].results[0].n, globalRows: b4[2].results, written: b4[2].meta.rows_written }
  const g = await db.prepare('SELECT n FROM counters WHERE key = ?').bind('ask:ai:day').first()
  out.globalAfter = g.n
  // submissions insert (join, then waitlist twice → duplicate ignored)
  const INS = `INSERT OR IGNORE INTO submissions (id, kind, created_at, expires_at, locale, name, email, telegram, interest, message) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
  out.insertJoin = meta(await db.prepare(INS).bind('1', 'join', now, now + 1, 'en', 'N', 'a@b.co', '@x', 'build', null).run())
  out.insertWaitlist = meta(await db.prepare(INS).bind('2', 'waitlist', now, now + 1, 'en', null, 'w@b.co', null, null, null).run())
  out.insertWaitlistDup = meta(await db.prepare(INS).bind('3', 'waitlist', now, now + 1, 'en', null, 'w@b.co', null, null, null).run())
  // purge with ~1000 live counters and 1000 expired ones
  const fill = []
  for (let i = 0; i < 2000; i++) fill.push(db.prepare('INSERT INTO counters (key, n, expires_at) VALUES (?1, 1, ?2)').bind(`fill:${i}`, i < 1000 ? now - 10 : now + 1000))
  await db.batch(fill)
  const purge = await db.batch([
    db.prepare('DELETE FROM counters WHERE expires_at <= ?1').bind(now),
    db.prepare('DELETE FROM submissions WHERE expires_at <= ?1').bind(now),
  ])
  out.purge1000Expired = purge.map(meta)
  return out
}

export default {
  async fetch(req, env) {
    const current = await run(env.DB, schema)
    const withoutRowid = await run(env.DB2, schema.replace("expires_at INTEGER NOT NULL);", "expires_at INTEGER NOT NULL) WITHOUT ROWID;"))
    const withoutRowidNoExpiresIndex = await run(env.DB3, schema.replace("expires_at INTEGER NOT NULL);", "expires_at INTEGER NOT NULL) WITHOUT ROWID;").replace("CREATE INDEX counters_expires ON counters (expires_at);", ""))
    return Response.json({ current, withoutRowid, withoutRowidNoExpiresIndex })
  },
}
