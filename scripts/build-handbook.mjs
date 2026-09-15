#!/usr/bin/env node
/**
 * QairuHub Handbook pipeline (AGENT-SPEC §4.1, V3-BUILD-PLAN D4). Owned by WP4.
 *
 * Reads docs/HANDBOOK.md and writes three generated, git-ignored files:
 *   functions/_generated/handbook-index.json   bundled into /api/ask
 *   public/handbook-index.json                 lazy client offline fallback
 *   src/data/handbook.generated.ts             /handbook page: TOC + sanitised HTML with anchors
 *
 * Chunking: every `### H3` is one chunk (parent `## H2` kept as `section`); the
 * `<!-- kw: … -->` comment becomes `kw`; every HTML comment is stripped from the text; chunks over
 * 320 words split at a paragraph boundary with a 40-word overlap.
 *
 * The build FAILS on: a chunk under 40 words, a missing kw line, a duplicate anchor, a missing
 * anchor that the site or Q links to, any email / phone / personal @handle / t.me invite pattern,
 * or an index over the 120 KB budget.
 *
 * Markdown is rendered here by a tiny purpose-built renderer (headings, paragraphs, nested lists,
 * tables, bold, inline code, links). Every character of source text is HTML-escaped; links are
 * limited to https URLs on an allowlist of hosts and to same-page anchors.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { buildIndex, slugify } from '../shared/handbookSearch.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// HANDBOOK_SOURCE / HANDBOOK_DRY_RUN=1 let the guards be tested against a scratch copy without writing outputs.
const SOURCE = process.env.HANDBOOK_SOURCE ? resolve(process.env.HANDBOOK_SOURCE) : resolve(root, 'docs/HANDBOOK.md')
const DRY_RUN = process.env.HANDBOOK_DRY_RUN === '1'
const OUT_FUNCTIONS = 'functions/_generated/handbook-index.json'
const OUT_PUBLIC = 'public/handbook-index.json'
const OUT_TS = 'src/data/handbook.generated.ts'

const MIN_WORDS = 40
const SPLIT_WORDS = 320
const OVERLAP_WORDS = 40
const INDEX_BUDGET_BYTES = 120 * 1024

/** Anchors that CONTENT-V3, the selection rules (AGENT-SPEC §4.4) or the offline copy rely on. */
const REQUIRED_ANCHORS = [
  'getting-your-project-featured-on-this-site',
  'platform-rules',
  'privacy-on-this-site',
  'qairuhubs-principles',
  'who-to-ask-about-what',
  'join-qairuhub-in-four-steps',
  'qairuhub-in-one-paragraph',
  'coming-up-and-later',
  'official-qairuhub-links',
]

const errors = []
const fail = (msg) => errors.push(msg)

/* ---------------------------------------------------------------------------------------- */
/* Read + private-data guard                                                                */
/* ---------------------------------------------------------------------------------------- */

const md = readFileSync(SOURCE, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
const version = createHash('sha256').update(md).digest('hex').slice(0, 12)
const lines = md.split('\n')

const PRIVATE_PATTERNS = [
  ['email address', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g],
  ['international phone number', /\+\d[\d\s().-]{8,}\d/g],
  ['Kazakhstan phone number', /(?<!\d)8[\s(-]*7\d{2}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?!\d)/g],
  ['long digit run (phone?)', /(?<!\d)\d{10,}(?!\d)/g],
  ['personal @handle', /(?<![\w.@/])@(?!qairuhub\b)(?!qairu\.edu\.kz\b)[A-Za-z0-9_]{5,32}\b/g],
  ['Telegram link other than t.me/qairuhub', /t\.me\/(?!qairuhub\b)[\w+/-]+/g],
]
lines.forEach((line, i) => {
  for (const [label, re] of PRIVATE_PATTERNS) {
    re.lastIndex = 0
    const m = re.exec(line)
    if (m) fail(`HANDBOOK.md:${i + 1}: ${label} is not allowed in the Handbook ("${m[0]}")`)
  }
})

/* ---------------------------------------------------------------------------------------- */
/* Parse into H1 / preamble / H2 sections / H3 chunks                                       */
/* ---------------------------------------------------------------------------------------- */

const doc = { title: '', preamble: [], sections: [] }
let section = null
let chunk = null
lines.forEach((line, i) => {
  const h = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line)
  if (h && h[1].length === 1 && !doc.title) {
    doc.title = h[2]
    return
  }
  if (h && h[1].length === 2) {
    section = { title: h[2], line: i + 1, intro: [], chunks: [] }
    doc.sections.push(section)
    chunk = null
    return
  }
  if (h && h[1].length === 3) {
    if (!section) {
      fail(`HANDBOOK.md:${i + 1}: H3 "${h[2]}" has no parent H2`)
      return
    }
    chunk = { title: h[2], line: i + 1, lines: [] }
    section.chunks.push(chunk)
    return
  }
  if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return // horizontal rules separate H2s only
  if (chunk) chunk.lines.push(line)
  else if (section) section.intro.push(line)
  else doc.preamble.push(line)
})

