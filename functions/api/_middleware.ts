/**
 * Middleware for every /api/* request (V3-BUILD-PLAN §2, §WP4).
 *
 * Lives in functions/api/ rather than functions/ on purpose: Pages derives `_routes.json` from the
 * Functions tree, and a root `_middleware.ts` would route every static asset through Functions
 * ("/*"). Scoped here, only /api/* invokes Functions; HTML, JS and fonts stay free static assets.
 *
 * - known routes and methods only (404 / 405 JSON otherwise)
 * - POST: Origin allowlist (403 `origin`), JSON-only (415), body cap (413 `too_long`), JSON parse (400)
 * - hands the parsed body and the salted IP hash to handlers in `context.data`
 * - security headers on every response, `Cache-Control: no-store` unless the handler set one,
 *   and never an `Access-Control-Allow-Origin`
 * - unhandled errors become 500 `failed`; logs carry the route and error name only, never bodies
 */
import { type Env, type RequestData } from '../_lib/env'
import { isAllowedOrigin } from '../_lib/origin'
import { errorResponse, methodNotAllowed } from '../_lib/respond'
import { ipHash } from '../_lib/session'

interface RouteRule {
  methods: string[]
  /** max request body in bytes (POST) */
  bodyCap: number
}

const ROUTES: Record<string, RouteRule> = {
  '/api/ask': { methods: ['POST'], bodyCap: 16 * 1024 },
  '/api/join': { methods: ['GET', 'HEAD', 'POST'], bodyCap: 8 * 1024 },
  '/api/config': { methods: ['GET', 'HEAD'], bodyCap: 0 },
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Cross-Origin-Resource-Policy': 'same-origin',
}

class BodyTooLarge extends Error {}

async function readCapped(request: Request, cap: number): Promise<string> {
  const declared = Number(request.headers.get('Content-Length') ?? '')
  if (Number.isFinite(declared) && declared > cap) throw new BodyTooLarge()
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > cap) {
      await reader.cancel().catch(() => undefined)
      throw new BodyTooLarge()
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    bytes.set(c, offset)
    offset += c.byteLength
  }
  return new TextDecoder().decode(bytes)
}

async function guard(context: EventContext<Env, string, RequestData>, path: string): Promise<Response> {
  const { request, env } = context
  const rule = ROUTES[path]
  if (!rule) return errorResponse(404, 'not_found')
  if (!rule.methods.includes(request.method)) return methodNotAllowed(rule.methods.join(', '))

  const origin = request.headers.get('Origin')
  if (request.method === 'POST') {
    if (!isAllowedOrigin(origin, request, env)) return errorResponse(403, 'origin')
    const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase()
    if (type !== 'application/json') return errorResponse(415, 'bad_request')
    let raw: string
    try {
      raw = await readCapped(request, rule.bodyCap)
    } catch (err) {
      if (err instanceof BodyTooLarge) return errorResponse(413, 'too_long')
      return errorResponse(400, 'bad_request')
    }
    try {
      context.data.body = JSON.parse(raw) as unknown
    } catch {
      return errorResponse(400, 'bad_request')
    }
  } else if (origin && !isAllowedOrigin(origin, request, env)) {
    // Cross-site GETs could not read the response anyway (no CORS); refuse them explicitly.
    return errorResponse(403, 'origin')
  }

  context.data.ipHash = await ipHash(request, env)
  return context.next()
}

export const onRequest: PagesFunction<Env, string, RequestData> = async (context) => {
  const path = new URL(context.request.url).pathname.replace(/\/+$/, '')
  let response: Response
  try {
    response = await guard(context, path)
  } catch (err) {
    console.error(
      JSON.stringify({ level: 'error', route: path, msg: 'unhandled', error: err instanceof Error ? err.name : 'unknown' }),
    )
    response = errorResponse(500, 'failed')
  }
  const out = new Response(response.body, response)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) out.headers.set(name, value)
  if (!out.headers.has('Cache-Control')) out.headers.set('Cache-Control', 'no-store')
  out.headers.delete('Access-Control-Allow-Origin')
  return out
}
