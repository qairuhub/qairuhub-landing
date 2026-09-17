// AUDIT 2: SSE framing overhead of /api/ask deltas (one event per released PII-filter chunk) vs ~50 ms coalescing.
//   node perf/v3.1/scripts/audit-sse-framing.mjs
import { dirname as __dn, resolve as __rs } from 'node:path'
import { fileURLToPath as __fu } from 'node:url'
const __root = __rs(__dn(__fu(import.meta.url)), '../../..').split(String.fromCharCode(92)).join('/')
import { pathToFileURL as __pu } from 'node:url'
import { brotliCompressSync } from 'node:zlib'
const { PiiFilter } = await import(__pu(__root + '/functions/_lib/piiFilter.ts').href)
const para = 'QairuHub runs free events in Astana: hackathons, workshops and Demo Day. Join on the platform, pick a project and ship it with a team; the Handbook explains how. '
const text = para.repeat(20).slice(0, 2400) // ~600 tokens
const tokens = text.match(/.{1,4}/gs)
const frame = (t) => `event: delta\ndata: ${JSON.stringify({ t })}\n\n`
// current: one release per upstream delta
const pii = new PiiFilter()
let events = 0, bytes = 0, body = ''
for (const tok of tokens) { const out = pii.push(tok); if (out) { events++; const f = frame(out); bytes += f.length; body += f } }
const rest = pii.flush(); if (rest) { events++; body += frame(rest); bytes += frame(rest).length }
// coalesced: flush every 5 upstream tokens (~50 ms at ~100 tok/s)
const pii2 = new PiiFilter(); let ev2 = 0, bytes2 = 0, acc = '', body2 = ''
tokens.forEach((tok, i) => { acc += pii2.push(tok); if ((i + 1) % 5 === 0 && acc) { ev2++; body2 += frame(acc); acc = '' } })
acc += pii2.flush(); if (acc) { ev2++; body2 += frame(acc) }
bytes2 = body2.length
console.log(JSON.stringify({ textChars: text.length, upstreamDeltas: tokens.length, current: { events, bytes, br: brotliCompressSync(body).length }, coalesced50ms: { events: ev2, bytes: bytes2, br: brotliCompressSync(body2).length } }))
