// AUDIT 2 probe: API + CDN caching / compression headers (perf/v3.1/audit-api-deps.md).
//
//   node perf/v3.1/scripts/audit-api-probe.mjs local [base]   default base http://127.0.0.1:8802
//   node perf/v3.1/scripts/audit-api-probe.mjs prod           GET/HEAD only, curl --resolve to 188.114.97.1
//
// Local mode expects (from the repo root, background):
//   npx wrangler pages dev dist --port 8802 --persist-to perf/v3.1/scripts/.wrangler --binding ASK_ENABLED=false
// ASK_ENABLED=false + no OPENAI_API_KEY + the EDGE binding "not connected" => /api/ask can only answer
// offline; nothing can reach OpenAI. Counters are written to the isolated local D1 only, and no
// submissions row is ever created (every POST /api/join here stops before the INSERT).
// Prod mode never POSTs and never requests /api/ask or POST /api/join (GET/HEAD of static files and
// GET /api/config only).
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const mode = process.argv[2] ?? 'local'
const prod = mode === 'prod'
const base = prod ? 'https://qairuhub.com' : (process.argv[3] ?? 'http://127.0.0.1:8802')
const RESOLVE = ['--resolve', 'qairuhub.com:443:188.114.97.1']
const ORIGIN = prod ? 'https://qairuhub.com' : base
const KEEP = [
  'content-type', 'content-length', 'content-encoding', 'cache-control', 'etag', 'last-modified', 'vary',
  'cf-cache-status', 'age', 'allow', 'retry-after', 'set-cookie', 'x-accel-buffering', 'transfer-encoding',
  'location', 'server-timing', 'alt-svc', 'link', 'server', 'cf-ray', 'content-security-policy',
]

function curl({ method = 'GET', path, headers = {}, body, http = [] }) {
  const args = ['-s', '-S', '-o', '-', '-D', '-', '-X', method, '--max-time', '25', ...http,
    '-w', '\n@@TIME %{time_total} %{time_starttransfer} %{size_download} %{http_version}']
  if (method === 'HEAD') args.splice(args.indexOf('-X'), 2, '-I')
  if (prod) args.push(...RESOLVE)
  // no --compressed: size_download is then the encoded (wire) size
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`)
  if (body !== undefined) args.push('--data-binary', '@-')
  args.push(base + path)
  const r = spawnSync('curl', args, { input: body, encoding: 'latin1', maxBuffer: 64 * 1024 * 1024 })
  const out = r.stdout ?? ''
  const timeIdx = out.lastIndexOf('\n@@TIME ')
  const [total, ttfb, size, httpVersion] = out.slice(timeIdx + 8).trim().split(' ')
  const payload = out.slice(0, timeIdx)
  // skip any 1xx (103 Early Hints) blocks
  let rest = payload
  let head = ''
  for (;;) {
    const split = rest.indexOf('\r\n\r\n')
    head = rest.slice(0, split)
    rest = rest.slice(split + 4)
    if (!/^HTTP\/[\d.]+ 1\d\d/.test(head)) break
  }
  const lines = head.split('\r\n')
  const status = Number(lines[0]?.split(' ')[1])
  const h = {}
  for (const l of lines.slice(1)) {
    const i = l.indexOf(':')
    const k = l.slice(0, i).trim().toLowerCase()
    if (KEEP.includes(k)) h[k] = h[k] ? `${h[k]} | ${l.slice(i + 1).trim()}` : l.slice(i + 1).trim()
  }
  const earlyHints = payload.includes('HTTP/2 103') || payload.includes('HTTP/1.1 103') || /HTTP\/3 103/.test(payload)
  return {
    status, headers: h, body: rest, wireBytes: Number(size), ms: Math.round(Number(total) * 1000),
    ttfbMs: Math.round(Number(ttfb) * 1000), http: httpVersion, earlyHints, err: r.stderr?.trim() || undefined,
  }
}

const rows = []
function probe(name, req, note = '') {
  const res = curl(req)
  const shown = res.body.length <= 160 && !/[\x00-\x08]/.test(res.body) ? res.body.replace(/\s+/g, ' ').trim() : `<${res.body.length} B>`
  const { ['content-security-policy']: csp, ...headers } = res.headers
  rows.push({ name, method: req.method ?? 'GET', path: req.path, status: res.status, wireBytes: res.wireBytes, ms: res.ms, ttfbMs: res.ttfbMs, http: res.http, earlyHints: res.earlyHints, headers, csp: csp ? csp.slice(0, 60) + '…' : undefined, body: shown, note, err: res.err })
  return res
}

const AE = { 'Accept-Encoding': 'br, gzip' }
const json = (o) => JSON.stringify(o)
const assets = readdirSync('dist/assets')
const pick = (re) => '/assets/' + assets.find((f) => re.test(f))

/* ---------------------------------------------------------------- API (local: everything; prod: GET config only) */
probe('config GET', { path: '/api/config', headers: { ...AE, Accept: 'application/json' } }, 'cacheable? (client fetches with cache:no-store)')
probe('config GET (2nd)', { path: '/api/config', headers: { ...AE, Accept: 'application/json' } }, 'cf-cache-status would show an edge hit')
probe('config HEAD', { method: 'HEAD', path: '/api/config', headers: AE })
if (!prod) {
  probe('config GET cross-site', { path: '/api/config', headers: { ...AE, Origin: 'https://evil.example' } })
  probe('join GET token', { path: '/api/join', headers: AE }, 'HMAC only, no D1')
  probe('join POST honeypot', { method: 'POST', path: '/api/join', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: json({ kind: 'join', company: 'bot' }) }, 'fake 200, nothing stored, no D1 call')
  probe('join POST no startedAt', { method: 'POST', path: '/api/join', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: json({ kind: 'waitlist', locale: 'en', email: 'not-an-email', company: '' }) }, '1 D1 batch (counter), then 403 before INSERT')
  const askBody = json({ question: 'How do I join QairuHub and is it free?', history: [], locale: 'en' })
  for (let i = 0; i < 3; i++) {
    probe(`ask POST offline SSE #${i + 1}`, {
      method: 'POST', path: '/api/ask', headers: { ...AE, Origin: ORIGIN, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: askBody,
    }, 'offline answer (reason disabled): 1 D1 batch of 2 counter upserts, BM25F search, no upstream')
  }
  probe('ask POST bad body', { method: 'POST', path: '/api/ask', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: json({ question: '' }) })
}

