/**
 * /api/join: the Join form and the QairuHub Accelerator waitlist (V3-BUILD-PLAN §WP4, DECISIONS §5).
 *
 * GET  → 200 { "startedAt": "v1.<issuedMs>.<sig>" }   (no-store)
 *   The client fetches this once when a form nears the viewport (or on first focus) and sends it
 *   back unchanged as `startedAt`. The server rejects a submit that arrives < 2.5 s after issue,
 *   or with a missing, forged or > 2 h old token (403 verify_failed; the client re-fetches and retries).
 *
 * POST (JSON ≤ 8 KB; Origin, JSON and size are enforced by _middleware.ts)
 *   { kind: "join", locale, name, email, telegram, interest, message?, company: "", startedAt, turnstileToken? }
 *   { kind: "waitlist", locale, email, company: "", startedAt, turnstileToken? }
 * Order: honeypot → rate limit → human check (Turnstile when TURNSTILE_SECRET_KEY is set; the
 * signed minimum fill time always when Turnstile is off) → validation → D1 insert → 1% purge →
 * optional Telegram ping → 200.
 *   200 {"ok":true}  ·  400 bad_request  ·  403 verify_failed  ·  422 invalid + fields
 *   429 rate_limited + Retry-After  ·  503 unavailable (no DB binding)
 * Join rows expire after SUBMISSION_RETENTION_DAYS (180); waitlist rows after WAITLIST_RETENTION_DAYS (400).
 * Request bodies, names, emails and messages are never logged.
 */
import { numVar, DEFAULTS, type Env, type Handler } from '../_lib/env'
import { hit, maybePurge } from '../_lib/ratelimit'
import { errorResponse, json } from '../_lib/respond'
import { checkFormToken, issueFormToken } from '../_lib/session'
import { turnstileEnforced, verifyTurnstile } from '../_lib/turnstile'
import { validateJoin, type JoinSubmission } from '../_lib/validate'

const WINDOW_SEC = 600

/**
 * Waitlist rows keep their own, longer retention: the Accelerator dates are to be announced (V3-DECISIONS §2)
 * and the waitlist promises one email when applications open, so the 180-day join retention could
 * delete sign-ups before that email goes out. ~13 months; override with WAITLIST_RETENTION_DAYS.
 */
const WAITLIST_RETENTION_DAYS_DEFAULT = 400
type RetentionEnv = Env & { WAITLIST_RETENTION_DAYS?: string }

function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ route: '/api/join', ...fields }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function honeypotFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim() !== ''
  return true
}

async function pingTelegram(env: Env, s: JoinSubmission): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return
  const parts = [`New ${s.kind} submission`, `locale: ${s.locale}`]
  if (s.interest) parts.push(`interest: ${s.interest}`)
  if (s.telegram) parts.push(`telegram: ${s.telegram}`)
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: parts.join('\n'), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) log({ level: 'warn', msg: 'telegram_ping_failed', status: res.status })
  } catch {
    log({ level: 'warn', msg: 'telegram_ping_failed' })
  }
}

export const onRequest: Handler = async (context) => {
  const { request, env, data } = context
  const started = Date.now()

  if (request.method !== 'POST') {
    const res = json({ startedAt: await issueFormToken(env, started) })
    return request.method === 'HEAD' ? new Response(null, res) : res
  }

  const ip = data.ipHash ?? 'unknown'
  const done = (res: Response, outcome: string, extra: Record<string, unknown> = {}) => {
    log({ status: res.status, outcome, ms: Date.now() - started, ip: ip.slice(0, 8), ...extra })
    return res
  }

  const body = data.body
  if (!isRecord(body)) return done(errorResponse(400, 'bad_request'), 'bad_request')

  // 3. Honeypot: pretend success, store nothing.
  if (honeypotFilled(body.company)) return done(json({ ok: true }), 'honeypot')

  const db = env.DB
  if (!db) return done(errorResponse(503, 'unavailable'), 'no_db')
  const nowSec = Math.floor(started / 1000)

  // 4. Rate limit per IP hash.
  const limit = numVar(env.JOIN_PER_IP_PER_10MIN, DEFAULTS.joinPerIpPer10Min)
  const [counter] = await hit(db, [{ key: `join:ip:${ip}`, windowSec: WINDOW_SEC }], nowSec)
  if (counter.n > limit) {
    const retry = Math.max(1, counter.expiresAt - nowSec)
    return done(errorResponse(429, 'rate_limited', {}, { 'Retry-After': String(retry) }), 'rate_limited')
  }

  // 5. Human checks.
  const action = body.kind === 'waitlist' ? 'waitlist' : 'join'
  const enforced = turnstileEnforced(env)
  if (enforced && !(await verifyTurnstile(request, env, body.turnstileToken, action))) {
    return done(errorResponse(403, 'verify_failed'), 'turnstile_failed')
  }
  const fill = await checkFormToken(env, body.startedAt, started)
  if (fill !== 'ok' && !(enforced && fill === 'missing')) {
    return done(errorResponse(403, 'verify_failed'), `started_at_${fill}`)
  }

  // 6. Validation.
  const result = validateJoin(body)
  if (!result.ok) return done(errorResponse(422, 'invalid', { fields: result.fields }), 'invalid', { fields: result.fields })
  const s = result.value

  // 7. Insert (a duplicate waitlist email is ignored and still succeeds).
  const retentionDays =
    s.kind === 'waitlist'
      ? numVar((env as RetentionEnv).WAITLIST_RETENTION_DAYS, WAITLIST_RETENTION_DAYS_DEFAULT)
      : numVar(env.SUBMISSION_RETENTION_DAYS, DEFAULTS.retentionDays)
  const insert = await db
    .prepare(
      `INSERT OR IGNORE INTO submissions (id, kind, created_at, expires_at, locale, name, email, telegram, interest, message)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
    .bind(
      crypto.randomUUID(),
      s.kind,
      nowSec,
      nowSec + Math.round(retentionDays * 86400),
      s.locale,
      s.name,
      s.email,
      s.telegram,
      s.interest,
      s.message,
    )
    .run()
  const inserted = (insert.meta?.changes ?? 0) > 0

  // 8. Opportunistic purge.  9. Optional ping (kind, locale, interest and Telegram handle only).
  maybePurge(db, nowSec, (p) => context.waitUntil(p))
  if (inserted) context.waitUntil(pingTelegram(env, s))

  // 10.
  return done(json({ ok: true }), inserted ? 'stored' : 'duplicate', { kind: s.kind })
}
