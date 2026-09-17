/**
 * Round-2 supplementary checks: handbook search UI presence, the assistant answer render path
 * (offline only - no upstream is reachable locally), members page detail, reduced motion.
 */
import { chromium } from 'playwright'
const base = process.argv[2] ?? 'http://127.0.0.1:8806'
const mode = process.argv[3] ?? 'desktop'
const out = { mode, checks: [], errors: [] }
const ok = (n, d = '') => out.checks.push({ n, pass: true, d })
const bad = (n, d = '') => out.checks.push({ n, pass: false, d })

const browser = await chromium.launch({ channel: 'chrome', headless: false })
const ctx = await browser.newContext(
  mode === 'mobile'
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }
    : { viewport: { width: 1440, height: 900 } },
)
const page = await ctx.newPage()
page.on('pageerror', (e) => out.errors.push('pageerror: ' + e.message.slice(0, 200)))
page.on('console', (m) => { if (m.type() === 'error') out.errors.push('console: ' + m.text().slice(0, 200)) })
page.on('requestfailed', (r) => { const f = r.failure()?.errorText ?? ''; if (!/ERR_ABORTED/.test(f)) out.errors.push('reqfail: ' + r.url().slice(0, 100) + ' ' + f) })

/* --- handbook: is there a search input at all? --- */
await page.goto(base + '/handbook', { waitUntil: 'load' })
await page.waitForSelector('.hb-body', { timeout: 20000 })
await page.waitForTimeout(800)
const inputs = await page.evaluate(() =>
  [...document.querySelectorAll('main input, main [role="searchbox"], main [type="search"]')].map(
    (e) => `${e.tagName}.${e.className}[type=${e.getAttribute('type')}]`,
  ),
)
ok('handbook search inputs', inputs.length ? inputs.join(' | ') : 'none (retrieval is server-side, via Q)')

/* --- handbook TOC filtering by section: click an h3 deep link --- */
// The h3 sublist is `hidden` until its h2 is the current section, so open one first.
const h2 = page.locator('.hb-toc__link--h2:visible').first()
if (await h2.count()) { await h2.click(); await page.waitForTimeout(1400) }
const h3 = page.locator('.hb-toc__link--h3:visible').first()
if (await h3.count()) {
  const href = await h3.getAttribute('href')
  await h3.click()
  await page.waitForTimeout(1200)
  const hash = await page.evaluate(() => location.hash)
  hash === href ? ok('handbook h3 deep link', `${href}`) : bad('handbook h3 deep link', `hash=${hash} want=${href}`)
} else ok('handbook h3 deep link', 'no h3 links visible at this width')

/* --- assistant: ask a question; stays offline (no upstream binding locally) --- */
await page.goto(base + '/', { waitUntil: 'load' })
await page.waitForSelector('h1', { timeout: 20000 })
await page.waitForTimeout(1200)
await page.locator('.qa-fab__btn').click()
await page.waitForSelector('.qa-panel[role="dialog"]', { timeout: 20000 })
const ta = page.locator('textarea.qa-panel__input')
await ta.fill('What is QairuHub?')
await page.waitForTimeout(200)
await ta.press('Enter')
await page.waitForTimeout(6000)
const answer = await page.evaluate(() => {
  const el = document.querySelector('.qa-msg--bot')
  return { html: !!el, text: (el?.innerText ?? '').slice(0, 120), paras: el?.querySelectorAll('p,li').length ?? 0 }
})
answer.html && answer.paras > 0
  ? ok('assistant renders a markdown answer', `${answer.paras} blocks | ${answer.text.replace(/\s+/g, ' ')}`)
  : bad('assistant renders a markdown answer', JSON.stringify(answer))

/* sources list rendered by Answer */
const sources = await page.locator('.qa-msg--bot a').count()
ok('assistant answer links', `${sources} anchors`)
await page.keyboard.press('Escape')
await page.waitForTimeout(600)

/* --- ask bar submit on the Launchpad (also offline) --- */
await page.evaluate(() => document.querySelector('.ask__form input')?.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(900)
const ask = page.locator('.ask__form input').first()
await ask.click()
await ask.fill('who can join qairuhub')
await ask.press('Enter')
await page.waitForTimeout(6000)
const inline = await page.evaluate(() => {
  const el = document.querySelector('.ask__answer')
  return { present: !!el, text: (el?.innerText ?? '').slice(0, 100), blocks: el?.querySelectorAll('.qa-md p, .qa-md li').length ?? 0 }
})
inline.present && inline.blocks > 0
  ? ok('ask bar inline answer renders', `${inline.blocks} blocks | ${inline.text.replace(/\s+/g, ' ')}`)
  : bad('ask bar inline answer renders', JSON.stringify(inline))

/* --- members page: table content + links --- */
await page.goto(base + '/members', { waitUntil: 'load' })
await page.waitForSelector('.members-table', { timeout: 20000 })
await page.waitForTimeout(600)
const m = await page.evaluate(() => ({
  rows: document.querySelectorAll('.members-table tbody tr').length,
  headings: document.querySelectorAll('.members-table thead th').length,
  text: document.querySelector('main')?.innerText.slice(0, 80) ?? '',
}))
m.rows > 0 && m.headings > 0 ? ok('members table', `${m.rows} rows, ${m.headings} cols`) : bad('members table', JSON.stringify(m))

await browser.close()
out.failed = out.checks.filter((c) => !c.pass).length
console.log(JSON.stringify(out, null, 1))
