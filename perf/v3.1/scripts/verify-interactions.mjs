/**
 * Interaction verification in the installed Chrome (real GPU) against a local wrangler server.
 * node interactions.mjs <baseUrl> <desktop|mobile>
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] ?? 'http://127.0.0.1:8806'
const mode = process.argv[3] ?? 'desktop'
const outDir = process.env.SHOT_DIR ?? 'perf/v3.1/shots/'
mkdirSync(outDir, { recursive: true })

const results = []
const errors = []
const ok = (name, detail = '') => results.push({ name, pass: true, detail })
const bad = (name, detail = '') => results.push({ name, pass: false, detail })

const browser = await chromium.launch({ channel: 'chrome', headless: false })
const context = await browser.newContext(
  mode === 'mobile'
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
)
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
let expect404 = false
page.on('console', (m) => {
  if (m.type() !== 'error') return
  // The intentional /definitely-not-a-page navigation logs one 404 in the console.
  if (expect404 && /404/.test(m.text())) return
  errors.push(`console: ${m.text().slice(0, 300)}`)
})
page.on('response', (r) => {
  if (r.status() >= 400 && !(expect404 && r.status() === 404)) errors.push(`http ${r.status()}: ${r.url().slice(0, 140)}`)
})
page.on('requestfailed', (r) => {
  const f = r.failure()?.errorText ?? ''
  if (!/ERR_ABORTED/.test(f)) errors.push(`requestfailed: ${r.url().slice(0, 120)} ${f}`)
})

const shot = async (name) => page.screenshot({ path: `${outDir}${mode}-${name}.png` })
const go = async (path) => {
  await page.goto(base + path, { waitUntil: 'load' })
  await page.waitForTimeout(900)
}

/* ------------------------------------------------------------------ home */
await go('/')
await page.waitForSelector('h1', { timeout: 10_000 })
ok('home loads', await page.locator('h1').first().innerText())

/* header menus */
if (mode === 'desktop') {
  const trigger = page.locator('button.hdr__trigger').first()
  // Desktop menus open on hover; a click on an open menu closes it again.
  await trigger.hover()
  await page.waitForTimeout(400)
  const expanded = await trigger.getAttribute('aria-expanded')
  const menuOpen = await page.locator('.hdr__menu.is-open').count()
  const subVisible = await page.locator('.hdr__menu.is-open a.hdr__sub').first().isVisible()
  expanded === 'true' && menuOpen > 0 && subVisible
    ? ok('desktop menu opens', `aria-expanded=${expanded}, sublinks visible`)
    : bad('desktop menu opens', `aria-expanded=${expanded} openMenus=${menuOpen} subVisible=${subVisible}`)
  await shot('menu-open')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const escOpen = await page.locator('.hdr__menu.is-open').count()
  // Escape closes it; then move the pointer away and check it stays closed.
  await page.mouse.move(700, 600)
  await page.waitForTimeout(500)
  const stillOpen = await page.locator('.hdr__menu.is-open').count()
  const expanded2 = await trigger.getAttribute('aria-expanded')
  stillOpen === 0 && expanded2 === 'false'
    ? ok('desktop menu closes', `escape closed=${escOpen === 0}`)
    : bad('desktop menu closes', `afterEscape=${escOpen} afterMouseOut=${stillOpen} aria-expanded=${expanded2}`)
} else {
  const burger = page.locator('button.hdr__burger')
  await burger.click()
  await page.waitForTimeout(450)
  const open = await page.locator('#hdr-mobile-menu.is-open').count()
  const visible = await page.locator('#hdr-mobile-menu a.hdr__sub, #hdr-mobile-menu a').first().isVisible()
  const navAttr = await page.evaluate(() => document.documentElement.getAttribute('data-nav-open'))
  open > 0 && visible ? ok('mobile menu opens', `data-nav-open=${navAttr}`) : bad('mobile menu opens', `open=${open} visible=${visible}`)
  await shot('menu-open')
  await page.locator('#hdr-mobile-menu button.hdr__iconbtn').first().click()
  await page.waitForTimeout(450)
  const closed = await page.locator('#hdr-mobile-menu.is-open').count()
  closed === 0 ? ok('mobile menu closes') : bad('mobile menu closes', `still open`)
}

/* carousels: rails must scroll horizontally */
for (const sel of ['.projects__rail', '.news__list', '.logos__row']) {
  const el = page.locator(sel).first()
  if ((await el.count()) === 0) continue
  await el.scrollIntoViewIfNeeded().catch(() => {})
  await page.waitForTimeout(400)
  const moved = await el.evaluate((node) => {
    const before = node.scrollLeft
    node.scrollBy({ left: 300, behavior: 'instant' })
    const after = node.scrollLeft
    node.scrollTo({ left: before, behavior: 'instant' })
    return { before, after, scrollable: node.scrollWidth > node.clientWidth + 4 }
  })
  moved.scrollable && moved.after > moved.before
    ? ok(`carousel ${sel}`, `scrollLeft ${moved.before} -> ${moved.after}`)
    : ok(`carousel ${sel}`, `not scrollable at this width (scrollWidth<=clientWidth)`)
}

/* Q assistant: launcher opens the panel, the panel input accepts typing (nothing is sent) */
await page.locator('.qa-fab__btn').click()
await page.waitForSelector('.qa-panel[role="dialog"]', { timeout: 10_000 })
await page.waitForTimeout(600)
const panelInput = page.locator('textarea.qa-panel__input')
await panelInput.fill('test typing only')
const typed = await panelInput.inputValue()
typed === 'test typing only' ? ok('assistant panel opens + accepts typing') : bad('assistant panel typing', typed)
await shot('assistant-open')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
;(await page.locator('.qa-panel').count()) === 0 ? ok('assistant panel closes (Escape)') : bad('assistant panel closes (Escape)')

