import { Component, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { onScroll } from '../lib/scroll'
import { useDocumentVisible, useReducedMotion } from '../lib/media'
import { PALETTE, updateJourney } from './sky/journey'
import { FALLBACK_GRADIENT } from './sky/fallback'
import { detectQuality, getAntialias, getDpr, type QualityTier } from './sky/quality'
import { attachPointer, stepPointer } from './sky/pointer'
import SkyDome from './sky/SkyDome'
import Stars from './sky/Stars'
import SceneLights from './sky/SceneLights'
import CloudSprites from './sky/CloudSprites'
import GlassWordmark from './sky/GlassWordmark'
import Field from './sky/Field'

/** Renders `fallback` if a subtree throws (no WebGL, font failure) instead of taking the page down. */
class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/**
 * The one writer of the shared journey state. Priority -100 so it runs before every layer's
 * useFrame: scroll → phase weights, then the lerped pointer. `state.size.height` is r3f's cached
 * canvas height (== viewport height for this fixed inset-0 canvas), refreshed on resize.
 */
function JourneyDriver({ reduced }: { reduced: boolean }) {
  useFrame((state) => {
    updateJourney(state.size.height, reduced ? 0 : state.clock.elapsedTime)
    stepPointer(0.06)
  }, -100)
  return null
}

/** In `demand` mode (reduced motion) the scene still has to follow the scroll position. */
function DemandInvalidator() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    invalidate()
    // a few extra frames so the env map, fonts and transmission buffer settle after mount
    const ids = [300, 1000, 2500].map((ms) => window.setTimeout(() => invalidate(), ms))
    const off = onScroll(() => invalidate())
    return () => {
      ids.forEach((id) => window.clearTimeout(id))
      off()
    }
  }, [invalidate])
  return null
}

/**
 * What the canvas is built for: the quality tier plus the two values derived from it and the
 * viewport (docs/JOURNEY-SPEC.md "Performance budget"). `dpr` follows the viewport at runtime
 * (r3f applies the prop change through `setDpr`); `antialias` is a WebGL context-creation
 * attribute, so the <Canvas> is keyed on it and remounts only when it actually has to change.
 */
interface CanvasProfile {
  tier: QualityTier
  dpr: number
  /** MSAA on exactly when the tier renders at 1× (see `getAntialias`) */
  antialias: boolean
}

function readProfile(tier: QualityTier): CanvasProfile {
  return { tier, dpr: getDpr(tier), antialias: getAntialias(tier) }
}

/** Viewport width at which `getDpr` switches from `dprCap` to `desktopDprCap` (quality.ts). */
const DESKTOP_QUERY = '(min-width: 1280px)'
/** Below this width `detectQuality` classifies the device as `low` (phones). */
const PHONE_QUERY = '(max-width: 767px)'

/**
 * Keeps the profile in step with the window: the desktop-width query re-caps the DPR, the
 * phone-width query re-runs the tier detection, and a `resolution` query catches the window
 * being dragged to a monitor with another devicePixelRatio. All three are threshold events,
 * never per-frame — the profile is state precisely because it changes so rarely.
 */
function useCanvasProfile(): CanvasProfile {
  const [profile, setProfile] = useState<CanvasProfile>(() => readProfile(detectQuality()))

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY)
    const phone = window.matchMedia(PHONE_QUERY)
    const recap = () => setProfile((p) => readProfile(p.tier))
    const redetect = () => setProfile(readProfile(detectQuality()))
    desktop.addEventListener('change', recap)
    phone.addEventListener('change', redetect)

    // devicePixelRatio has no event of its own: a `resolution` query that matches the current
    // ratio fires `change` once when the ratio changes, then has to be re-armed for the new one.
    let dppx: MediaQueryList | null = null
    const armDppx = () => {
      dppx?.removeEventListener('change', onDppx)
      dppx = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      dppx.addEventListener('change', onDppx)
    }
    const onDppx = () => {
      recap()
      armDppx()
    }
    armDppx()

    return () => {
      desktop.removeEventListener('change', recap)
      phone.removeEventListener('change', redetect)
      dppx?.removeEventListener('change', onDppx)
    }
  }, [])

  return profile
}

/**
 * The ONE fixed full-viewport canvas of the journey (docs/JOURNEY-SPEC.md): sky dome, stars,
 * lights, cloud sprites, the frosted wordmark (hero + footer) and the night field, all driven
 * by the shared `journey` state from a single render loop. Draw order (renderOrder):
 * SkyDome -10 → Stars -9 → clouds/glass/field (specialists) — the dome and stars never write
 * depth. A CSS space gradient (sky/fallback.ts, the same one App.tsx paints before this chunk
 * arrives) sits underneath for first paint and as the no-WebGL fallback.
 */
export default function SkyScene() {
  const reduced = useReducedMotion()
  const hidden = !useDocumentVisible()
  const { tier, dpr, antialias } = useCanvasProfile()
  const frameloop = hidden ? 'never' : reduced ? 'demand' : 'always'

  // The shared lerped pointer (sky/pointer.ts) listens for the life of the scene.
  useEffect(() => attachPointer(), [])

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0" style={{ background: FALLBACK_GRADIENT }} />
      <Boundary fallback={null}>
        <Canvas
          // Context attributes (antialias) cannot change after creation: remount only for those.
          key={`${tier}:${antialias ? 'msaa' : 'raw'}`}
          className="absolute inset-0"
          style={{ position: 'absolute', inset: 0 }}
          dpr={dpr}
          flat={false}
          gl={{ antialias, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true }}
          camera={{ fov: 40, position: [0, 0, 10], near: 0.1, far: 120 }}
          frameloop={frameloop}
          onCreated={(state) => {
            state.gl.setClearColor(PALETTE.space.top, 1)
            // Dev-only handle for perf profiling (toggle layers, read gl.info); stripped from prod.
            if (import.meta.env.DEV) (window as unknown as { __sky?: unknown }).__sky = state
          }}
        >
          <JourneyDriver reduced={reduced} />
          {reduced && <DemandInvalidator />}
          <SkyDome tier={tier} reduced={reduced} />
          <Stars tier={tier} reduced={reduced} />
          <SceneLights tier={tier} reduced={reduced} />
          <CloudSprites tier={tier} reduced={reduced} />
          <Boundary fallback={null}>
            <Suspense fallback={null}>
              <GlassWordmark tier={tier} reduced={reduced} />
            </Suspense>
          </Boundary>
          <Field tier={tier} reduced={reduced} />
        </Canvas>
      </Boundary>
    </div>
  )
}
