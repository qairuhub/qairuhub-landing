/**
 * Minimal TrueType (glyf) parser → typeface.js font data for three's TextGeometry / drei <Text3D>.
 *
 * Why not three's TTFLoader? In three r186 `examples/jsm/loaders/TTFLoader.js` imports
 * opentype.js from a jsdelivr URL at module-evaluation time. That would make the whole page
 * depend on a third-party CDN at runtime (and fail offline), so the same conversion
 * (opentype commands → typeface.js "o" path strings) is done here on the raw glyf table.
 * Output shape mirrors TTFLoader.convert(): `m x y` · `l x y` · `q x y cx cy` · `z`.
 *
 * Shared infrastructure: the glass wordmark (hero + footer are the same mesh) loads its TTF
 * through the one Suspense cache below, so a file is fetched and parsed once per character set.
 * `useTTFFont` accepts an ordered list of candidate urls and falls through to the next one when
 * a font fails to download or parse (e.g. a CFF-flavoured file), so an odd font never takes
 * the sculpture down.
 */

/** One typeface.js glyph: horizontal advance, ink extent + outline path (and its pre-split token cache). */
export interface TypefaceGlyph {
  ha: number
  x_min: number
  x_max: number
  o: string
  _cachedOutline: string[]
}

/**
 * typeface.js font object — a superset of drei's `FontData` (the `font` prop of <Text3D>) AND
 * of three's `FontData` (`new Font(data)` from examples/jsm/loaders/FontLoader), declared
 * locally so nothing deep-imports drei's non-public `core/useFont` path.
 */
export interface TypefaceData {
  familyName: string
  resolution: number
  boundingBox: { xMin: number; yMin: number; xMax: number; yMax: number }
  ascender: number
  descender: number
  underlinePosition: number
  underlineThickness: number
  original_font_information: Record<string, string>
  glyphs: { [char: string]: TypefaceGlyph }
}

interface Point {
  x: number
  y: number
  on: boolean
}
interface Tables {
  [tag: string]: { offset: number; length: number }
}

const ON_CURVE = 0x01
const X_SHORT = 0x02
const Y_SHORT = 0x04
const REPEAT = 0x08
const X_SAME = 0x10
const Y_SAME = 0x20

// Composite glyph flags
const ARG_1_AND_2_ARE_WORDS = 0x0001
const ARGS_ARE_XY_VALUES = 0x0002
const WE_HAVE_A_SCALE = 0x0008
const MORE_COMPONENTS = 0x0020
const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040
const WE_HAVE_A_TWO_BY_TWO = 0x0080

function readTables(dv: DataView): Tables {
  const numTables = dv.getUint16(4)
  const tables: Tables = {}
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16
    const tag = String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3))
    tables[tag] = { offset: dv.getUint32(o + 8), length: dv.getUint32(o + 12) }
  }
  return tables
}

/** cmap lookup: prefers a Unicode format 4 subtable, falls back to format 12. */
function buildCmap(dv: DataView, cmapOffset: number): (codePoint: number) => number {
  const n = dv.getUint16(cmapOffset + 2)
  let f4 = -1
  let f12 = -1
  for (let i = 0; i < n; i++) {
    const rec = cmapOffset + 4 + i * 8
    const platform = dv.getUint16(rec)
    const encoding = dv.getUint16(rec + 2)
    const off = cmapOffset + dv.getUint32(rec + 4)
    const format = dv.getUint16(off)
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))
    if (!unicode) continue
    if (format === 4 && f4 < 0) f4 = off
    if (format === 12 && f12 < 0) f12 = off
  }
  if (f4 >= 0) {
    const segX2 = dv.getUint16(f4 + 6)
    const ends = f4 + 14
    const starts = ends + segX2 + 2
    const deltas = starts + segX2
    const rangeOffsets = deltas + segX2
    return (cp) => {
      if (cp > 0xffff) return 0
      for (let s = 0; s < segX2; s += 2) {
        const end = dv.getUint16(ends + s)
        if (cp > end) continue
        const start = dv.getUint16(starts + s)
        if (cp < start) return 0
        const delta = dv.getInt16(deltas + s)
        const ro = dv.getUint16(rangeOffsets + s)
        if (ro === 0) return (cp + delta) & 0xffff
        const addr = rangeOffsets + s + ro + (cp - start) * 2
        const g = dv.getUint16(addr)
        return g === 0 ? 0 : (g + delta) & 0xffff
      }
      return 0
    }
  }
  if (f12 >= 0) {
    const nGroups = dv.getUint32(f12 + 12)
    return (cp) => {
      for (let g = 0; g < nGroups; g++) {
        const o = f12 + 16 + g * 12
        const start = dv.getUint32(o)
        const end = dv.getUint32(o + 4)
        if (cp >= start && cp <= end) return dv.getUint32(o + 8) + (cp - start)
      }
      return 0
    }
  }
  return () => 0
}

