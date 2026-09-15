/**
 * Server-sent events over a TransformStream (AGENT-SPEC §5.2): `meta`, `delta`, `done`, `error`.
 * Writes after the client has gone away resolve to `false` instead of throwing.
 */

export type SseEvent = 'meta' | 'delta' | 'done' | 'error'

export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Accel-Buffering': 'no',
}

export interface SseStream {
  readable: ReadableStream<Uint8Array>
  send(event: SseEvent, data: unknown): Promise<boolean>
  close(): Promise<void>
  /** true once a write failed (client disconnected) */
  readonly closed: boolean
}

export function createSse(): SseStream {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  let closed = false
  return {
    readable,
    get closed() {
      return closed
    },
    async send(event, data) {
      if (closed) return false
      try {
        await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        return true
      } catch {
        closed = true
        return false
      }
    },
    async close() {
      if (closed) return
      closed = true
      try {
        await writer.close()
      } catch {
        /* already errored */
      }
    },
  }
}

/**
 * Incremental parser for an upstream `text/event-stream` body. Yields the JSON of each `data:`
 * payload (multi-line data joined with "\n"); `[DONE]` and non-JSON payloads are skipped.
 */
export async function* parseEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>, void, undefined> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let data: string[] = []
  const flush = function* () {
    if (!data.length) return
    const payload = data.join('\n')
    data = []
    if (payload === '[DONE]') return
    try {
      const parsed: unknown = JSON.parse(payload)
      if (parsed && typeof parsed === 'object') yield parsed as Record<string, unknown>
    } catch {
      /* ignore */
    }
  }
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        if (line === '') yield* flush()
        else if (line.startsWith('data:')) data.push(line.slice(line.startsWith('data: ') ? 6 : 5))
      }
    }
    if (buffer.startsWith('data:')) data.push(buffer.slice(buffer.startsWith('data: ') ? 6 : 5))
    yield* flush()
  } finally {
    reader.releaseLock()
  }
}
