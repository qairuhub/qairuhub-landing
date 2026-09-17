/**
 * Cloudflare Turnstile client (V3-BUILD-PLAN §WP9, DECISIONS §5).
 *
 * Runtime-configured, no rebuild: the site key comes from `GET /api/config`
 * (`{ turnstileSiteKey: string | null }`), read once and lazily. Until the key is set in
 * Cloudflare, every call resolves `null` and the server falls back to honeypot + minimum fill
 * time + origin allowlist + rate limits (it enforces Turnstile only when its secret is set).
 *
 * Nothing here runs at import time. The config request and the script
 * (`challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`) are requested only when
 *  - a form nears the viewport (`primeTurnstileNear(el)`, IntersectionObserver, 400 px margin), or
 *  - a token is actually needed (`getTurnstileToken`, e.g. on the ask input's first focus).
 *
 * Tokens are single-use, so every `getTurnstileToken` call renders a fresh managed widget
 * (`appearance: 'interaction-only'`: invisible unless Cloudflare needs a click) and removes it
 * once the token is issued.
 */

export type TurnstileAction = 'join' | 'waitlist' | 'ask'

export interface TurnstileTokenOptions {
  /** Where the widget renders if an interactive check is needed. Default: a small fixed host. */
  container?: HTMLElement
  signal?: AbortSignal
}

/** Thrown when the challenge errors, expires before completion or times out. */
export class TurnstileError extends Error {
  constructor(message = 'Turnstile verification failed') {
    super(message)
    this.name = 'TurnstileError'
  }
}

interface TurnstileRenderOptions {
  sitekey: string
  action?: string
  appearance?: 'always' | 'execute' | 'interaction-only'
  size?: 'normal' | 'flexible' | 'compact'
  theme?: 'auto' | 'light' | 'dark'
  language?: string
  'response-field'?: boolean
  'refresh-expired'?: 'auto' | 'manual' | 'never'
  retry?: 'auto' | 'never'
  callback?: (token: string) => void
  'error-callback'?: (code?: string) => boolean | void
  'expired-callback'?: () => void
  'timeout-callback'?: () => void
}

interface TurnstileApi {
  render(container: HTMLElement | string, options: TurnstileRenderOptions): string | undefined
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const CONFIG_URL = '/api/config'
/** A human who must click the checkbox still gets well over a minute. */
const TOKEN_TIMEOUT_MS = 90_000
const CONFIG_TIMEOUT_MS = 6_000

let configPromise: Promise<string | null> | null = null
let scriptPromise: Promise<TurnstileApi> | null = null

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError')
}

function buildTimeKey(): string | null {
  // Optional public build-time fallback (plan §2 `.env.production`); the runtime config wins.
  const key = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim()
  return key ? key : null
}

/**
 * The public Turnstile site key, or `null` when none is configured (or the config endpoint is
 * unreachable, e.g. `pnpm dev` without Functions). Requested at most once per page load.
 *
 * Uses the HTTP cache: the endpoint sends `max-age=300, stale-while-revalidate=600`, so repeat
 * views within 5–15 min need no request (see functions/api/config.ts for the key rollout order).
 * `/api/join` and `/api/ask` stay `no-store`.
 */
export function getTurnstileSiteKey(): Promise<string | null> {
  if (configPromise) return configPromise
  configPromise = (async () => {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return buildTimeKey()
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS)
    try {
      const res = await fetch(CONFIG_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
      })
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return buildTimeKey()
      const data: unknown = await res.json()
      const key =
        data && typeof data === 'object' && 'turnstileSiteKey' in data
          ? (data as { turnstileSiteKey: unknown }).turnstileSiteKey
          : null
      return typeof key === 'string' && key.trim() ? key.trim() : buildTimeKey()
    } catch {
      return buildTimeKey()
    } finally {
      window.clearTimeout(timer)
    }
  })()
  return configPromise
}

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new TurnstileError('Turnstile script loaded without an API'))
    }
    script.onerror = () => reject(new TurnstileError('Turnstile script failed to load'))
    document.head.appendChild(script)
  }).catch((err: unknown) => {
    // Let a later attempt retry (a flaky network on first load, say).
    scriptPromise = null
    throw err
  })
  return scriptPromise
}