const updatedMatch = /\*\*Last updated:\*\*\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(md)
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
let updated = ''
if (updatedMatch) {
  const month = MONTHS.indexOf(updatedMatch[2].toLowerCase()) + 1
  if (month > 0) updated = `${updatedMatch[3]}-${String(month).padStart(2, '0')}-${updatedMatch[1].padStart(2, '0')}`
}
if (!updated) fail('HANDBOOK.md: missing or unparseable "**Last updated:** D Month YYYY" line')

/* ---------------------------------------------------------------------------------------- */
/* Anchors                                                                                  */
/* ---------------------------------------------------------------------------------------- */

const anchors = new Set()
for (const s of doc.sections) {
  for (const c of s.chunks) {
    c.id = slugify(c.title)
    if (!c.id) fail(`HANDBOOK.md:${c.line}: H3 "${c.title}" produces an empty anchor`)
    else if (anchors.has(c.id)) fail(`HANDBOOK.md:${c.line}: duplicate anchor "#${c.id}"`)
    anchors.add(c.id)
  }
}
for (const s of doc.sections) {
  // H2 anchors share the namespace; an H2 that collides with an H3 gets -2, -3 (H3 anchors are stable).
  const base = slugify(s.title) || 'section'
  let id = base
  for (let n = 2; anchors.has(id); n++) id = `${base}-${n}`
  s.id = id
  anchors.add(id)
}
for (const a of REQUIRED_ANCHORS) if (!anchors.has(a)) fail(`HANDBOOK.md: required anchor "#${a}" is missing`)

/* ---------------------------------------------------------------------------------------- */
/* Chunks for the index                                                                     */
/* ---------------------------------------------------------------------------------------- */

const COMMENT = /<!--[\s\S]*?-->/g
const KW = /<!--\s*kw:\s*([\s\S]*?)-->/
const countWords = (text) => (text.match(/\S+/g) ?? []).length

function splitLong(text) {
  if (countWords(text) <= SPLIT_WORDS) return [text]
  const paragraphs = text.split(/\n{2,}/)
  const parts = []
  let current = []
  let words = 0
  for (const p of paragraphs) {
    const pw = countWords(p)
    if (current.length && words + pw > SPLIT_WORDS) {
      parts.push(current.join('\n\n'))
      const overlap = current.join(' ').split(/\s+/).slice(-OVERLAP_WORDS).join(' ')
      current = [overlap]
      words = OVERLAP_WORDS
    }
    current.push(p)
    words += pw
  }
  if (current.length) parts.push(current.join('\n\n'))
  return parts
}

const rawChunks = []
for (const s of doc.sections) {
  if (s.intro.join('').trim()) {
    // Intro text under an H2 renders on the page but is not a retrieval chunk.
  }
  for (const c of s.chunks) {
    const source = c.lines.join('\n')
    const kwMatch = KW.exec(source)
    if (!kwMatch) fail(`HANDBOOK.md:${c.line}: chunk "#${c.id}" has no <!-- kw: … --> line`)
    const kw = kwMatch ? kwMatch[1].replace(/\s+/g, ' ').trim() : ''
    const text = source.replace(COMMENT, '').replace(/\n{3,}/g, '\n\n').trim()
    const words = countWords(text)
    if (words < MIN_WORDS) fail(`HANDBOOK.md:${c.line}: chunk "#${c.id}" has ${words} words (minimum ${MIN_WORDS})`)
    splitLong(text).forEach((part, i) => {
      rawChunks.push({
        id: i === 0 ? c.id : `${c.id}-${i + 1}`,
        section: s.title,
        title: c.title,
        url: `/handbook#${c.id}`,
        text: part,
        kw,
      })
    })
  }
}
const chunkIds = new Set()
for (const c of rawChunks) {
  if (chunkIds.has(c.id)) fail(`chunk id "${c.id}" is duplicated after splitting; rename the heading`)
  chunkIds.add(c.id)
}

/* ---------------------------------------------------------------------------------------- */
/* Tiny safe Markdown renderer                                                              */
/* ---------------------------------------------------------------------------------------- */

const LINK_HOSTS = [
  'qairuhub.com',
  'community.qairuhub.com',
  'qairuhub-landing.pages.dev',
  't.me',
  'instagram.com',
  'github.com',
  'hackalem.ai',
  'forms.gle',
  'theqairubook-app-production.up.railway.app',
]

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function safeHref(url) {
  if (/^#[\p{L}\p{N}-]+$/u.test(url)) return url
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return null
    if (!LINK_HOSTS.includes(u.hostname)) return null
    return u.href
  } catch {
    return null
  }
}

