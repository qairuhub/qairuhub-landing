import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { LayerProps } from './types'
import { nextTask } from './warmup'
import { blendPalette, journey, PALETTE } from './journey'
import { QUALITY } from './quality'
import { FIELD, HILL_SEGMENTS, createFieldUniforms, skylineScreenY } from './field/terrain'
import { BAND, SUN_GLOW, WARM_GLOW, bandMix, horizonFor, midStopFor } from './skyShaders'
import Hills from './field/Hills'
import Grass from './field/Grass'
import Flora from './field/Flora'

const noop = () => {}

/**
 * The azimuth the far terrain's fade colour is solved at. The far ridge spans the whole frame and
 * the band is hotter near the sun, so one colour has to stand for all of it: half way between the
 * sun's own column and the edge of the warmth.
 */
const FADE_AZ = 0.5
/** Peak strength of the valley haze at `journey.sunset` = 1 (grassShaders' `fieldMist`). */
const MIST_MAX = 0.3

const srgbVec3 = (hex: string) => {
  const v = parseInt(hex.slice(1), 16)
  return new THREE.Vector3(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255)
}
const WARM_V = srgbVec3(WARM_GLOW)
const SUN_V = srgbVec3(SUN_GLOW)
const smooth01 = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Compiles every program the field will ever need, well before the footer is reached.
 *
 * The group is `visible=false` until `journey.ground > 0.01`, so nothing warms Hills/Grass/Flora
 * up on its own: three compiled them lazily on the very frame the user arrived at the footer —
 * a 200 ms hitch exactly where the wordmark descends and the hills rise. `compile()` walks the
 * object synchronously (`traverse`, lights from the target scene) and issues compile + link;
 * with KHR_parallel_shader_compile the driver links in the background and `compileAsync`
 * merely polls readiness, so the main-thread cost is a few milliseconds of source generation.
 *
 * Two variants exist per material and both are warmed:
 *   1. the main pass (renderer tone mapping, sRGB output);
 *   2. the transmission pass the frosted wordmark triggers — three renders the opaque objects
 *      into its transmission FBO with `toneMapping = NoToneMapping`, and any render target
 *      switches the program's output colour space to the linear working space. A scratch 1×1
 *      target bound for the duration of one `compile()` reproduces exactly that cache key.
 *
 * Lighting and `scene.environment` must already be in place (SceneLights mounts before the
 * field, and drei's <Environment> assigns its texture in a layout effect), otherwise the cache
 * key would differ at render time and the work would be wasted.
 */
function warmOne(gl: THREE.WebGLRenderer, object: THREE.Object3D, scene: THREE.Scene, camera: THREE.Camera) {
  gl.compileAsync(object, camera, scene).catch(noop)
  const toneMapping = gl.toneMapping
  const target = gl.getRenderTarget()
  const scratch = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false })
  gl.toneMapping = THREE.NoToneMapping
  gl.setRenderTarget(scratch)
  try {
    gl.compileAsync(object, camera, scene).catch(noop)
  } finally {
    gl.setRenderTarget(target)
    gl.toneMapping = toneMapping
    scratch.dispose()
  }
}

/** One child (hills / grass chunks / flora) per task, so no task generates all six sources. */
async function warmFieldPrograms(gl: THREE.WebGLRenderer, group: THREE.Group, scene: THREE.Scene, camera: THREE.Camera, cancelled: () => boolean) {
  for (const child of [...group.children]) {
    if (cancelled()) return
    warmOne(gl, child, scene, camera)
    await nextTask()
  }
}

/**
 * The backlit field at the golden-hour end of the journey: hills, grass, flowers and mushrooms in
 * ONE group that rises from below the frame on `journey.ground` (0 → 1 over the last 1.5 vh):
 * group y = mix(−9, −2.2, ground); nothing renders until ground > 0.01.
 *
 * Draw calls: terrain (1) + grass InstancedMesh (1) + merged flora (1) = 3 — unchanged. Lit by
 * SceneLights; the valley haze and the fade toward the skyline colour happen in the same
 * fragment shaders the field already had (no scene.fog, no new pass). Under reduced
 * motion the wind uniform is 0 and `journey.time` stays at 0 — a static frame.
 *
 * Its shader programs are warmed once after mount (see `warmFieldPrograms`), scheduled on an
 * idle slot so the hero's first frames are not competing with it.
 */
