/**
 * Submission client for the two forms on the page: the Join form (`#join`) and the QairuHub
 * Accelerator waitlist (`#accelerator`). Both talk to `POST /api/join` (V3-BUILD-PLAN §WP4
 * contract, `kind: "join" | "waitlist"`). Components never call the network themselves.
 *
 * Spam protection travels with every request:
 *  - `company`: the honeypot (the server answers 200 and stores nothing when it is filled);
 *  - `startedAt`: the signed minimum-fill-time token from `GET /api/join` (`v1.<issuedMs>.<sig>`,
 *    DECISIONS §5: the server rejects a submit < 2.5 s after issue or > 2 h old). `warmFormToken()`
 *    fetches it on the first interaction with a form; a human who is faster than 2.5 s just sees
 *    "Sending…" a moment longer while the request waits out the rest. A `verify_failed` answer
 *    (expired token, a stale tab) is retried once with a fresh token;
 *  - `turnstileToken`: only when `/api/config` returns a site key (src/lib/turnstile.ts).
 *
 * Both functions resolve on success and reject with `SubmitError` (or an `AbortError`
 * DOMException when `signal` aborts, like `fetch`).
 */
import type { Locale } from '../i18n/locale'
import type { InterestValue } from '../i18n/shared'
import { getTurnstileToken } from './turnstile'

export type SubmitErrorCode = 'invalid' | 'rate_limited' | 'verify_failed' | 'failed'

export class SubmitError extends Error {
  code: SubmitErrorCode
  /** Server-reported invalid fields for `invalid` (e.g. `["email"]`). */
  fields?: string[]
  /** Seconds from `Retry-After`, when the server sent one. */
  retryAfter?: number

  constructor(code: SubmitErrorCode, init: { fields?: string[]; retryAfter?: number; message?: string } = {}) {
    super(init.message ?? `Submission failed: ${code}`)
    this.name = 'SubmitError'
    this.code = code
    if (init.fields) this.fields = init.fields
    if (init.retryAfter !== undefined) this.retryAfter = init.retryAfter
  }
}

export type JoinFieldKey = 'name' | 'email' | 'telegram' | 'interest' | 'message'

export interface JoinValues {
  name: string
  email: string
  telegram: string
  /** Locale-neutral option value (CONTENT-V3 §15.3), never the visible label. */
  interest: InterestValue
  message: string
  /** Honeypot. Humans never see or fill it. */
  company: string
}

export interface JoinSubmitOptions {
  signal?: AbortSignal
  locale: Locale
  /** Inline Turnstile container, used only if Cloudflare asks for an interactive check. */
  container?: HTMLElement
  /** @deprecated Ignored: the fill time is measured from the signed token (`warmFormToken`). */
  startedAt?: number
}

export interface WaitlistSubmitOptions {
  signal?: AbortSignal
  /** Page locale. Falls back to `<html lang>` for callers that have not passed it yet. */
  locale?: Locale
  /** @deprecated Ignored: the fill time is measured from the signed token (`warmFormToken`). */
  startedAt?: number
}

/** DECISIONS §5: the server rejects anything filled in under 2.5 s. A small margin on top. */
export const MIN_FILL_MS = 2600

const ENDPOINT = '/api/join'
const REQUEST_TIMEOUT_MS = 20_000


/* ------------------------------------------------------------------ signed fill-time token */

interface FormToken {
  value: string
  /** Client `Date.now()` when the token arrived (≥ the server's issue time). */
  receivedAt: number
}

/** Refetch well before the server's 2 h limit. */
const FORM_TOKEN_REUSE_MS = 90 * 60 * 1000
let formToken: FormToken | null = null
let formTokenRequest: Promise<FormToken> | null = null

