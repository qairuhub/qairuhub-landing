/**
 * Runtime performance probe for the landing page.
 *   PERF_URL=http://localhost:4173 PERF_CPU=4 PERF_HEADLESS=0 node scripts/perf.mjs
 * Launches Chromium (headed by default so the real GPU is used; PERF_HEADLESS=1 uses
 * software GL and is only good for relative comparisons), optionally throttles the CPU
 * (PERF_CPU=4 ⇒ 4× slower), then measures at several scroll positions:
 *   - fps and p95 frame time over a 2.5 s window while idle
 *   - fps while continuously scrolling (wheel events through Lenis)
 *   - long tasks (> 50 ms) since navigation
 *   - JS heap (Chrome only)
 * Prints a JSON report and exits 2 if any idle fps < 50 or scrolling fps < 40.
 */
import { chromium } from 'playwright'

const url = process.env.PERF_URL || 'http://localhost:5173'
const cpu = Number(process.env.PERF_CPU || 1)
const headless = process.env.PERF_HEADLESS !== '0' // headed needs a desktop session; sandboxed shells can only run headless (software GL ⇒ relative numbers only)
const width = Number(process.env.PERF_W || 1440)
const height = Number(process.env.PERF_H || 900)

const browser = await chromium.launch({
  headless,
  args: headless ? [] : ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-zero-copy'],
})
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })

const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.addInitScript(() => {
  window.__longTasks = []
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__longTasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) })
    }).observe({ type: 'longtask', buffered: true })
  } catch {}
})

const t0 = Date.now()
await page.goto(url, { waitUntil: 'networkidle' })
const loadMs = Date.now() - t0
await page.waitForTimeout(3000)

const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
const positions = [0, 0.08, 0.16, 0.3, 0.5, 0.7, 0.85, 0.95, 1].map((p) => Math.round(total * p))

async function measureIdle(ms) {
  return page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const times = []
        let last = performance.now()
        const start = last
        function f(t) {
          times.push(t - last)
          last = t
          if (t - start < ms) requestAnimationFrame(f)
          else {
            times.shift()
            const sorted = [...times].sort((a, b) => a - b)
            const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0
            const avg = times.reduce((a, b) => a + b, 0) / times.length
            resolve({ fps: Math.round(1000 / avg), p95: Math.round(p95 * 10) / 10, frames: times.length })
          }
        }
        requestAnimationFrame(f)
      }),
    ms,
  )
}

const idle = []
for (const y of positions) {
  await page.evaluate((v) => {
    if (window.__lenis) window.__lenis.scrollTo(v, { immediate: true })
    window.scrollTo(0, v)
  }, y)
  await page.waitForTimeout(900)
  const m = await measureIdle(2500)
  idle.push({ y, pct: Math.round((y / Math.max(1, total)) * 100), ...m })
}

// scrolling test: wheel from top to bottom over ~6s while counting frames
await page.evaluate(() => {
  if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true })
  window.scrollTo(0, 0)
})
await page.waitForTimeout(600)
const scrollPromise = page.evaluate(
  (ms) =>
    new Promise((resolve) => {
      const times = []
      let last = performance.now()
      const start = last
      function f(t) {
        times.push(t - last)
        last = t
        if (t - start < ms) requestAnimationFrame(f)
        else {
          const sorted = [...times].sort((a, b) => a - b)
          resolve({
            fps: Math.round(1000 / (times.reduce((a, b) => a + b, 0) / times.length)),
            p95: Math.round((sorted[Math.floor(sorted.length * 0.95)] || 0) * 10) / 10,
            worst: Math.round(sorted[sorted.length - 1] || 0),
          })
        }
      }
      requestAnimationFrame(f)
    }),
  6500,
)
await page.mouse.move(width / 2, height / 2)
for (let i = 0; i < 60; i++) {
  await page.mouse.wheel(0, Math.ceil(total / 60))
  await page.waitForTimeout(100)
}
const scrolling = await scrollPromise

const longTasks = await page.evaluate(() => window.__longTasks || [])
const heapMb = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null))
const contexts = await page.evaluate(() => document.querySelectorAll('canvas').length)

const report = {
  url,
  cpuThrottle: cpu,
  headless,
  viewport: { width, height },
  loadMs,
  canvases: contexts,
  idle,
  scrolling,
  longTasks: longTasks.filter((t) => t.dur >= 50),
  longTaskTotalMs: longTasks.reduce((a, t) => a + t.dur, 0),
  heapMb,
  errors,
}
console.log(JSON.stringify(report, null, 2))
await browser.close()

const minIdle = Math.min(...idle.map((m) => m.fps))
if (minIdle < 50 || scrolling.fps < 40 || errors.length) process.exitCode = 2
