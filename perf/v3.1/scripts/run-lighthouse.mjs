#!/usr/bin/env node
/**
 * Baseline Lighthouse 12 runs against the local `wrangler pages dev dist --port 8791` server.
 *   node perf/v3.1/scripts/run-lighthouse.mjs [--runs=2] [--base=http://127.0.0.1:8791] [--tag=]
 * Writes perf/v3.1/lighthouse/<page>-<preset><tag>-r<n>.json (mobile = default preset).
 * Extra Chrome flags: LH_EXTRA_FLAGS env (appended after --headless=new).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '..', 'lighthouse')
mkdirSync(outDir, { recursive: true })
const args = process.argv.slice(2)
const flag = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=') ?? d
const runs = Number(flag('runs', 2))
const base = flag('base', 'http://127.0.0.1:8791').replace(/\/+$/, '')
const tag = flag('tag', '')
const only = flag('only', '')
const presets = (flag('presets', 'mobile,desktop')).split(',')
const pages = [
  ['home', '/'],
  ['kk', '/kk/'],
  ['members', '/members'],
  ['handbook', '/handbook'],
].filter(([n]) => !only || only.split(',').includes(n))

/**
 * True only for a report that can actually be summarised. A Lighthouse run that crashed (the local
 * server died mid-matrix, a Chrome interstitial) still WRITES a report — one whose only content is
 * `runtimeError` and a null performance score. Treating that file as "already done" left the broken
 * run on disk through every re-run, and summarize-lighthouse.mjs then folded it into the medians as
 * a 0. Anything unreadable, errored or score-less is re-run.
 */
function usableReport(file) {
  if (!existsSync(file)) return false
  try {
    const r = JSON.parse(readFileSync(file, 'utf8'))
    if (r.runtimeError) {
      console.log('rerun (runtimeError', r.runtimeError.code + ')', file)
      return false
    }
    if (r.categories?.performance?.score == null) {
      console.log('rerun (no performance score)', file)
      return false
    }
    return true
  } catch {
    console.log('rerun (unreadable)', file)
    return false
  }
}

const chromeFlags = ['--headless=new', process.env.LH_EXTRA_FLAGS || ''].join(' ').trim()
process.env.CHROME_PATH ||= 'C:/Program Files/Google/Chrome/Application/chrome.exe'

for (let r = 1; r <= runs; r++) {
  for (const [name, path] of pages) {
    for (const preset of presets) {
      const out = resolve(outDir, `${name}-${preset}${tag}-r${r}.json`)
      if (usableReport(out) && !args.includes('--force')) {
        console.log('skip', out)
        continue
      }
      const cli = [
        '-y', 'lighthouse@12', `${base}${path}`,
        '--output=json', `--output-path=${out}`,
        `--chrome-flags="${chromeFlags}"`,
        '--quiet',
      ]
      if (preset === 'desktop') cli.push('--preset=desktop')
      const t0 = Date.now()
      const res = spawnSync('npx', cli, { shell: true, stdio: ['ignore', 'inherit', 'inherit'], timeout: 240000 })
      console.log(`${name} ${preset} r${r}: exit ${res.status} in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
    }
  }
}
