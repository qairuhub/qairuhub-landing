import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getConsoleFunction, setConsoleFunction } from 'three'
import { onScroll } from '../lib/scroll'
import { useDocumentVisible, useReducedMotion } from '../lib/media'
import { useRoute } from '../i18n/LocaleProvider'
import { PALETTE, journey, setStaticJourney, updateJourney } from './sky/journey'
import { fallbackGradientFor, presetForPage as presetFor, type StaticPreset } from './sky/fallback'
import { detectQuality, getAntialias, getDpr, type QualityTier } from './sky/quality'
import { attachPointer, stepPointer } from './sky/pointer'
import SkyDome from './sky/SkyDome'
import Stars from './sky/Stars'
import SceneLights from './sky/SceneLights'
import CloudSprites, { allowCloudBake } from './sky/CloudSprites'
import GlassWordmark, { GLASS_WORDMARK_NAME, GlassWordmarkFailed, glassWordmarkSettled, preloadGlassWordmark } from './sky/GlassWordmark'
import { compileTracked, delay, listWarmers, markReveal, nextTask, openWordmarkGate, warmPMREM, whenLinked } from './sky/warmup'
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

/** drei <Environment resolution> in SceneLights: the PMREM programs are sized from it. */
const ENV_RESOLUTION = 64

/** Software rasterisers: SwiftShader (headless Chrome, so every Lighthouse run), Mesa, Windows WARP. */
const SOFTWARE_GL = /swiftshader|llvmpipe|software\s*rasteriz|basic render|\bwarp\b/i

/**
 * Whether the reveal may be split (audit item L15). It only pays off where the driver really links
 * programs off the main thread AND draws on a GPU:
 *
 *   - no `KHR_parallel_shader_compile`: linking blocks, so the wordmark's link would stall the
 *     very frames the early reveal starts;
 *   - a software rasteriser: the extension IS advertised, but every frame is drawn on the CPU.
 *     Revealing the sky 0.7 s sooner there does not make the frames cheaper, it only moves one
 *     ~465 ms software frame earlier — measured as Lighthouse desktop home 99 → 82, with the same
 *     frame simply falling outside the trace before. docs/PERFORMANCE.md has the numbers.
 *
 * Both cases keep the single gate, i.e. exactly the behaviour of the build before L15.
 */
function canSplitReveal(gl: THREE.WebGLRenderer): boolean {
  try {
    const ctx = gl.getContext()
    if (!ctx.getExtension('KHR_parallel_shader_compile')) return false
    const info = ctx.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? ctx.getParameter(info.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER)
    return !SOFTWARE_GL.test(String(renderer))
  } catch {
    return false
  }
}

/**
 * Links every program of the first frames in the background before the canvas renders at all
 * (audit-loading L1). Order matters: three converts `scene.environment` with its PMREM programs
 * inside the first compile of a lit material, so those (and the private bake scenes) are warmed
 * and awaited first; then each top-level object is prepared for the main pass and for
 * render-to-texture passes, one object per task.
 *
 * Two stages (verify round 2): `onReady` fires once every layer EXCEPT the glass wordmark is
 * linked, which is what the canvas reveal waits for; the wordmark's own program (drei's
 * transmission material, the slowest to link, on a geometry that is built one glyph per task)
 * then opens its gate and GlassWordmark fades it in. Waiting for it here cost the hero ~1.4 s.
 */
