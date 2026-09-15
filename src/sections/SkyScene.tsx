import { Component, Suspense, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { getConsoleFunction, setConsoleFunction } from 'three'
import { onScroll } from '../lib/scroll'
import { useDocumentVisible, useReducedMotion } from '../lib/media'
import { useRoute } from '../i18n/LocaleProvider'
import type { Page } from '../i18n/locale'
import { PALETTE, journey, setStaticJourney, updateJourney } from './sky/journey'
import { fallbackGradientFor } from './sky/fallback'
import { detectQuality, getAntialias, getDpr, type QualityTier } from './sky/quality'
import { attachPointer, stepPointer } from './sky/pointer'
import SkyDome from './sky/SkyDome'
import Stars from './sky/Stars'
import SceneLights from './sky/SceneLights'
import CloudSprites from './sky/CloudSprites'
import GlassWordmark, { preloadGlassWordmark } from './sky/GlassWordmark'
import Field from './sky/Field'

/**
 * Silences exactly one known-harmless three.js deprecation: @react-three/fiber 9.7 (the latest 9.x)
 * still builds its store with `new THREE.Clock()`, and three r183+ warns about it on every Canvas
 * mount. Routed through three's own logger hook (`setConsoleFunction`, which only sees three's
 * log / warn / error calls) instead of patching the global console, and installed at module
 * evaluation so it is in place before the <Canvas> creates its store. Every other message still
 * reaches the console unchanged, through any logger that was already installed.
 */
const CLOCK_DEPRECATION = 'THREE.Clock: This module has been deprecated'
/**
 * Second known-harmless message: on Windows, ANGLE compiles GLSL to HLSL and the D3D compiler
 * reports constant folding of three's own shader chunks as "warning X4122: sum of … cannot be
 * represented accurately in double precision". three forwards any non-empty program log as a
 * warning (seen on the user's Intel UHD / D3D11). Dropped only when X4122 is the log's sole content.
 */
const PROGRAM_LOG = 'THREE.WebGLProgram: Program Info Log:'
const isOnlyX4122 = (message: string, params: unknown[]) => {
  // three calls warn('WebGLProgram: Program Info Log:', programLog): the log arrives as a param.
  const log = [message.slice(PROGRAM_LOG.length), ...params.map((p) => (typeof p === 'string' ? p : ''))].join('\n')
  // Only diagnostic lines count (the D3D log also carries blank / NUL-padded filler lines).
  const lines = log.split(/\r?\n/).filter((l) => /\b(warning|error)\b/i.test(l))
  return lines.length > 0 && lines.every((l) => /warning X4122:/.test(l))
}
type ThreeConsoleFn = Parameters<typeof setConsoleFunction>[0]
const previousThreeConsole = getConsoleFunction() as ThreeConsoleFn | null
setConsoleFunction((type, message, ...params) => {
  if (type === 'warn' && message.startsWith(CLOCK_DEPRECATION)) return
  if (type === 'warn' && message.startsWith(PROGRAM_LOG) && isOnlyX4122(message, params)) return
  if (previousThreeConsole) return previousThreeConsole(type, message, ...params)
  // Mirror three's default output, including its TSL stack-trace form.
  const trace = params[0] as { isStackTrace?: boolean; getError?: (m: string) => Error } | undefined
  if (type !== 'log' && trace?.isStackTrace && trace.getError) console[type](trace.getError(message))
  else console[type](message, ...params)
})

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

/** A page without a scroll story renders one frozen journey preset (V3-BUILD-PLAN WP1 C). */
type StaticPreset = 'night' | 'space'

/** home → the scroll journey (null); 404 → space (the top of the journey); every other page → night. */
function presetFor(page: Page): StaticPreset | null {
  if (page === 'home') return null
  return page === 'notFound' ? 'space' : 'night'
}

/**
 * The one writer of the shared journey state. Priority -100 so it runs before every layer's
 * useFrame: scroll → phase weights, then the lerped pointer. `state.size.height` is r3f's cached
 * canvas height (== viewport height for this fixed inset-0 canvas), refreshed on resize.
 *
 * With a static `preset` the weights are written once (before the first frame) and
 * `updateJourney` never runs, so a short sub-page never scrolls into the descent / whiteout; only
 * the clock advances for the star twinkle and the cloud sway.
 */
function JourneyDriver({ reduced, preset }: { reduced: boolean; preset: StaticPreset | null }) {
  useLayoutEffect(() => {
    if (preset) setStaticJourney(preset)
  }, [preset])

  useFrame((state) => {
    const time = reduced ? 0 : state.clock.elapsedTime
    if (preset) journey.time = time
    else updateJourney(state.size.height, time)
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
 * depth. A CSS gradient in the page's first palette (sky/fallback.ts) sits underneath for first
 * paint and as the no-WebGL fallback.
 *
 * The route decides what is mounted (V3-BUILD-PLAN WP1 C). Home: the full scroll journey.
 * Sub-pages: a static preset (`night` for /members and /handbook, `space` for the 404) with only
 * the dome, the stars and the clouds. No GlassWordmark (no Courgette fetch, no transmission FBO),
 * no Field and no SceneLights: every remaining layer is an unlit shader, so the environment bake
 * would be wasted.
 */
export default function SkyScene() {
  const { page } = useRoute()
  const preset = presetFor(page)
  const reduced = useReducedMotion()
  const hidden = !useDocumentVisible()
  const { tier, dpr, antialias } = useCanvasProfile()
  const frameloop = hidden ? 'never' : reduced ? 'demand' : 'always'

  // Start the wordmark TTF download with the chunk (idempotent), on the one page that draws it.
  if (!preset) preloadGlassWordmark()

  // The shared lerped pointer (sky/pointer.ts) listens for the life of the scene.
  useEffect(() => attachPointer(), [])

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0" style={{ background: fallbackGradientFor(preset ?? 'space') }} />
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
            state.gl.setClearColor(preset === 'night' ? PALETTE.night.top : PALETTE.space.top, 1)
            // Dev-only handle for perf profiling (toggle layers, read gl.info); stripped from prod.
            if (import.meta.env.DEV) (window as unknown as { __sky?: unknown }).__sky = state
          }}
        >
          <JourneyDriver reduced={reduced} preset={preset} />
          {reduced && <DemandInvalidator />}
          <SkyDome tier={tier} reduced={reduced} />
          <Stars tier={tier} reduced={reduced} />
          {!preset && <SceneLights tier={tier} reduced={reduced} />}
          <CloudSprites tier={tier} reduced={reduced} />
          {!preset && (
            <Boundary fallback={null}>
              <Suspense fallback={null}>
                <GlassWordmark tier={tier} reduced={reduced} />
              </Suspense>
            </Boundary>
          )}
          {!preset && <Field tier={tier} reduced={reduced} />}
        </Canvas>
      </Boundary>
    </div>
  )
}
