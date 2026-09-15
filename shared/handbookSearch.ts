/**
 * QairuHub Handbook retrieval: tokenizer (EN/KK/RU), BM25F-lite ranking, context selection and
 * the offline answer renderer (AGENT-SPEC §4.1–§4.4, §9). Owned by WP4.
 *
 * One module, three callers:
 *   - functions/api/ask.ts           ranks the bundled index for every question
 *   - scripts/build-handbook.mjs     builds the index (`buildIndex`, `slugify`)
 *   - the browser (WP3)              client-only fallback when /api/ask is unreachable:
 *       const { answerOffline } = await import('../../shared/handbookSearch')
 *       const index = await (await fetch('/handbook-index.json')).json()
 *       const { text, sources } = answerOffline(index, question, { locale, previous })
 *
 * Must stay runtime-agnostic (no DOM, no Node, no Workers globals) and use only erasable
 * TypeScript syntax, because Node imports this file directly with type stripping.
 */

export type HandbookLocale = 'en' | 'kk'
/** Language of an answer: the page locale, or Russian when the question is written in Russian. */
export type AnswerLang = 'en' | 'kk' | 'ru'

export interface FieldCounts {
  title: number
  kw: number
  body: number
}

export type HandbookField = keyof FieldCounts

export interface HandbookChunk {
  id: string
  section: string
  title: string
  /** `/handbook#<id>` (split parts keep the anchor of their H3) */
  url: string
  /** plain Markdown, comments stripped */
  text: string
  /**
   * The raw `<!-- kw: … -->` synonyms. Present on build input only: the emitted index drops the
   * string (its terms live in `tf.kw` / `len.kw`) to stay inside the 120 KB index budget.
   */
  kw?: string
  tf: { title: Record<string, number>; kw: Record<string, number>; body: Record<string, number> }
  len: FieldCounts
}

/** AGENT-SPEC §4.1 index schema (`BookIndex` there). */
export interface HandbookIndex {
  /** sha256(HANDBOOK.md), first 12 hex chars */
  version: string
  /** "2026-09-14", parsed from the "Last updated" line */
  updated: string
  avgLen: FieldCounts
  /** document frequency per stemmed token */
  df: Record<string, number>
  chunks: HandbookChunk[]
}

export interface SearchResult {
  chunk: HandbookChunk
  score: number
}

export interface HandbookSource {
  id: string
  title: string
  url: string
}

/** Raw chunk as produced by the build script, before term statistics are added. */
export interface RawChunk {
  id: string
  section: string
  title: string
  url: string
  text: string
  kw: string
}

/* ------------------------------------------------------------------------------------------ */
/* Parameters                                                                                 */
/* ------------------------------------------------------------------------------------------ */

/**
 * Defaults mirror wrangler.toml [vars]. `minScore` is tuned on the eval set: with BM25F-lite a single
 * on-topic term that appears in a dozen chunks ("join", "events", "mentorship") scores 0.9–1.1, so
 * 0.8 keeps the chip questions answerable offline while empty or brand-only questions stay weak.
 */
export const SEARCH_DEFAULTS = {
  topK: 5,
  minScore: 0.8,
  contextChars: 9000,
} as const

const K1 = 1.2
const B = 0.75
const FIELD_WEIGHTS: FieldCounts = { title: 3, kw: 2, body: 1 }
const STEM_LENGTH = 6
/** A follow-up with fewer tokens than this borrows the previous user message at half weight. */
const FOLLOW_UP_TOKENS = 5
const RELATIVE_CUTOFF = 0.3
const SOURCES_MAX = 3
const OFFLINE_MAX = 3
const SNIPPET_CHARS = 260

/** Chunks pinned by the selection rules (slugs of H3 headings in docs/HANDBOOK.md). */
export const PINNED_IDS = {
  overview: 'qairuhub-in-one-paragraph',
  join: 'join-qairuhub-in-four-steps',
  timeline: 'coming-up-and-later',
} as const

/* ------------------------------------------------------------------------------------------ */
/* Tokenizer                                                                                  */
/* ------------------------------------------------------------------------------------------ */

const STOPWORDS_EN =
  'com www http https a an the and or but if of to in on at by for with from as is are was were be been being am do does did doing have has had having i me my mine we us our you your yours he him his she her it its they them their this that these those there here what which whom how when where can could would should will shall may might must so than too very just about into over also any all some such only own same other more most please tell let im ive youre dont doesnt isnt arent'