export function parseTTF(buffer: ArrayBuffer, chars: string, familyName = 'Font'): TypefaceData {
  const dv = new DataView(buffer)
  const t = readTables(dv)
  const need = ['head', 'maxp', 'hhea', 'hmtx', 'loca', 'glyf', 'cmap']
  for (const tag of need) if (!t[tag]) throw new Error('TTF: missing ' + tag + ' table (CFF fonts are not supported)')

  const head = t.head.offset
  const unitsPerEm = dv.getUint16(head + 18) || 1000
  const xMin = dv.getInt16(head + 36)
  const yMin = dv.getInt16(head + 38)
  const xMax = dv.getInt16(head + 40)
  const yMax = dv.getInt16(head + 42)
  const longLoca = dv.getInt16(head + 50) === 1
  const numGlyphs = dv.getUint16(t.maxp.offset + 4)
  const hhea = t.hhea.offset
  const ascender = dv.getInt16(hhea + 4)
  const descender = dv.getInt16(hhea + 6)
  const numHMetrics = dv.getUint16(hhea + 34)
  const underlinePosition = t.post ? dv.getInt16(t.post.offset + 8) : -100
  const underlineThickness = t.post ? dv.getInt16(t.post.offset + 10) : 50
  const cmap = buildCmap(dv, t.cmap.offset)

  const glyphRange = (index: number): [number, number] | null => {
    if (index < 0 || index >= numGlyphs) return null
    const loca = t.loca.offset
    const a = longLoca ? dv.getUint32(loca + index * 4) : dv.getUint16(loca + index * 2) * 2
    const b = longLoca ? dv.getUint32(loca + index * 4 + 4) : dv.getUint16(loca + index * 2 + 2) * 2
    return b > a ? [t.glyf.offset + a, t.glyf.offset + b] : null
  }

  const advance = (index: number) => {
    const i = Math.min(index, numHMetrics - 1)
    return dv.getUint16(t.hmtx.offset + i * 4)
  }

  /** Contours (arrays of points) in font units. Composites are resolved recursively. */
  const readContours = (index: number, depth = 0): Point[][] => {
    const range = glyphRange(index)
    if (!range || depth > 4) return []
    let p = range[0]
    const numberOfContours = dv.getInt16(p)
    p += 10
    if (numberOfContours >= 0) {
      const endPts: number[] = []
      for (let i = 0; i < numberOfContours; i++) {
        endPts.push(dv.getUint16(p))
        p += 2
      }
      const numPoints = numberOfContours ? endPts[numberOfContours - 1] + 1 : 0
      const insLen = dv.getUint16(p)
      p += 2 + insLen
      const flags = new Uint8Array(numPoints)
      for (let i = 0; i < numPoints; ) {
        const f = dv.getUint8(p++)
        flags[i++] = f
        if (f & REPEAT) {
          let r = dv.getUint8(p++)
          while (r-- > 0 && i < numPoints) flags[i++] = f
        }
      }
      const xs = new Int32Array(numPoints)
      let v = 0
      for (let i = 0; i < numPoints; i++) {
        const f = flags[i]
        if (f & X_SHORT) {
          const d = dv.getUint8(p++)
          v += f & X_SAME ? d : -d
        } else if (!(f & X_SAME)) {
          v += dv.getInt16(p)
          p += 2
        }
        xs[i] = v
      }
      const ys = new Int32Array(numPoints)
      v = 0
      for (let i = 0; i < numPoints; i++) {
        const f = flags[i]
        if (f & Y_SHORT) {
          const d = dv.getUint8(p++)
          v += f & Y_SAME ? d : -d
        } else if (!(f & Y_SAME)) {
          v += dv.getInt16(p)
          p += 2
        }
        ys[i] = v
      }
      const contours: Point[][] = []
      let start = 0
      for (let c = 0; c < numberOfContours; c++) {
        const end = endPts[c]
        const pts: Point[] = []
        for (let i = start; i <= end; i++) pts.push({ x: xs[i], y: ys[i], on: (flags[i] & ON_CURVE) !== 0 })
        if (pts.length) contours.push(pts)
        start = end + 1
      }
      return contours
    }

    // Composite glyph
    const out: Point[][] = []
    for (;;) {
      const flags = dv.getUint16(p)
      const glyphIndex = dv.getUint16(p + 2)
      p += 4
      let dx = 0
      let dy = 0
      if (flags & ARG_1_AND_2_ARE_WORDS) {
        dx = dv.getInt16(p)
        dy = dv.getInt16(p + 2)
        p += 4
      } else {
        dx = dv.getInt8(p)
        dy = dv.getInt8(p + 1)
        p += 2
      }
      if (!(flags & ARGS_ARE_XY_VALUES)) {
        dx = 0
        dy = 0
      }
      let a = 1
      let b = 0
      let c = 0
      let d = 1
      const f2 = (o: number) => dv.getInt16(o) / 16384
      if (flags & WE_HAVE_A_SCALE) {
        a = d = f2(p)
        p += 2
      } else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) {
        a = f2(p)
        d = f2(p + 2)
        p += 4
      } else if (flags & WE_HAVE_A_TWO_BY_TWO) {
        a = f2(p)
        b = f2(p + 2)
        c = f2(p + 4)
        d = f2(p + 6)
        p += 8
      }
      const sub = readContours(glyphIndex, depth + 1)
      for (const contour of sub) {
        out.push(contour.map((pt) => ({ x: a * pt.x + c * pt.y + dx, y: b * pt.x + d * pt.y + dy, on: pt.on })))
      }
      if (!(flags & MORE_COMPONENTS)) break
    }
    return out
  }

  /** TrueType quadratic contours → typeface.js path string (implied on-curve midpoints resolved). */
  const contoursToPath = (contours: Point[][]): string => {
    let o = ''
    const r = Math.round
    for (const pts of contours) {
      const n = pts.length
      if (n === 0) continue
      let startIdx = pts.findIndex((pt) => pt.on)
      let sx: number
      let sy: number
      if (startIdx < 0) {
        // All points off-curve: start on the implied midpoint between the last and first.
        startIdx = 0
        sx = (pts[0].x + pts[n - 1].x) / 2
        sy = (pts[0].y + pts[n - 1].y) / 2
      } else {
        sx = pts[startIdx].x
        sy = pts[startIdx].y
      }
      o += 'm ' + r(sx) + ' ' + r(sy) + ' '
      let ctrl: Point | null = null
      const emit = (pt: Point) => {
        if (pt.on) {
          if (ctrl) {
            o += 'q ' + r(pt.x) + ' ' + r(pt.y) + ' ' + r(ctrl.x) + ' ' + r(ctrl.y) + ' '
            ctrl = null
          } else {
            o += 'l ' + r(pt.x) + ' ' + r(pt.y) + ' '
          }
        } else if (ctrl) {
          const mx = (ctrl.x + pt.x) / 2
          const my = (ctrl.y + pt.y) / 2
          o += 'q ' + r(mx) + ' ' + r(my) + ' ' + r(ctrl.x) + ' ' + r(ctrl.y) + ' '
          ctrl = pt
        } else {
          ctrl = pt
        }
      }
      const startOn = pts[startIdx].on
      const first = startOn ? startIdx + 1 : startIdx
      const count = startOn ? n - 1 : n
      for (let k = 0; k < count; k++) emit(pts[(first + k) % n])
      emit({ x: sx, y: sy, on: true })
      o += 'z '
    }
    return o.trim()
  }

  const glyphs: TypefaceData['glyphs'] = {}
  const unique = Array.from(new Set(Array.from(chars + '?')))
  for (const ch of unique) {
    const cp = ch.codePointAt(0)
    if (cp === undefined) continue
    const index = cmap(cp)
    if (index === 0 && ch !== '?') continue
    const contours = readContours(index)
    let gxMin = 0
    let gxMax = 0
    if (contours.length) {
      gxMin = Infinity
      gxMax = -Infinity
      for (const c of contours) {
        for (const pt of c) {
          if (pt.x < gxMin) gxMin = pt.x
          if (pt.x > gxMax) gxMax = pt.x
        }
      }
    }
    const o = contoursToPath(contours)
    glyphs[ch] = { ha: advance(index), x_min: Math.round(gxMin), x_max: Math.round(gxMax), o, _cachedOutline: o.split(' ') }
  }

  return {
    familyName,
    resolution: unitsPerEm,
    boundingBox: { xMin, yMin, xMax, yMax },
    ascender,
    descender,
    underlinePosition,
    underlineThickness,
    original_font_information: {},
    glyphs,
  }
}

