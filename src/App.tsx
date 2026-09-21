import { Suspense, lazy, useEffect, useState, type CSSProperties } from 'react'
import { SmoothScroll } from './lib/SmoothScroll'
import { afterFirstContentfulPaint, onFirstIntent, postTask, type TaskPriority } from './lib/schedule'
import { useRoute } from './i18n/LocaleProvider'
import { fallbackGradientFor, presetForPage } from './sections/sky/fallback'
import { sectionIds } from './i18n/shared'
import Header from './sections/Header'
import Hero from './sections/Hero'
import AgenticCards from './sections/AgenticCards'
import Logos from './sections/Logos'
import Waitlist from './sections/Waitlist'
import Supersize from './sections/Supersize'
import Features from './sections/Features'
import Projects from './sections/Projects'
import News from './sections/News'
import ModelsCTA from './sections/ModelsCTA'
import Integrations from './sections/Integrations'
import Storytelling from './sections/Storytelling'
import Footer from './sections/Footer'
import AssistantLauncher from './assistant/AssistantLauncher'
import PageSkeleton from './components/ui/PageSkeleton'
import PageLoadFailed from './components/ui/PageLoadFailed'
import { ChunkBoundary } from './components/ui/ChunkBoundary'
import { reloadOnceForChunkError } from './components/ui/chunkReload'
import type { Page } from './i18n/locale'

/**
 * The WebGL journey (three + r3f + drei ≈ the bulk of the bundle) is code-split and only
 * requested after the first contentful paint (home) or after the page has loaded (sub-pages),
 * see `useAfterFirstPaint`. Until the canvas fades in, a fixed div in the page's first sky
 * palette (sky/fallback.ts, derived from journey.ts PALETTE) sits where the canvas will be, so
 * the first paint already shows the right sky and the hand-off is invisible. sky/fallback.ts
 * pulls in journey.ts only (no three), so this costs nothing up front.
 */
const SkyScene = lazy(() => import('./sections/SkyScene'))

/* Sub-pages are separate chunks: the home bundle never pays for them. */
const MembersPage = lazy(() => import('./pages/MembersPage'))
const HandbookPage = lazy(() => import('./pages/HandbookPage'))
const LinksPage = lazy(() => import('./pages/LinksPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

/*
 * Below-the-fold home sections with heavy code (ProductDemo + its i18n, DemoForm) are split out
 * of the entry chunk (plan §5 budget). Their placeholders keep the section id and roughly the
 * section height, so anchors (#platform, #join), scroll length and the journey stay stable while
 * the chunk loads. Both imports are warmed at the first idle slot after paint, long before a
 * reader can scroll that far.
 */
const loadProductDemo = () => import('./sections/ProductDemo')
const loadDemoForm = () => import('./sections/DemoForm')
const ProductDemo = lazy(loadProductDemo)
const DemoForm = lazy(loadDemoForm)
const PLATFORM_FALLBACK: CSSProperties = { minHeight: '140lvh' }
const JOIN_FALLBACK: CSSProperties = { minHeight: '54lvh' }

function useWarmHomeChunks() {
  useEffect(() => {
    const warm = () => {
      // A failed warm-up is not an error: the <ChunkBoundary> around each island handles it when
      // the section actually mounts. Swallow it so a blocked chunk is not an unhandled rejection.
      loadProductDemo().catch(() => undefined)
      loadDemoForm().catch(() => undefined)
    }
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 1500 })
      return () => window.cancelIdleCallback(id)
    }
    const timer = window.setTimeout(warm, 600)
    return () => window.clearTimeout(timer)
  }, [])
}

/** The sky placeholder in the page's own first palette (night on /members and /handbook). */
function skyFallback(page: Page): CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    background: fallbackGradientFor(presetForPage(page) ?? 'space'),
  }
}

/**
 * First paint = header + hero only; the sections below the fold mount in a few batches, one task
 * each, right after that paint (audit-loading L3). A deep link or a reload / back-forward (scroll
 * restoration) renders everything at once, so the target position exists immediately.
 */
function renderAllAtOnce(): boolean {
  if (window.location.hash && window.location.hash !== '#') return true
  const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined
  return (nav?.type ?? 'navigate') !== 'navigate'
}

function useStagedMount(total: number): number {
  const [stage, setStage] = useState(() => (renderAllAtOnce() ? total : 0))
  // Background until the reader shows intent to move; then the rest mounts ahead of the sky.
  const [priority, setPriority] = useState<TaskPriority>('background')
  useEffect(() => onFirstIntent(() => setPriority('user-blocking')), [])
  useEffect(() => {
    if (stage >= total) return
    let done = false
    const go = () => {
      if (done) return
      done = true
      setStage((s) => s + 1)
    }
    const cancel = stage === 0 ? afterFirstContentfulPaint(go, priority) : postTask(go, priority)
    // Hidden tabs get no frames: never wait more than a second per batch.
    const timer = window.setTimeout(go, stage === 0 ? 4000 : 1000)
    return () => {
      done = true
      cancel()
      window.clearTimeout(timer)
    }
  }, [stage, total, priority])
  return stage
}