const STOPWORDS_KK =
  'және мен бен пен да де та те ма ме ба бе па пе бұл сол осы ол сен сіз біз олар не қалай қандай неше үшін туралы бар болады бола ғой ғана керек әлі тағы немесе иә егер маған саған оның менің сенің бізге'
const STOPWORDS_RU =
  'и в во не что он на с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь даже ну ли если уже или ни быть был него до вас нибудь уж вам ведь там потом себя ей может они тут есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда этот того потому этого какой совсем ним здесь этом почти мой тем чтобы нее сейчас были куда всех можно при об хоть после над больше тот через эти нас про всего них какая много разве эту моя свою этой перед том такой им более всегда между как какие какую скажи пожалуйста'

function stopwordSet(...lists: string[]): Set<string> {
  const set = new Set<string>()
  for (const list of lists) for (const w of list.split(' ')) if (w) set.add(normalizeText(w))
  return set
}

/** NFKC → lowercase → ё→е → strip apostrophes (AGENT-SPEC §4.2). */
export function normalizeText(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/['’‘`ʼ]/g, '')
}

const STOPWORDS = stopwordSet(STOPWORDS_EN, STOPWORDS_KK, STOPWORDS_RU)
const SPLIT = /[^\p{L}\p{N}]+/u
const DIGITS = /^\p{N}+$/u

/** Normalized words, without stopwords. Tokens shorter than 2 are dropped unless all digits. */
export function words(text: string, keepStopwords = false): string[] {
  const out: string[] = []
  for (const raw of normalizeText(text).split(SPLIT)) {
    if (!raw) continue
    if (raw.length < 2 && !DIGITS.test(raw)) continue
    if (!keepStopwords && STOPWORDS.has(raw)) continue
    out.push(raw)
  }
  return out
}

/** Prefix stem: good recall for agglutinative Kazakh without a morphology library. */
export function stem(word: string): string {
  return word.length > STEM_LENGTH ? word.slice(0, STEM_LENGTH) : word
}

/** Stemmed tokens of `text`, stopwords removed. */
export function tokenize(text: string): string[] {
  return words(text).map(stem)
}

/** High-value KK/RU terms → English terms the (English) Handbook uses (AGENT-SPEC §4.2). */
const EXPANSIONS: ReadonlyArray<readonly [readonly string[], string]> = [
  [['қосыл', 'тіркел', 'вступ', 'регистр', 'присоедин', 'мүше'], 'join register'],
  [['ақы', 'тегін', 'бесплат', 'стоим', 'құн', 'сколько'], 'free cost'],
  [['хакатон'], 'hackathon'],
  [['акселератор'], 'accelerator'],
  [['ментор', 'тәлімгер', 'наставн'], 'mentor'],
  [['жоба', 'проект'], 'project'],
  [['команд'], 'team'],
  [['серіктес', 'партнер', 'демеуш', 'спонсор'], 'partner'],
  [['демо'], 'demo'],
  [['мастер'], 'masterclass'],
]

function expansionsFor(word: string): string[] {
  const out: string[] = []
  for (const [prefixes, english] of EXPANSIONS) {
    if (prefixes.some((p) => word.startsWith(p))) out.push(...tokenize(english))
  }
  return out
}

/* ------------------------------------------------------------------------------------------ */
/* Index building (build time)                                                                */
/* ------------------------------------------------------------------------------------------ */

function termFreq(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {}
  for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1
  return tf
}

/** Heading → anchor: lowercase, keep letters/digits/spaces/hyphens, spaces → hyphens. */
export function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .trim()
    .replace(/ /g, '-')
}

