/**
 * POST /api/ask: Q, the QairuHub assistant (AGENT-SPEC §1–§10, DECISIONS §5).
 *
 * Request (JSON ≤ 16 KB; Origin, JSON and size enforced by _middleware.ts):
 *   { question: string (1–500), history?: [{ role, content }] (≤ 6), locale: "en" | "kk", turnstileToken? }
 * Pre-stream errors: 400 bad_request · 403 origin · 403 verify_required · 413 too_long · 429 rate_limited
 * Success: 200 text/event-stream with `meta` → `delta`… → `done` (or `error` `upstream_partial`).
 *   meta: { mode: "ai" | "offline", reason?: "no_key" | "disabled" | "daily_cap" | "upstream",
 *           sources: [{ id, title, url }], book: <index version>, handbook: <index version> }
 *
 * Pipeline: session check (qh_ask cookie or Turnstile, only when TURNSTILE_SECRET_KEY is set) →
 * per-IP rate limits (D1) → BM25F retrieval over the bundled Handbook index → mode decision
 * (kill switch, upstream availability, global daily cap) → OpenAI Responses stream re-emitted as
 * SSE through the PII filter and the prompt-leak guard, or the offline Handbook answer.
 * Questions and answers are never stored or logged; logs carry mode, latency, token usage and an
 * IP-hash prefix only.
 */
import indexJson from '../_generated/handbook-index.json'
import {
  answerOffline,
  search,
  selectContext,
  type HandbookIndex,
  type HandbookSource,
} from '../../shared/handbookSearch'
import { boolVar, DEFAULTS, numVar, type Handler } from '../_lib/env'
import { LEAK_GUARD_TEXT } from '../_lib/leakGuardText'
import { buildRequest, postResponses, upstreamKind, withoutRejectedParams } from '../_lib/openai'
import { LeakGuard, PiiFilter } from '../_lib/piiFilter'
import { astanaDate, hit, maybePurge, nextAstanaMidnight } from '../_lib/ratelimit'
import { errorResponse } from '../_lib/respond'
import { askCookieHeader, hasValidAskCookie } from '../_lib/session'
import { createSse, parseEventStream, SSE_HEADERS, type SseStream } from '../_lib/sse'
import { developerMessage, SYSTEM_PROMPT } from '../_lib/systemPrompt'
import { turnstileEnforced, verifyTurnstile } from '../_lib/turnstile'
import { validateAsk, type AskInput } from '../_lib/validate'

const INDEX = indexJson as unknown as HandbookIndex
const FIRST_BYTE_TIMEOUT_MS = 12_000
const TOTAL_TIMEOUT_MS = 30_000

type OfflineReason = 'no_key' | 'disabled' | 'daily_cap' | 'upstream'

interface Usage {
  input_tokens?: number
  output_tokens?: number
  input_tokens_details?: { cached_tokens?: number }
  output_tokens_details?: { reasoning_tokens?: number }
}

function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ route: '/api/ask', ...fields }))
}

