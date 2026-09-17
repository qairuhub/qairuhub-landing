// A2-06: GET /api/config must come from the browser cache on a repeat view within 5 min
// (src/lib/turnstile.ts no longer sends `cache: no-store`; functions/api/config.ts sends
// `max-age=300, stale-while-revalidate=600`). /api/join and /api/ask must stay uncached.
//   npx wrangler pages dev <dist> --port 8820      (a build of the current tree + Functions)
//   node perf/v3.1/scripts/audit-config-cache.mjs http://127.0.0.1:8820
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://127.0.0.1:8820'
const browser = await chromium.launch({ headless: true })
const out = {}
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const requested = []
  page.on('request', (r) => {
    if (r.url().includes('/api/')) requested.push(r.url().replace(base, ''))
  })
  const reachConfig = async () => {
    // the join form primes Turnstile when it nears the viewport
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(2500)
    await page.locator('input.ask__input').first().focus().catch(() => {})
    await page.waitForTimeout(2500)
  }
  await page.goto(base + '/?q=low', { waitUntil: 'load' })
  await reachConfig()
  out.firstView = {
    apiRequests: [...requested],
    config: await page.evaluate(() => {
      const e = performance.getEntriesByName(location.origin + '/api/config')[0]
      return e ? { transferSize: e.transferSize, encodedBodySize: e.encodedBodySize } : null
    }),
  }
  requested.length = 0
  await page.reload({ waitUntil: 'load' })
  await reachConfig()
  out.secondView = {
    apiRequests: [...requested],
    config: await page.evaluate(() => {
      const e = performance.getEntriesByName(location.origin + '/api/config')[0]
      return e ? { transferSize: e.transferSize, encodedBodySize: e.encodedBodySize } : null
    }),
  }
  out.fromCacheOnSecondView = out.secondView.config?.transferSize === 0
  await ctx.close()
} finally {
  await browser.close()
}
console.log(JSON.stringify(out, null, 1))
