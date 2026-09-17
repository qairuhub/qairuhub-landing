// API / CDN header probe for perf/v3.1/baseline-api.md.
//
//   node perf/v3.1/scripts/api-probe.mjs local [base]      default base http://127.0.0.1:8793
//   node perf/v3.1/scripts/api-probe.mjs prod               GET/HEAD only, via --resolve to a reachable CF IP
//
// Local mode expects `npx wrangler pages dev dist --port 8793 --persist-to perf/v3.1/scripts/.wrangler
// --binding ASK_ENABLED=false` (the EDGE service binding is "not connected", so /api/ask can only
// answer offline and nothing reaches OpenAI). It writes counters in the isolated local D1 only and
// never creates a submissions row (every POST /api/join here fails before the INSERT).
// Prod mode never POSTs and never touches /api/ask or /api/join.
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { gzipSync, brotliCompressSync, constants } from 'node:zlib'

const mode = process.argv[2] ?? 'local'
const base = mode === 'prod' ? 'https://qairuhub.com' : (process.argv[3] ?? 'http://127.0.0.1:8793')
const RESOLVE = ['--resolve', 'qairuhub.com:443:188.114.97.1', '--resolve', 'www.qairuhub.com:443:188.114.97.1']
const ORIGIN = mode === 'prod' ? 'https://qairuhub.com' : base
const KEEP = [
  'content-type', 'content-length', 'content-encoding', 'cache-control', 'etag', 'last-modified', 'vary',
  'cf-cache-status', 'age', 'access-control-allow-origin', 'access-control-allow-methods', 'allow', 'retry-after',
  'set-cookie', 'x-content-type-options', 'content-security-policy', 'cross-origin-resource-policy', 'x-accel-buffering',
  'transfer-encoding', 'location', 'server-timing', 'alt-svc',
]