/* ---------------------------------------------------------------- static */
probe('HTML /', { path: '/', headers: AE })
probe('HTML / (2nd, If-None-Match)', { path: '/', headers: { ...AE, 'If-None-Match': rows.at(-1).headers.etag ?? '"x"' } })
probe('HTML /kk/', { path: '/kk/', headers: AE })
probe('HTML /members', { path: '/members', headers: AE })
probe('HTML /handbook', { path: '/handbook', headers: AE })
probe('404 /nope', { path: '/nope', headers: AE })
probe('asset three.js', { path: pick(/^three-.*\.js$/), headers: AE })
probe('asset r3f.js', { path: pick(/^r3f-.*\.js$/), headers: AE })
probe('asset index.js', { path: pick(/^index-.*\.js$/), headers: AE })
probe('asset index.css', { path: pick(/^index-.*\.css$/), headers: AE })
probe('asset index.js gzip-only client', { path: pick(/^index-.*\.js$/), headers: { 'Accept-Encoding': 'gzip' } })
probe('handbook-index.json', { path: '/handbook-index.json', headers: AE })
const hb = rows.at(-1)
if (hb.headers.etag) probe('handbook-index.json If-None-Match', { path: '/handbook-index.json', headers: { ...AE, 'If-None-Match': hb.headers.etag } })
probe('sitemap.xml', { path: '/sitemap.xml', headers: AE })
probe('robots.txt', { path: '/robots.txt', headers: AE })
probe('favicon.svg', { path: '/favicon.svg', headers: AE })
probe('font Courgette TTF', { path: '/fonts/Courgette-Regular.ttf', headers: AE })
probe('font Inter-latin woff2', { path: '/fonts/Inter-latin.woff2', headers: AE })
probe('font DancingScript TTF', { path: '/fonts/DancingScript-Variable.ttf', headers: AE })
probe('asset missing hash', { path: '/assets/does-not-exist-123.js', headers: AE }, 'a stale chunk URL after a deploy')

/* ---------------------------------------------------------------- compression potential */
const sizes = {}
const sample = (name, buf) => {
  sizes[name] = {
    raw: buf.length,
    gzip6: gzipSync(buf, { level: 6 }).length,
    br4: brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }).length,
    br11: brotliCompressSync(buf).length,
  }
}
sample('handbook-index.json', readFileSync('dist/handbook-index.json'))
sample('Courgette-Regular.ttf', readFileSync('dist/fonts/Courgette-Regular.ttf'))
sample('DancingScript-Variable.ttf', readFileSync('dist/fonts/DancingScript-Variable.ttf'))
const sse = rows.find((r) => r.name.startsWith('ask POST offline SSE'))
if (sse) {
  const raw = curl({ method: 'POST', path: '/api/ask', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: json({ question: 'What is the QairuHub Accelerator?', history: [], locale: 'en' }) })
  sample('ask offline SSE body', Buffer.from(raw.body, 'latin1'))
}

const out = { mode, base, at: new Date().toISOString(), rows, sizes }
const file = `perf/v3.1/scripts/audit-api-probe-${mode}.json`
writeFileSync(file, JSON.stringify(out, null, 2))
for (const r of rows) {
  console.log(`${r.status}\t${r.wireBytes}B\t${r.ms}ms (ttfb ${r.ttfbMs})\th${r.http}${r.earlyHints ? ' +103' : ''}\t${r.method} ${r.path}\t${r.name}`)
  for (const [k, v] of Object.entries(r.headers)) console.log(`\t${k}: ${v.length > 110 ? v.slice(0, 110) + '…' : v}`)
  if (r.body && r.body.length < 170) console.log(`\tbody: ${r.body}`)
  if (r.err) console.log(`\terr: ${r.err}`)
}
console.log(JSON.stringify(sizes, null, 1))
console.log('wrote', file)
