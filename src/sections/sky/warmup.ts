import * as THREE from 'three'

/**
 * Non-blocking shader warm-up for the sky canvas (perf/v3.1/audit-loading.md, L1).
 *
 * three links every program on the main thread the first time it is used: `onFirstUse` asks for
 * the info log / uniforms, and that call blocks until the driver has finished the link. With
 * KHR_parallel_shader_compile (Chrome, Edge, Safari 17+, Firefox) `renderer.compileAsync()` issues
 * the compile + link and then only POLLS `COMPLETION_STATUS_KHR`, so the GPU process links in the
 * background while the page stays responsive. The canvas therefore stays on `frameloop="never"`
 * until every program of the first frames reports ready.
 *
 * Programs are keyed by the render target that is bound while they are prepared (output colour
 * space, tone mapping), so render-to-texture passes (drei's transmission FBO, the cloud / nebula
 * bakes, three's PMREM conversion) are warmed with a target bound: `compileForTarget`.
 */

type Warmer = (gl: THREE.WebGLRenderer) => Promise<unknown> | void

const warmers = new Set<Warmer>()

/** Layers with private bake scenes register how to warm them (called once by SkyScene). */
export function registerWarmer(fn: Warmer): () => void {
  warmers.add(fn)
  return () => {
    warmers.delete(fn)
  }
}

export function listWarmers(): Warmer[] {
  return [...warmers]
}

/** Resolves in a new macrotask (after the browser had a chance to paint / handle input). */
export function nextTask(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (s?.yield) return s.yield()
  return new Promise((resolve) => {
    const ch = new MessageChannel()
    ch.port1.onmessage = () => resolve()
    ch.port2.postMessage(0)
  })
}

export const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/* ------------------------------------------------------------------ wordmark reveal gate */

/**
 * The glass wordmark is the one layer whose program is slow to link (drei's
 * MeshTransmissionMaterial, 0.5–0.8 s cold on the reference Intel UHD) and whose geometry is built
 * one glyph per task. Holding the whole canvas for it delayed the first hero paint by ~1.4 s, so
 * the sky reveals as soon as the other layers are linked and the wordmark fades in on its own once
 * `openWordmarkGate` is called. Keyed by the canvas instance: a remount (new context attributes)
 * has to link everything again, so its gate starts closed.
 */
const wordmarkGate = { key: '', openedAt: 0 }

/**
 * User-timing mark for the first time a reveal stage is reached, so the two stages can be read
 * from a profile, from RUM and from perf/v3.1/scripts/verify-reveal-cold.mjs without instrumenting
 * WebGL. Once per name per document; `performance.mark` is guarded because it is missing in some
 * embedded webviews.
 */
const marked = new Set<string>()
export function markReveal(name: 'qh-sky-ready' | 'qh-wordmark-ready'): void {
  if (marked.has(name)) return
  marked.add(name)
  try {
    performance.mark?.(name)
  } catch {
    /* user timing unavailable: measurement only, never behaviour */
  }
}

/** Wordmark programs for `key` are linked: start its fade. Idempotent per key. */
export function openWordmarkGate(key: string): void {
  if (wordmarkGate.key === key && wordmarkGate.openedAt) return
  wordmarkGate.key = key
  wordmarkGate.openedAt = performance.now()
  markReveal('qh-wordmark-ready')
}

/**
 * Reveal ramp for the wordmark of `key`: 0 before its programs are linked, then 0 → 1 over
 * WORDMARK_FADE_MS. GlassWordmark applies it as opacity only where the material is already
 * transparent (the low tier's physical stand-in); the frosted MeshTransmissionMaterial is opaque
 * and `material.transparent` is part of three's program cache key, so there it only decides the
 * one frame the run switches on (see the note in GlassWordmark's useFrame).
 */
export const WORDMARK_FADE_MS = 500

export function wordmarkGateFade(key: string, instant: boolean): number {
  if (wordmarkGate.key !== key || !wordmarkGate.openedAt) return 0
  if (instant) return 1
  const t = (performance.now() - wordmarkGate.openedAt) / WORDMARK_FADE_MS
  return t >= 1 ? 1 : t <= 0 ? 0 : t * t * (3 - 2 * t)
}

interface TrackedProgram {
  isReady(): boolean
}

