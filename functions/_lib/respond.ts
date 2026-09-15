/** JSON responses and the error envelope `{ "error": { "code": … } }` (AGENT-SPEC §5.2). */

export type ErrorCode =
  | 'bad_request'
  | 'origin'
  | 'method'
  | 'unsupported_media_type'
  | 'too_long'
  | 'rate_limited'
  | 'verify_required'
  | 'verify_failed'
  | 'invalid'
  | 'not_found'
  | 'unavailable'
  | 'failed'

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function errorResponse(
  status: number,
  code: ErrorCode,
  extra: Record<string, unknown> = {},
  headers: HeadersInit = {},
): Response {
  return json({ error: { code, ...extra } }, { status, headers })
}

export function methodNotAllowed(allow: string): Response {
  return errorResponse(405, 'method', {}, { Allow: allow })
}
