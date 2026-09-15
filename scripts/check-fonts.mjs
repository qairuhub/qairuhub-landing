#!/usr/bin/env node
/**
 * Font coverage + budget gate (docs/V3-BUILD-PLAN.md WP11).
 *
 *   node scripts/check-fonts.mjs
 *
 * 1. Parses every @font-face in src/styles/global.css (family, src url, unicode-range).
 * 2. Reads each face's cmap straight from public/ (TTF/OTF, or WOFF2 via node:zlib brotli — the
 *    cmap table is never transformed in WOFF2, so no full decoder is needed).
 * 3. FAILS if any Kazakh letter (Ә ә Ғ ғ Қ қ Ң ң Ө ө Ұ ұ Ү ү Һ һ І і, А–я, Ё ё) that a face's
 *    unicode-range claims is missing from that face's cmap, and if a family used for body/display
 *    text (Inter, Anton, Caveat) has no face that claims + covers a Kazakh letter (= fallback glyph).
 *    Latin faces must cover printable ASCII. Other claimed-but-absent code points are warnings.
 * 4. FAILS if a preload in src/styles/fonts.preload.json is missing on disk, or if the preload
 *    budget is exceeded: EN home (common + home) ≤ 700 KB, KK home (common + home + kk) ≤ 800 KB.
 * 5. FAILS if source fonts sneak back under public/ (public/fonts/src) — they would ship in dist.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { brotliDecompressSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CSS = resolve(root, 'src/styles/global.css')
const PUBLIC = resolve(root, 'public')
const PRELOAD = resolve(root, 'src/styles/fonts.preload.json')
const BUDGET = { en: 700 * 1024, kk: 800 * 1024 }
const TEXT_FAMILIES = ['Inter', 'Anton', 'Caveat']

const KK_EXTRA = [0x04d8, 0x04d9, 0x0492, 0x0493, 0x049a, 0x049b, 0x04a2, 0x04a3, 0x04e8, 0x04e9, 0x04b0, 0x04b1, 0x04ae, 0x04af, 0x04ba, 0x04bb, 0x0406, 0x0456]
const KAZAKH = [...KK_EXTRA, 0x0401, 0x0451]
for (let c = 0x0410; c <= 0x044f; c++) KAZAKH.push(c)
const ASCII = []
for (let c = 0x20; c <= 0x7e; c++) ASCII.push(c)

const errors = []
const warnings = []
const hex = (c) => 'U+' + c.toString(16).toUpperCase().padStart(4, '0') + ' ' + String.fromCodePoint(c)
const kb = (n) => (n / 1024).toFixed(1) + ' KB'

/* ------------------------------------------------------------------ CSS @font-face parsing */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function parseRange(value) {
  if (!value) return [[0, 0x10ffff]]
  return value.split(',').map((part) => {
    const token = part.trim().replace(/^u\+/i, '')
    if (token.includes('?')) return [parseInt(token.replace(/\?/g, '0'), 16), parseInt(token.replace(/\?/g, 'F'), 16)]
    const [a, b] = token.split('-')
    return [parseInt(a, 16), parseInt(b ?? a, 16)]
  })
}

