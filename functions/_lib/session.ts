/**
 * Signed, stateless tokens:
 *   - the `qh_ask` session cookie `v1.<exp>.<sig>` set after a human check (AGENT-SPEC §6)
 *   - the form `startedAt` token `v1.<issuedMs>.<sig>` from `GET /api/join`, which lets the server
 *     enforce the minimum fill time (DECISIONS §5) without trusting a client clock
 * plus the salted IP hash used for rate limits (IPv6 keyed by its /64). Raw IPs are never stored
 * or logged. Without SESSION_SIGNING_KEY / RATE_LIMIT_SALT only local requests fall back to the
 * dev constants; anywhere else a `ConfigError` is thrown and the API fails closed.
 */
import { hmacBase64Url, safeEqual, sha256Hex } from './crypto'
import { warnOnce, type Env } from './env'

const DEV_SIGNING_KEY = 'qairuhub-local-dev-signing-key-not-for-production'
const DEV_SALT = 'qairuhub-local-dev-salt-not-for-production'

export const ASK_COOKIE = 'qh_ask'
export const ASK_COOKIE_MAX_AGE = 7200
/** Minimum time between issuing a form token and submitting the form (DECISIONS §5: ≥ 2.5 s). */
export const FORM_MIN_FILL_MS = 2500
/** A form token older than this must be refreshed (the client re-fetches it). */
export const FORM_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000

/* ---------------------------------------------------------------------------------------- */
/* Secrets: dev fallbacks are for local requests only                                       */
/* ---------------------------------------------------------------------------------------- */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * A required secret is missing on a non-local request. The API fails closed rather than signing
 * with (or salting by) the development constants that live in the repo. Carries the secret's
 * name only, never a value.
 */
export class ConfigError extends Error {
  readonly secret: string
  constructor(secret: string) {
    super(`${secret} is not set`)
    this.name = 'ConfigError'
    this.secret = secret
  }
}

function isLocalRequest(request: Request): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(request.url).hostname)
  } catch {
    return false
  }
}

/**
 * Set once this isolate has served a request addressed to a local host (`wrangler pages dev`).
 * Cloudflare routes production traffic by hostname, so a deployed isolate never sets it. The
 * middleware calls `ipHash(request, env)` before any handler, which is what establishes it, so the
 * request-less signers below (`issueFormToken`, `askCookieHeader`, …) can tell dev from production.
 */
let localDevSeen = false

function missingSecret(name: string): never {
  console.error(JSON.stringify({ level: 'error', msg: 'missing_secret', name }))
  throw new ConfigError(name)
}

function signingKey(env: Env, request?: Request): string {
  if (env.SESSION_SIGNING_KEY) return env.SESSION_SIGNING_KEY
  const local = request ? isLocalRequest(request) : localDevSeen
  if (!local) missingSecret('SESSION_SIGNING_KEY')
  warnOnce('SESSION_SIGNING_KEY', 'SESSION_SIGNING_KEY is not set; using the local development key')
  return DEV_SIGNING_KEY
}

/* ---------------------------------------------------------------------------------------- */
/* Salted IP hash                                                                           */
/* ---------------------------------------------------------------------------------------- */

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/
const HEXTET = /^[0-9a-f]{1,4}$/

/**
 * The /64 prefix of an IPv6 address, e.g. `2001:db8:1:2::/64`. A single client usually controls a
 * whole /64, so limits keyed on the full address could be dodged by rotating the interface id.
 * Returns null when the input is not a well-formed IPv6 address.
 */
