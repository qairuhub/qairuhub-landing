import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { LayerProps } from './types'
import { journey, PALETTE } from './journey'
import { QUALITY } from './quality'
import { FIELD, HILL_SEGMENTS, createFieldUniforms } from './field/terrain'
import Hills from './field/Hills'
import Grass from './field/Grass'
import Flora from './field/Flora'

const noop = () => {}

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
function warmFieldPrograms(gl: THREE.WebGLRenderer, group: THREE.Group, scene: THREE.Scene, camera: THREE.Camera) {
  const wasVisible = group.visible
  group.visible = true
  try {
    gl.compileAsync(group, camera, scene).catch(noop)

    const toneMapping = gl.toneMapping
    const target = gl.getRenderTarget()
    const scratch = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false })
    gl.toneMapping = THREE.NoToneMapping
    gl.setRenderTarget(scratch)
    try {
      gl.compileAsync(group, camera, scene).catch(noop)
    } finally {
      gl.setRenderTarget(target)
      gl.toneMapping = toneMapping
      scratch.dispose()
    }
  } finally {
    group.visible = wasVisible
  }
}

/**
 * The moonlit field at the end of the journey: hills, grass, flowers and mushrooms in ONE group
 * that rises from below the frame on `journey.ground` (0 → 1 over the last 1.5 vh):
 * group y = mix(−9, −2.2, ground); nothing renders until ground > 0.01.
 *
 * Draw calls: terrain (1) + grass InstancedMesh (1) + merged flora (1) = 3. Lit by SceneLights;
 * the distance fade toward PALETTE.night.bottom happens in-shader (no scene.fog). Under reduced
 * motion the wind uniform is 0 and `journey.time` stays at 0 — a static frame.
 *
 * Its shader programs are warmed once after mount (see `warmFieldPrograms`), scheduled on an
 * idle slot so the hero's first frames are not competing with it.
 */
export default function Field({ tier, reduced }: LayerProps) {
  const group = useRef<THREE.Group>(null)
  const uniforms = useMemo(() => createFieldUniforms(PALETTE.night.bottom), [])
  const q = QUALITY[tier]
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    uniforms.uWind.value = reduced ? 0 : 1
  }, [reduced, uniforms])

  useEffect(() => {
    let cancelled = false
    const run = () => {
      const g = group.current
      if (cancelled || !g) return
      warmFieldPrograms(gl, g, scene, camera)
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
  }, [gl, scene, camera])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const ground = journey.ground
    g.visible = ground > 0.01
    g.position.y = FIELD.riseFrom + (FIELD.riseTo - FIELD.riseFrom) * ground
    uniforms.uTime.value = journey.time
  })

  return (
    <group ref={group} position={[0, FIELD.riseFrom, 0]} visible={false}>
      <Hills segments={HILL_SEGMENTS[tier]} uniforms={uniforms} />
      <Grass count={q.blades} uniforms={uniforms} />
      <Flora uniforms={uniforms} />
    </group>
  )
}