export function buildIndex(input: { version: string; updated: string; chunks: RawChunk[] }): HandbookIndex {
  const df: Record<string, number> = {}
  const totals: FieldCounts = { title: 0, kw: 0, body: 0 }
  const chunks: HandbookChunk[] = input.chunks.map((raw) => {
    const title = tokenize(raw.title)
    const kw = tokenize(raw.kw)
    const body = tokenize(raw.text)
    const seen = new Set<string>([...title, ...kw, ...body])
    for (const t of seen) df[t] = (df[t] ?? 0) + 1
    totals.title += title.length
    totals.kw += kw.length
    totals.body += body.length
    return {
      id: raw.id,
      section: raw.section,
      title: raw.title,
      url: raw.url,
      text: raw.text,
      tf: { title: termFreq(title), kw: termFreq(kw), body: termFreq(body) },
      len: { title: title.length, kw: kw.length, body: body.length },
    }
  })
  const n = Math.max(1, chunks.length)
  const round = (x: number) => Math.round((x / n) * 100) / 100
  return {
    version: input.version,
    updated: input.updated,
    avgLen: { title: round(totals.title), kw: round(totals.kw), body: round(totals.body) },
    df,
    chunks,
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Ranking                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/** Weighted query terms: the question, its expansions, and (for short follow-ups) the previous question at half weight. */
export function queryTerms(question: string, previous?: string): Map<string, number> {
  const terms = new Map<string, number>()
  const add = (token: string, weight: number) => {
    const current = terms.get(token) ?? 0
    if (weight > current) terms.set(token, weight)
  }
  const qWords = words(question)
  for (const w of qWords) {
    add(stem(w), 1)
    for (const e of expansionsFor(w)) add(e, 1)
  }
  if (previous && qWords.length < FOLLOW_UP_TOKENS) {
    for (const w of words(previous)) {
      add(stem(w), 0.5)
      for (const e of expansionsFor(w)) add(e, 0.5)
    }
  }
  return terms
}

const FIELDS: HandbookField[] = ['title', 'kw', 'body']

/** BM25F-lite (k1 1.2, b 0.75, weights title 3 / kw 2 / body 1). Returns matches, best first. */
export function search(index: HandbookIndex, question: string, opts: { previous?: string } = {}): SearchResult[] {
  const terms = queryTerms(question, opts.previous)
  const n = index.chunks.length
  if (!n || !terms.size) return []
  const idf = new Map<string, number>()
  for (const t of terms.keys()) {
    const df = index.df[t]
    if (df) idf.set(t, Math.log(1 + (n - df + 0.5) / (df + 0.5)))
  }
  const results: SearchResult[] = []
  for (const chunk of index.chunks) {
    let score = 0
    for (const [t, weight] of terms) {
      const tIdf = idf.get(t)
      if (tIdf === undefined) continue
      let wtf = 0
      for (const f of FIELDS) {
        const tf = chunk.tf[f][t]
        if (!tf) continue
        const avg = index.avgLen[f] || 1
        wtf += (FIELD_WEIGHTS[f] * tf) / (1 - B + (B * chunk.len[f]) / avg)
      }
      if (wtf > 0) score += weight * tIdf * (wtf / (K1 + wtf))
    }
    if (score > 0) results.push({ chunk, score })
  }
  results.sort((a, b) => b.score - a.score)
  return results
}

/* ------------------------------------------------------------------------------------------ */
/* Selection (AI mode context)                                                                */
/* ------------------------------------------------------------------------------------------ */

const TIME_PHRASES_EXACT = ['when', 'this week', 'soon', 'today', 'tomorrow', 'upcoming', 'next week', 'осы апта', 'бүгін', 'ертең', 'когда', 'на неделе', 'сегодня', 'завтра', 'скоро']
const TIME_PREFIXES = ['date', 'қашан', 'күні', 'дата', 'дату', 'даты']

/** True when the question asks about time (AGENT-SPEC §4.4 pins the "Coming up and later" chunk). */
export function hasTimeWord(text: string): boolean {
  const list = words(text, true)
  const joined = ` ${list.join(' ')} `
  if (TIME_PHRASES_EXACT.some((p) => joined.includes(` ${p} `))) return true
  return list.some((w) => TIME_PREFIXES.some((p) => w.startsWith(p)))
}

export interface Selection {
  /** chunks to send as excerpts, in priority order, within the context budget */
  chunks: HandbookChunk[]
  /** top 3 distinct sources among the chunks sent */
  sources: HandbookSource[]
  topScore: number
  /** true when the best match is below `minScore` (weak-match guard applied) */
  weak: boolean
}

export function toSources(chunks: HandbookChunk[], max = SOURCES_MAX): HandbookSource[] {
  const out: HandbookSource[] = []
  const urls = new Set<string>()
  for (const c of chunks) {
    if (urls.has(c.url)) continue
    urls.add(c.url)
    out.push({ id: c.url.split('#')[1] ?? c.id, title: c.title, url: c.url })
    if (out.length >= max) break
  }
  return out
}

export function selectContext(
  index: HandbookIndex,
  results: SearchResult[],
  question: string,
  opts: { topK?: number; minScore?: number; contextChars?: number } = {},
): Selection {
  const topK = opts.topK ?? SEARCH_DEFAULTS.topK
  const minScore = opts.minScore ?? SEARCH_DEFAULTS.minScore
  const contextChars = opts.contextChars ?? SEARCH_DEFAULTS.contextChars
  const byId = new Map(index.chunks.map((c) => [c.id, c] as const))
  const topScore = results[0]?.score ?? 0
  const weak = topScore < minScore

  let matches = results
    .slice(0, topK)
    .filter((r) => r.score >= RELATIVE_CUTOFF * topScore)
    .map((r) => r.chunk)

  const ordered: HandbookChunk[] = []
  const push = (c: HandbookChunk | undefined) => {
    if (c && !ordered.includes(c)) ordered.push(c)
  }
  if (weak) {
    push(byId.get(PINNED_IDS.overview))
    push(byId.get(PINNED_IDS.join))
    matches = matches.slice(0, 2)
  }
  const timeline = hasTimeWord(question) ? byId.get(PINNED_IDS.timeline) : undefined
  // Priority: best match, then the time pin, then the rest. Lower-priority chunks drop first.
  if (!weak && matches.length) push(matches[0])
  push(timeline)
  for (const c of matches) push(c)

  const chunks: HandbookChunk[] = []
  let used = 0
  for (const c of ordered) {
    if (chunks.length && used + c.text.length > contextChars) continue
    chunks.push(c)
    used += c.text.length
  }
  return { chunks, sources: toSources(chunks), topScore, weak }
}

/* ------------------------------------------------------------------------------------------ */
/* Offline answer (AGENT-SPEC §9)                                                             */
/* ------------------------------------------------------------------------------------------ */

const KAZAKH_LETTERS = /[әғқңөұүһі]/iu
const CYRILLIC = /\p{Script=Cyrillic}/gu
const LATIN = /\p{Script=Latin}/gu

/** Language of the offline intro: Kazakh-specific letters → kk, other Cyrillic → ru, else the page locale. */
export function detectLang(text: string, pageLocale: HandbookLocale): AnswerLang {
  if (KAZAKH_LETTERS.test(text)) return 'kk'
  const cyr = text.match(CYRILLIC)?.length ?? 0
  const lat = text.match(LATIN)?.length ?? 0
  if (cyr > 0 && cyr >= lat) return 'ru'
  return pageLocale
}

export const OFFLINE_STRINGS: Record<AnswerLang, { intro: string; none: string; readMore: string }> = {
  en: {
    intro: "I can't reach my AI brain right now, so here's what the QairuHub Handbook says:",
    none: "I couldn't find that in the QairuHub Handbook. Try rephrasing, or check t.me/qairuhub.",
    readMore: 'Read more',
  },
  kk: {
    intro: 'Қазір AI миыма қосыла алмай тұрмын, сондықтан The QairuHub Handbook-та жазылғанын көрсетемін:',
    none: 'Бұл The QairuHub Handbook-тан табылмады. Сұрақты басқаша қойып көр немесе t.me/qairuhub арнасын қара.',
    readMore: 'Толығырақ',
  },
  ru: {
    intro: 'Сейчас я не могу подключиться к ИИ, поэтому вот что написано в QairuHub Handbook:',
    none: 'Я не нашёл этого в QairuHub Handbook. Попробуй переформулировать вопрос или загляни в t.me/qairuhub.',
    readMore: 'Подробнее',
  },
}

/** Markdown chunk text → one plain line per block, for snippets. */
function plainBlocks(markdown: string): string[] {
  const blocks: string[] = []
  let list: string[] = []
  const flushList = () => {
    if (!list.length) return
    const joined = list
      .map((item, i) => (/[.!?:;]$/.test(item) || i === list.length - 1 ? item : `${item};`))
      .join(' ')
    blocks.push(/[.!?]$/.test(joined) ? joined : `${joined}.`)
    list = []
  }
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('|') || line.startsWith('#') || /^-{3,}$/.test(line)) {
      flushList()
      continue
    }
    const clean = line
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*|__|`/g, '')
      .trim()
    const item = /^(?:[-*+]|\d+\.)\s+(.*)$/.exec(clean)
    if (item) list.push(item[1])
    else {
      flushList()
      blocks.push(clean)
    }
  }
  flushList()
  return blocks
}

/** First 1–2 sentences of a chunk, at most `max` characters. */
function firstSentences(text: string, max: number): string {
  // A sentence ends at [.!?] followed by a space or the end, so "t.me/qairuhub" and "qairu.edu.kz" stay whole.
  const sentences = text.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)
  let out = sentences[0] ?? ''
  if (sentences[1] && out.length + 1 + sentences[1].length <= max) out = `${out} ${sentences[1]}`
  if (out.length > max) {
    const cut = out.slice(0, max - 1)
    const space = cut.lastIndexOf(' ')
    out = `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, '')}…`
  }
  return out
}

/** "**Question?**\nAnswer" pairs of an FAQ chunk. */
function faqPairs(markdown: string): Array<{ q: string; a: string }> {
  const pairs: Array<{ q: string; a: string }> = []
  for (const block of markdown.split(/\n{2,}/)) {
    const m = /^\*\*(.+?\?)\*\*\s*\n([\s\S]+)$/.exec(block.trim())
    if (m) pairs.push({ q: m[1].trim(), a: plainBlocks(m[2]).join(' ').replace(/\s+/g, ' ').trim() })
  }
  return pairs
}

/**
 * First 1–2 sentences of a chunk, at most `max` characters. For FAQ chunks, when a question is
 * given, the question/answer pair that shares the most terms with it.
 */
export function snippet(markdown: string, max = SNIPPET_CHARS, question?: string): string {
  const pairs = question ? faqPairs(markdown) : []
  if (pairs.length && question) {
    const wanted = new Set(tokenize(question))
    let best: { q: string; a: string } | undefined
    let bestScore = 0
    for (const p of pairs) {
      let score = 0
      for (const t of tokenize(p.q)) if (wanted.has(t)) score += 2
      for (const t of new Set(tokenize(p.a))) if (wanted.has(t)) score += 1
      if (score > bestScore) {
        best = p
        bestScore = score
      }
    }
    if (best) return firstSentences(`${best.q} ${firstSentences(best.a, max)}`, max)
  }
  return firstSentences(plainBlocks(markdown).join(' ').replace(/\s+/g, ' ').trim(), max)
}

/**
 * Offline answer Markdown: the intro plus up to 3 matches above the weak-match guard, each as
 * `**{title}**: {snippet}` + `Read more: {url}`; or the "not found" line when nothing clears `minScore`.
 */
export function renderOffline(
  results: SearchResult[],
  lang: AnswerLang,
  opts: { minScore?: number; question?: string } = {},
): string {
  const minScore = opts.minScore ?? SEARCH_DEFAULTS.minScore
  const s = OFFLINE_STRINGS[lang]
  const picked = offlinePicks(results, minScore)
  if (!picked.length) return s.none
  const parts = picked.map((c) => `**${c.title}**: ${snippet(c.text, SNIPPET_CHARS, opts.question)}\n${s.readMore}: ${c.url}`)
  return `${s.intro}\n\n${parts.join('\n\n')}`
}

function offlinePicks(results: SearchResult[], minScore: number): HandbookChunk[] {
  const top = results.reduce((m, r) => Math.max(m, r.score), 0)
  if (top < minScore) return []
  const out: HandbookChunk[] = []
  const urls = new Set<string>()
  for (const r of results) {
    if (r.score < minScore || r.score < RELATIVE_CUTOFF * top) continue
    if (urls.has(r.chunk.url)) continue
    urls.add(r.chunk.url)
    out.push(r.chunk)
    if (out.length >= OFFLINE_MAX) break
  }
  return out
}

const BRAND = /qairu\s*hub|қайрухаб|кайрухаб/iu

/** True when the question names QairuHub (in any script). */
export function isAboutBrand(question: string): boolean {
  return BRAND.test(question)
}

/** Everything the offline path needs in one call (server offline mode and the browser fallback). */
export function answerOffline(
  index: HandbookIndex,
  question: string,
  opts: { locale: HandbookLocale; previous?: string; minScore?: number },
): { text: string; sources: HandbookSource[]; lang: AnswerLang; topScore: number } {
  const minScore = opts.minScore ?? SEARCH_DEFAULTS.minScore
  let results = search(index, question, { previous: opts.previous })
  const lang = detectLang(question, opts.locale)
  const topScore = results[0]?.score ?? 0
  const byId = (id: string) => index.chunks.find((c) => c.id === id)
  if (topScore < minScore && isAboutBrand(question)) {
    // "What is QairuHub?" has no scoring terms (the brand is in every chunk): answer with the overview.
    const overview = byId(PINNED_IDS.overview)
    if (overview) results = [{ chunk: overview, score: minScore }]
  } else if (topScore >= minScore && hasTimeWord(question)) {
    // Time questions: the dated "Coming up and later" list goes right after the best match.
    const timeline = byId(PINNED_IDS.timeline)
    if (timeline && results[0].chunk !== timeline) {
      const rest = results.slice(1).filter((r) => r.chunk !== timeline)
      results = [results[0], { chunk: timeline, score: topScore }, ...rest]
    }
  }
  return {
    text: renderOffline(results, lang, { minScore, question }),
    sources: toSources(offlinePicks(results, minScore)),
    lang,
    topScore,
  }
}
