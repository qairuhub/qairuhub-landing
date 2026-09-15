import { Suspense, lazy, useEffect, type CSSProperties } from 'react'
import { SmoothScroll } from './lib/SmoothScroll'
import { useRoute } from './i18n/LocaleProvider'
import { FALLBACK_GRADIENT } from './sections/sky/fallback'
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

/**
 * The WebGL journey (three + r3f + drei ≈ the bulk of the bundle) is code-split and only
 * requested after the DOM has painted. Until the chunk arrives a fixed div in the SPACE
 * palette (sky/fallback.ts, derived from journey.ts PALETTE.space) sits where the canvas will
 * be, so the first paint is already the top of the journey and the hand-off is invisible.
 * sky/fallback.ts pulls in journey.ts only (no three), so this costs nothing up front.
 */
const SkyScene = lazy(() => import('./sections/SkyScene'))

/* Sub-pages are separate chunks: the home bundle never pays for them. */
const MembersPage = lazy(() => import('./pages/MembersPage'))
const HandbookPage = lazy(() => import('./pages/HandbookPage'))
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
      void loadProductDemo()
      void loadDemoForm()
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

const SPACE_FALLBACK: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  background: FALLBACK_GRADIENT,
}

/** Keeps the footer below the fold while a sub-page chunk loads (no footer flash at the top). */
const PAGE_FALLBACK: CSSProperties = { minHeight: '100lvh' }

function HomeSections() {
  useWarmHomeChunks()
  return (
    <>
      <Hero />
      <AgenticCards />
      <Logos />
      <Waitlist />
      <Supersize />
      <Suspense fallback={<section id={sectionIds.platform} style={PLATFORM_FALLBACK} />}>
        <ProductDemo />
      </Suspense>
      <Features />
      <Projects />
      <News />
      <ModelsCTA />
      <Integrations />
      <Storytelling />
      <Suspense fallback={<section id="join" style={JOIN_FALLBACK} />}>
        <DemoForm />
      </Suspense>
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

  return (
    <SmoothScroll>
      {/* Fixed full-viewport WebGL backdrop. z-0, lazy. SkyScene reads the route itself. */}
      <Suspense fallback={<div aria-hidden="true" style={SPACE_FALLBACK} />}>
        <SkyScene />
      </Suspense>
      {/* Fixed 72px header. z-100 */}
      <Header />
      <main className="relative z-[2]">
        {page === 'home' ? (
          <HomeSections />
        ) : (
          <Suspense fallback={<div style={PAGE_FALLBACK} />}>
            {page === 'members' ? <MembersPage /> : page === 'handbook' ? <HandbookPage /> : <NotFoundPage />}
          </Suspense>
        )}
      </main>
      {/* Outside <main> so <footer> is exposed as the contentinfo landmark. */}
      <Footer />
      {/* Floating "Ask Q" launcher, every page. */}
      <AssistantLauncher />
    </SmoothScroll>
  )
}