function Warmup({ withWordmark, gateKey, onReady }: { withWordmark: boolean; gateKey: string; onReady: () => void }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    let cancelled = false
    const both = async (object: THREE.Object3D, pending: Promise<unknown>[]) => {
      pending.push(whenLinked(compileTracked(gl, object, camera, scene, false)))
      await nextTask()
      pending.push(whenLinked(compileTracked(gl, object, camera, scene, true)))
      await nextTask()
    }
    const run = async () => {
      await nextTask()
      if (cancelled) return
      const pending: Promise<unknown>[] = []
      // 1. everything unlit (no environment conversion) + the private bake scenes + PMREM, in parallel.
      //    PMREM belongs to the lit wordmark, so the reveal does not strictly need it — but letting the
      //    frameloop start first only moves the contention: measured on the reference machine, dropping
      //    it from this gate reveals the sky 247 ms sooner and the WORDMARK 338 ms later (1448/2739 vs
      //    1695/2401 ms), because the wordmark's link then polls against a running render loop. The
      //    wordmark is the hero, and here it lands exactly as the 700 ms canvas fade ends.
      const pmrem = withWordmark ? warmPMREM(gl, ENV_RESOLUTION) : Promise.resolve()
      pending.push(pmrem)
      await nextTask()
      for (const warm of listWarmers()) {
        const p = warm(gl)
        if (p) pending.push(p)
        await nextTask()
      }
      for (const child of [...scene.children]) {
        if (cancelled) return
        if (child.name === GLASS_WORDMARK_NAME) continue
        await both(child, pending)
      }
      // 1b. the sky can be revealed now: everything it draws in the first frames is linked.
      await Promise.all(pending)
      if (cancelled) return
      if (canSplitReveal(gl)) onReady()
      // 2. the lit wordmark once its mesh exists and the PMREM programs are linked (its first
      //    compile converts scene.environment with them)
      if (withWordmark) {
        const wordmarkPending: Promise<unknown>[] = []
        await Promise.all([glassWordmarkSettled(), pmrem])
        const wordmark = scene.getObjectByName(GLASS_WORDMARK_NAME)
        if (wordmark && !cancelled) {
          wordmark.traverse((o) => {
            const m = (o as THREE.Mesh).material as (THREE.Material & { defines?: Record<string, string>; uniforms?: Record<string, unknown> }) | undefined
            // drei's onBeforeCompile adds USE_TRANSMISSION on the first compile; declaring it up
            // front keeps the program cache key stable, so the warmed program is the one drawn.
            if (m?.uniforms && '_transmission' in m.uniforms && m.defines && !('USE_TRANSMISSION' in m.defines)) m.defines.USE_TRANSMISSION = ''
          })
          await both(wordmark, wordmarkPending)
        }
        await Promise.all(wordmarkPending)
      }
    }
    // A driver without KHR_parallel_shader_compile still links (blocking); never hold the sky or
    // the wordmark back: both gates open on the timeout too.
    Promise.race([run(), delay(8000)])
      .catch(() => {})
      .finally(() => {
        if (cancelled) return
        onReady()
        openWordmarkGate(gateKey)
        // The gate is module state, so it re-renders nothing: in `demand` mode (reduced motion)
        // ask for the one frame that draws the wordmark, instead of waiting for the next scroll.
        invalidate()
      })
    return () => {
      cancelled = true
    }
  }, [gl, scene, camera, withWordmark, gateKey, onReady, invalidate])
  return null
}

/**
 * Calls `onFrame` once the first rendered frame has been handed to the compositor. It mounts in
 * the commit that switches the frameloop on; in `demand` mode (reduced motion) the store's own
 * invalidate may already have been spent before this subscriber existed, so it asks for a frame.
 */
function FirstFrame({ onFrame }: { onFrame: () => void }) {
  const done = useRef(false)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), [invalidate])
  useFrame(() => {
    if (done.current) return
    done.current = true
    requestAnimationFrame(() => onFrame())
  })
  return null
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
 *
 * Load sequence (perf/v3.1/audit-loading.md L1, L6–L8): the layers mount one task at a time, the
 * canvas stays on `frameloop="never"` while <Warmup> links every program in the background, and
 * the first frame then fades in over the gradient. The glass wordmark has its own, later gate (its
 * transmission program is the slowest to link), so the sky does not wait for it. The cloud-atlas
 * bake and the night field only start after the reveal.
 */
