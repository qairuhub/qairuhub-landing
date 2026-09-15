/**
 * OpenAI Responses API access (AGENT-SPEC §5.3, DECISIONS §5). Resolution order:
 *   1. env.EDGE: the internal `qairuhub-edge` Worker (service binding). It holds the key from the
 *      Secrets Store, adds Authorization and streams OpenAI's response back unchanged.
 *   2. env.OPENAI_API_KEY: a Pages secret, direct call to OPENAI_BASE_URL.
 *   3. neither: offline mode (`no_key`).
 * Nothing in the Pages project touches the Secrets Store directly.
 */
import { DEFAULTS, numVar, strVar, type Env } from './env'

export type UpstreamKind = 'edge' | 'key'

export function upstreamKind(env: Env): UpstreamKind | null {
  if (env.EDGE) return 'edge'
  if (env.OPENAI_API_KEY) return 'key'
  return null
}

export interface ResponsesRequest {
  model: string
  instructions: string
  input: Array<{ role: 'user' | 'assistant' | 'developer'; content: string }>
  max_output_tokens: number
  reasoning?: { effort: string }
  text?: { verbosity: 'low' | 'medium' | 'high' }
  stream: true
  store: false
  safety_identifier?: string
}

export function buildRequest(
  env: Env,
  parts: Pick<ResponsesRequest, 'instructions' | 'input'> & { safetyIdentifier: string },
): ResponsesRequest {
  const effort = strVar(env.OPENAI_REASONING_EFFORT, DEFAULTS.reasoningEffort)
  return {
    model: strVar(env.OPENAI_MODEL, DEFAULTS.model),
    instructions: parts.instructions,
    input: parts.input,
    max_output_tokens: numVar(env.OPENAI_MAX_OUTPUT_TOKENS, DEFAULTS.maxOutputTokens),
    reasoning: { effort },
    text: { verbosity: 'low' },
    stream: true,
    store: false,
    safety_identifier: parts.safetyIdentifier,
  }
}

/** POST /responses through the edge Worker or with the Pages secret. Throws on network errors. */
export async function postResponses(env: Env, body: ResponsesRequest, signal: AbortSignal): Promise<Response> {
  const payload = JSON.stringify(body)
  if (env.EDGE) {
    return env.EDGE.fetch('https://edge/openai/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: payload,
      signal,
    })
  }
  if (env.OPENAI_API_KEY) {
    const base = strVar(env.OPENAI_BASE_URL, DEFAULTS.baseUrl).replace(/\/+$/, '')
    return fetch(`${base}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: payload,
      signal,
    })
  }
  throw new Error('no_upstream')
}

/**
 * When a 400 names an optional parameter (`text.verbosity`, `safety_identifier`), returns a copy of
 * the request without it so the caller can retry once. Otherwise null.
 */
export async function withoutRejectedParams(res: Response, body: ResponsesRequest): Promise<ResponsesRequest | null> {
  if (res.status !== 400) return null
  let detail = ''
  try {
    const data = (await res.clone().json()) as { error?: { param?: string; message?: string } }
    detail = `${data.error?.param ?? ''} ${data.error?.message ?? ''}`
  } catch {
    return null
  }
  const next: ResponsesRequest = { ...body }
  let changed = false
  if (/verbosity/.test(detail) && next.text) {
    delete next.text
    changed = true
  }
  if (/safety_identifier/.test(detail) && next.safety_identifier) {
    delete next.safety_identifier
    changed = true
  }
  if (/reasoning/.test(detail) && next.reasoning) {
    delete next.reasoning
    changed = true
  }
  return changed ? next : null
}