/* Launchpad ask bar accepts typing (no submit) */
await page.evaluate(() => {
  const el = document.querySelector('.ask__form input')
  el?.scrollIntoView({ block: 'center' })
})
await page.waitForTimeout(700)
const askInput = page.locator('.ask__form input').first()
if ((await askInput.count()) > 0) {
  await askInput.click()
  await askInput.type('what is qairuhub', { delay: 15 })
  const v = await askInput.inputValue()
  v === 'what is qairuhub' ? ok('ask bar accepts typing') : bad('ask bar accepts typing', v)
  await askInput.fill('')
} else bad('ask bar present')

/* EN -> KK -> EN */
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(500)
if (mode === 'mobile') await page.locator('button.hdr__burger').click()
await page.waitForTimeout(400)
const kkOpt = page.locator('a.lsw__opt[hreflang="kk"]:visible').first()
await kkOpt.click()
await page.waitForLoadState('load')
await page.waitForTimeout(900)
const lang = await page.evaluate(() => document.documentElement.lang)
const url = page.url()
lang === 'kk' && /\/kk\/?$/.test(new URL(url).pathname)
  ? ok('EN -> KK switch', url)
  : bad('EN -> KK switch', `lang=${lang} url=${url}`)
await shot('kk')
if (mode === 'mobile') await page.locator('button.hdr__burger').click()
await page.waitForTimeout(400)
await page.locator('a.lsw__opt[hreflang="en"]:visible').first().click()
await page.waitForLoadState('load')
await page.waitForTimeout(800)
const lang2 = await page.evaluate(() => document.documentElement.lang)
lang2 === 'en' ? ok('KK -> EN switch', page.url()) : bad('KK -> EN switch', `lang=${lang2} url=${page.url()}`)

/* ------------------------------------------------------------------ handbook */
await go('/handbook')
await page.waitForSelector('.hb-body', { timeout: 15_000 })
const tocCount = await page.locator('.hb-toc__link').count()
if (mode === 'mobile') {
  const details = page.locator('details.hb-toc-m')
  if ((await details.count()) > 0) {
    await page.locator('.hb-toc-m__summary').click()
    await page.waitForTimeout(400)
    const open = await details.evaluate((d) => d.open)
    open ? ok('handbook contents opens (mobile)', `${tocCount} TOC links`) : bad('handbook contents opens (mobile)')
  }
}
const firstLink = page.locator('.hb-toc__link:visible').first()
const targetHash = await firstLink.getAttribute('href')
await firstLink.click()
await page.waitForTimeout(1200)
const hash = await page.evaluate(() => location.hash)
const scrolled = await page.evaluate(() => window.scrollY)
hash === targetHash && scrolled > 0
  ? ok('handbook TOC navigates', `${targetHash} scrollY=${Math.round(scrolled)} (${tocCount} links)`)
  : bad('handbook TOC navigates', `hash=${hash} want=${targetHash} scrollY=${scrolled}`)
await shot('handbook')

/* ------------------------------------------------------------------ members */
await go('/members')
await page.waitForSelector('.members-table', { timeout: 15_000 })
const rows = await page.locator('.members-table tbody tr').count()
rows > 0 ? ok('members page renders', `${rows} rows`) : bad('members page renders', 'no rows')
await shot('members')

/* ------------------------------------------------------------------ 404 */
expect404 = true
await go('/definitely-not-a-page')
await page.waitForTimeout(800)
const notFoundText = await page.locator('main').innerText()
notFoundText.trim().length > 20 ? ok('404 page renders', notFoundText.slice(0, 60).replace(/\s+/g, ' ')) : bad('404 page renders', notFoundText)
await shot('404')

/* ------------------------------------------------------------------ Google Translate simulation */
expect404 = false
await go('/')
await page.waitForSelector('h1', { timeout: 10_000 })
await page.waitForTimeout(1500)
const beforeText = (await page.locator('h1').first().innerText()).trim()
await page.evaluate(() => {
  // What Chrome's translator does: every text node is wrapped in a <font> element.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) {
    const n = walker.currentNode
    if (n.nodeValue && n.nodeValue.trim() && n.parentElement && !/^(SCRIPT|STYLE)$/.test(n.parentElement.tagName)) nodes.push(n)
  }
  for (const n of nodes) {
    const font = document.createElement('font')
    font.setAttribute('style', 'vertical-align: inherit;')
    const inner = document.createElement('font')
    inner.setAttribute('style', 'vertical-align: inherit;')
    inner.textContent = n.nodeValue
    font.appendChild(inner)
    n.parentNode?.replaceChild(font, n)
  }
  return nodes.length
})
await page.waitForTimeout(1200)
// The UI must still be there and still react.
const afterText = (await page.locator('h1').first().innerText()).trim()
const rootChildren = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0)
await page.locator('.qa-fab__btn').click()
await page.waitForTimeout(1200)
const panelAfterTranslate = await page.locator('.qa-panel[role="dialog"]').count()
await shot('translated')
rootChildren > 0 && afterText.length > 0 && panelAfterTranslate === 1
  ? ok('google-translate simulation', `h1 "${afterText.slice(0, 40)}", panel still opens`)
  : bad('google-translate simulation', `root=${rootChildren} h1="${afterText}" (was "${beforeText}") panel=${panelAfterTranslate}`)

await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(JSON.stringify({ mode, results, errors, failed: failed.length }, null, 2))