/**
 * Warm up: fetch the config and, only when a site key exists, load the script. Never throws.
 * Resolves `true` when Turnstile is configured.
 */
export async function preloadTurnstile(): Promise<boolean> {
  try {
    const key = await getTurnstileSiteKey()
    if (!key) return false
    await loadScript()
    return true
  } catch {
    return false
  }
}

/**
 * Prime Turnstile once `el` comes within 400 px of the viewport (join form, waitlist input).
 * `onReady(configured)` fires after the config (and script, when configured) have loaded.
 * Returns a cleanup function, so it can be the body of a React effect.
 */
export function primeTurnstileNear(el: Element | null, onReady?: (configured: boolean) => void): () => void {
  if (!el || typeof IntersectionObserver === 'undefined') return () => {}
  let cancelled = false
  let fired = false
  const io = new IntersectionObserver(
    (entries) => {
      if (fired || !entries.some((e) => e.isIntersecting)) return
      fired = true
      io.disconnect()
      void preloadTurnstile().then((configured) => {
        if (!cancelled && onReady) onReady(configured)
      })
    },
    { rootMargin: '400px 0px' },
  )
  io.observe(el)
  return () => {
    cancelled = true
    io.disconnect()
  }
}

let floatingHost: HTMLElement | null = null

/** Fallback host for callers without a container: bottom-centre, empty (0×0) unless a check shows. */
function getFloatingHost(): HTMLElement {
  if (floatingHost && document.body.contains(floatingHost)) return floatingHost
  const host = document.createElement('div')
  host.setAttribute('data-turnstile-host', '')
  host.style.position = 'fixed'
  host.style.left = '50%'
  host.style.bottom = 'max(16px, env(safe-area-inset-bottom))'
  host.style.transform = 'translateX(-50%)'
  host.style.zIndex = '1000'
  document.body.appendChild(host)
  floatingHost = host
  return host
}

/**
 * A fresh Turnstile token for `action`, or `null` when no site key is configured.
 * Rejects with `TurnstileError` when the check fails and with an `AbortError` when `signal` aborts.
 */
export async function getTurnstileToken(
  action: TurnstileAction,
  opts: TurnstileTokenOptions = {},
): Promise<string | null> {
  const { signal } = opts
  if (signal?.aborted) throw abortError()
  const sitekey = await getTurnstileSiteKey()
  if (!sitekey) return null
  const api = await loadScript()
  if (signal?.aborted) throw abortError()

  const host = opts.container ?? getFloatingHost()
  const slot = document.createElement('div')
  host.appendChild(slot)
  // Turnstile has no Kazakh UI: KK pages let it follow the browser language ('auto').
  const language = document.documentElement.lang === 'kk' ? 'auto' : 'en'

  return new Promise<string | null>((resolve, reject) => {
    let widgetId: string | undefined
    let settled = false
    let timer = 0
    const onAbort = () => finish(() => reject(abortError()))
    function finish(settle: () => void) {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      try {
        if (widgetId) api.remove(widgetId)
      } catch {
        /* widget already gone */
      }
      slot.remove()
      settle()
    }
    timer = window.setTimeout(() => finish(() => reject(new TurnstileError('Turnstile timed out'))), TOKEN_TIMEOUT_MS)
    signal?.addEventListener('abort', onAbort, { once: true })

    try {
      widgetId = api.render(slot, {
        sitekey,
        action,
        appearance: 'interaction-only',
        size: 'flexible',
        theme: 'dark',
        language,
        'response-field': false,
        'refresh-expired': 'never',
        retry: 'never',
        callback: (token) => finish(() => resolve(token)),
        'error-callback': () => {
          finish(() => reject(new TurnstileError()))
          return true
        },
        'expired-callback': () => finish(() => reject(new TurnstileError('Turnstile token expired'))),
        'timeout-callback': () => finish(() => reject(new TurnstileError('Turnstile challenge timed out'))),
      })
    } catch {
      finish(() => reject(new TurnstileError('Turnstile failed to render')))
    }
  })
}
