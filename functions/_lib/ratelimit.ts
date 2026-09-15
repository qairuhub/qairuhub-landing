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

const UPSERT = `INSERT INTO counters (key, n, expires_at) VALUES (?1, 1, ?2)
ON CONFLICT(key) DO UPDATE SET
  n = CASE WHEN counters.expires_at <= ?3 THEN 1 ELSE counters.n + 1 END,
  expires_at = CASE WHEN counters.expires_at <= ?3 THEN excluded.expires_at ELSE counters.expires_at END
RETURNING n, expires_at`

/** Increments every counter in one round trip and returns the new counts. */
export async function hit(db: D1Database, specs: CounterSpec[], nowSec: number): Promise<CounterResult[]> {
  const statements = specs.map((s) =>
    db.prepare(UPSERT).bind(s.key, s.expiresAt ?? nowSec + (s.windowSec ?? 60), nowSec),
  )
  const results = await db.batch<{ n: number; expires_at: number }>(statements)
  return results.map((r, i) => {
    const row = r.results?.[0]
    return { key: specs[i].key, n: row?.n ?? 1, expiresAt: row?.expires_at ?? nowSec }
  })
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
