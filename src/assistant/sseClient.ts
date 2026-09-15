import type { Locale } from '../i18n/locale'
import { getTurnstileToken, preloadTurnstile } from '../lib/turnstile'
import type { AnswerMode, AnswerSource, AskErrorCode, OfflineReason } from './store'

/**
 * Client for `POST /api/ask` (AGENT-SPEC §5, §9, §11). Lazy chunk, loaded by `store.ts`.
 *
 * - `fetch` POST + a line-based SSE parser over the `ReadableStream` (EventSource cannot POST),
 *   events `meta` · `delta` · `done` · `error`.
 * - The caller's AbortSignal cancels the request and the reader at once.
 * - Turnstile: the first question of a session carries a token when a site key is configured
 *   (`getTurnstileToken('ask')`, null otherwise); a 403 `verify_required` re-runs the check and
 *   retries exactly once.
 * - Offline fallback in the browser: when the request fails at the network level, returns 404,
 *   405 or 5xx, or answers with something that is not an event stream (e.g. `pnpm dev` without
 *   Functions), the Handbook index (`/handbook-index.json`) and `shared/handbookSearch` are
 *   lazy-loaded and the same offline answer is rendered locally.
 */

export interface AskHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

export interface AskRequest {
  question: string
  history: AskHistoryItem[]
  locale: Locale
  signal: AbortSignal
  container: HTMLElement | null
}

export interface AskMeta {
  mode: AnswerMode
  reason?: OfflineReason
  sources: AnswerSource[]
}

export interface AskHandlers {
  onMeta(meta: AskMeta): void
  onDelta(text: string): void
}

export type AskOutcome = { kind: 'done' } | { kind: 'error'; code: AskErrorCode }

const ENDPOINT = '/api/ask'
const INDEX_URL = '/handbook-index.json'
const VERIFIED_KEY = 'qh.ask.verified'

class OfflineSignal extends Error {}

let verified = (() => {
  try {
    return window.sessionStorage.getItem(VERIFIED_KEY) === '1'
  } catch {
    return false
  }
})()

function markVerified() {
  if (verified) return
  verified = true
  try {
    window.sessionStorage.setItem(VERIFIED_KEY, '1')
  } catch {
    /* ignore */
  }
}

/** First-intent warm-up: the Turnstile config (and script, only when configured). */
export function warmUp(): void {
  void preloadTurnstile()
}

async function token(req: AskRequest): Promise<string | null> {
  try {
    return await getTurnstileToken('ask', { signal: req.signal, container: req.container ?? undefined })
  } catch (err) {
    if (req.signal.aborted) throw err
    return null // a failed check: let the server decide (verify_required → one retry)
  }
}

function post(req: AskRequest, turnstileToken: string | null): Promise<Response> {
  const body: Record<string, unknown> = { question: req.question, history: req.history, locale: req.locale }
  if (turnstileToken) body.turnstileToken = turnstileToken
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(body),
    signal: req.signal,
  })
}

async function errorCode(res: Response): Promise<string | undefined> {
  try {
    const data = (await res.json()) as { error?: { code?: unknown } }
    return typeof data?.error?.code === 'string' ? data.error.code : undefined
  } catch {
    return undefined
  }
}

function isSources(value: unknown): value is AnswerSource[] {
  return Array.isArray(value) && value.every((s) => s && typeof s === 'object' && typeof (s as AnswerSource).url === 'string')
}

function parseMeta(data: unknown): AskMeta {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const reasons: OfflineReason[] = ['no_key', 'disabled', 'daily_cap', 'upstream']
  return {
    mode: d.mode === 'offline' ? 'offline' : 'ai',
    reason: reasons.includes(d.reason as OfflineReason) ? (d.reason as OfflineReason) : undefined,
    sources: isSources(d.sources)
      ? d.sources.slice(0, 3).map((s) => ({ id: String(s.id ?? ''), title: String(s.title ?? ''), url: s.url }))
      : [],
  }
}