export function ipv6Prefix64(ip: string): string | null {
  let addr = ip.trim().toLowerCase()
  if (addr.startsWith('[') && addr.endsWith(']')) addr = addr.slice(1, -1)
  addr = addr.split('%')[0] // zone id
  const halves = addr.split('::')
  if (halves.length > 2) return null
  const groups = (part: string | undefined): string[] | null => {
    if (!part) return []
    const out = part.split(':')
    const last = out[out.length - 1]
    if (last.includes('.')) {
      // embedded IPv4 tail occupies the last two hextets
      if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(last)) return null
      out.splice(out.length - 1, 1, '0', '0')
    }
    return out.every((g) => HEXTET.test(g)) ? out : null
  }
  const head = groups(halves[0])
  const tail = halves.length === 2 ? groups(halves[1]) : []
  if (!head || !tail) return null
  let full: string[]
  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length
    if (fill < 1) return null
    full = [...head, ...Array<string>(fill).fill('0'), ...tail]
  } else {
    if (head.length !== 8) return null
    full = head
  }
  return `${full
    .slice(0, 4)
    .map((g) => parseInt(g, 16).toString(16))
    .join(':')}::/64`
}

/** The rate-limit key for a client address: IPv4 as is, IPv6 reduced to its /64. */
function rateLimitKey(ip: string): string {
  const mapped = IPV4_MAPPED.exec(ip.trim().toLowerCase())
  if (mapped) return mapped[1]
  if (!ip.includes(':')) return ip.trim()
  return ipv6Prefix64(ip) ?? ip.trim()
}

export async function ipHash(request: Request, env: Env): Promise<string> {
  const local = isLocalRequest(request)
  if (local) localDevSeen = true
  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    '0.0.0.0'
  let salt = env.RATE_LIMIT_SALT
  if (!salt) {
    if (!local) missingSecret('RATE_LIMIT_SALT')
    warnOnce('RATE_LIMIT_SALT', 'RATE_LIMIT_SALT is not set; using the local development salt')
    salt = DEV_SALT
  }
  return (await sha256Hex(`${rateLimitKey(ip)}${salt}`)).slice(0, 32)
}

/* ---------------------------------------------------------------------------------------- */
/* qh_ask cookie                                                                            */
/* ---------------------------------------------------------------------------------------- */

export async function askCookieHeader(env: Env, nowSec: number): Promise<string> {
  const exp = nowSec + ASK_COOKIE_MAX_AGE
  const sig = await hmacBase64Url(signingKey(env), `ask.v1.${exp}`)
  return `${ASK_COOKIE}=v1.${exp}.${sig}; HttpOnly; Secure; SameSite=Strict; Path=/api/ask; Max-Age=${ASK_COOKIE_MAX_AGE}`
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return null
}

export async function hasValidAskCookie(request: Request, env: Env, nowSec: number): Promise<boolean> {
  const value = readCookie(request, ASK_COOKIE)
  const m = value ? /^v1\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(value) : null
  if (!m) return false
  const exp = Number(m[1])
  if (exp <= nowSec || exp > nowSec + ASK_COOKIE_MAX_AGE + 60) return false
  const expected = await hmacBase64Url(signingKey(env, request), `ask.v1.${exp}`)
  return safeEqual(expected, m[2])
}

/* ---------------------------------------------------------------------------------------- */
/* Form startedAt token                                                                     */
/* ---------------------------------------------------------------------------------------- */

export async function issueFormToken(env: Env, nowMs: number): Promise<string> {
  const sig = await hmacBase64Url(signingKey(env), `form.v1.${nowMs}`)
  return `v1.${nowMs}.${sig}`
}

export type FormTokenCheck = 'ok' | 'missing' | 'invalid' | 'too_fast' | 'expired'

export async function checkFormToken(env: Env, token: unknown, nowMs: number): Promise<FormTokenCheck> {
  if (token === undefined || token === null || token === '') return 'missing'
  if (typeof token !== 'string') return 'invalid'
  const m = /^v1\.(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(token)
  if (!m) return 'invalid'
  const expected = await hmacBase64Url(signingKey(env), `form.v1.${m[1]}`)
  if (!safeEqual(expected, m[2])) return 'invalid'
  const age = nowMs - Number(m[1])
  if (age < FORM_MIN_FILL_MS) return 'too_fast'
  if (age > FORM_TOKEN_MAX_AGE_MS) return 'expired'
  return 'ok'
}