export const onRequest: Handler = async (context) => {
  const { request, env, data } = context
  const started = Date.now()
  const nowSec = Math.floor(started / 1000)
  const ip = data.ipHash ?? 'unknown'
  const reject = (res: Response, outcome: string) => {
    log({ status: res.status, outcome, ms: Date.now() - started, ip: ip.slice(0, 8) })
    return res
  }

  const parsed = validateAsk(data.body)
  if (!parsed.ok) return reject(errorResponse(parsed.status, parsed.code), parsed.code)
  const input = parsed.value

  // 2. Session: a valid qh_ask cookie, or a Turnstile token that earns one.
  const cookies: string[] = []
  if (turnstileEnforced(env) && !(await hasValidAskCookie(request, env, nowSec))) {
    if (!input.turnstileToken || !(await verifyTurnstile(request, env, input.turnstileToken, 'ask'))) {
      return reject(errorResponse(403, 'verify_required'), 'verify_required')
    }
    cookies.push(await askCookieHeader(env, nowSec))
  }

  // 3. Per-IP limits.
  const db = env.DB
  const today = astanaDate(nowSec)
  const midnight = nextAstanaMidnight(nowSec)
  if (db) {
    const [minute, day] = await hit(
      db,
      [
        { key: `ask:ipm:${ip}`, windowSec: 60 },
        { key: `ask:ipd:${ip}:${today}`, expiresAt: midnight },
      ],
      nowSec,
    )
    if (minute.n > numVar(env.ASK_PER_IP_PER_MINUTE, DEFAULTS.perIpPerMinute)) {
      const retry = String(Math.max(1, minute.expiresAt - nowSec))
      return reject(errorResponse(429, 'rate_limited', {}, { 'Retry-After': retry }), 'rate_limited_minute')
    }
    if (day.n > numVar(env.ASK_PER_IP_PER_DAY, DEFAULTS.perIpPerDay)) {
      const retry = String(Math.max(1, midnight - nowSec))
      return reject(errorResponse(429, 'rate_limited', {}, { 'Retry-After': retry }), 'rate_limited_day')
    }
    maybePurge(db, nowSec, (p) => context.waitUntil(p))
  }

  // 4. Retrieval.
  const previous = [...input.history].reverse().find((h) => h.role === 'user')?.content
  const minScore = numVar(env.ASK_MIN_SCORE, DEFAULTS.minScore)
  const results = search(INDEX, input.question, { previous })
  const selection = selectContext(INDEX, results, input.question, {
    topK: numVar(env.ASK_TOP_K, DEFAULTS.topK),
    minScore,
    contextChars: numVar(env.ASK_CONTEXT_CHARS, DEFAULTS.contextChars),
  })

  // 5. Mode.
  let reason: OfflineReason | null = null
  if (!boolVar(env.ASK_ENABLED, true)) reason = 'disabled'
  else if (!upstreamKind(env)) reason = 'no_key'
  else if (!db) reason = 'disabled' // without D1 there is no cost cap, so AI stays off
  else {
    const [global] = await hit(db, [{ key: `ask:ai:${today}`, expiresAt: midnight + 3600 }], nowSec)
    if (global.n > numVar(env.ASK_DAILY_CAP, DEFAULTS.dailyCap)) reason = 'daily_cap'
  }

  const sse = createSse()
  const headers = new Headers(SSE_HEADERS)
  for (const c of cookies) headers.append('Set-Cookie', c)

  const meta = { started, ip, previous, minScore }
  const work = reason
    ? streamOffline(sse, input, reason, meta)
    : streamAi(sse, env, input, selection.chunks, selection.sources, meta)
  context.waitUntil(
    work.catch(async (err: unknown) => {
      log({ level: 'error', msg: 'stream_failed', error: err instanceof Error ? err.name : 'unknown' })
      await sse.send('error', { code: 'upstream_partial' })
      await sse.close()
    }),
  )
  return new Response(sse.readable, { status: 200, headers })
}

interface RequestMeta {
  started: number
  ip: string
  previous?: string
  minScore: number
}

async function streamOffline(sse: SseStream, input: AskInput, reason: OfflineReason, m: RequestMeta): Promise<void> {
  const answer = answerOffline(INDEX, input.question, { locale: input.locale, previous: m.previous, minScore: m.minScore })
  await sse.send('meta', { mode: 'offline', reason, sources: answer.sources, book: INDEX.version, handbook: INDEX.version })
  await sse.send('delta', { t: answer.text })
  await sse.send('done', { mode: 'offline', reason })
  await sse.close()
  log({
    status: 200,
    mode: 'offline',
    reason,
    ms: Date.now() - m.started,
    sources: answer.sources.length,
    ip: m.ip.slice(0, 8),
  })
}