/**
 * The sky chunk (three + r3f, ~260 KB) is requested only after the first frame has been painted:
 * before that it would compete with the critical CSS / JS / Inter on a slow link, and Lighthouse
 * counts every request started before the LCP paint as an LCP dependency. The wordmark TTF
 * starts downloading at the same moment (its own small chunk) on the home page.
 */
function useAfterFirstPaint(page: Page): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const start = () => {
      setReady(true)
      if (page === 'home') void import('./sections/sky/wordmarkFont').then((m) => m.preloadWordmarkFont())
    }
    if (page === 'home') {
      // Home: the sky IS the hero, request it right after the first paint.
      return afterFirstContentfulPaint(start, 'user-visible')
    }
    // Sub-pages: a static backdrop, so it waits for the page to load AND paint, then for an idle
    // slot. Both gates are needed: `load` can fire BEFORE the first paint (measured on /members,
    // load 285 ms vs paint 357 ms), and the sky chunk started before the paint would count as an
    // LCP dependency again — there the LCP element is the header wordmark.
    let idle = 0
    let timer = 0
    let cancelPaint = () => {}
    const later = () => {
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(start, { timeout: 1500 })
      else timer = window.setTimeout(start, 300)
    }
    const afterPaint = () => {
      cancelPaint = afterFirstContentfulPaint(later, 'background')
    }
    if (document.readyState === 'complete') afterPaint()
    else window.addEventListener('load', afterPaint, { once: true })
    return () => {
      window.removeEventListener('load', afterPaint)
      cancelPaint()
      if (idle) window.cancelIdleCallback(idle)
      window.clearTimeout(timer)
    }
  }, [page])
  return ready
}

function HomeSections() {
  useWarmHomeChunks()
  const stage = useStagedMount(8)
  return (
    <>
      <Hero />
      {stage >= 1 && <AgenticCards />}
      {stage >= 2 && (
        <>
          <Logos />
          <Waitlist />
        </>
      )}
      {stage >= 3 && <Supersize />}
      {stage >= 4 && (
        <ChunkBoundary fallback={<section id={sectionIds.platform} style={PLATFORM_FALLBACK} />}>
          <Suspense fallback={<section id={sectionIds.platform} style={PLATFORM_FALLBACK} />}>
            <ProductDemo />
          </Suspense>
        </ChunkBoundary>
      )}
      {stage >= 5 && <Features />}
      {stage >= 6 && (
        <>
          <Projects />
          <News />
        </>
      )}
      {stage >= 7 && (
        <>
          <ModelsCTA />
          <Integrations />
        </>
      )}
      {stage >= 8 && (
        <>
          <Storytelling />
          <ChunkBoundary fallback={<section id="join" style={JOIN_FALLBACK} />}>
            <Suspense fallback={<section id="join" style={JOIN_FALLBACK} />}>
              <DemoForm />
            </Suspense>
          </ChunkBoundary>
        </>
      )}
    </>
  )
}

/**
 * One SPA bundle, one page per document load (plan D2). The route comes from <RouteProvider>
 * (main.tsx); switching page or locale is a full navigation.
 *
 * Page contract (WP10): a page component renders its content only. App already provides the
 * `<main>` landmark, the header, the footer, the sky backdrop and the assistant launcher.
 */
export default function App() {
  const { page } = useRoute()
  const skyOn = useAfterFirstPaint(page)
  const skyPlaceholder = <div aria-hidden="true" style={skyFallback(page)} />

  return (
    <SmoothScroll>
      {/* Fixed full-viewport WebGL backdrop. z-0, lazy. SkyScene reads the route itself. */}
      <ChunkBoundary fallback={skyPlaceholder}>
        <Suspense fallback={skyPlaceholder}>{skyOn ? <SkyScene /> : skyPlaceholder}</Suspense>
      </ChunkBoundary>
      {/* Fixed 72px header. z-100 */}
      <Header />
      <main className="relative z-[2]">
        {page === 'home' ? (
          <HomeSections />
        ) : (
          // The skeleton keeps the footer below the fold while a sub-page chunk loads; if the chunk
          // never arrives the boundary swaps in a notice with a retry, because the same bars would
          // otherwise read as "still loading" forever (the guarded reload deliberately does nothing
          // in the first 30 s, which is when a first-visit failure happens).
          <ChunkBoundary fallback={<PageLoadFailed />} onError={reloadOnceForChunkError}>
            <Suspense fallback={<PageSkeleton />}>
              {page === 'members' ? (
                <MembersPage />
              ) : page === 'handbook' ? (
                <HandbookPage />
              ) : page === 'links' ? (
                <LinksPage />
              ) : (
                <NotFoundPage />
              )}
            </Suspense>
          </ChunkBoundary>
        )}
      </main>
      {/* Outside <main> so <footer> is exposed as the contentinfo landmark. */}
      <Footer />
      {/* Floating "Ask Q" launcher, every page. */}
      <AssistantLauncher />
    </SmoothScroll>
  )
}
