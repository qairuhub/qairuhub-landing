#!/usr/bin/env node
/**
 * Content guard (V3-BUILD-PLAN §WP12, owned by WP12). Part of `pnpm check`.
 *
 *   node scripts/check-content.mjs            scan src/** , functions/** , shared/** , edge/src/** and dist/** (if built)
 *   node scripts/check-content.mjs --dist     scan dist/** only (after `pnpm build`)
 *
 * Fails (exit 1) when shipped code or built pages contain:
 *   - old names:      Qairu AI · AI Fridays · Qairu Space · Qairu Hackathons · Qairu Accelerator
 *                     (also the renamed knowledge base "Qairu Book"; DECISIONS §1)
 *   - slop words:     empower · unleash · supercharge · revolutioni(se|ze|zing…) · cutting-edge · seamless
 *   - private data:   gmail.com · "+7 7" phone numbers · t.me/+ private invite links
 *   - private denylist: every line of scripts/private-denylist.txt (git-ignored, built locally from
 *                     the private roster; Telegram @usernames and emails). Missing file = warning + skip.
 *
 * Denylist hits are reported by entry NUMBER only, never by value, so the output is safe to paste.
 *
 * Scope rules
 *   - Private data + denylist: raw text of every scanned file (code comments included: a handle in
 *     a comment still ships in the public repo).
 *   - Old names + slop words: shipped text only. In .ts/.tsx/.js/.mjs/.cjs/.css files comments are
 *     stripped first (a comment saying "never write Qairu Book" is fine). Slop words are additionally
 *     not checked in dist JS (third-party library strings are not our copy) or JSON.
 *   - `src/content.ts` is the v2 copy file the integrator deletes once nothing imports it; it is
 *     scanned like everything else, so its old names fail the check until it is gone.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distOnly = process.argv.includes('--dist')

const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.html', '.json', '.md', '.txt', '.svg', '.xml', '.webmanifest'])
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css'])
const SKIP_DIRS = new Set(['node_modules', '.git', '.wrangler', 'fonts'])

/** [label, RegExp] — `g` flag required (matchAll). */
const OLD_NAMES = [
  ['old name "Qairu AI"', /\bQairu AI\b/g],
  ['old name "AI Fridays"', /\bAI Fridays\b/gi],
  ['old name "Qairu Space"', /\bQairu Space\b/gi],
  ['old name "Qairu Hackathons"', /\bQairu Hackathons?\b/gi],
  ['old name "Qairu Accelerator"', /\bQairu Accelerator\b/gi],
  ['old name "Qairu Book"', /\b(The )?Qairu Book\b/gi],
]

const SLOP = [
  ['slop "empower"', /\bempower/gi],
  ['slop "unleash"', /\bunleash/gi],
  ['slop "supercharge"', /\bsupercharg/gi],
  ['slop "revolutioni…"', /\brevolutioni[sz]/gi],
  ['slop "cutting-edge"', /\bcutting[- ]edge\b/gi],
  ['slop "seamless"', /\bseamless/gi],
]

const PRIVATE = [
  ['private data "gmail.com"', /gmail\.com/gi],
  ['private data "+7 7" phone', /\+7[\s -]?\(?7\d{2}/g],
  ['private invite link "t.me/+"', /t\.me\/\+/gi],
  ['private invite link "t.me/joinchat"', /t\.me\/joinchat/gi],
]

/* ------------------------------------------------------------------ denylist */
const denyPath = resolve(root, 'scripts/private-denylist.txt')
let deny = []
if (existsSync(denyPath)) {
  deny = readFileSync(denyPath, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith('#'))
} else {
  console.warn('check-content: WARNING scripts/private-denylist.txt is missing; private handle/email check skipped.')
}
/** "@handle" entries also match t.me/handle and telegram.me/handle. */
const denyNeedles = deny.map((entry, i) => {
  const needles = [entry]
  if (entry.startsWith('@') && !entry.includes('.')) {
    const name = entry.slice(1)
    needles.push(`t.me/${name}`, `telegram.me/${name}`)
  }
  return { n: i + 1, needles }
})

/* ------------------------------------------------------------------ files */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (TEXT_EXT.has(extname(name).toLowerCase())) out.push(p)
  }
  return out
}

const sourceRoots = distOnly ? [] : ['src', 'functions', 'shared', 'edge/src', 'public/_headers', 'public/_redirects', 'index.html']
const files = []
for (const r of sourceRoots) {
  const p = resolve(root, r)
  if (!existsSync(p)) continue
  if (statSync(p).isDirectory()) walk(p, files)
  else files.push(p)
}
const distDir = resolve(root, 'dist')
const distFiles = walk(distDir)
if (distOnly && distFiles.length === 0) {
  console.error('check-content: dist/ is empty; run `pnpm build` first.')
  process.exit(1)
}
files.push(...distFiles)

/** Blank out comments but keep newlines so line numbers stay right. Good enough for our own sources. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\'"`])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length))
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length

/** key "file:line  rule" -> count (a minified bundle repeats one line many times) */
const findings = new Map()
function report(file, line, rule) {
  const key = `${relative(root, file).split(sep).join('/')}:${line}  ${rule}`
  findings.set(key, (findings.get(key) ?? 0) + 1)
}

for (const file of files) {
  const raw = readFileSync(file, 'utf8')
  const ext = extname(file).toLowerCase()
  const inDist = file.startsWith(distDir + sep)
  const minifiedVendor = inDist && ext === '.js'

  for (const [label, re] of PRIVATE) {
    for (const m of raw.matchAll(re)) report(file, lineOf(raw, m.index), label)
  }

  // dist is minified (comments already gone) and one line long: stripping there could eat real code after a "//" in a string
  const visible = CODE_EXT.has(ext) && !inDist ? stripComments(raw) : raw
  for (const [label, re] of OLD_NAMES) {
    for (const m of visible.matchAll(re)) report(file, lineOf(visible, m.index), label)
  }

  if (!minifiedVendor && ext !== '.json') {
    for (const [label, re] of SLOP) {
      for (const m of visible.matchAll(re)) report(file, lineOf(visible, m.index), label)
    }
  }

  if (denyNeedles.length) {
    const lower = raw.toLowerCase()
    for (const { n, needles } of denyNeedles) {
      for (const needle of needles) {
        let from = 0
        let at
        while ((at = lower.indexOf(needle, from)) !== -1) {
          // "@name" must not be the tail of a longer handle or the local part of an email
          const after = lower[at + needle.length]
          const before = lower[at - 1]
          const handle = needle.startsWith('@')
          const boundaryOk = !handle || ((!after || !/[a-z0-9_]/.test(after)) && (!before || !/[a-z0-9._%+-]/.test(before)))
          if (boundaryOk) report(file, lineOf(raw, at), `private denylist entry #${n}`)
          from = at + needle.length
        }
      }
    }
  }
}

const scanned = `${files.length} files${distFiles.length ? ` (${distFiles.length} in dist/)` : ' (dist/ not built, skipped)'}`
if (findings.size) {
  const total = [...findings.values()].reduce((a, b) => a + b, 0)
  console.error(`check-content: FAIL, ${total} finding(s) in ${scanned}`)
  for (const [key, count] of findings) console.error(`  ${key}${count > 1 ? `  (x${count})` : ''}`)
  process.exit(1)
}
console.log(`check-content: OK, ${scanned}, ${deny.length} denylist entries checked.`)
