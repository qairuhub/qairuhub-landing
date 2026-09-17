// AUDIT 2: what happens when a lazy chunk fails to load (flaky mobile network, or a chunk URL that a
// new deploy removed while the tab stayed open)? Blocks one chunk pattern at a time and reports
// whether #root still has content.
//
//   node perf/v3.1/scripts/mac-static-server.mjs dist 4821 &     (or any static server for dist/)
//   node perf/v3.1/scripts/audit-chunk-failure.mjs http://127.0.0.1:4821
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://127.0.0.1:4821'
const cases = [
  { name: 'three chunk fails (home)', path: '/', block: /\/assets\/three-[^/]+\.js$/ },
  { name: 'r3f chunk fails (members)', path: '/members', block: /\/assets\/r3f-[^/]+\.js$/ },
  { name: 'Assistant panel chunk fails, then launcher click', path: '/', block: /\/assets\/Assistant-[^/]+\.js$/, click: 'button.qa-fab__btn' },
  // The sub-page chunk itself: <ChunkBoundary onError={reloadOnceForChunkError}> keeps the header,
  // footer and launcher and leaves the PageSkeleton in place (no reload in the first 30 s).
  { name: 'MembersPage chunk fails (members)', path: '/members', block: /\/assets\/MembersPage-[^/]+\.js$/ },
  { name: 'HandbookPage chunk fails (handbook)', path: '/handbook', block: /\/assets\/HandbookPage-[^/]+\.js$/ },
  { name: 'ProductDemo chunk fails (home)', path: '/', block: /\/assets\/ProductDemo-[^/]+\.js$/ },
  { name: 'nothing blocked (control)', path: '/', block: null, click: 'button.qa-fab__btn' },
]
const browser = await chromium.launch({ headless: true })
const out = []
try {
  for (const c of cases) {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 140)))
    if (c.block) await page.route(c.block, (route) => route.abort('connectionreset'))
    await page.goto(base + c.path + '?q=low', { waitUntil: 'load' })
    await page.waitForTimeout(4000)
    if (c.click) {
      await page.click(c.click).catch((e) => errors.push('click: ' + e.message.slice(0, 80)))
      await page.waitForTimeout(2500)
    }
    const state = await page.evaluate(() => ({
      rootChildren: document.getElementById('root')?.childElementCount ?? -1,
      textLength: document.body.innerText.length,
      dialog: !!document.querySelector('[role="dialog"]'),
      header: !!document.querySelector('header'),
      footer: !!document.querySelector('footer'),
      launcher: !!document.querySelector('button.qa-fab__btn'),
    }))
    out.push({ case: c.name, ...state, blank: state.rootChildren === 0, errors: [...new Set(errors)].slice(0, 4) })
    await ctx.close()
  }
} finally {
  await browser.close()
}
console.log(JSON.stringify(out, null, 1))