function anchorHtml(href, labelHtml) {
  if (href.startsWith('#')) return `<a href="${escapeHtml(href)}">${labelHtml}</a>`
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${labelHtml}</a>`
}

/** Bare https URLs and bare allowlisted domains (community.qairuhub.com/sign-up, t.me/qairuhub, …). */
const AUTOLINK =
  /(?<![\w/@.-])(https:\/\/[^\s<>()]+|(?:community\.qairuhub\.com|qairuhub-landing\.pages\.dev|theqairubook-app-production\.up\.railway\.app|qairuhub\.com|hackalem\.ai)(?:\/[\w\-./#]*)?|(?:t\.me|instagram\.com)\/qairuhub\b|github\.com\/[\w-]+(?:\/[\w.-]+)?|forms\.gle\/\w+)/g

function autolink(escaped) {
  return escaped.replace(AUTOLINK, (match) => {
    const trail = /[.,;:!?]+$/.exec(match)?.[0] ?? ''
    const core = trail ? match.slice(0, -trail.length) : match
    const plain = core.replace(/&amp;/g, '&')
    const href = safeHref(plain.startsWith('https://') ? plain : `https://${plain}`)
    return href ? `${anchorHtml(href, core)}${trail}` : match
  })
}

function inline(text) {
  const held = []
  const hold = (html) => `\u0000${held.push(html) - 1}\u0000`
  let s = text.replace(/`([^`]+)`/g, (_, code) => hold(`<code>${escapeHtml(code)}</code>`))
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const href = safeHref(url)
    const labelHtml = escapeHtml(label).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    return href ? hold(anchorHtml(href, labelHtml)) : hold(labelHtml)
  })
  s = escapeHtml(s)
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
  s = autolink(s)
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => held[Number(i)])
}

function renderTable(rows) {
  const cells = (row) =>
    row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim())
  const [head, sep, ...body] = rows
  if (!sep || !/^\s*\|?\s*:?-{2,}/.test(sep)) {
    return rows.map((r) => `<p>${inline(r)}</p>`).join('\n')
  }
  const th = cells(head).map((c) => `<th scope="col">${inline(c)}</th>`).join('')
  const trs = body.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('\n')
  return `<div class="hb-table"><table>\n<thead><tr>${th}</tr></thead>\n<tbody>\n${trs}\n</tbody>\n</table></div>`
}

function renderList(items, start = 0, indent = items[0]?.indent ?? 0) {
  // items: { indent, ordered, text }[] ; returns [html, nextIndex]
  const ordered = items[start].ordered
  const tag = ordered ? 'ol' : 'ul'
  let html = `<${tag}>`
  let i = start
  while (i < items.length && items[i].indent >= indent) {
    if (items[i].indent > indent) {
      const [nested, next] = renderList(items, i, items[i].indent)
      html = html.replace(/<\/li>$/, `${nested}</li>`)
      i = next
      continue
    }
    html += `<li>${inline(items[i].text)}</li>`
    i++
  }
  return [`${html}</${tag}>`, i]
}

function renderBlocks(blockLines) {
  const out = []
  const src = blockLines.join('\n').replace(COMMENT, '').split('\n')
  let i = 0
  while (i < src.length) {
    const line = src[i]
    if (!line.trim()) {
      i++
      continue
    }
    const h = /^(#{4,6})\s+(.+)$/.exec(line)
    if (h) {
      out.push(`<h4>${inline(h[2])}</h4>`)
      i++
      continue
    }
    if (line.trim().startsWith('|')) {
      const rows = []
      while (i < src.length && src[i].trim().startsWith('|')) rows.push(src[i++])
      out.push(renderTable(rows))
      continue
    }
    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
      const items = []
      while (i < src.length && src[i].trim()) {
        const m = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(src[i])
        if (m) items.push({ indent: m[1].replace(/\t/g, '  ').length, ordered: /\d/.test(m[2]), text: m[3] })
        else if (items.length) items[items.length - 1].text += ` ${src[i].trim()}`
        i++
      }
      out.push(renderList(items)[0])
      continue
    }
    const para = []
    while (i < src.length && src[i].trim() && !/^\s*(?:[-*+]|\d+\.)\s+/.test(src[i]) && !src[i].trim().startsWith('|') && !/^#{4,6}\s/.test(src[i])) {
      para.push(src[i++])
    }
    // A line that is only bold (FAQ questions) or ends with two spaces keeps its line break.
    const html = para
      .map((l, k) => {
        const rendered = inline(l.trim())
        if (k === para.length - 1) return rendered
        return /^\*\*.+\*\*$/.test(l.trim()) || / {2}$/.test(l) ? `${rendered}<br>` : `${rendered} `
      })
      .join('')
    out.push(`<p>${html}</p>`)
  }
  return out.join('\n')
}

const toc = []
const htmlParts = []
for (const s of doc.sections) {
  toc.push({ id: s.id, title: s.title, level: 2 })
  htmlParts.push(`<section class="hb-section" aria-labelledby="${s.id}">`)
  htmlParts.push(`<h2 id="${s.id}">${inline(s.title)}</h2>`)
  const intro = renderBlocks(s.intro)
  if (intro) htmlParts.push(intro)
  for (const c of s.chunks) {
    toc.push({ id: c.id, title: c.title, level: 3, parent: s.id })
    htmlParts.push(`<h3 id="${c.id}"><a class="hb-anchor" href="#${c.id}">${inline(c.title)}</a></h3>`)
    htmlParts.push(renderBlocks(c.lines))
  }
  htmlParts.push('</section>')
}
const html = htmlParts.join('\n')
const preambleHtml = renderBlocks(doc.preamble)

// Defence in depth: the renderer must never emit raw tags other than its own vocabulary.
const ALLOWED_TAGS = new Set(['section', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'code', 'a', 'br', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'])
for (const m of `${html}${preambleHtml}`.matchAll(/<\/?([a-zA-Z0-9]+)/g)) {
  if (!ALLOWED_TAGS.has(m[1].toLowerCase())) fail(`renderer emitted a disallowed <${m[1]}> tag`)
}

/* ---------------------------------------------------------------------------------------- */
/* Outputs                                                                                  */
/* ---------------------------------------------------------------------------------------- */

const index = buildIndex({ version, updated, chunks: rawChunks })
const indexJson = `${JSON.stringify(index)}\n`
const indexBytes = Buffer.byteLength(indexJson)
if (indexBytes > INDEX_BUDGET_BYTES) {
  fail(`handbook-index.json is ${(indexBytes / 1024).toFixed(1)} KB (budget ${INDEX_BUDGET_BYTES / 1024} KB)`)
}

if (errors.length) {
  console.error(`build-handbook: ${errors.length} error(s)`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

const generatedTs = `/* GENERATED by scripts/build-handbook.mjs from docs/HANDBOOK.md. Do not edit; git-ignored. */
export interface HandbookTocEntry {
  id: string
  title: string
  level: 2 | 3
  /** id of the parent H2 (level 3 only) */
  parent?: string
}