async function fetchFormToken(): Promise<FormToken> {
  const res = await fetch(ENDPOINT, { method: 'GET', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
  const body: unknown = res.ok ? await res.json().catch(() => null) : null
  const value = body && typeof body === 'object' ? (body as { startedAt?: unknown }).startedAt : undefined
  if (typeof value !== 'string' || !value) throw new SubmitError('failed', { message: `form token HTTP ${res.status}` })
  return { value, receivedAt: Date.now() }
}

/** The cached token, or a fresh one (one request at a time). */
function formTokenFor(fresh = false): Promise<FormToken> {
  if (!fresh && formToken && Date.now() - formToken.receivedAt < FORM_TOKEN_REUSE_MS) return Promise.resolve(formToken)
  if (!formTokenRequest) {
    formTokenRequest = fetchFormToken()
      .then((token) => (formToken = token))
      .finally(() => {
        formTokenRequest = null
      })
  }
  return formTokenRequest
}

/**
 * Start the minimum-fill-time clock: call on the first focus or keystroke in a form. Idempotent and
 * silent (a failure is retried at submit time). No request is made before someone uses a form.
 */
export function warmFormToken(): void {
  void formTokenFor().catch(() => {})
}

function abortError(): DOMException {
  return new DOMException('The submission was aborted.', 'AbortError')
}

export function isAbortError(err: unknown): boolean {
  return (err instanceof DOMException || err instanceof Error) && err.name === 'AbortError'
}

function pageLocale(): Locale {
  return typeof document !== 'undefined' && document.documentElement.lang === 'kk' ? 'kk' : 'en'
}

/** Resolves after `ms` (immediately when ≤ 0), or rejects early when `signal` aborts. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    if (ms <= 0) return resolve()
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(abortError())
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function turnstileToken(
  action: 'join' | 'waitlist',
  signal: AbortSignal | undefined,
  container?: HTMLElement,
): Promise<string | null> {
  try {
    return await getTurnstileToken(action, { signal, container })
  } catch (err) {
    if (isAbortError(err)) throw err
    throw new SubmitError('verify_failed')
  }
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined
}

/** POST the payload and map the `/api/join` contract onto `SubmitError` codes. */
async function post(payload: Record<string, unknown>, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw abortError()
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (err) {
    if (signal?.aborted) throw abortError()
    // Timeout or network failure.
    throw new SubmitError('failed', { message: err instanceof Error ? err.message : undefined })
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }

  let body: unknown = null
  if ((res.headers.get('content-type') ?? '').includes('application/json')) {
    try {
      body = await res.json()
    } catch {
      body = null
    }
  }

  if (res.ok && body && typeof body === 'object' && (body as { ok?: unknown }).ok === true) return

  const error =
    body && typeof body === 'object' && 'error' in body ? (body as { error?: { code?: unknown; fields?: unknown } }).error : undefined
  const code = typeof error?.code === 'string' ? error.code : ''
  const retry = Number(res.headers.get('Retry-After'))
  const retryAfter = Number.isFinite(retry) && retry > 0 ? retry : undefined

  if (res.status === 422 || code === 'invalid') {
    throw new SubmitError('invalid', { fields: asStringArray(error?.fields) })
  }
  if (res.status === 429 || code === 'rate_limited') throw new SubmitError('rate_limited', { retryAfter })
  if (code === 'verify_failed' || code === 'verify_required') throw new SubmitError('verify_failed')
  throw new SubmitError('failed', { message: `HTTP ${res.status}${code ? ` ${code}` : ''}` })
}

/** Human check + signed fill-time token, then POST; one retry with fresh tokens on `verify_failed`. */
async function send(
  action: 'join' | 'waitlist',
  payload: Record<string, unknown>,
  signal: AbortSignal | undefined,
  container?: HTMLElement,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    let token: FormToken
    let turnstile: string | null
    try {
      ;[turnstile, token] = await Promise.all([turnstileToken(action, signal, container), formTokenFor(attempt > 0)])
    } catch (err) {
      if (isAbortError(err) || err instanceof SubmitError) throw err
      throw new SubmitError('failed', { message: err instanceof Error ? err.message : undefined })
    }
    // Run out the rest of the minimum fill time, counted from the token's arrival.
    await wait(MIN_FILL_MS - (Date.now() - token.receivedAt), signal)
    try {
      await post({ ...payload, startedAt: token.value, ...(turnstile ? { turnstileToken: turnstile } : {}) }, signal)
      return
    } catch (err) {
      if (attempt === 0 && err instanceof SubmitError && err.code === 'verify_failed') continue
      throw err
    }
  }
}

/** Submit the Join form (`kind: "join"`). */
export async function submitJoin(values: JoinValues, opts: JoinSubmitOptions): Promise<void> {
  const { signal, locale, container } = opts
  await send(
    'join',
    {
      kind: 'join',
      locale,
      name: values.name.trim(),
      email: values.email.trim(),
      telegram: values.telegram.trim(),
      interest: values.interest,
      message: values.message.trim(),
      company: values.company,
    },
    signal,
    container,
  )
}

/** Subscribe an email to the QairuHub Accelerator waitlist (`kind: "waitlist"`). Duplicates resolve. */
export async function subscribeWaitlist(email: string, opts: WaitlistSubmitOptions = {}): Promise<void> {
  const { signal } = opts
  const locale = opts.locale ?? pageLocale()
  await send('waitlist', { kind: 'waitlist', locale, email: email.trim(), company: '' }, signal)
}
