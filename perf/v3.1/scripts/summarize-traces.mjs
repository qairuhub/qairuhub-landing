#!/usr/bin/env node
/**
 * Reads perf/v3.1/traces/*-analysis.json (analyze-trace.mjs) and writes
 * perf/v3.1/traces/summary.json + a markdown table on stdout:
 *   node perf/v3.1/scripts/summarize-traces.mjs
 *
 * canvas visible = end of the main-thread task that issued the first draw into the default
 * framebuffer (the compositor can only present that frame once the task has returned);
 * TBT (trace) = Σ (long task − 50 ms) for long tasks that start after FCP (no TTI cut-off).
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dir = resolve(here, '..', 'traces')
const rows = []
for (const f of readdirSync(dir).filter((x) => x.endsWith('-analysis.json')).sort()) {
  const a = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  const p = a.markers.probe ?? {}
  const fcp = p.fcp ?? a.markers.fcp
  const lts = a.longTasks
  const taskEnd = (t) => {
    if (t == null) return null
    const lt = lts.find((x) => x.start <= t && t <= x.start + x.dur)
    return Math.round(lt ? lt.start + lt.dur : t)
  }
  const blocked = (p.programs ?? []).reduce((s, x) => s + (x.blockedMs || 0), 0)
  const topBlocked = [...(p.programs ?? [])].sort((x, y) => (y.blockedMs || 0) - (x.blockedMs || 0)).slice(0, 3).map((x) => `${x.name} ${Math.round(x.blockedMs)}`)
  const lcp = p.lcp?.at(-1)
  rows.push({
    id: a.id,
    fcp: Math.round(fcp),
    lcp: lcp ? Math.round(lcp.t) : null,
    lcpEl: lcp?.el,
    ctx: p.webglContexts?.filter((t) => t < 10000),
    canvasVisible: taskEnd(p.firstScreenDraw),
    wordmarkVisible: taskEnd(p.firstWordmarkDraw),
    longTasks: lts.length,
    longMs: Math.round(lts.reduce((s, x) => s + x.dur, 0)),
    tbt: Math.round(lts.filter((x) => x.start >= fcp).reduce((s, x) => s + Math.max(0, x.dur - 50), 0)),
    maxTask: Math.round(Math.max(0, ...lts.map((x) => x.dur))),
    shaderBlocked: Math.round(blocked),
    topBlocked,
    tasks: lts.map((x) => `${Math.round(x.start)}+${Math.round(x.dur)} ${x.owners.slice(0, 3).map(([k, v]) => `${k} ${Math.round(v)}`).join(', ')}`),
    owners: a.totals.longTaskOwners.slice(0, 12),
  })
}
writeFileSync(join(dir, 'summary.json'), JSON.stringify(rows, null, 1))
console.log('| run | FCP | LCP (element) | WebGL ctx at | canvas visible | wordmark visible | long tasks (sum) | TBT from FCP | longest | shader link blocking (top) |')
console.log('|---|---:|---|---|---:|---:|---|---:|---:|---|')
for (const r of rows) {
  console.log(
    `| ${r.id} | ${r.fcp} | ${r.lcp} (${r.lcpEl}) | ${r.ctx?.join(', ')} | ${r.canvasVisible ?? '–'} | ${r.wordmarkVisible ?? '–'} | ${r.longTasks} (${r.longMs}) | ${r.tbt} | ${r.maxTask} | ${r.shaderBlocked} (${r.topBlocked.join('; ')}) |`,
  )
}
console.log('\nLong tasks per run (start+duration ms: top owners by sampled ms)')
for (const r of rows) {
  console.log(`\n${r.id}`)
  for (const t of r.tasks) console.log(`  - ${t}`)
}