/** Every requested character (whitespace aside) must have produced an outline, else the font is unusable. */
function assertOutlines(data: TypefaceData, chars: string, url: string): void {
  for (const ch of chars) {
    if (/\s/.test(ch)) continue
    const g = data.glyphs[ch]
    if (!g || g.o.length === 0) throw new Error('TTF: "' + ch + '" has no outline in ' + url)
  }
}

/* ------------------------------------------------------------------ Suspense resource */

interface Resource {
  status: 'pending' | 'done' | 'error'
  value?: TypefaceData
  error?: unknown
  promise: Promise<void>
}
const cache = new Map<string, Resource>()

async function loadOne(url: string, chars: string): Promise<TypefaceData> {
  const r = await fetch(url)
  if (!r.ok) throw new Error('TTF: HTTP ' + r.status + ' loading ' + url)
  const data = parseTTF(await r.arrayBuffer(), chars, url.split('/').pop() ?? 'Font')
  assertOutlines(data, chars, url)
  return data
}

/** Tries each candidate in order; resolves with the first font that downloads AND parses. */
async function loadFirst(urls: readonly string[], chars: string): Promise<TypefaceData> {
  let lastError: unknown = new Error('TTF: no font url given')
  for (const url of urls) {
    try {
      return await loadOne(url, chars)
    } catch (e) {
      lastError = e
      if (import.meta.env.DEV) console.warn('[ttf] ' + url + ' failed, trying the next candidate', e)
    }
  }
  throw lastError
}

