import { Suspense, lazy, type CSSProperties } from 'react'
import { SmoothScroll } from './lib/SmoothScroll'
import { FALLBACK_GRADIENT } from './sections/sky/fallback'
import Header from './sections/Header'
import Hero from './sections/Hero'
import AgenticCards from './sections/AgenticCards'
import Logos from './sections/Logos'
import Waitlist from './sections/Waitlist'
import Supersize from './sections/Supersize'
import ProductDemo from './sections/ProductDemo'
import Features from './sections/Features'
import ModelsCTA from './sections/ModelsCTA'
import Integrations from './sections/Integrations'
import Storytelling from './sections/Storytelling'
import DemoForm from './sections/DemoForm'
import Footer from './sections/Footer'

/**
 * The WebGL journey (three + r3f + drei ≈ the bulk of the bundle) is code-split and only
 * requested after the DOM has painted. Until the chunk arrives a fixed div in the SPACE
 * palette (sky/fallback.ts, derived from journey.ts PALETTE.space) sits where the canvas will
 * be, so the first paint is already the top of the journey and the hand-off is invisible.
 * sky/fallback.ts pulls in journey.ts only (no three), so this costs nothing up front.
 */
const SkyScene = lazy(() => import('./sections/SkyScene'))

const SPACE_FALLBACK: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  background: FALLBACK_GRADIENT,
}

/**
 * Page order mirrors the reference landing 1:1.
 * Every section is a self-contained component under src/sections.
 * Copy lives in src/content.ts — edit text there, not in the components.
 */
export default function App() {
  return (
    <SmoothScroll>
      {/* Fixed full-viewport WebGL journey (space → sky → night + field). z-0, lazy. */}
      <Suspense fallback={<div aria-hidden="true" style={SPACE_FALLBACK} />}>
        <SkyScene />
      </Suspense>
      {/* Fixed 72px header. z-100 */}
      <Header />
      <main className="relative z-[2]">
        <Hero />
        <AgenticCards />
        <Logos />
        <Waitlist />
        <Supersize />
        <ProductDemo />
        <Features />
        <ModelsCTA />
        <Integrations />
        <Storytelling />
        <DemoForm />
      </main>
      {/* Outside <main> so <footer> is exposed as the contentinfo landmark. 150vh spacer. */}
      <Footer />
    </SmoothScroll>
  )
}
