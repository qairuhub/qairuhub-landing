/**
 * Origin allowlist (AGENT-SPEC §6). No CORS: the site calls its API same-origin, and no
 * `Access-Control-Allow-Origin` header is ever sent.
 *
 * Allowed:
 *   - every origin in ALLOWED_ORIGINS (comma-separated) and SITE_ORIGIN
 *   - preview deployments: any https subdomain of an allowed *.pages.dev origin
 *   - the request's own origin (a custom domain serving this project)
 *   - http://localhost / 127.0.0.1 on any port, but only while the Function itself runs on localhost
 */
import { DEFAULTS, type Env } from './env'

function allowedOrigins(env: Env): URL[] {
  const list = `${env.ALLOWED_ORIGINS ?? ''},${env.SITE_ORIGIN ?? DEFAULTS.siteOrigin}`
  const out: URL[] = []
  for (const raw of list.split(',')) {
    const value = raw.trim()
    if (!value) continue
    try {
      out.push(new URL(value))
    } catch {
      /* ignore malformed entries */
    }
  }
  return out
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function isAllowedOrigin(origin: string | null, request: Request, env: Env): boolean {
  if (!origin) return false
  let o: URL
  try {
    o = new URL(origin)
  } catch {
    return false
  }
  if (o.origin !== origin) return false // no paths, credentials or trailing junk
  const self = new URL(request.url)
  if (o.origin === self.origin) return true
  if (LOCAL_HOSTS.has(self.hostname)) return o.protocol === 'http:' && LOCAL_HOSTS.has(o.hostname)
  if (o.protocol !== 'https:') return false
  for (const a of allowedOrigins(env)) {
    if (a.origin === o.origin) return true
    if (a.hostname.endsWith('.pages.dev') && o.hostname.endsWith(`.${a.hostname}`)) return true
  }
  return false
}

/** Hostnames a Turnstile token may be issued for (siteverify `hostname`). */
export function allowedHostnames(request: Request, env: Env): { exact: Set<string>; suffixes: string[] } {
  const self = new URL(request.url).hostname
  const exact = new Set<string>([self, ...(LOCAL_HOSTS.has(self) ? LOCAL_HOSTS : [])])
  const suffixes: string[] = []
  for (const a of allowedOrigins(env)) {
    exact.add(a.hostname)
    if (a.hostname.endsWith('.pages.dev')) suffixes.push(`.${a.hostname}`)
  }
  return { exact, suffixes }
}
