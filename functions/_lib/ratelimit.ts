/**
 * D1 counters (AGENT-SPEC §8). Table `counters(key, n, expires_at)`; a key's window starts at its
 * first hit and resets once `expires_at` has passed. Stale rows are purged opportunistically.
 */

export interface CounterSpec {
  key: string
  /** window length in seconds, or an absolute expiry (unix seconds) */
  windowSec?: number
  expiresAt?: number
}

export interface CounterResult {
  key: string
  n: number
  expiresAt: number
}

const UPSERT_SET = `ON CONFLICT(key) DO UPDATE SET
  n = CASE WHEN counters.expires_at <= ?3 THEN 1 ELSE counters.n + 1 END,
  expires_at = CASE WHEN counters.expires_at <= ?3 THEN excluded.expires_at ELSE counters.expires_at END
RETURNING n, expires_at`

const UPSERT = `INSERT INTO counters (key, n, expires_at) VALUES (?1, 1, ?2)
${UPSERT_SET}`

/**
 * UPSERT that runs only while two other counters are within their limits: ?4/?5 and ?6/?7 are
 * key/limit pairs. In the same batch after their own upserts, it counts exactly the requests that
 * pass the per-IP checks (`n <= limit`), and returns no row otherwise. (`INSERT … SELECT … WHERE`
 * needs a WHERE before ON CONFLICT, which the subqueries provide.)
 */
const GUARDED_UPSERT = `INSERT INTO counters (key, n, expires_at)
SELECT ?1, 1, ?2
 WHERE (SELECT n FROM counters WHERE key = ?4) <= ?5
   AND (SELECT n FROM counters WHERE key = ?6) <= ?7
${UPSERT_SET}`

type CounterRow = { n: number; expires_at: number }

function toResult(key: string, row: CounterRow | undefined, nowSec: number): CounterResult {
  return { key, n: row?.n ?? 1, expiresAt: row?.expires_at ?? nowSec }
}

/** Increments every counter in one round trip and returns the new counts. */
export async function hit(db: D1Database, specs: CounterSpec[], nowSec: number): Promise<CounterResult[]> {
  const statements = specs.map((s) =>
    db.prepare(UPSERT).bind(s.key, s.expiresAt ?? nowSec + (s.windowSec ?? 60), nowSec),
  )
  const results = await db.batch<CounterRow>(statements)
  return results.map((r, i) => toResult(specs[i].key, r.results?.[0], nowSec))
}

export interface AskCounterSpec {
  /** per-IP minute window (60 s from the first hit) */
  minuteKey: string
  /** per-IP day window, ends at `dayExpiresAt` */
  dayKey: string
  dayExpiresAt: number
  minuteLimit: number
  dayLimit: number
  /** global AI counter: counted only when both per-IP counters are within their limits */
  globalKey?: string
  globalExpiresAt?: number
}

export interface AskCounters {
  minute: CounterResult
  day: CounterResult
  /** `null` when no global key was given, or when a per-IP limit was exceeded (nothing counted) */
  global: CounterResult | null
}

/**
 * /api/ask's counters in ONE round trip (one implicit transaction): the two per-IP upserts and,
 * when `globalKey` is set, the guarded global upsert. Same results as `hit()` for the per-IP
 * windows followed by a separate global `hit()` only when both limits pass.
 */
export async function hitAsk(db: D1Database, spec: AskCounterSpec, nowSec: number): Promise<AskCounters> {
  const statements = [
    db.prepare(UPSERT).bind(spec.minuteKey, nowSec + 60, nowSec),
    db.prepare(UPSERT).bind(spec.dayKey, spec.dayExpiresAt, nowSec),
  ]
  if (spec.globalKey) {
    statements.push(
      db
        .prepare(GUARDED_UPSERT)
        .bind(
          spec.globalKey,
          spec.globalExpiresAt ?? spec.dayExpiresAt,
          nowSec,
          spec.minuteKey,
          spec.minuteLimit,
          spec.dayKey,
          spec.dayLimit,
        ),
    )
  }
  const [minute, day, global] = await db.batch<CounterRow>(statements)
  const globalRow = global?.results?.[0]
  return {
    minute: toResult(spec.minuteKey, minute.results?.[0], nowSec),
    day: toResult(spec.dayKey, day.results?.[0], nowSec),
    global: spec.globalKey && globalRow ? toResult(spec.globalKey, globalRow, nowSec) : null,
  }
}

/** Current count without incrementing (0 when absent or expired). */
export async function peek(db: D1Database, key: string, nowSec: number): Promise<number> {
  const row = await db
    .prepare('SELECT n FROM counters WHERE key = ?1 AND expires_at > ?2')
    .bind(key, nowSec)
    .first<{ n: number }>()
  return row?.n ?? 0
}

/** 1% of requests delete expired counters and submissions (V3-BUILD-PLAN §WP4 step 8). */
export function maybePurge(db: D1Database, nowSec: number, waitUntil: (p: Promise<unknown>) => void): void {
  if (Math.random() >= 0.01) return
  waitUntil(
    db
      .batch([
        db.prepare('DELETE FROM counters WHERE expires_at <= ?1').bind(nowSec),
        db.prepare('DELETE FROM submissions WHERE expires_at <= ?1').bind(nowSec),
      ])
      .catch(() => console.warn(JSON.stringify({ level: 'warn', msg: 'purge_failed' }))),
  )
}

/* ---------------------------------------------------------------------------------------- */
/* Astana time (UTC+5 since 2024-03-01)                                                     */
/* ---------------------------------------------------------------------------------------- */

const ASTANA_OFFSET_SEC = 5 * 3600

/** "2026-09-14" in Astana. */
export function astanaDate(nowSec: number): string {
  return new Date((nowSec + ASTANA_OFFSET_SEC) * 1000).toISOString().slice(0, 10)
}

/** Unix seconds of the next 00:00 in Astana. */
export function nextAstanaMidnight(nowSec: number): number {
  const local = nowSec + ASTANA_OFFSET_SEC
  return (Math.floor(local / 86400) + 1) * 86400 - ASTANA_OFFSET_SEC
}