function resource(urls: readonly string[], chars: string): Resource {
  const key = urls.join('|') + '::' + chars
  let res = cache.get(key)
  if (!res) {
    const entry: Resource = {
      status: 'pending',
      promise: loadFirst(urls, chars)
        .then((data) => {
          entry.value = data
          entry.status = 'done'
        })
        .catch((e: unknown) => {
          entry.error = e
          entry.status = 'error'
        }),
    }
    res = entry
    cache.set(key, res)
  }
  return res
}

/** Start the download early (e.g. at module evaluation) so the first render does not wait on the network. */
export function preloadTTFFont(url: string | readonly string[], chars: string): void {
  if (typeof fetch !== 'function') return
  resource(typeof url === 'string' ? [url] : url, chars)
}

/**
 * Suspense-style loader: throws the pending promise (render nothing via <Suspense fallback={null}>),
 * throws the error to the nearest error boundary, otherwise returns a stable TypefaceData reference
 * (stable identity matters — the glass geometry cache keys on it). `url` may be an ordered list
 * of candidates: the first one that downloads and parses wins (fallback fonts).
 */
export function useTTFFont(url: string | readonly string[], chars: string): TypefaceData {
  const res = resource(typeof url === 'string' ? [url] : url, chars)
  if (res.status === 'pending') throw res.promise
  if (res.status === 'error') throw res.error
  return res.value as TypefaceData
}
