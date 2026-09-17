// A2-01: the assistant islands must survive a chunk that can't load.
//   node assistant-chunk-test.mjs http://127.0.0.1:4831
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://127.0.0.1:4831'
const cases = [
  { name: 'Assistant panel chunk fails, two launcher clicks', block: /\/assets\/Assistant-[^/]+\.js$/, act: 'panel' },
  { name: 'Answer chunk fails, ask bar question', block: /\/assets\/Answer-[^/]+\.js$/, act: 'ask' },
  { name: 'Announcer chunk fails, ask bar question', block: /\/assets\/Announcer-[^/]+\.js$/, act: 'ask' },
  { name: 'control: nothing blocked, panel', block: null, act: 'panel' },
  { name: 'control: nothing blocked, ask bar question', block: null, act: 'ask' },
]
const browser = await chromium.launch({ headless: true })
const out = []
try {
  for (const c of cases) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)))
    if (c.block) await page.route(c.block, (r) => r.abort('connectionreset'))
    await page.goto(base + '/?q=low', { waitUntil: 'load' })
    await page.waitForTimeout(2500)
    const res = { case: c.name }
    if (c.act === 'panel') {
      await page.click('button.qa-fab__btn')
      await page.waitForTimeout(1500)
      res.dialogAfterFirstClick = await page.locator('[role="dialog"]').count()
      await page.click('button.qa-fab__btn') // the launcher must still respond
      await page.waitForTimeout(1500)
      res.dialogAfterSecondClick = await page.locator('[role="dialog"]').count()
      res.launcherStillThere = await page.locator('button.qa-fab__btn').count()
    } else {
      await page.fill('input.ask__input', 'What is QairuHub?')
      await page.press('input.ask__input', 'Enter')
      await page.waitForTimeout(6000)
      res.answerBox = await page.locator('.ask__answer').count()
      res.answerText = ((await page.locator('.ask__scroll').innerText().catch(() => '')) || '').slice(0, 70)
      res.sources = await page.locator('.qa-sources').count()
      res.askAgainWorks = await page
        .getByRole('button', { name: /again|something else|басқа/i })
        .count()
    }
    const state = await page.evaluate(() => ({
      rootChildren: document.getElementById('root')?.childElementCount ?? -1,
      textLength: document.body.innerText.length,
      reloaded: performance.getEntriesByType('navigation')[0]?.type,
      chunkReloadKey: (() => {
        try {
          return sessionStorage.getItem('qh.chunkReload')
        } catch {
          return 'blocked'
        }
      })(),
    }))
    out.push({ ...res, ...state, blank: state.rootChildren === 0, errors: [...new Set(errors)].slice(0, 4) })
    await ctx.close()
  }
} finally {
  await browser.close()
}
console.log(JSON.stringify(out, null, 1))
