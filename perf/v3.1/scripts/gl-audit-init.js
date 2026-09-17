/*
 * Page-side WebGL upload recorder (injected with page.addInitScript before any site script).
 *
 * Wraps bufferData / bufferSubData / texImage2D / texSubImage2D / texStorage2D / texImage3D /
 * texStorage3D / renderbufferStorage(Multisample) on WebGLRenderingContext and
 * WebGL2RenderingContext and records every call (target, bytes, upload vs allocation, stack).
 * Registers window.__THREE_DEVTOOLS__ so three.js hands over every Scene and WebGLRenderer it
 * constructs (three dispatches an `observe` event from both constructors, production builds
 * included); `window.__glAuditOwners()` then walks those scenes and maps each recorded upload to
 * the object that owns it (typed-array identity for buffers, renderer.properties for textures).
 *
 * Optional corruption model (window.__GL_AUDIT_CORRUPT = { limit, mode }): ARRAY_BUFFER /
 * ELEMENT_ARRAY_BUFFER uploads larger than `limit` bytes keep their first `limit` bytes and the
 * rest is zeroed (mode 'zero') or shifted by 4 bytes (mode 'shift4').
 */
;(() => {
  if (window.__glAudit) return
  const S = (window.__glAudit = { recs: [], sub: new Map(), scenes: [], renderers: [], mark: 'load', corrupted: [] })
  const ids = { buf: new WeakMap(), tex: new WeakMap(), rb: new WeakMap(), n: { buf: 0, tex: 0, rb: 0 } }
  const idOf = (kind, obj) => {
    if (!obj) return 0
    let id = ids[kind].get(obj)
    if (!id) ids[kind].set(obj, (id = ++ids.n[kind]))
    return id
  }
  S.arrRecs = new WeakMap()
  S.texIdOf = (t) => (t ? ids.tex.get(t) || 0 : 0)

  const devtools = new EventTarget()
  devtools.addEventListener('observe', (e) => {
    const d = e.detail
    if (!d) return
    if (d.isScene) S.scenes.push(d)
    else if (d.domElement && typeof d.render === 'function' && d.properties) S.renderers.push(d)
  })
  window.__THREE_DEVTOOLS__ = devtools

  const now = () => Math.round(performance.now())
  const stack = () =>
    String(new Error().stack || '')
      .split('\n')
      .slice(1)
      .filter((l) => !/<anonymous>|P\.<computed>/.test(l))
      .slice(0, 8)
      .map((l) =>
        l
          .trim()
          .replace(/^at /, '')
          .replace(/https?:\/\/[^/]+\/(assets\/)?/g, '')
          .replace(/-[A-Za-z0-9_]{8}\.js/g, '.js'),
      )

  const state = new WeakMap()
  const st = (gl) => {
    let s = state.get(gl)
    if (!s) state.set(gl, (s = { buf: {}, unit: gl.TEXTURE0, tex: {}, rb: null }))
    return s
  }

  const TYPE_BYTES = { 0x1401: 1, 0x1400: 1, 0x1403: 2, 0x1402: 2, 0x1405: 4, 0x1404: 4, 0x1406: 4, 0x140b: 2, 0x8d61: 2, 0x8033: 2, 0x8034: 2, 0x8363: 2, 0x84fa: 4, 0x8368: 4, 0x8c3b: 4, 0x8c3e: 4, 0x8dad: 8 }
  const FORMAT_CH = { 0x1908: 4, 0x1907: 3, 0x8227: 2, 0x1903: 1, 0x1909: 1, 0x190a: 2, 0x1906: 1, 0x1902: 1, 0x84f9: 1, 0x8d99: 4, 0x8d98: 3, 0x8228: 2, 0x8d94: 1, 0x8c40: 3, 0x8c42: 4 }
  // sized internal formats -> bytes per texel
  const SIZED = { 0x8058: 4, 0x8051: 3, 0x8229: 1, 0x822b: 2, 0x8c43: 4, 0x8c41: 3, 0x881a: 8, 0x881b: 6, 0x8814: 16, 0x8815: 12, 0x822d: 2, 0x822f: 4, 0x822e: 4, 0x8230: 8, 0x8c3a: 4, 0x8c3d: 4, 0x81a5: 2, 0x81a6: 4, 0x8cac: 4, 0x88f0: 4, 0x8cad: 5, 0x8d48: 1, 0x8056: 2, 0x8057: 2, 0x8d62: 2 }
  const FORMAT_NAMES = { 0x8058: 'RGBA8', 0x881a: 'RGBA16F', 0x8814: 'RGBA32F', 0x8c43: 'SRGB8_ALPHA8', 0x81a5: 'DEPTH16', 0x81a6: 'DEPTH24', 0x8cac: 'DEPTH32F', 0x88f0: 'DEPTH24_STENCIL8', 0x8229: 'R8', 0x1908: 'RGBA', 0x1907: 'RGB', 0x8051: 'RGB8', 0x881b: 'RGB16F', 0x822f: 'RG16F', 0x822b: 'RG8', 0x8d48: 'STENCIL8' }
  const TARGETS = { 0x8892: 'ARRAY_BUFFER', 0x8893: 'ELEMENT_ARRAY_BUFFER', 0x8a11: 'UNIFORM_BUFFER', 0x88eb: 'PIXEL_PACK_BUFFER', 0x88ec: 'PIXEL_UNPACK_BUFFER', 0x8f36: 'COPY_READ_BUFFER', 0x8f37: 'COPY_WRITE_BUFFER', 0x8c8e: 'TRANSFORM_FEEDBACK_BUFFER', 0x0de1: 'TEXTURE_2D', 0x8513: 'TEXTURE_CUBE_MAP', 0x806f: 'TEXTURE_3D', 0x8c1a: 'TEXTURE_2D_ARRAY', 0x8d41: 'RENDERBUFFER' }
  const tname = (t) => TARGETS[t] || (t >= 0x8515 && t <= 0x851a ? 'CUBE_FACE_' + (t - 0x8515) : '0x' + Number(t).toString(16))
  const texTarget = (t) => (t >= 0x8515 && t <= 0x851a ? 0x8513 : t)

  const push = (rec) => {
    rec.t = now()
    rec.y = Math.round(window.scrollY)
    rec.mark = S.mark
    rec.stack = stack()
    S.recs.push(rec)
    return S.recs.length - 1
  }
  const linkArray = (arr, idx) => {
    if (!arr || typeof arr !== 'object') return
    let list = S.arrRecs.get(arr)
    if (!list) S.arrRecs.set(arr, (list = []))
    list.push(idx)
  }

  const corrupt = (target, src, gl) => {
    const cfg = window.__GL_AUDIT_CORRUPT
    if (!cfg || !src || !ArrayBuffer.isView(src)) return src
    if (target !== gl.ARRAY_BUFFER && target !== gl.ELEMENT_ARRAY_BUFFER) return src
    if (src.byteLength <= cfg.limit) return src
    S.corrupted.push({ target: tname(target), bytes: src.byteLength, mode: cfg.mode })
    const bytes = new Uint8Array(src.buffer, src.byteOffset, src.byteLength)
    const out = new Uint8Array(src.byteLength)
    out.set(bytes.subarray(0, cfg.limit))
    if (cfg.mode === 'shift4') out.set(bytes.subarray(cfg.limit + 4), cfg.limit)
    return new src.constructor(out.buffer)
  }

  for (const Ctx of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Ctx) continue
    const P = Ctx.prototype
    const ctxName = Ctx === window.WebGL2RenderingContext ? 'webgl2' : 'webgl1'
    const wrap = (name, fn) => {
      const orig = P[name]
      if (typeof orig !== 'function') return
      P[name] = function (...args) {
        return fn.call(this, orig, args)
      }
    }

    wrap('bindBuffer', function (orig, args) {
      st(this).buf[args[0]] = args[1]
      return orig.apply(this, args)
    })
    wrap('activeTexture', function (orig, args) {
      st(this).unit = args[0]
      return orig.apply(this, args)
    })
    wrap('bindTexture', function (orig, args) {
      const s = st(this)
      ;(s.tex[s.unit] ||= {})[args[0]] = args[1]
      return orig.apply(this, args)
    })
    wrap('bindRenderbuffer', function (orig, args) {
      st(this).rb = args[1]
      return orig.apply(this, args)
    })
    const boundTex = (gl, target) => {
      const s = st(gl)
      return (s.tex[s.unit] || {})[texTarget(target)] || null
    }

    wrap('bufferData', function (orig, args) {
      const [target, src, usage, srcOffset, length] = args
      const buffer = st(this).buf[target]
      const rec = { fn: 'bufferData', ctx: ctxName, target: tname(target), buf: idOf('buf', buffer), usage }
      if (typeof src === 'number') {
        rec.bytes = src
        rec.upload = false
      } else if (src) {
        const bpe = src.BYTES_PER_ELEMENT || 1
        const off = (srcOffset || 0) * bpe
        rec.bytes = length ? length * bpe : src.byteLength - off
        rec.upload = true
        rec.array = src.constructor.name
        rec.elements = rec.bytes / bpe
      }
      const idx = push(rec)
      if (src && typeof src === 'object') linkArray(src, idx)
      if (src && typeof src === 'object') args[1] = corrupt(target, src, this)
      return orig.apply(this, args)
    })

    wrap('bufferSubData', function (orig, args) {
      const [target, offset, src, srcOffset, length] = args
      const buffer = st(this).buf[target]
      const bpe = (src && src.BYTES_PER_ELEMENT) || 1
      const bytes = src ? (length ? length * bpe : src.byteLength - (srcOffset || 0) * bpe) : 0
      const b = idOf('buf', buffer)
      const key = b + ':' + bytes + ':' + tname(target)
      let agg = S.sub.get(key)
      if (!agg) {
        agg = { fn: 'bufferSubData', ctx: ctxName, target: tname(target), buf: b, bytes, upload: true, array: src && src.constructor.name, calls: 0, maxOffset: 0, first: now(), stack: stack(), marks: {} }
        S.sub.set(key, agg)
        agg.idx = S.recs.push(agg) - 1
        agg.t = agg.first
        agg.mark = S.mark
        agg.y = Math.round(window.scrollY)
        linkArray(src, agg.idx)
      }
      agg.calls++
      agg.marks[S.mark] = (agg.marks[S.mark] || 0) + 1
      agg.maxOffset = Math.max(agg.maxOffset, offset)
      agg.last = now()
      return orig.apply(this, args)
    })

    const texRec = (gl, fn, target, level, ifmt, w, h, d, format, type, src, extra) => {
      const tex = boundTex(gl, target)
      const rec = { fn, ctx: ctxName, target: tname(target), tex: idOf('tex', tex), level, w, h, d: d || 1, ifmt: FORMAT_NAMES[ifmt] || '0x' + Number(ifmt).toString(16) }
      const texel = SIZED[ifmt] || (FORMAT_CH[format] || 4) * (TYPE_BYTES[type] || 1)
      const size = w * h * (d || 1) * texel
      if (src === null || src === undefined) {
        rec.upload = false
        rec.bytes = size
      } else if (typeof src === 'number') {
        rec.upload = true
        rec.source = 'PBO offset'
        rec.bytes = size
      } else if (ArrayBuffer.isView(src)) {
        rec.upload = true
        rec.source = src.constructor.name
        rec.bytes = src.byteLength - (extra || 0) * (src.BYTES_PER_ELEMENT || 1)
      } else {
        rec.upload = true
        rec.source = (src.constructor && src.constructor.name) || typeof src
        rec.bytes = size
      }
      return push(rec)
    }

    wrap('texImage2D', function (orig, args) {
      try {
        if (args.length === 6) {
          const [target, level, ifmt, format, type, source] = args
          const w = source.naturalWidth || source.videoWidth || source.displayWidth || source.width || 0
          const h = source.naturalHeight || source.videoHeight || source.displayHeight || source.height || 0
          texRec(this, 'texImage2D', target, level, ifmt, w, h, 1, format, type, source)
        } else {
          const [target, level, ifmt, w, h, , format, type, src, srcOffset] = args
          texRec(this, 'texImage2D', target, level, ifmt, w, h, 1, format, type, src, srcOffset)
        }
      } catch {}
      return orig.apply(this, args)
    })
    wrap('texSubImage2D', function (orig, args) {
      try {
        if (args.length === 7) {
          const [target, level, , , format, type, source] = args
          const w = source.naturalWidth || source.videoWidth || source.width || 0
          const h = source.naturalHeight || source.videoHeight || source.height || 0
          texRec(this, 'texSubImage2D', target, level, 0, w, h, 1, format, type, source)
        } else {
          const [target, level, , , w, h, format, type, src, srcOffset] = args
          texRec(this, 'texSubImage2D', target, level, 0, w, h, 1, format, type, src, srcOffset)
        }
      } catch {}
      return orig.apply(this, args)
    })
    wrap('texImage3D', function (orig, args) {
      try {
        const [target, level, ifmt, w, h, d, , format, type, src, srcOffset] = args
        texRec(this, 'texImage3D', target, level, ifmt, w, h, d, format, type, src, srcOffset)
      } catch {}
      return orig.apply(this, args)
    })
    wrap('texStorage2D', function (orig, args) {
      try {
        const [target, levels, ifmt, w, h] = args
        const faces = target === 0x8513 ? 6 : 1
        let total = 0
        for (let l = 0; l < levels; l++) total += Math.max(1, w >> l) * Math.max(1, h >> l)
        const idx = texRec(this, 'texStorage2D', target, levels, ifmt, w, h, 1, 0, 0, null)
        S.recs[idx].bytes = total * faces * (SIZED[ifmt] || 4)
        S.recs[idx].levels = levels
      } catch {}
      return orig.apply(this, args)
    })
    wrap('texStorage3D', function (orig, args) {
      try {
        const [target, levels, ifmt, w, h, d] = args
        const idx = texRec(this, 'texStorage3D', target, levels, ifmt, w, h, d, 0, 0, null)
        S.recs[idx].levels = levels
      } catch {}
      return orig.apply(this, args)
    })
    const rbRec = (gl, fn, samples, ifmt, w, h) => {
      const rec = { fn, ctx: ctxName, target: 'RENDERBUFFER', rb: idOf('rb', st(gl).rb), w, h, samples, ifmt: FORMAT_NAMES[ifmt] || '0x' + Number(ifmt).toString(16), upload: false }
      rec.bytes = w * h * (SIZED[ifmt] || 4) * Math.max(1, samples)
      push(rec)
    }
    wrap('renderbufferStorage', function (orig, args) {
      try {
        rbRec(this, 'renderbufferStorage', 1, args[1], args[2], args[3])
      } catch {}
      return orig.apply(this, args)
    })
    wrap('renderbufferStorageMultisample', function (orig, args) {
      try {
        rbRec(this, 'renderbufferStorageMultisample', args[1], args[2], args[3], args[4])
      } catch {}
      return orig.apply(this, args)
    })
  }

  /** Classify a three object into the site's layers (src/sections/sky/*). */
  const classify = (obj, scene, si) => {
    const g = obj.geometry || {}
    const a = g.attributes || {}
    const m = Array.isArray(obj.material) ? obj.material[0] : obj.material || {}
    const main = si === S.mainScene
    const verts = a.position ? a.position.count : 0
    let name
    if (obj.isPoints) name = 'stars (Stars.tsx)'
    else if (g.isInstancedBufferGeometry && a.aCell) name = `clouds z=${obj.position.z} (CloudSprites.tsx)`
    else if (obj.isInstancedMesh) name = 'grass field (field/Grass.tsx)'
    else if (m.type === 'MeshLambertMaterial') name = 'hills / terrain (field/Hills.tsx)'
    else if (a.aSway) name = 'flora (field/Flora.tsx)'
    else if (verts > 20000) name = `glass wordmark hero+footer (GlassText, ${m.type})`
    else if (obj.renderOrder === -10) name = 'sky dome (SkyDome.tsx)'
    else if (obj.renderOrder === -9 && verts === 3) name = 'transmission backlight (GlassText.tsx)'
    else if (verts === 3) name = 'fullscreen triangle (bake scene)'
    else name = `${obj.type}/${g.type || ''}/${m.type || ''} v${verts}`
    return main ? name : `[scene ${si}${scene.name ? ' ' + scene.name : ''}] ${name}`
  }

  window.__glAuditOwners = () => {
    // The main scene is the one with the most children (r3f's root scene).
    let best = -1
    S.scenes.forEach((s, i) => {
      if (best < 0 || s.children.length > S.scenes[best].children.length) best = i
    })
    S.mainScene = best
    const own = (idx, owner, extra) => {
      const r = S.recs[idx]
      if (!r || r.owner) return
      r.owner = owner
      Object.assign(r, extra)
    }
    const order = S.scenes.map((s, i) => i).sort((x, y) => (x === best ? -1 : y === best ? 1 : x - y))
    for (const si of order) {
      const scene = S.scenes[si]
      scene.traverse((obj) => {
        const g = obj.geometry
        if (!g || !g.attributes) return
        const label = classify(obj, scene, si)
        const attrs = Object.entries(g.attributes)
        if (g.index) attrs.push(['index', g.index])
        if (obj.isInstancedMesh) {
          attrs.push(['instanceMatrix', obj.instanceMatrix])
          if (obj.instanceColor) attrs.push(['instanceColor', obj.instanceColor])
        }
        for (const [name, attr] of attrs) {
          const arr = attr.array || (attr.data && attr.data.array)
          for (const idx of S.arrRecs.get(arr) || []) own(idx, label, { attr: name, count: attr.count, itemSize: attr.itemSize })
        }
      })
    }
    // textures: every texture reachable from materials / environments, via renderer.properties
    for (const r of S.renderers) {
      const seen = new Set()
      const tag = (tex, label) => {
        if (!tex || !tex.isTexture || seen.has(tex)) return
        seen.add(tex)
        const p = r.properties.get(tex)
        const id = S.texIdOf(p && p.__webglTexture)
        if (!id) return
        S.recs.forEach((rec, idx) => {
          if (rec.tex === id) own(idx, label)
        })
      }
      for (const si of order) {
        const scene = S.scenes[si]
        if (scene.environment) tag(scene.environment, `scene.environment (drei <Environment> cube RT) [scene ${si}]`)
        if (scene.background && scene.background.isTexture) tag(scene.background, `scene.background [scene ${si}]`)
        scene.traverse((obj) => {
          const mats = [].concat(obj.material || [])
          for (const m of mats) {
            const label = classify(obj, scene, si)
            for (const key of ['map', 'envMap', 'normalMap', 'roughnessMap', 'alphaMap', 'emissiveMap', 'transmissionMap', 'thicknessMap']) tag(m[key], `${label} .${key}`)
            if (m.uniforms) for (const k of Object.keys(m.uniforms)) tag(m.uniforms[k] && m.uniforms[k].value, `${label} uniform ${k}`)
          }
        })
      }
    }
    const canvases = [...document.querySelectorAll('canvas')].map((c) => ({ w: c.width, h: c.height, css: [c.clientWidth, c.clientHeight] }))
    return { scenes: S.scenes.length, mainScene: best, renderers: S.renderers.length, canvases }
  }
})()
