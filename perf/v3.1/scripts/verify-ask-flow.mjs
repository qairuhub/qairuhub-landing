/**
 * End-to-end Ask-bar flow against a LOCAL wrangler server. No AI upstream is reached: with the
 * EDGE binding unconnected the Function answers from the bundled Handbook (mode "offline"), so
 * nothing leaves the machine.
 *   node perf/v3.1/scripts/verify-ask-flow.mjs <baseUrl> [1440x900|390x844]
 */
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://127.0.0.1:8806'
const [w, h] = (process.argv[3] ?? '1440x900').split('x').map(Number)

const browser = await chromium.launch({ channel: 'chrome', headless: false })
const page = await browser.newPage({ viewport: { width: w, height: h } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`)
})
const sse = []
page.on('response', (r) => {
  if (r.url().includes('/api/ask')) sse.push({ status: r.status(), type: r.headers()['content-type'] })
})

await page.goto(`${base}/`, { waitUntil: 'load' })
await page.waitForTimeout(1500)
await page.evaluate(() => document.querySelector('.ask__form input')?.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(800)

const input = page.locator('.ask__form input').first()
await input.click()
await input.type('How do I join QairuHub?', { delay: 10 })
await input.press('Enter')

await page.waitForSelector('.ask__answer .qa-md', { timeout: 20_000 })
await page.waitForTimeout(6000)

const inline = await page.evaluate(() => {
  const root = document.querySelector('.ask__answer')
  return {
    question: root?.querySelector('.ask__q')?.textContent ?? null,
    answerLength: (root?.querySelector('.qa-md')?.textContent ?? '').length,
    answerStart: (root?.querySelector('.qa-md')?.textContent ?? '').slice(0, 80),
    links: [...(root?.querySelectorAll('.qa-md a') ?? [])].map((a) => a.getAttribute('href')),
    sources: [...(root?.querySelectorAll('.qa-source') ?? [])].map((a) => a.getAttribute('href')),
    stillThinking: !!root?.querySelector('.qa-answer__thinking'),
  }
})
await page.screenshot({ path: (process.env.SHOT_DIR ?? 'perf/v3.1/shots/') + `ask-inline-${w}.png` })

// "Continue in chat" must open the panel on the same thread.
await page.locator('.ask__actions button').first().click()
await page.waitForSelector('.qa-panel[role="dialog"]', { timeout: 10_000 })
await page.waitForTimeout(1500)
const panel = await page.evaluate(() => ({
  messages: document.querySelectorAll('.qa-panel .qa-msg').length,
  answerLength: (document.querySelector('.qa-panel .qa-md')?.textContent ?? '').length,
}))
await page.screenshot({ path: (process.env.SHOT_DIR ?? 'perf/v3.1/shots/') + `ask-panel-${w}.png` })

// Reload: the thread is restored from sessionStorage without re-asking.
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(2500)
const asksAfterReload = sse.length

await browser.close()
console.log(JSON.stringify({ viewport: `${w}x${h}`, sse, inline, panel, asksAfterReload, errors }, null, 2))