export interface HandbookDoc {
  /** sha256(HANDBOOK.md), first 12 hex chars; matches handbook-index.json */
  version: string
  /** ISO date from the "Last updated" line */
  updated: string
  /** the H1 of HANDBOOK.md */
  title: string
  /** H2 + H3 entries in document order; ids are the element ids in \`html\` */
  toc: HandbookTocEntry[]
  /**
   * Sanitised HTML of every H2 section (H1 and preamble excluded; the page renders its own title,
   * intro, date and legend). Vocabulary: section.hb-section, h2[id], h3[id] > a.hb-anchor, h4, p, ul, ol,
   * li, strong, code, br, div.hb-table > table, a (external: target=_blank rel=noopener noreferrer).
   */
  html: string
  /** Sanitised HTML of the preamble under the H1 (last updated, language, status labels). */
  preambleHtml: string
}

export const handbook: HandbookDoc = {
  version: ${JSON.stringify(version)},
  updated: ${JSON.stringify(updated)},
  title: ${JSON.stringify(doc.title)},
  toc: ${JSON.stringify(toc, null, 2).replace(/\n/g, '\n  ')},
  html: ${JSON.stringify(html)},
  preambleHtml: ${JSON.stringify(preambleHtml)},
}
`

function write(rel, contents) {
  if (DRY_RUN) {
    console.log(`build-handbook (dry run): would write ${rel} (${(Buffer.byteLength(contents) / 1024).toFixed(1)} KB)`)
    return
  }
  const file = resolve(root, rel)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, contents)
  const bytes = Buffer.byteLength(contents)
  const gz = gzipSync(contents).length
  console.log(`build-handbook: wrote ${rel} (${(bytes / 1024).toFixed(1)} KB, ${(gz / 1024).toFixed(1)} KB gzip)`)
}

write(OUT_FUNCTIONS, indexJson)
write(OUT_PUBLIC, indexJson)
write(OUT_TS, generatedTs)
console.log(
  `build-handbook: version ${version}, updated ${updated}, ${doc.sections.length} sections, ${rawChunks.length} chunks, ${Object.keys(index.df).length} terms`,
)