function parseFaces(css) {
  const faces = []
  for (const m of stripComments(css).matchAll(/@font-face\s*{([^}]*)}/g)) {
    const body = m[1]
    const prop = (name) => body.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`))?.[1].trim()
    const family = prop('font-family')?.replace(/["']/g, '')
    const url = prop('src')?.match(/url\(\s*["']?([^"')]+)["']?\s*\)/)?.[1]
    const rangeText = prop('unicode-range')
    faces.push({ family, url, rangeText: rangeText?.replace(/\s+/g, ' ') ?? '(all)', ranges: parseRange(rangeText) })
  }
  return faces
}

const inRanges = (ranges, cp) => ranges.some(([a, b]) => cp >= a && cp <= b)

/* ------------------------------------------------------------------ sfnt / woff2 table access */
const tag4 = (dv, o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3))

const WOFF2_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill']

/** Returns { dv, tables: { tag: { offset, length } } } addressing a plain sfnt view of the tables we read. */
function openFont(buf) {
  const file = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const sig = tag4(file, 0)
  if (sig === 'wOF2') {
    const numTables = file.getUint16(12)
    const compressedLength = file.getUint32(20)
    let p = 48
    const readBase128 = () => {
      let value = 0
      for (let i = 0; i < 5; i++) {
        const byte = file.getUint8(p++)
        value = value * 128 + (byte & 0x7f)
        if (!(byte & 0x80)) return value
      }
      throw new Error('WOFF2: bad UIntBase128')
    }
    const dir = []
    for (let i = 0; i < numTables; i++) {
      const flags = file.getUint8(p++)
      const tagIndex = flags & 0x3f
      const tag = tagIndex === 63 ? tag4(file, (p += 4) - 4) : WOFF2_TAGS[tagIndex]
      const version = flags >> 6
      const origLength = readBase128()
      // glyf/loca: version 0 = transformed; every other table: version 0 = null transform.
      const transformed = tag === 'glyf' || tag === 'loca' ? version !== 3 : version !== 0
      const length = transformed ? readBase128() : origLength
      dir.push({ tag, length })
    }
    if (tag4(file, 4) === 'ttcf') throw new Error('WOFF2 collections are not supported')
    const stream = brotliDecompressSync(buf.subarray(p, p + compressedLength))
    const dv = new DataView(stream.buffer, stream.byteOffset, stream.byteLength)
    const tables = {}
    let offset = 0
    for (const { tag, length } of dir) {
      tables[tag] = { offset, length }
      offset += length
    }
    return { dv, tables, format: 'woff2' }
  }
  if (sig === 'wOFF') throw new Error('WOFF1 is not supported; ship WOFF2')
  let base = 0
  if (sig === 'ttcf') base = file.getUint32(12)
  const n = file.getUint16(base + 4)
  const tables = {}
  for (let i = 0; i < n; i++) {
    const o = base + 12 + i * 16
    tables[tag4(file, o)] = { offset: file.getUint32(o + 8), length: file.getUint32(o + 12) }
  }
  return { dv: file, tables, format: 'sfnt' }
}

/** cmap formats 0/4/6/12 (Unicode platform 0, Windows 3/1 and 3/10); glyph 0 counts as missing. */
function codepoints(dv, cmapOff) {
  const set = new Set()
  const n = dv.getUint16(cmapOff + 2)
  for (let i = 0; i < n; i++) {
    const rec = cmapOff + 4 + i * 8
    const pid = dv.getUint16(rec)
    const eid = dv.getUint16(rec + 2)
    const off = cmapOff + dv.getUint32(rec + 4)
    if (!(pid === 0 || (pid === 3 && (eid === 1 || eid === 10)))) continue
    const fmt = dv.getUint16(off)
    if (fmt === 4) {
      const segX2 = dv.getUint16(off + 6)
      const ends = off + 14
      const starts = ends + segX2 + 2
      const deltas = starts + segX2
      const ros = deltas + segX2
      for (let s = 0; s < segX2; s += 2) {
        const end = dv.getUint16(ends + s)
        const start = dv.getUint16(starts + s)
        const delta = dv.getInt16(deltas + s)
        const ro = dv.getUint16(ros + s)
        for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
          let g
          if (ro === 0) g = (cp + delta) & 0xffff
          else {
            g = dv.getUint16(ros + s + ro + (cp - start) * 2)
            if (g) g = (g + delta) & 0xffff
          }
          if (g) set.add(cp)
        }
      }
    } else if (fmt === 12) {
      const groups = dv.getUint32(off + 12)
      for (let g = 0; g < groups; g++) {
        const o = off + 16 + g * 12
        const a = dv.getUint32(o)
        const b = dv.getUint32(o + 4)
        const gid = dv.getUint32(o + 8)
        for (let cp = a; cp <= b; cp++) if (gid + (cp - a)) set.add(cp)
      }
    } else if (fmt === 6) {
      const first = dv.getUint16(off + 6)
      const count = dv.getUint16(off + 8)
      for (let k = 0; k < count; k++) if (dv.getUint16(off + 10 + k * 2)) set.add(first + k)
    } else if (fmt === 0) {
      for (let k = 0; k < 256; k++) if (dv.getUint8(off + 6 + k)) set.add(k)
    }
  }
  return set
}

/* ------------------------------------------------------------------ 1–3: coverage */
const faces = parseFaces(readFileSync(CSS, 'utf8'))
if (faces.length === 0) errors.push('no @font-face rules found in src/styles/global.css')

const rows = []
for (const face of faces) {
  if (!face.family || !face.url) {
    errors.push(`@font-face without family/src: ${JSON.stringify(face)}`)
    continue
  }
  const file = resolve(PUBLIC, face.url.replace(/^\/+/, ''))
  if (!existsSync(file)) {
    errors.push(`${face.family}: ${face.url} does not exist in public/`)
    continue
  }
  let cps
  try {
    const { dv, tables } = openFont(readFileSync(file))
    if (!tables.cmap) throw new Error('no cmap table')
    cps = codepoints(dv, tables.cmap.offset)
  } catch (e) {
    errors.push(`${face.family} ${face.url}: cannot read cmap (${e.message})`)
    continue
  }
  face.cps = cps
  const claimedKk = KAZAKH.filter((c) => inRanges(face.ranges, c))
  const missingKk = claimedKk.filter((c) => !cps.has(c))
  // A full-range face (no unicode-range) that has no Cyrillic at all is a Latin-only face (the
  // Latin wordmark); it only counts as "claiming" Kazakh if it maps at least one Cyrillic letter.
  const fullRange = face.rangeText === '(all)'
  const latinOnly = fullRange && !KAZAKH.some((c) => cps.has(c))
  if (missingKk.length && !latinOnly) {
    errors.push(`${face.family} ${face.url}: unicode-range claims Kazakh letters the font lacks: ${missingKk.map(hex).join(', ')}`)
  }
  if (inRanges(face.ranges, 0x41) && !latinOnly) {
    const missingAscii = ASCII.filter((c) => inRanges(face.ranges, c) && !cps.has(c))
    if (missingAscii.length) errors.push(`${face.family} ${face.url}: missing printable ASCII: ${missingAscii.map(hex).join(', ')}`)
  }
  if (!fullRange) {
    let absent = 0
    for (const [a, b] of face.ranges) for (let c = a; c <= b; c++) if (!cps.has(c) && !(c < 0x20) && !(c >= 0x7f && c < 0xa0)) absent++
    if (absent) warnings.push(`${face.family} ${face.url}: ${absent} code point(s) in its unicode-range are not in the font (browser falls back for those)`)
  }
  rows.push({
    family: face.family,
    file: face.url,
    size: kb(statSync(file).size),
    range: face.rangeText.length > 48 ? face.rangeText.slice(0, 45) + '…' : face.rangeText,
    kazakh: latinOnly ? 'n/a (latin-only)' : claimedKk.length ? `${claimedKk.length - missingKk.length}/${claimedKk.length}` : '—',
  })
}

for (const family of TEXT_FAMILIES) {
  const familyFaces = faces.filter((f) => f.family === family && f.cps)
  if (familyFaces.length === 0) {
    errors.push(`family "${family}" has no readable @font-face`)
    continue
  }
  // The browser picks the first face (in source order) whose unicode-range contains the character.
  const uncovered = KAZAKH.filter((c) => {
    const face = familyFaces.find((f) => inRanges(f.ranges, c))
    return !face || !face.cps.has(c)
  })
  if (uncovered.length) errors.push(`family "${family}" would fall back for: ${uncovered.map(hex).join(', ')}`)
  const asciiGaps = ASCII.filter((c) => {
    const face = familyFaces.find((f) => inRanges(f.ranges, c))
    return !face || !face.cps.has(c)
  })
  if (asciiGaps.length) errors.push(`family "${family}" would fall back for ASCII: ${asciiGaps.map(hex).join(', ')}`)
}

/* ------------------------------------------------------------------ 4: preload manifest + budget */
let budget = null
if (!existsSync(PRELOAD)) {
  errors.push('src/styles/fonts.preload.json is missing')
} else {
  const manifest = JSON.parse(readFileSync(PRELOAD, 'utf8'))
  const size = (href) => {
    const file = resolve(PUBLIC, href.replace(/^\/+/, ''))
    if (!existsSync(file)) {
      errors.push(`preload ${href} does not exist in public/`)
      return 0
    }
    if (!faces.some((f) => f.url === href) && !href.endsWith('.ttf')) warnings.push(`preload ${href} is not used by any @font-face`)
    return statSync(file).size
  }
  for (const key of ['common', 'home', 'kk']) {
    if (!Array.isArray(manifest[key])) errors.push(`fonts.preload.json: "${key}" must be an array`)
  }
  const total = (list) => [...new Set(list)].reduce((sum, href) => sum + size(href), 0)
  const en = total([...(manifest.common ?? []), ...(manifest.home ?? [])])
  const kk = total([...(manifest.common ?? []), ...(manifest.home ?? []), ...(manifest.kk ?? [])])
  budget = { en, kk }
  if (en > BUDGET.en) errors.push(`EN home preloads ${kb(en)} exceed the ${kb(BUDGET.en)} budget`)
  if (kk > BUDGET.kk) errors.push(`KK home preloads ${kb(kk)} exceed the ${kb(BUDGET.kk)} budget`)
}

/* ------------------------------------------------------------------ 5: no sources under public/ */
if (existsSync(resolve(PUBLIC, 'fonts/src'))) errors.push('public/fonts/src exists: source fonts would be deployed; keep them in fonts-src/')

/* ------------------------------------------------------------------ report */
console.table(rows)
if (budget) console.log(`preload budget: EN home ${kb(budget.en)} / ${kb(BUDGET.en)} · KK home ${kb(budget.kk)} / ${kb(BUDGET.kk)}`)
for (const w of warnings) console.warn('warn: ' + w)
if (errors.length) {
  for (const e of errors) console.error('FAIL: ' + e)
  process.exit(1)
}
console.log(`check-fonts: OK — ${faces.length} faces, every Kazakh letter covered in ${TEXT_FAMILIES.join(', ')}.`)