export default function Field({ tier, reduced }: LayerProps) {
  const group = useRef<THREE.Group>(null)
  const uniforms = useMemo(() => createFieldUniforms(PALETTE.afterglow.bottom), [])
  /** scratch for the per-frame skyline colour — see the useFrame below. No allocation. */
  const sky = useMemo(
    () => ({ top: { r: 0, g: 0, b: 0 }, mid: { r: 0, g: 0, b: 0 }, bottom: { r: 0, g: 0, b: 0 } }),
    [],
  )
  /** cached (aspect, viewport height) → where the band and the skyline are; a terrain scan, not per-frame work */
  const geom = useMemo(() => ({ aspect: -1, height: -1, horizon: 0.55, skyline: 0.56 }), [])
  const q = QUALITY[tier]
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    uniforms.uWind.value = reduced ? 0 : 1
  }, [reduced, uniforms])

  // Hills, grass and flora are built in three commits (one task each) instead of one.
  const [stage, setStage] = useState(1)
  useEffect(() => {
    if (stage >= 3) return
    let cancelled = false
    void nextTask().then(() => {
      if (!cancelled) setStage((s) => s + 1)
    })
    return () => {
      cancelled = true
    }
  }, [stage])

  useEffect(() => {
    if (stage < 3) return
    let cancelled = false
    const run = () => {
      const g = group.current
      if (cancelled || !g) return
      void warmFieldPrograms(gl, g, scene, camera, () => cancelled)
    }
    // Off the critical path: the first idle slot, or at the latest ~1 s after mount — long before
    // any scroll (Lenis-smoothed) can reach the footer. Safari has no requestIdleCallback.
    const idle = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(run, { timeout: 1200 }) : 0
    const timer = idle ? 0 : window.setTimeout(run, 400)
    return () => {
      cancelled = true
      if (idle) window.cancelIdleCallback(idle)
      if (timer) window.clearTimeout(timer)
    }
  }, [gl, scene, camera, stage])

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const ground = journey.ground
    g.visible = ground > 0.01
    g.position.y = FIELD.riseFrom + (FIELD.riseTo - FIELD.riseFrom) * ground
    uniforms.uTime.value = journey.time
    if (!g.visible) return

    // The colour the far terrain dissolves into is the sky it actually MEETS — the dome's own
    // output at the skyline — not the foot of the gradient (which left a hard pink seam along the
    // ridge, orange sky above and mauve valley below). It is derived rather than copied: the
    // skyline's screen y and the band's hot line come from the same two functions the dome uses,
    // and the band's strength there from the dome shader's own constants (skyShaders' BAND /
    // bandMix / LOW_TINT). Retuning the band moves the sky and the terrain together, which is the
    // desync the review called out. Three palette blends and some scalar maths — no allocation.
    const aspect = state.size.width / Math.max(1, state.size.height)
    if (geom.aspect !== aspect || geom.height !== state.size.height) {
      geom.aspect = aspect
      geom.height = state.size.height
      geom.horizon = horizonFor(aspect, state.size.height)
      geom.skyline = skylineScreenY(aspect)
    }
    const sunset = journey.sunset
    const top = blendPalette('top', sky.top)
    const mid = blendPalette('mid', sky.mid)
    const bottom = blendPalette('bottom', sky.bottom)
    const midStop = midStopFor(geom.horizon, sunset)
    const t = geom.skyline < midStop ? geom.skyline / midStop : (geom.skyline - midStop) / (1 - midStop)
    const a = geom.skyline < midStop ? top : mid
    const b = geom.skyline < midStop ? mid : bottom
    let r = a.r + (b.r - a.r) * t
    let gg = a.g + (b.g - a.g) * t
    let bb = a.b + (b.b - a.b) * t
    const hy = geom.skyline - geom.horizon
    const { warm, hot } = bandMix(hy, BAND.riseBase + (1 - BAND.riseBase) * ground)
    const kWarm = warm * (BAND.warmMix + BAND.warmAz * FADE_AZ) * sunset
    r += (WARM_V.x - r) * kWarm
    gg += (WARM_V.y - gg) * kWarm
    bb += (WARM_V.z - bb) * kWarm
    const kHot = hot * (BAND.hotMix + BAND.hotAz * FADE_AZ) * sunset
    r += (SUN_V.x - r) * kHot
    gg += (SUN_V.y - gg) * kHot
    bb += (SUN_V.z - bb) * kHot
    const shade = smooth01(0, BAND.shadeSpan, Math.max(0, hy)) * sunset
    uniforms.uFade.value.set(
      r * (1 + (BAND.lowTint[0] - 1) * shade),
      gg * (1 + (BAND.lowTint[1] - 1) * shade),
      bb * (1 + (BAND.lowTint[2] - 1) * shade),
    )
    uniforms.uMistAmount.value = MIST_MAX * sunset
  })

  return (
    <group ref={group} position={[0, FIELD.riseFrom, 0]} visible={false}>
      <Hills segments={HILL_SEGMENTS[tier]} uniforms={uniforms} />
      {stage >= 2 && <Grass count={q.blades} uniforms={uniforms} />}
      {stage >= 3 && <Flora uniforms={uniforms} />}
    </group>
  )
}
