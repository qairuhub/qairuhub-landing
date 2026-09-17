#!/usr/bin/env node
/**
 * Attributes the main-thread work of a trace from trace-load.mjs to source functions.
 *
 *   node perf/v3.1/scripts/analyze-trace.mjs <raw-trace.json> [--maps=perf/v3.1/tmp-dist-maps/assets] [--frames]
 *
 * - main thread = the renderer thread that ran ParseHTML for the page URL;
 * - t0 = that frame's navigationStart; every time below is ms after it;
 * - long task = a top-level RunTask on the main thread longer than 50 ms;
 * - each CPU-profile sample (V8 sampler, ~0.1–1 ms) inside a long task is attributed along two
 *   axes: OWNER (the first feature-level frame walking leaf → root, e.g. "cloud atlas bake",
 *   "wordmark: glyph extrusion", falling back to generic owners like "React", "r3f") and OP (what
 *   the leaf is doing: shader source build, GL call name, GC, compile, style/layout, JS self);
 *   minified frames are mapped back through the source maps of the sourcemapped build (the JS is
 *   byte-identical to dist/, verified before recording);
 * - native "(program)" samples are refined with the deepest overlapping trace event
 *   (Layout, UpdateLayoutTree, Paint, v8.compile, ParseHTML …).
 * Writes <trace>-analysis.json next to the probe file (perf/v3.1/traces) and prints a report.
 * --frames also writes the screenshot filmstrip at the key moments (perf/v3.1/traces/frames).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const v31 = resolve(here, '..')
const args = process.argv.slice(2)
const flag = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=') ?? d
const tracePath = args.find((a) => !a.startsWith('--'))
if (!tracePath) throw new Error('usage: analyze-trace.mjs <trace.json>')
const mapsDir = resolve(flag('maps', join(v31, 'tmp-dist-maps', 'assets')))
const id = basename(tracePath, '.json')
const outDir = join(v31, 'traces')
const LONG = 50

const raw = JSON.parse(readFileSync(tracePath, 'utf8'))
const events = Array.isArray(raw) ? raw : raw.traceEvents

/* ------------------------------------------------------------------ source maps */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const LOOKUP = new Int8Array(128).fill(-1)
;[...B64].forEach((c, i) => (LOOKUP[c.charCodeAt(0)] = i))
function parseMappings(mappings) {
  const lines = []
  let srcIdx = 0
  let srcLine = 0
  let srcCol = 0
  let nameIdx = 0
  for (const lineStr of mappings.split(';')) {
    let genCol = 0
    const segs = []
    if (lineStr) {
      for (const seg of lineStr.split(',')) {
        const vals = []
        let value = 0
        let shift = 0
        for (let i = 0; i < seg.length; i++) {
          let digit = LOOKUP[seg.charCodeAt(i)]
          const cont = digit & 32
          digit &= 31
          value += digit << shift
          if (cont) shift += 5
          else {
            vals.push(value & 1 ? -(value >>> 1) : value >>> 1)
            value = 0
            shift = 0
          }
        }
        genCol += vals[0]
        if (vals.length >= 4) {
          srcIdx += vals[1]
          srcLine += vals[2]
          srcCol += vals[3]
          if (vals.length >= 5) nameIdx += vals[4]
          segs.push([genCol, srcIdx, srcLine, srcCol, vals.length >= 5 ? nameIdx : -1])
        }
      }
    }
    lines.push(segs)
  }
  return lines
}
const maps = new Map()
function getMap(file) {
  if (maps.has(file)) return maps.get(file)
  const p = join(mapsDir, `${file}.map`)
  let m = null
  if (existsSync(p)) {
    const json = JSON.parse(readFileSync(p, 'utf8'))
    m = { json, lines: parseMappings(json.mappings), srcLines: new Map() }
  }
  maps.set(file, m)
  return m
}
function sourceLine(m, srcIdx, line) {
  let arr = m.srcLines.get(srcIdx)
  if (!arr) {
    arr = String(m.json.sourcesContent?.[srcIdx] ?? '').split('\n')
    m.srcLines.set(srcIdx, arr)
  }
  return arr[line] ?? ''
}
const NAME_RE = [
  /(?:^|\s)(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/,
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function|[A-Za-z_$][\w$]*\s*=>)/,
  /([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s*)?function\b/,
  /^\s*(?:static\s+|async\s+|get\s+|set\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/,
  /\.([A-Za-z_$][\w$]*)\s*=\s*function/,
  /this\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/,
  /class\s+([A-Za-z_$][\w$]*)/,
]
function guessName(m, srcIdx, line) {
  for (let l = line; l >= Math.max(0, line - 2); l--) {
    const text = sourceLine(m, srcIdx, l)
    for (const re of NAME_RE) {
      const hit = text.match(re)
      if (hit && !['if', 'for', 'while', 'switch', 'return', 'catch'].includes(hit[1])) return hit[1]
    }
  }
  return null
}
const frameCache = new Map()
function mapFrame(cf) {
  const key = `${cf.url}|${cf.lineNumber}|${cf.columnNumber}|${cf.functionName}`
  if (frameCache.has(key)) return frameCache.get(key)
  let out
  const file = cf.url ? cf.url.split('/').pop().split('?')[0] : ''
  if (!cf.url) {
    out = { native: cf.functionName || '(anonymous native)', src: null, name: cf.functionName }
  } else if (!/\.js$/.test(file)) {
    out = { native: null, src: cf.url, name: cf.functionName || '(anon)' }
  } else {
    const m = getMap(file)
    if (!m) out = { native: null, src: `${file}`, name: cf.functionName }
    else {
      const segs = m.lines[cf.lineNumber] ?? []
      let lo = 0
      let hi = segs.length - 1
      let best = null
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (segs[mid][0] <= cf.columnNumber) {
          best = segs[mid]
          lo = mid + 1
        } else hi = mid - 1
      }
      if (!best) out = { native: null, src: file, name: cf.functionName }
      else {
        const src = String(m.json.sources[best[1]]).replace(/^(\.\.\/)+/, '').replace(/\\/g, '/')
        const name = guessName(m, best[1], best[2]) || (best[4] >= 0 ? m.json.names[best[4]] : null) || cf.functionName || '(anon)'
        out = { native: null, src: src.replace(/^.*node_modules\//, 'nm:'), line: best[2] + 1, name }
      }
    }
  }
  frameCache.set(key, out)
  return out
}

/* ------------------------------------------------------------------ classification */
const GL_SHADER = /^(compileShader|linkProgram|getProgramParameter|getShaderParameter|getShaderInfoLog|getProgramInfoLog|getActiveUniform|getActiveAttrib|getUniformLocation|getAttribLocation|shaderSource|attachShader|createShader|createProgram|deleteShader|detachShader|getShaderPrecisionFormat|getShaderSource)$/
const GL_UPLOAD = /^(texImage2D|texSubImage2D|texImage3D|texStorage2D|texStorage3D|bufferData|bufferSubData|generateMipmap|renderbufferStorage|renderbufferStorageMultisample|framebufferTexture2D|readPixels)$/
const GL_OTHER = /^(drawArrays|drawElements|drawArraysInstanced|drawElementsInstanced|clear|getParameter|getExtension|getContext|getSupportedExtensions|uniform\w+|vertexAttrib\w*|enableVertexAttribArray|bindBuffer|bindTexture|bindFramebuffer|useProgram|viewport|scissor|blitFramebuffer|invalidateFramebuffer|checkFramebufferStatus|pixelStorei|texParameteri|activeTexture|createTexture|createBuffer|createFramebuffer|deleteTexture|deleteBuffer|loseContext|getContextAttributes|isContextLost)$/

const FEATURE_OWNERS = [
  [/src\/lib\/ttf\.ts/, 'wordmark: TTF fetch+parse'],
  [/src\/components\/three\/extrudeGlyphs\.ts|nm:three\/examples\/jsm\/loaders\/FontLoader|nm:three\/src\/extras\/(ShapeUtils|Earcut|core\/)/, 'wordmark: glyph shapes + extrusion'],
  [/src\/components\/three\/GlassText\.tsx/, 'wordmark: GlassText (geometry cache / backlight)'],
  [/src\/sections\/sky\/GlassWordmark\.tsx/, 'wordmark: GlassWordmark'],
  [/nm:@react-three\/drei\/(core|materials)\/MeshTransmissionMaterial/, 'drei MeshTransmissionMaterial'],
  [/nm:three\/src\/extras\/PMREMGenerator|nm:@react-three\/drei\/core\/(Environment|Lightformer|useEnvironment)|nm:three\/src\/cameras\/CubeCamera|nm:three\/src\/renderers\/WebGLCubeRenderTarget/, 'Environment / PMREM bake'],
  [/src\/sections\/sky\/cloudBake\.ts/, 'cloud atlas bake'],
  [/src\/sections\/sky\/CloudSprites\.tsx/, 'CloudSprites'],
  [/src\/sections\/sky\/SkyDome\.tsx/, 'SkyDome (+ nebula bake)'],
  [/src\/sections\/sky\/Stars\.tsx/, 'Stars'],
  [/src\/sections\/sky\/field\/Grass/, 'Field: grass'],
  [/src\/sections\/sky\/field\/Hills/, 'Field: hills'],
  [/src\/sections\/sky\/field\/Flora|nm:three\/examples\/jsm\/utils\/BufferGeometryUtils/, 'Field: flora'],
  [/src\/sections\/sky\/Field\.tsx/, 'Field (warm-up compile)'],
  [/src\/sections\/sky\/SceneLights/, 'SceneLights'],
  [/src\/sections\/sky\/quality\.ts/, 'quality probe (GPU string)'],
  [/src\/sections\/sky\/journey\.ts|src\/sections\/sky\/pointer\.ts/, 'journey driver'],
  [/src\/sections\/SkyScene\.tsx/, 'SkyScene'],
  [/nm:lenis/, 'Lenis'],
  [/src\/lib\/SmoothScroll/, 'SmoothScroll (Lenis setup)'],
  [/src\/assistant\//, 'Assistant launcher'],
  [/src\/sections\/(ProductDemo|DemoForm)/, 'lazy home sections'],
  [/src\/sections\/Header/, 'Header'],
  [/src\/(sections|components\/ui|pages|i18n)\//, 'App DOM components'],
  [/src\/main\.tsx|src\/App\.tsx/, 'App entry'],
  [/src\/lib\/domGuard/, 'domGuard'],
]
const GENERIC_OWNERS = [
  [/nm:three\/src\/renderers\/webgl\/WebGL(Program|Programs|Shader|Uniforms)|nm:three\/src\/renderers\/shaders\//, 'three: program build (other owner)'],
  [/nm:three\//, 'three (render/other)'],
  [/nm:@react-three\/fiber/, 'r3f reconciler / loop'],
  [/nm:@react-three\/drei/, 'drei (other)'],
  [/nm:(react-dom|scheduler|react)\//, 'React (render/commit)'],
  [/src\/lib\/ticker/, 'ticker'],
]
function ownerOf(stack) {
  for (const f of stack) if (f.src) for (const [re, label] of FEATURE_OWNERS) if (re.test(f.src)) return label
  for (const f of stack) if (f.src) for (const [re, label] of GENERIC_OWNERS) if (re.test(f.src)) return label
  return null
}
function opOf(stack) {
  const leaf = stack[0]
  if (!leaf) return 'unknown'
  if (leaf.native) {
    if (GL_SHADER.test(leaf.native)) return `GL shader: ${leaf.native}`
    if (GL_UPLOAD.test(leaf.native)) return `GL upload: ${leaf.native}`
    if (GL_OTHER.test(leaf.native)) return `GL: ${leaf.native}`
    return `native: ${leaf.native}`
  }
  for (const f of stack.slice(0, 6)) {
    if (f.src && /nm:three\/src\/renderers\/webgl\/WebGL(Program|Programs|Shader)\.js/.test(f.src)) return 'three: shader source build (JS)'
  }
  if (leaf.src) return `JS: ${leaf.src.replace(/^nm:/, '').replace(/^(@[^/]+\/[^/]+|[^/]+)\/.*$/, '$1')}`
  return 'JS'
}

/* ------------------------------------------------------------------ threads + t0 */
let mainPid = null
let mainTid = null
let pageUrl = null
for (const e of events) {
  if (e.name === 'ParseHTML' && e.args?.beginData?.url && /^https?:\/\/(127\.0\.0\.1|localhost|qairuhub)/.test(e.args.beginData.url)) {
    mainPid = e.pid
    mainTid = e.tid
    pageUrl = e.args.beginData.url
    break
  }
}
if (mainPid === null) throw new Error('no ParseHTML for the page url in the trace')
const onMain = (e) => e.pid === mainPid && e.tid === mainTid
let t0 = null
for (const e of events) {
  if (e.name === 'navigationStart' && e.pid === mainPid && e.args?.data?.documentLoaderURL?.startsWith(pageUrl.replace(/[?#].*$/, '').replace(/\/$/, ''))) {
    if (e.args.data.isLoadingMainFrame !== false) t0 = e.ts
  }
}
if (t0 === null) t0 = Math.min(...events.filter((e) => e.name === 'ParseHTML' && onMain(e)).map((e) => e.ts))
const ms = (ts) => +((ts - t0) / 1000).toFixed(1)

/* ------------------------------------------------------------------ main-thread events */
const main = events.filter((e) => onMain(e) && typeof e.ts === 'number')
// B/E pairs → durations (timeline events are mostly X with dur, some are B/E)
const stackBE = new Map()
const spans = []
for (const e of main.sort((a, b) => a.ts - b.ts)) {
  if (e.ph === 'X' && e.dur != null) spans.push({ name: e.name, cat: e.cat, ts: e.ts, end: e.ts + e.dur, args: e.args })
  else if (e.ph === 'B') {
    const k = e.name
    if (!stackBE.has(k)) stackBE.set(k, [])
    stackBE.get(k).push(e)
  } else if (e.ph === 'E') {
    const b = stackBE.get(e.name)?.pop()
    if (b) spans.push({ name: e.name, cat: b.cat, ts: b.ts, end: e.ts, args: { ...b.args, ...e.args } })
  }
}
spans.sort((a, b) => a.ts - b.ts || b.end - a.end)
const tasks = spans.filter((s) => s.name === 'RunTask' || s.name === 'ThreadControllerImpl::RunTask')
// keep only top-level tasks (not nested in another task)
const topTasks = []
let lastEnd = -Infinity
for (const t of tasks) {
  if (t.ts >= lastEnd) {
    topTasks.push(t)
    lastEnd = t.end
  }
}
const longTasks = topTasks.filter((t) => (t.end - t.ts) / 1000 > LONG && t.ts >= t0)

const REFINE = new Set([
  'Layout', 'UpdateLayoutTree', 'RecalculateStyles', 'Paint', 'PrePaint', 'Layerize', 'Commit', 'ParseHTML', 'ParseAuthorStyleSheet',
  'v8.compile', 'v8.compileModule', 'V8.CompileCode', 'v8.parseOnBackground', 'v8.produceModuleCache', 'v8.evaluateModule', 'EvaluateScript',
  'MinorGC', 'MajorGC', 'V8.GC_SCAVENGER', 'V8.GCFinalizeMC', 'BlinkGC.AtomicPhase', 'CppGC.AtomicPhase', 'HitTest', 'IntersectionObserverController::computeIntersections',
  'Decode Image', 'ImageDecodeTask', 'ResourceReceivedData', 'ScheduleStyleRecalculation', 'UpdateLayerTree', 'HandlePostMessage', 'FontLoading', 'FontCache::GetFontPlatformData',
  'v8.run', 'FunctionCall', 'TimerFire', 'FireAnimationFrame', 'EventDispatch', 'RunMicrotasks', 'v8.newInstance', 'WebGLRenderingContext', 'GPUTask',
])
const refineSpans = spans.filter((s) => REFINE.has(s.name) || /GC|Compile|compile|Parse|Layout|Style|Paint/.test(s.name))
function deepestAt(ts) {
  let best = null
  // spans sorted by start; linear scan is fine for our sizes via binary search on start
  let lo = 0
  let hi = refineSpans.length - 1
  let idx = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (refineSpans[mid].ts <= ts) {
      idx = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  for (let i = idx; i >= 0 && i > idx - 4000; i--) {
    const s = refineSpans[i]
    if (s.end >= ts && s.ts <= ts) {
      if (!best || s.end - s.ts < best.end - best.ts) best = s
    }
  }
  return best
}

/* ------------------------------------------------------------------ CPU profile */
const profiles = new Map() // id → { pid, tid, startTime, nodes: Map, samples: [], times: [] }
for (const e of events) {
  if (e.name === 'Profile' && e.pid === mainPid) {
    profiles.set(`${e.pid}:${e.id}`, { pid: e.pid, tid: e.tid, start: e.args.data.startTime, nodes: new Map(), samples: [], times: [], last: e.args.data.startTime })
  }
}
for (const e of events.filter((x) => x.name === 'ProfileChunk').sort((a, b) => a.ts - b.ts)) {
  const p = profiles.get(`${e.pid}:${e.id}`)
  if (!p) continue
  const cp = e.args.data.cpuProfile ?? {}
  for (const n of cp.nodes ?? []) p.nodes.set(n.id, n)
  const deltas = e.args.data.timeDeltas ?? []
  const samples = cp.samples ?? []
  for (let i = 0; i < samples.length; i++) {
    p.last += deltas[i] ?? 0
    p.samples.push(samples[i])
    p.times.push(p.last)
  }
}
const mainProfile = [...profiles.values()].find((p) => p.tid === mainTid)
const stackCache = new Map()
function stackOf(p, nodeId) {
  if (stackCache.has(nodeId)) return stackCache.get(nodeId)
  const out = []
  let n = p.nodes.get(nodeId)
  while (n) {
    const cf = n.callFrame
    if (cf.functionName === '(root)') break
    out.push(cf.url || cf.functionName?.startsWith('(') ? mapFrame(cf) : { native: cf.functionName, src: null, name: cf.functionName })
    n = n.parent != null ? p.nodes.get(n.parent) : null
  }
  stackCache.set(nodeId, out)
  return out
}
function classifySample(p, i) {
  const node = p.nodes.get(p.samples[i])
  const fn = node?.callFrame?.functionName
  const ts = p.times[i]
  if (fn === '(idle)') return { owner: 'idle', op: 'idle', fn: '(idle)' }
  if (fn === '(garbage collector)') return { owner: 'GC', op: 'GC', fn: 'GC' }
  if (fn === '(program)') {
    const s = deepestAt(ts)
    const name = s ? s.name : 'native (other)'
    const op = /GC/.test(name) ? 'GC' : /compile|Compile|parse/.test(name) ? `script ${name}` : name
    let owner = 'browser (style/layout/paint/other)'
    if (/compile|Compile|evaluateModule|EvaluateScript/.test(name)) {
      const url = s.args?.data?.url || s.args?.beginData?.url || s.args?.fileName || ''
      owner = `script compile: ${String(url).split('/').pop() || '?'}`
    } else if (/GC/.test(name)) owner = 'GC'
    return { owner, op, fn: name }
  }
  const stack = stackOf(p, p.samples[i])
  let owner = ownerOf(stack)
  if (!owner) {
    const s = deepestAt(ts)
    owner = s && /compile|Compile|evaluateModule|EvaluateScript/.test(s.name) ? `script eval: ${String(s.args?.data?.url || s.args?.fileName || '').split('/').pop()}` : 'other JS'
  }
  const leaf = stack[0]
  const fnLabel = leaf ? (leaf.native ? `[native] ${leaf.native}` : `${leaf.name} (${leaf.src}${leaf.line ? ':' + leaf.line : ''})`) : fn
  return { owner, op: opOf(stack), fn: fnLabel, stack }
}

function bucket(p, fromTs, toTs) {
  const owners = new Map()
  const ops = new Map()
  const fns = new Map()
  const ownerFns = new Map()
  let total = 0
  if (!p) return { owners, ops, fns, total }
  // binary search start
  let lo = 0
  let hi = p.times.length - 1
  let s = p.times.length
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (p.times[mid] >= fromTs) {
      s = mid
      hi = mid - 1
    } else lo = mid + 1
  }
  for (let i = s; i < p.times.length && p.times[i] <= toTs; i++) {
    const dt = ((p.times[i + 1] ?? p.times[i]) - p.times[i]) / 1000
    const w = Math.min(dt, 5)
    const c = classifySample(p, i)
    if (c.owner === 'idle') continue
    total += w
    owners.set(c.owner, (owners.get(c.owner) ?? 0) + w)
    ops.set(c.op, (ops.get(c.op) ?? 0) + w)
    fns.set(c.fn, (fns.get(c.fn) ?? 0) + w)
    const k = `${c.owner} :: ${c.op}`
    ownerFns.set(k, (ownerFns.get(k) ?? 0) + w)
  }
  return { owners, ops, fns, ownerFns, total }
}
const top = (m, n = 8) =>
  [...(m ?? new Map()).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => [k, +v.toFixed(1)])

/* ------------------------------------------------------------------ task summaries */
function taskKind(t) {
  const inner = spans.filter((s) => s.ts >= t.ts && s.end <= t.end && s !== t)
  const kinds = new Map()
  for (const s of inner) {
    if (['EvaluateScript', 'v8.evaluateModule', 'FunctionCall', 'TimerFire', 'FireAnimationFrame', 'EventDispatch', 'RunMicrotasks', 'ParseHTML', 'Layout', 'UpdateLayoutTree', 'Paint', 'v8.compile', 'v8.compileModule', 'MajorGC', 'MinorGC'].includes(s.name)) {
      kinds.set(s.name, (kinds.get(s.name) ?? 0) + (s.end - s.ts) / 1000)
    }
  }
  const fc = inner.find((s) => s.name === 'FunctionCall' || s.name === 'EvaluateScript' || s.name === 'v8.evaluateModule' || s.name === 'TimerFire' || s.name === 'FireAnimationFrame')
  const url = fc?.args?.data?.url || fc?.args?.data?.functionName || ''
  return { kinds: top(kinds, 6), entry: fc ? `${fc.name} ${String(url).split('/').pop()}` : null }
}

const report = { id, pageUrl, t0, longTasks: [], totals: null, markers: {} }
for (const t of longTasks) {
  const b = bucket(mainProfile, t.ts, t.end)
  const k = taskKind(t)
  report.longTasks.push({
    start: ms(t.ts),
    dur: +((t.end - t.ts) / 1000).toFixed(1),
    entry: k.entry,
    events: k.kinds,
    sampledMs: +b.total.toFixed(1),
    owners: top(b.owners, 10),
    ops: top(b.ops, 10),
    functions: top(b.fns, 12),
    ownerOps: top(b.ownerFns, 14),
  })
}
// Whole window (0 → end of trace) main-thread busy time by owner.
const endTs = Math.max(...main.map((e) => e.ts + (e.dur ?? 0)))
const all = bucket(mainProfile, t0, endTs)
const inLong = { owners: new Map(), total: 0 }
for (const lt of report.longTasks) {
  for (const [k, v] of lt.owners) inLong.owners.set(k, (inLong.owners.get(k) ?? 0) + v)
  inLong.total += lt.dur
}
report.totals = {
  sampledBusyMs: +all.total.toFixed(0),
  owners: top(all.owners, 30),
  ops: top(all.ops, 25),
  longTaskMs: +inLong.total.toFixed(0),
  longTaskOwners: top(inLong.owners, 30),
  tbtLike: +report.longTasks.reduce((s, t) => s + Math.max(0, t.dur - 50), 0).toFixed(0),
}
// Markers from trace
for (const e of events) {
  if (e.pid !== mainPid) continue
  if (e.name === 'firstContentfulPaint' && report.markers.fcp == null) report.markers.fcp = ms(e.ts)
  if (e.name === 'largestContentfulPaint::Candidate') report.markers.lcp = ms(e.ts)
  if (e.name === 'domContentLoadedEventEnd' && report.markers.dcl == null) report.markers.dcl = ms(e.ts)
  if (e.name === 'loadEventEnd' && report.markers.load == null) report.markers.load = ms(e.ts)
}
// Script evaluation timings per chunk
const evals = spans.filter((s) => (s.name === 'v8.evaluateModule' || s.name === 'EvaluateScript' || s.name === 'v8.compileModule' || s.name === 'v8.compile') && s.ts >= t0)
report.scripts = evals
  .map((s) => ({ name: s.name, url: String(s.args?.data?.url || s.args?.fileName || s.args?.beginData?.url || '').split('/').pop(), start: ms(s.ts), dur: +((s.end - s.ts) / 1000).toFixed(1) }))
  .filter((s) => s.dur >= 2)
// Frames: main-thread animation frames with long gaps
report.frames = spans
  .filter((s) => s.name === 'FireAnimationFrame' && s.ts >= t0)
  .map((s) => ({ t: ms(s.ts), d: +((s.end - s.ts) / 1000).toFixed(1) }))
  .filter((f) => f.d > 30)

// Probe join
const probePath = join(outDir, `${id}-probe.json`)
if (existsSync(probePath)) {
  const probe = JSON.parse(readFileSync(probePath, 'utf8'))
  const g = probe.q.gl
  report.markers.probe = {
    fcp: probe.q.fcp && +probe.q.fcp.toFixed(0),
    lcp: probe.q.lcp.map((l) => ({ t: +l.t.toFixed(0), el: l.el, text: l.text })),
    webglContexts: g.contexts.map((c) => +c.t.toFixed(0)),
    firstDraw: g.firstDraw && +g.firstDraw.t.toFixed(0),
    firstScreenDraw: g.firstScreenDraw && +g.firstScreenDraw.t.toFixed(0),
    firstInstancedScreenDraw: g.firstInstancedDraw && +g.firstInstancedDraw.t.toFixed(0),
    firstWordmarkDraw: g.firstWordmarkDraw && +g.firstWordmarkDraw.t.toFixed(0),
    wordmarkIndices: g.firstWordmarkDraw?.count,
    links: g.links,
    linkWaitMs: +g.linkWaitMs.toFixed(0),
    linkWaits: g.linkWaits,
    parallelExt: g.parallelExt,
    programs: (g.programs || []).map((x) => ({ name: x.name, link: x.link, firstQuery: x.firstQuery, blockedMs: x.blockedMs, ready: x.ready ?? null, frag: x.fragLen, vert: x.vertLen })),
    rafGaps: g.frames,
    load: probe.nav?.load,
    dcl: probe.nav?.dcl,
    ttfb: probe.nav?.ttfb,
    renderer: probe.renderer,
    canvas: probe.canvas,
    fold: probe.fold,
    fontsLoaded: probe.fonts.filter((f) => f.status !== 'unloaded').map((f) => `${f.family} ${f.range}`),
    resources: probe.res.filter((r) => /fonts|assets|api/.test(r.name)).map((r) => `${r.name} ${r.start}-${r.end} ${r.transfer}`),
    errors: probe.errors,
  }
}

// Filmstrip
if (args.includes('--frames')) {
  const shots = events.filter((e) => e.name === 'Screenshot' && e.args?.snapshot).sort((a, b) => a.ts - b.ts)
  const fdir = join(outDir, 'frames')
  mkdirSync(fdir, { recursive: true })
  const want = [250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000]
  const p = report.markers.probe
  if (p?.firstScreenDraw) want.push(p.firstScreenDraw + 34)
  if (p?.firstWordmarkDraw) want.push(p.firstWordmarkDraw + 34)
  const written = []
  for (const w of [...new Set(want)].sort((a, b) => a - b)) {
    const target = t0 + w * 1000
    let pick = null
    for (const s of shots) if (s.ts <= target) pick = s
    if (!pick) continue
    const f = join(fdir, `${id}-${String(w).padStart(5, '0')}ms.jpg`)
    writeFileSync(f, Buffer.from(pick.args.snapshot, 'base64'))
    written.push({ want: w, shotAt: ms(pick.ts), file: basename(f) })
  }
  report.filmstrip = written
}

writeFileSync(join(outDir, `${id}-analysis.json`), JSON.stringify(report, null, 1))

/* ------------------------------------------------------------------ print */
const pr = (...a) => console.log(...a)
pr(`\n=== ${id}  ${pageUrl}`)
pr('markers', JSON.stringify({ ...report.markers, probe: undefined }))
if (report.markers.probe) {
  const p = report.markers.probe
  pr('probe', JSON.stringify({ fcp: p.fcp, lcp: p.lcp.at(-1), ctx: p.webglContexts, firstDraw: p.firstDraw, firstScreenDraw: p.firstScreenDraw, instanced: p.firstInstancedScreenDraw, wordmark: p.firstWordmarkDraw, links: p.links, linkWaitMs: p.linkWaitMs, load: p.load, rafGaps: p.rafGaps.length }))
}
pr(`long tasks: ${report.longTasks.length}, total ${report.totals.longTaskMs} ms, TBT-like ${report.totals.tbtLike} ms, sampled busy ${report.totals.sampledBusyMs} ms`)
for (const lt of report.longTasks) {
  pr(`\n-- @${lt.start} ms  ${lt.dur} ms  entry=${lt.entry}  sampled=${lt.sampledMs}`)
  pr('   events:', lt.events.map(([k, v]) => `${k} ${v}`).join(' | '))
  pr('   owners:', lt.owners.map(([k, v]) => `${k} ${v}`).join(' | '))
  pr('   ops   :', lt.ops.slice(0, 7).map(([k, v]) => `${k} ${v}`).join(' | '))
  pr('   fns   :', lt.functions.slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' | '))
}
pr('\nlong-task owners:', report.totals.longTaskOwners.map(([k, v]) => `${k} ${v}`).join(' | '))
pr('all busy owners:', report.totals.owners.slice(0, 18).map(([k, v]) => `${k} ${v}`).join(' | '))
pr('all busy ops:', report.totals.ops.slice(0, 16).map(([k, v]) => `${k} ${v}`).join(' | '))
if (report.markers.probe?.programs) {
  pr('programs (link → first blocking query, blocked ms):')
  for (const x of report.markers.probe.programs) pr(`   ${String(x.name).padEnd(34)} link@${x.link} query@${x.firstQuery} blocked ${x.blockedMs} ms  ready@${x.ready} frag ${x.frag}`)
  pr('   total blocked', report.markers.probe.programs.reduce((s, x) => s + (x.blockedMs || 0), 0).toFixed(0), 'ms over', report.markers.probe.programs.length, 'programs')
}
pr('rafGaps', JSON.stringify(report.markers.probe?.rafGaps))
pr('fold', JSON.stringify(report.markers.probe?.fold?.slice(0, 20)))
pr('fonts', JSON.stringify(report.markers.probe?.fontsLoaded))
pr('res', JSON.stringify(report.markers.probe?.resources))
pr('scripts:', report.scripts.map((s) => `${s.name}:${s.url}@${s.start}+${s.dur}`).join(' | '))
