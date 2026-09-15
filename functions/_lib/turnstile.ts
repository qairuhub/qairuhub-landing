/**
 * Cloudflare Turnstile siteverify (DECISIONS §5). Enforced only when TURNSTILE_SECRET_KEY is set;
 * until then the forms rely on the honeypot, the signed minimum fill time, the origin allowlist and
 * the D1 rate limits. Fails closed on network errors and timeouts.
 */
import { allowedHostnames } from './origin'
import type { Env } from './env'

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TIMEOUT_MS = 5000

export type TurnstileAction = 'join' | 'waitlist' | 'ask'

export function turnstileEnforced(env: Env): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY)
}

interface SiteverifyResponse {
  success: boolean
  action?: string
  hostname?: string
  'error-codes'?: string[]
}

export async function verifyTurnstile(
  request: Request,
  env: Env,
  token: unknown,
  action: TurnstileAction,
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (typeof token !== 'string' || !token || token.length > 2048) return false

  const form = new FormData()
  form.set('secret', secret)
  form.set('response', token)
  const ip = request.headers.get('CF-Connecting-IP')
  if (ip) form.set('remoteip', ip)
  form.set('idempotency_key', crypto.randomUUID())

  try {
    const res = await fetch(SITEVERIFY, { method: 'POST', body: form, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return false
    const data = (await res.json()) as SiteverifyResponse
    if (!data.success) return false
    if (data.action !== action) return false
    const host = data.hostname ?? ''
    const { exact, suffixes } = allowedHostnames(request, env)
    return exact.has(host) || suffixes.some((s) => host.endsWith(s))
  } catch {
    console.warn(JSON.stringify({ level: 'warn', msg: 'turnstile_unreachable' }))
    return false
  }
}