function curl({ method = 'GET', path, headers = {}, body }) {
  const args = ['-s', '-S', '-o', '-', '-D', '-', '-X', method, '--max-time', '20', '-w', '\n@@TIME %{time_total} %{time_starttransfer} %{size_download}']
  if (method === 'HEAD') args.splice(args.indexOf('-X'), 2, '-I')
  if (mode === 'prod') args.push(...RESOLVE)
  // no --compressed: curl keeps the encoded bytes, so size_download is the wire size
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`)
  if (body !== undefined) args.push('--data-binary', '@-')
  args.push(base + path)
  const r = spawnSync('curl', args, { input: body, encoding: 'latin1', maxBuffer: 64 * 1024 * 1024 })
  const out = r.stdout ?? ''
  const timeIdx = out.lastIndexOf('\n@@TIME ')
  const [total, ttfb, size] = out.slice(timeIdx + 8).trim().split(' ').map(Number)
  const payload = out.slice(0, timeIdx)
  const split = payload.indexOf('\r\n\r\n')
  const head = payload.slice(0, split)
  const bodyText = payload.slice(split + 4)
  const lines = head.split('\r\n')
  const status = Number(lines[0].split(' ')[1])
  const h = {}
  for (const l of lines.slice(1)) {
    const i = l.indexOf(':')
    const k = l.slice(0, i).trim().toLowerCase()
    if (KEEP.includes(k)) h[k] = h[k] ? `${h[k]} | ${l.slice(i + 1).trim()}` : l.slice(i + 1).trim()
  }
  return { status, headers: h, body: bodyText, wireBytes: size, ms: Math.round(total * 1000), ttfbMs: Math.round(ttfb * 1000), err: r.stderr?.trim() || undefined }
}

const rows = []
function probe(name, req, note = '') {
  const res = curl(req)
  const shown = res.body.length <= 200 && !/[\x00-\x08]/.test(res.body) ? res.body.replace(/\s+/g, ' ').trim() : `<${res.body.length} B>`
  rows.push({ name, method: req.method ?? 'GET', path: req.path, status: res.status, wireBytes: res.wireBytes, ms: res.ms, ttfbMs: res.ttfbMs, headers: res.headers, body: shown, note, err: res.err })
  return res
}

const AE = { 'Accept-Encoding': 'br, gzip' }
const json = (o) => JSON.stringify(o)

if (mode === 'local') {
  // --- /api/config
  probe('config GET', { path: '/api/config', headers: { ...AE, Accept: 'application/json' } })
  probe('config GET same-origin', { path: '/api/config', headers: { ...AE, Origin: ORIGIN } })
  probe('config HEAD', { method: 'HEAD', path: '/api/config', headers: AE })
  probe('config GET cross-site', { path: '/api/config', headers: { ...AE, Origin: 'https://evil.example' } })
  probe('config PUT', { method: 'PUT', path: '/api/config', headers: AE })
  probe('config GET x5 (warm)', { path: '/api/config', headers: AE })
  for (let i = 0; i < 4; i++) probe('config GET x5 (warm)', { path: '/api/config', headers: AE })
  // --- preflight
  probe('OPTIONS /api/join preflight', {
    method: 'OPTIONS', path: '/api/join',
    headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  })
  probe('OPTIONS /api/ask preflight', {
    method: 'OPTIONS', path: '/api/ask',
    headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  })
  // --- /api/join invalid bodies (none reaches the INSERT)
  probe('join GET token', { path: '/api/join', headers: AE })
  probe('join POST no Origin', { method: 'POST', path: '/api/join', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  probe('join POST cross-site Origin', { method: 'POST', path: '/api/join', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' })
  probe('join POST text/plain', { method: 'POST', path: '/api/join', headers: { Origin: ORIGIN, 'Content-Type': 'text/plain' }, body: '{}' })
  probe('join POST bad JSON', { method: 'POST', path: '/api/join', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{nope' })
  probe('join POST 9 KB body', { method: 'POST', path: '/api/join', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: json({ message: 'x'.repeat(9000) }) })
  probe('join POST array body', { method: 'POST', path: '/api/join', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '[]' })
  probe('join POST honeypot', { method: 'POST', path: '/api/join', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: json({ kind: 'join', company: 'bot' }) }, 'fake 200, nothing stored, no D1 call')
  probe('join POST no startedAt', { method: 'POST', path: '/api/join', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: json({ kind: 'waitlist', locale: 'en', email: 'not-an-email', company: '' }) }, '1 D1 counter write, then 403')
  // valid token, > 2.5 s old, invalid fields → 422 (validation precedes the INSERT)
  const tok = JSON.parse(curl({ path: '/api/join' }).body).startedAt
  await new Promise((r) => setTimeout(r, 2700))
  probe('join POST invalid fields', {
    method: 'POST', path: '/api/join', headers: { ...AE, Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: json({ kind: 'join', locale: 'en', name: '', email: 'nope', telegram: '', interest: 'zzz', company: '', startedAt: tok }),
  }, 'counter write + HMAC check, then 422 before INSERT')
  // --- /api/ask offline (ASK_ENABLED=false, EDGE not connected): SSE headers + size
  probe('ask POST offline SSE', {
    method: 'POST', path: '/api/ask', headers: { ...AE, Origin: ORIGIN, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: json({ question: 'How do I join QairuHub and is it free?', history: [], locale: 'en' }),
  }, 'offline answer (reason disabled); no upstream possible')
  probe('ask POST bad body', { method: 'POST', path: '/api/ask', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: json({ question: '' }) })
  probe('ask GET', { path: '/api/ask', headers: AE })
  probe('unknown /api/nope', { path: '/api/nope', headers: AE })
}

// --- static (both modes)
const assets = (await import('node:fs')).readdirSync('dist/assets')
const pick = (re) => '/assets/' + assets.find((f) => re.test(f))
probe('HTML /', { path: '/', headers: AE })
probe('HTML /members', { path: '/members', headers: AE })
probe('HTML /kk/', { path: '/kk/', headers: AE })
probe('HTML /handbook', { path: '/handbook', headers: AE })
probe('asset three.js', { path: pick(/^three-.*\.js$/), headers: AE })
probe('asset index.css', { path: pick(/^index-.*\.css$/), headers: AE })
probe('handbook-index.json', { path: '/handbook-index.json', headers: AE })
const hb = curl({ path: '/handbook-index.json', headers: AE })
if (hb.headers.etag) probe('handbook-index.json If-None-Match', { path: '/handbook-index.json', headers: { ...AE, 'If-None-Match': hb.headers.etag } })
probe('font Courgette TTF', { path: '/fonts/Courgette-Regular.ttf', headers: AE })
probe('font Inter woff2', { path: '/fonts/Inter-latin.woff2', headers: AE })
if (mode === 'prod') {
  probe('config GET (prod)', { path: '/api/config', headers: { ...AE, Accept: 'application/json' } })
  probe('config GET (prod, 2nd)', { path: '/api/config', headers: { ...AE, Accept: 'application/json' } })
  probe('robots.txt', { path: '/robots.txt', headers: AE })
}

// --- compression potential of the payloads we control
const sizes = {}
const idx = (await import('node:fs')).readFileSync('dist/handbook-index.json')
const ask = rows.find((r) => r.name === 'ask POST offline SSE')
for (const [name, buf] of Object.entries({ 'handbook-index.json': idx })) {
  sizes[name] = { raw: buf.length, gzip6: gzipSync(buf, { level: 6 }).length, br5: brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length, br11: brotliCompressSync(buf).length }
}
for (const f of ['Courgette-Regular.ttf', 'DancingScript-Variable.ttf']) {
  const buf = (await import('node:fs')).readFileSync(`dist/fonts/${f}`)
  sizes[f] = { raw: buf.length, gzip6: gzipSync(buf, { level: 6 }).length, br11: brotliCompressSync(buf).length }
}

const out = { mode, base, at: new Date().toISOString(), rows, sizes, askOfflineWire: ask?.wireBytes }
const file = `perf/v3.1/scripts/api-probe-${mode}.json`
writeFileSync(file, JSON.stringify(out, null, 2))
for (const r of rows) {
  console.log(`${r.status}\t${r.wireBytes}B\t${r.ms}ms\t${r.method} ${r.path}\t${r.name}`)
  console.log(`\t${Object.entries(r.headers).map(([k, v]) => `${k}: ${v.length > 90 ? v.slice(0, 90) + '…' : v}`).join('\n\t')}`)
  if (r.body) console.log(`\tbody: ${r.body}`)
  if (r.err) console.log(`\terr: ${r.err}`)
}
console.log(JSON.stringify(sizes, null, 1))
console.log('wrote', file)
