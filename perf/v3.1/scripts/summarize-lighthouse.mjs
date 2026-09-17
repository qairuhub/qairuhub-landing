#!/usr/bin/env node
/**
 * Reads perf/v3.1/lighthouse/*.json (not *-smoke-*) and writes
 *   perf/v3.1/lighthouse-summary.json   (all extracted numbers per run)
 *   perf/v3.1/lighthouse-tables.md      (markdown tables, pasted into baseline-lighthouse.md)
 *   node perf/v3.1/scripts/summarize-lighthouse.mjs [--tag=]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const v31 = resolve(here, '..')
const dir = join(v31, 'lighthouse')
const tag = process.argv.find((a) => a.startsWith('--tag='))?.split('=')[1] ?? ''
const re = new RegExp(`^(home|kk|members|handbook)-(mobile|desktop)${tag.replace(/[-]/g, '\\-')}-r(\\d)\\.json$`)

const kib = (b) => (b == null ? '' : (b / 1024).toFixed(1))
const ms = (v) => (v == null ? '' : Math.round(v))
const short = (u) => String(u).replace(/^https?:\/\/[^/]+/, '')

const runs = []
for (const f of readdirSync(dir).sort()) {
  const m = f.match(re)
  if (!m) continue
  const r = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  // A crashed run (dead server, Chrome interstitial) still produced a report file: it carries a
  // `runtimeError` and a null score. `score ?? 0` below would enter it in the median as a 0 and
  // read as a catastrophic regression, so drop it and say so instead.
  if (r.runtimeError || r.categories?.performance?.score == null) {
    console.warn('skipping failed run', f, r.runtimeError?.code ?? 'no performance score')
    continue
  }
  const a = r.audits
  const items = (k) => a[k]?.details?.items ?? []
  const lcpEl = items('largest-contentful-paint-element')[0]?.items?.[0]?.node
  const lcpPhases = items('largest-contentful-paint-element')[1]?.items ?? []
  runs.push({
    file: f,
    page: m[1],
    preset: m[2],
    run: Number(m[3]),
    env: { benchmarkIndex: r.environment?.benchmarkIndex, ua: r.environment?.hostUserAgent, formFactor: r.configSettings?.formFactor, throttling: r.configSettings?.throttlingMethod },
    score: Math.round((r.categories.performance.score ?? 0) * 100),
    fcp: a['first-contentful-paint'].numericValue,
    lcp: a['largest-contentful-paint'].numericValue,
    tbt: a['total-blocking-time'].numericValue,
    cls: a['cumulative-layout-shift'].numericValue,
    si: a['speed-index'].numericValue,
    tti: a['interactive']?.numericValue,
    maxFid: a['max-potential-fid']?.numericValue,
    bytes: a['total-byte-weight'].numericValue,
    lcpElement: lcpEl ? { selector: lcpEl.selector, snippet: lcpEl.snippet, label: lcpEl.nodeLabel } : null,
    lcpPhases: lcpPhases.map((p) => ({ phase: p.phase, timing: Math.round(p.timing) })),
    bootup: items('bootup-time').map((i) => ({ url: short(i.url), total: ms(i.total), scripting: ms(i.scripting), parse: ms(i.scriptParseCompile) })),
    mainThread: items('mainthread-work-breakdown').map((i) => ({ group: i.groupLabel, ms: ms(i.duration) })),
    unusedJs: items('unused-javascript').map((i) => ({ url: short(i.url), total: i.totalBytes, wasted: i.wastedBytes })),
    unusedCss: items('unused-css-rules').map((i) => ({ url: short(i.url), total: i.totalBytes, wasted: i.wastedBytes })),
    renderBlocking: items('render-blocking-resources').map((i) => ({ url: short(i.url), bytes: i.totalBytes, wastedMs: ms(i.wastedMs) })),
    renderBlockingInsight: (a['render-blocking-insight']?.details?.items ?? []).map((i) => ({ url: short(i.url), bytes: i.totalBytes, ms: ms(i.wastedMs) })),
    fontDisplay: { score: a['font-display']?.score, items: items('font-display').map((i) => short(i.url)) },
    images: Object.fromEntries(['uses-optimized-images', 'modern-image-formats', 'offscreen-images', 'unsized-images', 'uses-responsive-images', 'image-size-responsive'].map((k) => [k, { score: a[k]?.score ?? null, n: items(k).length }])),
    longTasks: items('long-tasks').map((i) => ({ url: short(i.url), start: ms(i.startTime), dur: ms(i.duration) })),
    requests: items('network-requests').map((i) => ({ url: short(i.url), type: i.resourceType, prio: i.priority, start: ms(i.networkRequestTime ?? i.startTime), end: ms(i.networkEndTime ?? i.endTime), transfer: i.transferSize, size: i.resourceSize, status: i.statusCode })),
    consoleErrors: items('errors-in-console').map((i) => `${i.source}: ${String(i.description).slice(0, 180)}`),
    domSize: a['dom-size']?.numericValue,
    layoutShifts: items('layout-shifts').length,
    nonComposited: items('non-composited-animations').length,
    cacheTtl: a['uses-long-cache-ttl']?.score,
    textCompression: a['uses-text-compression']?.score,
    legacyJs: a['legacy-javascript']?.details?.items?.length ?? 0,
    duplicatedJs: a['duplicated-javascript']?.details?.items?.length ?? 0,
    thirdParty: items('third-party-summary').map((i) => i.entity),
  })
}
writeFileSync(join(v31, `lighthouse-summary${tag}.json`), JSON.stringify(runs, null, 1))

const med = (xs) => {
  const s = xs.filter((x) => x != null).sort((p, q) => p - q)
  if (!s.length) return null
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const out = []
const P = ['home', 'kk', 'members', 'handbook']
for (const preset of ['mobile', 'desktop']) {
  out.push(`\n### ${preset === 'mobile' ? 'Mobile (Lighthouse default: Moto G Power emulation, simulated Slow 4G, 4x CPU)' : 'Desktop (--preset=desktop: 1350x940, simulated 10 Mbps / 40 ms, 1x CPU)'}\n`)
  out.push('| page | score (runs) | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTI ms | transfer KiB | LCP element |')
  out.push('|---|---|---|---|---|---|---|---|---|---|')
  for (const p of P) {
    const rs = runs.filter((r) => r.page === p && r.preset === preset)
    if (!rs.length) continue
    const el = rs[0].lcpElement ? `\`${String(rs[0].lcpElement.selector).slice(0, 60)}\`` : 'n/a'
    out.push(
      `| ${p} | ${med(rs.map((r) => r.score))} (${rs.map((r) => r.score).join(', ')}) | ${ms(med(rs.map((r) => r.fcp)))} | ${ms(med(rs.map((r) => r.lcp)))} | ${ms(med(rs.map((r) => r.tbt)))} | ${med(rs.map((r) => r.cls))?.toFixed(3)} | ${ms(med(rs.map((r) => r.si)))} | ${ms(med(rs.map((r) => r.tti)))} | ${kib(med(rs.map((r) => r.bytes)))} | ${el} |`,
    )
  }
}

const first = (p, preset) => runs.find((r) => r.page === p && r.preset === preset && r.run === 1) ?? runs.find((r) => r.page === p && r.preset === preset)
out.push('\n### JS bootup time per script (run 1, ms: total / scripting / parse+compile)\n')
for (const preset of ['mobile', 'desktop']) {
  out.push(`\n**${preset}**\n`)
  out.push('| page | scripts |')
  out.push('|---|---|')
  for (const p of P) {
    const r = first(p, preset)
    if (!r) continue
    out.push(`| ${p} | ${r.bootup.map((b) => `${b.url.replace('/assets/', '')} ${b.total}/${b.scripting}/${b.parse}`).join('<br>')} |`)
  }
}
out.push('\n### Main-thread breakdown (run 1, ms)\n')
const groups = [...new Set(runs.flatMap((r) => r.mainThread.map((m) => m.group)))]
out.push(`| page / preset | ${groups.join(' | ')} |`)
out.push(`|---|${groups.map(() => '---').join('|')}|`)
for (const preset of ['mobile', 'desktop'])
  for (const p of P) {
    const r = first(p, preset)
    if (!r) continue
    out.push(`| ${p} ${preset} | ${groups.map((g) => r.mainThread.find((m) => m.group === g)?.ms ?? '').join(' | ')} |`)
  }
out.push('\n### Unused JS / CSS, render-blocking (run 1, mobile)\n')
out.push('| page | unused JS (url: wasted/total KiB) | unused CSS | render-blocking (insight) |')
out.push('|---|---|---|---|')
for (const p of P) {
  const r = first(p, 'mobile')
  if (!r) continue
  out.push(
    `| ${p} | ${r.unusedJs.map((u) => `${u.url.replace('/assets/', '')}: ${kib(u.wasted)}/${kib(u.total)}`).join('<br>') || 'none'} | ${r.unusedCss.map((u) => `${u.url.replace('/assets/', '')}: ${kib(u.wasted)}/${kib(u.total)}`).join('<br>') || 'none'} | ${[...r.renderBlocking, ...r.renderBlockingInsight].map((u) => `${u.url} ${kib(u.bytes)} KiB ${u.wastedMs ?? u.ms ?? ''} ms`).join('<br>') || 'none'} |`,
  )
}
out.push('\n### Long tasks (run 1)\n')
out.push('| page / preset | long tasks (url @start: duration ms) |')
out.push('|---|---|')
for (const preset of ['mobile', 'desktop'])
  for (const p of P) {
    const r = first(p, preset)
    if (!r) continue
    out.push(`| ${p} ${preset} | ${r.longTasks.map((t) => `${t.url.replace('/assets/', '') || '(page)'} @${t.start}: ${t.dur}`).join('<br>') || 'none'} |`)
  }
out.push('\n### Network requests before load settles (run 1, mobile; transfer bytes, priority)\n')
for (const p of P) {
  const r = first(p, 'mobile')
  if (!r) continue
  out.push(`\n**${p}** (${r.requests.length} requests, ${kib(r.requests.reduce((s, q) => s + (q.transfer || 0), 0))} KiB transferred)\n`)
  out.push('| start ms | type | prio | transfer KiB | url |')
  out.push('|---|---|---|---|---|')
  for (const q of r.requests) out.push(`| ${q.start} | ${q.type} | ${q.prio} | ${kib(q.transfer)} | ${q.url} |`)
}
out.push('\n### Other audits (run 1)\n')
out.push('| page / preset | font-display | image audits (score/items) | DOM nodes | layout shifts | non-composited anims | cache TTL | text compression | legacy JS | console errors |')
out.push('|---|---|---|---|---|---|---|---|---|---|')
for (const preset of ['mobile', 'desktop'])
  for (const p of P) {
    const r = first(p, preset)
    if (!r) continue
    out.push(
      `| ${p} ${preset} | ${r.fontDisplay.score} | ${Object.entries(r.images).map(([k, v]) => `${k.replace('uses-', '')}:${v.score ?? '-'}/${v.n}`).join(' ')} | ${r.domSize} | ${r.layoutShifts} | ${r.nonComposited} | ${r.cacheTtl} | ${r.textCompression} | ${r.legacyJs} | ${r.consoleErrors.length ? r.consoleErrors.join('<br>') : 'none'} |`,
    )
  }
out.push(`\nEnvironment: ${JSON.stringify(runs[0]?.env)}`)
writeFileSync(join(v31, `lighthouse-tables${tag}.md`), out.join('\n') + '\n')
console.log(out.join('\n'))