/**
 * `renderer.compile()` (issues compile + link, never waits) and returns the program each material
 * got for THIS variant. `compileAsync` only polls `currentProgram`, which the next variant
 * (another render target) replaces, so the main-pass program would go unobserved.
 * `target`: prepare the render-to-texture variant (any bound target keys the same way).
 */
export function compileTracked(gl: THREE.WebGLRenderer, object: THREE.Object3D, camera: THREE.Camera, scene: THREE.Scene | null, target: boolean): TrackedProgram[] {
  const prev = gl.getRenderTarget()
  const scratch = target ? new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false }) : null
  if (scratch) gl.setRenderTarget(scratch)
  try {
    const materials = gl.compile(object, camera, scene)
    const out: TrackedProgram[] = []
    materials.forEach((m) => {
      const program = (gl.properties.get(m) as { currentProgram?: TrackedProgram }).currentProgram
      if (program) out.push(program)
    })
    return out
  } finally {
    if (scratch) {
      gl.setRenderTarget(prev)
      scratch.dispose()
    }
  }
}

/** Resolves when every program reports COMPLETION_STATUS_KHR (polled, never blocking). */
export function whenLinked(programs: TrackedProgram[]): Promise<void> {
  return new Promise((resolve) => {
    const left = new Set(programs)
    const check = () => {
      left.forEach((p) => {
        if (p.isReady()) left.delete(p)
      })
      if (left.size === 0) resolve()
      else window.setTimeout(check, 16)
    }
    check()
  })
}

/** `compileAsync` with a scratch render target bound: the variant a render-to-texture pass uses. */
export function compileForTarget(gl: THREE.WebGLRenderer, object: THREE.Object3D, camera: THREE.Camera, scene?: THREE.Scene): Promise<unknown> {
  return whenLinked(compileTracked(gl, object, camera, scene ?? null, true))
}

interface PMREMInternals {
  _setSize?: (cubeSize: number) => void
  _allocateTargets?: () => THREE.WebGLRenderTarget
  _ggxMaterial?: THREE.ShaderMaterial | null
  _cubemapMaterial?: THREE.ShaderMaterial | null
  _compileMaterial?: (material: THREE.Material) => void
  compileCubemapShader: () => void
}

/**
 * An (empty) geometry WITH a position attribute: three r186 keys programs on
 * `hasPositionAttribute`, so a warm-up mesh without one prepares a program nobody renders.
 * (three's own `PMREMGenerator.compileCubemapShader()` has exactly that problem.)
 */
function warmGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3))
  return g
}

/**
 * Warms three's internal PMREM programs (CubemapToCubeUV + PMREMGGXConvolution) for a cube
 * environment of `cubeSize`. The renderer converts `scene.environment` with its own
 * PMREMGenerator inside the first compile/render of a lit material and links those programs
 * synchronously there (≈ 0.35–0.7 s cold on an Intel UHD); an identical material compiled here
 * first shares the cached program. Uses two private PMREMGenerator members (three r186) and
 * silently does nothing if they ever disappear.
 */
export function warmPMREM(gl: THREE.WebGLRenderer, cubeSize: number): Promise<unknown> {
  const pmrem = new THREE.PMREMGenerator(gl) as unknown as PMREMInternals & THREE.PMREMGenerator
  if (typeof pmrem._setSize !== 'function' || typeof pmrem._allocateTargets !== 'function') return Promise.resolve()
  pmrem._setSize(cubeSize)
  const target = pmrem._allocateTargets()
  // Creates the CubemapToCubeUV material; its own compile (empty geometry) is skipped.
  pmrem._compileMaterial = () => {}
  pmrem.compileCubemapShader()
  const group = new THREE.Group()
  const geometry = warmGeometry()
  for (const m of [pmrem._ggxMaterial, pmrem._cubemapMaterial]) if (m) group.add(new THREE.Mesh(geometry, m))
  const camera = new THREE.OrthographicCamera()
  return compileForTarget(gl, group, camera).finally(() => {
    // The programs stay cached in the renderer as long as some material uses them; the real
    // conversion runs right after this resolves, so dispose on the next macrotask.
    window.setTimeout(() => {
      target.dispose()
      geometry.dispose()
      pmrem.dispose()
    }, 5000)
  })
}