async function streamAi(
  sse: SseStream,
  env: Parameters<Handler>[0]['env'],
  input: AskInput,
  chunks: HandbookIndex['chunks'],
  sources: HandbookSource[],
  m: RequestMeta,
): Promise<void> {
  const controller = new AbortController()
  const firstByte = setTimeout(() => controller.abort(), FIRST_BYTE_TIMEOUT_MS)
  const total = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS)
  const clearTimers = () => {
    clearTimeout(firstByte)
    clearTimeout(total)
  }
  const upstream = upstreamKind(env)

  let body = buildRequest(env, {
    instructions: SYSTEM_PROMPT,
    input: [
      ...input.history,
      {
        role: 'developer',
        content: developerMessage({ today: astanaDate(Math.floor(m.started / 1000)), locale: input.locale, version: INDEX.version, chunks }),
      },
      { role: 'user', content: input.question },
    ],
    safetyIdentifier: m.ip,
  })

  const fallback = async (why: string, status?: number, reason: OfflineReason = 'upstream') => {
    clearTimers()
    log({ level: 'warn', msg: 'upstream_unavailable', why, upstream, upstreamStatus: status })
    await streamOffline(sse, input, reason, m)
  }

  let res: Response
  try {
    res = await postResponses(env, body, controller.signal)
    if (!res.ok) {
      const retry = await withoutRejectedParams(res, body)
      if (retry) {
        log({ level: 'warn', msg: 'param_retry' })
        await res.body?.cancel().catch(() => undefined)
        body = retry
        res = await postResponses(env, body, controller.signal)
      }
    }
  } catch (err) {
    return fallback(controller.signal.aborted ? 'first_byte_timeout' : err instanceof Error ? err.name : 'fetch_failed')
  }
  if (!res.ok || !res.body) {
    // The edge Worker answers 503 {"error":{"code":"no_key"}} when the Secrets Store secret is unavailable.
    let code: string | undefined
    try {
      code = res.status === 503 ? ((await res.json()) as { error?: { code?: string } }).error?.code : undefined
    } catch {
      code = undefined
    }
    await res.body?.cancel().catch(() => undefined)
    return fallback('bad_status', res.status, code === 'no_key' ? 'no_key' : 'upstream')
  }

  const pii = new PiiFilter()
  const leak = new LeakGuard(LEAK_GUARD_TEXT)
  let metaSent = false
  let forwarded = false
  let firstDeltaMs: number | undefined
  let outcome: 'completed' | 'failed' | 'incomplete' | 'error' | 'leak' | 'aborted' | 'eof' = 'eof'
  let usage: Usage | undefined

  const sendMeta = async () => {
    if (metaSent) return
    metaSent = true
    await sse.send('meta', { mode: 'ai', sources, book: INDEX.version, handbook: INDEX.version })
  }
  const forward = async (text: string): Promise<boolean> => {
    if (!text) return true
    await sendMeta()
    if (firstDeltaMs === undefined) firstDeltaMs = Date.now() - m.started
    forwarded = true
    return sse.send('delta', { t: text })
  }

  try {
    for await (const event of parseEventStream(res.body)) {
      clearTimeout(firstByte)
      const type = event.type
      if (type === 'response.output_text.delta' && typeof event.delta === 'string') {
        if (leak.push(event.delta)) {
          outcome = 'leak'
          break
        }
        if (!(await forward(pii.push(event.delta)))) {
          outcome = 'aborted'
          break
        }
      } else if (type === 'response.completed') {
        usage = (event.response as { usage?: Usage } | undefined)?.usage
        outcome = 'completed'
        break
      } else if (type === 'response.failed' || type === 'response.incomplete' || type === 'error') {
        usage = (event.response as { usage?: Usage } | undefined)?.usage
        outcome = type === 'response.failed' ? 'failed' : type === 'error' ? 'error' : 'incomplete'
        break
      }
    }
  } catch {
    outcome = controller.signal.aborted ? 'aborted' : 'error'
  } finally {
    clearTimers()
  }
  if (outcome !== 'completed') controller.abort()

  if (outcome === 'completed') {
    const rest = pii.flush()
    if (leak.finish()) outcome = 'leak'
    else {
      await forward(rest)
      await sendMeta()
      await sse.send('done', { mode: 'ai' })
    }
  }
  if (outcome !== 'completed') {
    if (outcome === 'leak') log({ level: 'warn', msg: 'leak_blocked' })
    if (!forwarded && !sse.closed) {
      await streamOffline(sse, input, 'upstream', m)
      log({ level: 'warn', msg: 'upstream_failed_before_delta', outcome, upstream })
      return
    }
    if (outcome !== 'leak') await forward(pii.flush())
    await sse.send('error', { code: 'upstream_partial' })
  }
  await sse.close()

  log({
    status: 200,
    mode: 'ai',
    upstream,
    outcome,
    ms: Date.now() - m.started,
    firstDeltaMs,
    tokens: usage
      ? {
          in: usage.input_tokens,
          cached: usage.input_tokens_details?.cached_tokens,
          out: usage.output_tokens,
          reasoning: usage.output_tokens_details?.reasoning_tokens,
        }
      : undefined,
    sources: sources.length,
    ip: m.ip.slice(0, 8),
  })
}