/** Reads the event stream. Throws OfflineSignal when it ends before any answer arrived. */
async function readStream(res: Response, handlers: AskHandlers, signal: AbortSignal): Promise<AskOutcome> {
  const reader = res.body!.getReader()
  const onAbort = () => void reader.cancel().catch(() => undefined)
  signal.addEventListener('abort', onAbort, { once: true })
  const decoder = new TextDecoder()
  let buffer = ''
  let event = 'message'
  let data: string[] = []
  // an object, not `let`s: the parser closure writes these and TS would keep them narrowed
  const seen: { meta: boolean; text: boolean; outcome: AskOutcome | null } = { meta: false, text: false, outcome: null }

  const dispatch = () => {
    if (!data.length) {
      event = 'message'
      return
    }
    let payload: unknown = null
    try {
      payload = JSON.parse(data.join('\n'))
    } catch {
      payload = null
    }
    const name = event
    event = 'message'
    data = []
    if (name === 'meta') {
      seen.meta = true
      handlers.onMeta(parseMeta(payload))
    } else if (name === 'delta') {
      const t = (payload as { t?: unknown } | null)?.t
      if (typeof t === 'string' && t) {
        seen.text = true
        handlers.onDelta(t)
      }
    } else if (name === 'done') {
      seen.outcome = { kind: 'done' }
    } else if (name === 'error') {
      seen.outcome = { kind: 'error', code: 'error' }
    }
  }

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        if (line === '') dispatch()
        else if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(line.startsWith('data: ') ? 6 : 5))
      }
      if (seen.outcome) break
    }
    buffer += decoder.decode()
    if (!seen.outcome && buffer.startsWith('data:')) data.push(buffer.slice(buffer.startsWith('data: ') ? 6 : 5))
    if (!seen.outcome) dispatch()
  } catch (err) {
    if (signal.aborted) throw err
    if (!seen.text) throw new OfflineSignal()
    return { kind: 'error', code: 'error' }
  } finally {
    signal.removeEventListener('abort', onAbort)
    reader.cancel().catch(() => undefined)
  }

  if (seen.outcome) return seen.outcome
  // The connection closed without `done`.
  if (!seen.meta && !seen.text) throw new OfflineSignal()
  return seen.text ? { kind: 'done' } : { kind: 'error', code: 'error' }
}

/* ------------------------------------------------------------------ browser offline fallback */

type SearchModule = typeof import('../../shared/handbookSearch')
let indexPromise: Promise<Parameters<SearchModule['answerOffline']>[0]> | null = null

function loadIndex(signal: AbortSignal) {
  if (!indexPromise) {
    indexPromise = fetch(INDEX_URL, { credentials: 'same-origin', signal }).then((res) => {
      if (!res.ok) throw new Error(`index ${res.status}`)
      return res.json()
    })
    indexPromise.catch(() => {
      indexPromise = null
    })
  }
  return indexPromise
}

async function answerLocally(req: AskRequest, handlers: AskHandlers): Promise<AskOutcome> {
  const [search, index] = await Promise.all([import('../../shared/handbookSearch'), loadIndex(req.signal)])
  if (req.signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
  const previous = [...req.history].reverse().find((h) => h.role === 'user')?.content
  const answer = search.answerOffline(index, req.question, { locale: req.locale, previous })
  handlers.onMeta({ mode: 'offline', reason: 'client', sources: answer.sources })
  handlers.onDelta(answer.text)
  return { kind: 'done' }
}

/* ------------------------------------------------------------------ entry */

export async function streamAsk(req: AskRequest, handlers: AskHandlers): Promise<AskOutcome> {
  try {
    let res = await post(req, verified ? null : await token(req))

    if (res.status === 403) {
      const code = await errorCode(res)
      if (code !== 'verify_required') return { kind: 'error', code: 'error' }
      verified = false
      res = await post(req, await token(req))
      if (res.status === 403) return { kind: 'error', code: 'error' }
    }
    if (res.status === 429) return { kind: 'error', code: 'rateLimited' }
    if (res.status === 413) return { kind: 'error', code: 'tooLong' }
    if (res.status === 404 || res.status === 405 || res.status >= 500) throw new OfflineSignal()
    if (!res.ok) return { kind: 'error', code: 'error' }
    if (!(res.headers.get('content-type') ?? '').includes('text/event-stream') || !res.body) throw new OfflineSignal()

    markVerified()
    return await readStream(res, handlers, req.signal)
  } catch (err) {
    if (req.signal.aborted) throw err
    // Network failure (TypeError), a missing API, or a stream that died before answering.
    if (err instanceof OfflineSignal || err instanceof TypeError) return answerLocally(req, handlers)
    throw err
  }
}