export default function SkyScene() {
  const { page } = useRoute()
  const preset = presetFor(page)
  const reduced = useReducedMotion()
  const hidden = !useDocumentVisible()
  const { tier, dpr, antialias } = useCanvasProfile()
  const canvasKey = `${tier}:${antialias ? 'msaa' : 'raw'}`
  // Per canvas instance (a remount for new context attributes warms up again).
  const [liveKey, setLiveKey] = useState<string | null>(null)
  const [shownKey, setShownKey] = useState<string | null>(null)
  const live = liveKey === canvasKey
  const shown = shownKey === canvasKey
  const onReady = useCallback(() => {
    markReveal('qh-sky-ready')
    setLiveKey(canvasKey)
  }, [canvasKey])
  const onShown = useCallback(() => setShownKey(canvasKey), [canvasKey])
  const frameloop = hidden || !live ? 'never' : reduced ? 'demand' : 'always'

  // Layers mount one commit (task) at a time: dome + stars, clouds, lights / environment, wordmark.
  const [layerStage, setLayerStage] = useState(0)
  useEffect(() => {
    if (layerStage >= 3) return
    let cancelled = false
    void nextTask().then(() => {
      if (!cancelled) setLayerStage((s) => s + 1)
    })
    return () => {
      cancelled = true
    }
  }, [layerStage])

  // After the reveal: the cloud atlas bake, then the night field (only the footer shows it).
  const [fieldOn, setFieldOn] = useState(false)
  useEffect(() => {
    if (!shown) return
    const bake = window.setTimeout(allowCloudBake, preset ? 0 : 1200)
    if (preset) return () => window.clearTimeout(bake)
    const mount = () => setFieldOn(true)
    const idle = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(mount, { timeout: 2500 }) : 0
    const timer = idle ? 0 : window.setTimeout(mount, 1500)
    const off = onScroll((s) => {
      if (s.y > window.innerHeight * 0.3) mount()
    })
    return () => {
      window.clearTimeout(bake)
      if (idle) window.cancelIdleCallback(idle)
      if (timer) window.clearTimeout(timer)
      off()
    }
  }, [shown, preset])

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
          key={canvasKey}
          className="absolute inset-0"
          style={{ position: 'absolute', inset: 0, opacity: shown ? 1 : 0, transition: reduced ? 'none' : 'opacity 700ms ease-out' }}
          dpr={dpr}
          flat={false}
          gl={{ antialias, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true }}
          camera={{ fov: 40, position: [0, 0, 10], near: 0.1, far: 120 }}
          frameloop={frameloop}
          onCreated={(state) => {
            state.gl.setClearColor(preset === 'night' ? PALETTE.night.top : PALETTE.space.top, 1)
            // three's first use of a program reads three info logs: on ANGLE-D3D11 each is a
            // synchronous GPU-process round trip (5–25 ms per program even after the warm-up).
            // Dev builds keep the shader error reporting.
            state.gl.debug.checkShaderErrors = import.meta.env.DEV
            // Dev-only handle for perf profiling (toggle layers, read gl.info); stripped from prod.
            if (import.meta.env.DEV) (window as unknown as { __sky?: unknown }).__sky = state
          }}
        >
          <JourneyDriver reduced={reduced} preset={preset} />
          {reduced && <DemandInvalidator />}
          <SkyDome tier={tier} reduced={reduced} />
          <Stars tier={tier} reduced={reduced} />
          {layerStage >= 2 && !preset && <SceneLights tier={tier} reduced={reduced} />}
          {layerStage >= 1 && <CloudSprites tier={tier} reduced={reduced} />}
          {layerStage >= 3 && !preset && (
            <Boundary fallback={<GlassWordmarkFailed />}>
              <Suspense fallback={null}>
                <GlassWordmark tier={tier} reduced={reduced} gateKey={canvasKey} />
              </Suspense>
            </Boundary>
          )}
          {!preset && fieldOn && <Field tier={tier} reduced={reduced} />}
          {layerStage >= 3 && <Warmup withWordmark={!preset} gateKey={canvasKey} onReady={onReady} />}
          {live && !shown && <FirstFrame onFrame={onShown} />}
        </Canvas>
      </Boundary>
    </div>
  )
}
