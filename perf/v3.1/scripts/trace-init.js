/*
 * Init script for trace-load.mjs (runs before any page script). Records, on the page clock
 * (performance.now(), ms since navigation start):
 *   - FCP / LCP candidates (+ element), long tasks, resource timings (read at the end);
 *   - WebGL context creation, first draw of any kind, first draw into the default framebuffer
 *     (= the canvas shows something), first draw of the glass wordmark (the only non-instanced
 *     indexed draw with > 3000 indices), first draw with the cloud / grass instanced meshes;
 *   - shader program work: linkProgram count, time blocked in getProgramParameter (the sync
 *     wait for the link), compileShader count, texImage2D / bufferData counts.
 * Kept deliberately light: every wrapper is a flag check + one performance.now() pair.
 */
;(() => {
  const now = () => performance.now()
  const qh = (window.__qh = {
    lcp: [],
    fcp: null,
    longtasks: [],
    gl: {
      contexts: [],
      firstDraw: null,
      firstScreenDraw: null,
      firstWordmarkDraw: null,
      firstInstancedDraw: null,
      screenDraws: 0,
      links: 0,
      compiles: 0,
      linkWaitMs: 0,
      linkWaits: [],
      programParamCalls: 0,
      texUploads: 0,
      bufferUploads: 0,
      parallelExt: null,
      frames: [],
    },
    marks: {},
  })

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const el = e.element
        qh.lcp.push({
          t: e.startTime,
          size: e.size,
          render: e.renderTime,
          load: e.loadTime,
          el: el ? `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}` : null,
          text: el ? String(el.textContent || '').slice(0, 60) : null,
        })
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.name === 'first-contentful-paint') qh.fcp = e.startTime
    }).observe({ type: 'paint', buffered: true })
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) qh.longtasks.push({ t: e.startTime, d: e.duration })
    }).observe({ type: 'longtask', buffered: true })
  } catch {}

  const origGetContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const ctx = origGetContext.call(this, type, attrs)
    if (ctx && /webgl/.test(type)) {
      qh.gl.contexts.push({ t: now(), type, w: this.width, h: this.height, attrs: attrs ? JSON.stringify(attrs) : null, inDom: this.isConnected })
    }
    return ctx
  }

  const wrapGL = (Proto) => {
    if (!Proto) return
    const P = Proto.prototype
    const FRAMEBUFFER_BINDING = 0x8ca6
    let bound = null // last bound draw framebuffer (tracked via bindFramebuffer)
    const bindFramebuffer = P.bindFramebuffer
    P.bindFramebuffer = function (target, fb) {
      if (target === 0x8d40 || target === 0x8ca9) bound = fb
      return bindFramebuffer.call(this, target, fb)
    }
    const onDraw = (kind, count, instanced) => {
      const t = now()
      const g = qh.gl
      if (g.firstDraw === null) g.firstDraw = { t, kind, count }
      if (bound === null) {
        g.screenDraws++
        if (g.firstScreenDraw === null) g.firstScreenDraw = { t, kind, count }
        if (!instanced && kind === 'elements' && count > 3000 && g.firstWordmarkDraw === null) g.firstWordmarkDraw = { t, count }
        if (instanced && g.firstInstancedDraw === null) g.firstInstancedDraw = { t, kind, count }
      }
    }
    for (const [name, kind, instanced, countArg] of [
      ['drawArrays', 'arrays', false, 2],
      ['drawElements', 'elements', false, 1],
      ['drawArraysInstanced', 'arrays', true, 2],
      ['drawElementsInstanced', 'elements', true, 1],
    ]) {
      const orig = P[name]
      if (!orig) continue
      P[name] = function (...args) {
        onDraw(kind, args[countArg], instanced)
        return orig.apply(this, args)
      }
    }
    // Per-program bookkeeping: name (three's `#define SHADER_NAME`), link call time, and the time
    // the main thread spent blocked in the first info-log / status query (= waiting for the link).
    const shaderSrc = new WeakMap()
    const progInfo = new WeakMap()
    qh.gl.programs = []
    const src = P.shaderSource
    P.shaderSource = function (s, text) {
      shaderSrc.set(s, text)
      return src.call(this, s, text)
    }
    const attach = P.attachShader
    P.attachShader = function (p, s) {
      let info = progInfo.get(p)
      if (!info) {
        info = { name: null, fragLen: 0, vertLen: 0, link: null, firstQuery: null, blockedMs: 0 }
        progInfo.set(p, info)
        qh.gl.programs.push(info)
      }
      const text = shaderSrc.get(s) || ''
      const named = (text.match(/#define SHADER_NAME ([^\n]+)/) || [])[1]?.trim()
      const type = (text.match(/#define SHADER_TYPE (\w+)/) || [])[1]
      // Owner tags from the app's own uniform / attribute names (sky/*.ts shaders, drei, three).
      const TAGS = [
        [/uniform sampler2D uNebula/, 'sky dome'],
        [/uThreshold/, 'cloud atlas bake'],
        [/aCell|uRim/, 'cloud sprites'],
        [/aBright|aTwinkle|uTwinkle/, 'stars'],
        [/uStrength/, 'glass backlight'],
        [/_transmission|uniform sampler2D buffer/, 'drei MeshTransmissionMaterial'],
        [/uWind/, 'field (grass/flora/hills)'],
        [/uAspect/, 'nebula bake'],
      ]
      let tag = null
      for (const [re, label] of TAGS) if (re.test(text)) { tag = label; break }
      if (named) info.name = named
      if (type && !info.type) info.type = type
      if (tag && !info.tag) info.tag = tag
      if (/gl_Position/.test(text)) info.vertLen = text.length
      else info.fragLen = text.length
      if (!info.name && info.fragLen && info.vertLen) info.name = [info.type, info.tag].filter(Boolean).join(' / ') || `custom(${info.fragLen})`
      return attach.call(this, p, s)
    }
    const link = P.linkProgram
    P.linkProgram = function (p) {
      qh.gl.links++
      const info = progInfo.get(p)
      if (info) info.link = +now().toFixed(1)
      return link.call(this, p)
    }
    const compile = P.compileShader
    P.compileShader = function (s) {
      qh.gl.compiles++
      return compile.call(this, s)
    }
    for (const name of ['getProgramInfoLog', 'getShaderInfoLog', 'getActiveUniform', 'getUniformLocation', 'getActiveAttrib', 'getAttribLocation']) {
      const orig = P[name]
      if (!orig) continue
      P[name] = function (obj, ...rest) {
        const t0 = now()
        const r = orig.call(this, obj, ...rest)
        const dt = now() - t0
        const info = name === 'getProgramInfoLog' ? progInfo.get(obj) : null
        if (info && info.firstQuery === null) {
          info.firstQuery = +t0.toFixed(1)
          info.blockedMs = +dt.toFixed(1)
        }
        if (dt > 2) qh.gl.linkWaits.push({ fn: name, t: +t0.toFixed(0), ms: +dt.toFixed(1), prog: info?.name })
        qh.gl.linkWaitMs += dt
        return r
      }
    }
    const gpp = P.getProgramParameter
    P.getProgramParameter = function (p, pname) {
      const t0 = now()
      const r = gpp.call(this, p, pname)
      const dt = now() - t0
      qh.gl.programParamCalls++
      if (pname === 0x8b82) {
        // LINK_STATUS: blocks until the (parallel) link finished
        qh.gl.linkWaitMs += dt
        const info = progInfo.get(p)
        if (info && info.firstQuery === null) {
          info.firstQuery = +t0.toFixed(1)
          info.blockedMs = +dt.toFixed(1)
        }
        if (dt > 2) qh.gl.linkWaits.push({ fn: 'getProgramParameter(LINK_STATUS)', t: +t0.toFixed(0), ms: +dt.toFixed(1), prog: info?.name })
      } else if (pname === 0x91b1) {
        const info = progInfo.get(p)
        if (info && r && !info.ready) info.ready = +t0.toFixed(1)
      }
      return r
    }
    const tex = P.texImage2D
    P.texImage2D = function (...a) {
      qh.gl.texUploads++
      return tex.apply(this, a)
    }
    const buf = P.bufferData
    P.bufferData = function (...a) {
      qh.gl.bufferUploads++
      return buf.apply(this, a)
    }
    const ext = P.getExtension
    P.getExtension = function (n) {
      const r = ext.call(this, n)
      if (n === 'KHR_parallel_shader_compile') qh.gl.parallelExt = !!r
      return r
    }
  }
  wrapGL(window.WebGL2RenderingContext)
  wrapGL(window.WebGLRenderingContext)

  // rAF cadence for the first 10 s (frame times, to see stalls between frames)
  let last = 0
  const tick = (t) => {
    if (last) {
      const dt = t - last
      if (dt > 50) qh.gl.frames.push({ t: +last.toFixed(0), gap: +dt.toFixed(0) })
    }
    last = t
    if (t < 12000) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  document.addEventListener('DOMContentLoaded', () => (qh.marks.dcl = now()))
  window.addEventListener('load', () => (qh.marks.load = now()))
})()
