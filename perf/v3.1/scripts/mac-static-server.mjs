#!/usr/bin/env node
/**
 * Tiny static server for the built site (baseline measurements, no wrangler needed).
 *
 *   node perf/v3.1/scripts/mac-static-server.mjs <distDir> <port>
 *
 * Emulates what Cloudflare Pages does for this project closely enough for browser tests:
 *   - clean URLs: /members -> members.html, /kk/ -> kk/index.html, /kk/handbook -> kk/handbook.html
 *   - /kk -> 301 /kk/ (public/_redirects)
 *   - unknown paths -> 404.html (or kk/404.html under /kk/) with status 404
 *   - headers from <distDir>/_headers (the "/*" block on every response, path blocks by prefix)
 *   - /api/* -> 503 JSON (the upstream is not available locally; the UI must degrade)
 */
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const dist = resolve(process.argv[2] || 'dist')
const port = Number(process.argv[3] || 4391)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
}

/** Parse Pages' _headers: blocks of "path" followed by indented "Name: value" lines. */
function parseHeaders(file) {
  const blocks = []
  if (!existsSync(file)) return blocks
  let cur = null
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue
    if (!/^\s/.test(raw)) {
      cur = { pattern: raw.trim(), headers: {} }
      blocks.push(cur)
    } else if (cur) {
      const i = raw.indexOf(':')
      cur.headers[raw.slice(0, i).trim()] = raw.slice(i + 1).trim()
    }
  }
  return blocks
}
const headerBlocks = parseHeaders(join(dist, '_headers'))
const matches = (pattern, path) => (pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern)

function resolveFile(path) {
  const clean = decodeURIComponent(path).replace(/\/+$/, '') || ''
  const candidates = [join(dist, clean), join(dist, clean + '.html'), join(dist, clean, 'index.html')]
  for (const c of candidates) {
    if (!c.startsWith(dist)) continue
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const path = url.pathname
  const headers = {}
  for (const b of headerBlocks) if (matches(b.pattern, path)) Object.assign(headers, b.headers)
  if (path === '/kk') {
    res.writeHead(301, { Location: '/kk/' + url.search })
    return res.end()
  }
  if (path.startsWith('/api/')) {
    res.writeHead(503, { ...headers, 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'unavailable_locally' }))
  }
  let file = resolveFile(path)
  let status = 200
  if (!file) {
    status = 404
    file = join(dist, path.startsWith('/kk/') ? 'kk/404.html' : '404.html')
  }
  const body = readFileSync(file)
  res.writeHead(status, { ...headers, 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Content-Length': body.length })
  res.end(req.method === 'HEAD' ? undefined : body)
}).listen(port, '127.0.0.1', () => console.log(`static ${dist} on http://127.0.0.1:${port}`))
