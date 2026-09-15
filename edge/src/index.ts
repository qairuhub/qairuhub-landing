/**
 * qairuhub-edge: the only code that reads the OpenAI key (Cloudflare Secrets Store `chatgpt-api`).
 * DECISIONS §5. Called by the Pages Function /api/ask through the `EDGE` service binding.
 *
 *   POST /openai/responses   JSON body ≤ 64 KB → forwarded to https://api.openai.com/v1/responses
 *                            with `Authorization: Bearer <key>`; the response (usually an SSE
 *                            stream) is streamed back unchanged.
 *   anything else            404 (405 for other methods on the one path)
 *
 * No request or response bodies are ever logged, and the key never appears in a log or response.
 */

interface Env {
  OPENAI_KEY: SecretsStoreSecret
}

const PATH = '/openai/responses'
const UPSTREAM = 'https://api.openai.com/v1/responses'
const MAX_BODY_BYTES = 64 * 1024
/** Upstream headers worth passing through; everything else (cookies, org ids…) is dropped. */
const PASS_HEADERS = ['content-type', 'x-request-id', 'openai-processing-ms', 'retry-after']

function jsonError(status: number, code: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: { code } }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== PATH) return jsonError(404, 'not_found')
    if (request.method !== 'POST') return jsonError(405, 'method', { Allow: 'POST' })

    const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase()
    if (type !== 'application/json') return jsonError(415, 'bad_request')
    const declared = Number(request.headers.get('Content-Length') ?? '')
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return jsonError(413, 'too_long')
    const body = await request.arrayBuffer()
    if (body.byteLength === 0 || body.byteLength > MAX_BODY_BYTES) return jsonError(413, 'too_long')

    let key: string
    try {
      key = await env.OPENAI_KEY.get()
    } catch {
      console.error(JSON.stringify({ level: 'error', msg: 'secret_unavailable' }))
      return jsonError(503, 'no_key')
    }
    if (!key) return jsonError(503, 'no_key')

    let upstream: Response
    try {
      upstream = await fetch(UPSTREAM, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: request.headers.get('Accept') ?? 'text/event-stream',
        },
        body,
        signal: request.signal,
      })
    } catch {
      console.error(JSON.stringify({ level: 'error', msg: 'upstream_unreachable' }))
      return jsonError(502, 'upstream')
    }

    const headers = new Headers({ 'Cache-Control': 'no-store' })
    for (const name of PASS_HEADERS) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    console.log(JSON.stringify({ msg: 'forwarded', status: upstream.status }))
    return new Response(upstream.body, { status: upstream.status, headers })
  },
} satisfies ExportedHandler<Env>
