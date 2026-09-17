// AUDIT 2: CPU of the per-request Handbook retrieval in /api/ask (BM25F search + context selection / offline answer).
//   node perf/v3.1/scripts/audit-search-bench.mjs
import { dirname as __dn, resolve as __rs } from 'node:path'
import { fileURLToPath as __fu } from 'node:url'
const __root = __rs(__dn(__fu(import.meta.url)), '../../..').split(String.fromCharCode(92)).join('/')
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
const root = __root + '/'
const t0 = performance.now()
const raw = readFileSync(root + 'functions/_generated/handbook-index.json', 'utf8')
const index = JSON.parse(raw)
const tParse = performance.now() - t0
const hs = await import('file:///' + root + 'shared/handbookSearch.ts')
const qs = ['How do I join QairuHub and is it free?', 'What is the Accelerator and when does it start?', 'Қалай қосыламын?', 'Who runs QairuHub', 'hackathon', 'Can I mentor students at QairuHub if I work at a company in Almaty and have 10 years of experience in ML?']
// warm
for (let i = 0; i < 50; i++) for (const q of qs) { const r = hs.search(index, q, {}); hs.selectContext(index, r, q, { topK: 5, minScore: 0.8, contextChars: 9000 }); hs.answerOffline(index, q, { locale: 'en', minScore: 0.8 }) }
const res = {}
for (const q of qs) {
  const N = 200
  let a = performance.now()
  for (let i = 0; i < N; i++) { const r = hs.search(index, q, {}); hs.selectContext(index, r, q, { topK: 5, minScore: 0.8, contextChars: 9000 }) }
  const aiPath = (performance.now() - a) / N
  a = performance.now()
  for (let i = 0; i < N; i++) hs.answerOffline(index, q, { locale: 'en', minScore: 0.8 })
  const offline = (performance.now() - a) / N
  res[q.slice(0, 40)] = { aiPathMs: +aiPath.toFixed(3), offlineMs: +offline.toFixed(3) }
}
// cold (first call in a fresh "isolate" approximated by the first call after parse)
console.log(JSON.stringify({ jsonBytes: raw.length, jsonParseMs: +tParse.toFixed(2), perQuery: res }, null, 1))
