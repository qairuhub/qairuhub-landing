import * as THREE from 'three'
import { cloudBakeFragment, cloudBakeVertex } from './shaders'

/**
 * Bakes the cumulus shader (shaders.ts `cloudBakeFragment`) ONCE into a texture atlas that the
 * instanced sprite layers in CloudSprites.tsx sample from. `CLOUD_COUNT` distinct clouds live in a
 * `COLS × ROWS` grid of 2:1 cells, one cell (`texSize × texSize/2`) per cloud, so every layer is a
 * single draw call.
 *
 * The bake is spread over the first frames (`step()` bakes one cell per call) so there is never a
 * long task; the atlas is cleared to transparent first, so sprites whose cell is not baked yet are
 * simply invisible. If the first cell comes back empty (shader failed to compile / no render), the
 * atlas swaps to a procedural CanvasTexture fallback with the same channel layout.
 *
 * Channel layout (see shaders.ts): R light · G detail · B rim · A coverage (straight alpha).
 */

export const CLOUD_COUNT = 8
export const ATLAS_COLS = 4
export const ATLAS_ROWS = 2

/**
 * Bake look (docs/JOURNEY-SPEC.md "Beauty checklist": cumulus — crisp cauliflower edges, bright
 * tops, cooler undersides, never noise mush). `threshold` up = leaner clouds; `softness` up = softer
 * edges (keep it tight so silhouettes stay crisp instead of smearing); `detail` up = more fbm
 * breakup on the silhouette (the cauliflower lobes); `shadow` up = darker bellies.
 */
const BAKE = {
  threshold: 0.5,
  /** tight edge ramp: a wide one smears the lobes into a defocused blob */
  softness: 0.14,
  /** strong domain warp so the outline is lobed, not oval */
  warp: 0.7,
  /** fbm breakup on the silhouette — the cauliflower */
  detail: 1.6,
  /** light-march step per iteration in cloud space (up, a touch to the left → sun upper-left) */
  sun: [-0.025, 0.08] as const,
  /** darker bellies: white tops over a grey-blue base, like the reference deck */
  shadow: 0.62,
  /** base seed; each cell adds `i * 17.3` */
  seed: 3.7,
  /**
   * one extra high-frequency noise octave on the *alpha edge only* (2.7× the finest detail octave,
   * weighted by `uDetail`): the rim breaks into wisps while the mass the light march shades stays
   * smooth, so the edge frays without the body turning into noise mush
   */
  wispFrequency: 7.5 * 2.7,
  wispWeight: 0.18,
}

/** The bake fragment's alpha edge, as written in shaders.ts — the line the wisp octave is spliced into. */
const ALPHA_EDGE = 'float alpha = smoothstep(uThreshold, uThreshold + uSoftness, d) * mask;'

/**
 * Splice the wisp octave into the bake fragment. Everything it references (`vnoise`, `ROT`, `q`,
 * `so`, `mask`) is already in scope at the alpha edge. If the shader source no longer contains
 * the anchor line the untouched fragment is used, so a refactor of shaders.ts can never break the
 * bake — it only loses the wisps (flagged in DEV).
 */
function withWispEdge(fragment: string): string {
  if (!fragment.includes(ALPHA_EDGE)) {
    if (import.meta.env.DEV) console.warn('[clouds] bake fragment anchor not found; baking without the wisp octave')
    return fragment
  }
  const wisp = `
  // high-frequency wisps on the rim only: the density that shades the mass stays smooth
  float wisp = (vnoise(ROT * q * ${BAKE.wispFrequency.toFixed(2)} + so + vec2(17.0, 3.0)) - 0.5)
    * ${BAKE.wispWeight.toFixed(2)} * uDetail;
  float alpha = smoothstep(uThreshold, uThreshold + uSoftness, d + wisp) * mask;`
  return fragment.replace(ALPHA_EDGE, wisp.trimStart())
}

export interface CloudAtlas {
  /** the texture sprites sample — the render target's texture, or the fallback once it failed */
  readonly texture: THREE.Texture
  /** true once every cell is baked (or the fallback is in use) */
  readonly done: boolean
  /** cell `i` (0..CLOUD_COUNT-1) → uv rect [u0, v0, du, dv] written into `out` at `offset` */
  cell(i: number, out: Float32Array, offset: number, mirrored: boolean): void
  /** Bake the next cell (call from useFrame). Returns true when there is nothing left to do. */
  step(gl: THREE.WebGLRenderer): boolean
  /** Links the bake program in the background (KHR_parallel_shader_compile) before the first step. */
  compile(gl: THREE.WebGLRenderer): Promise<unknown>
  /** Restart the bake (after a StrictMode remount); the atlas is re-cleared on the next step. */
  reset(): void
  dispose(): void
}

const scratchColor = new THREE.Color()
const probe = new Uint8Array(8 * 8 * 4)

function screenTriangle() {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2))
  return g
}

/**
 * Procedural stand-in with the same channel layout: a soft squashed ellipse per cell, lit at the
 * top and shaded at the bottom. Cheap, ugly-but-fine; only ever seen if the GPU bake failed.
 */
export function createFallbackAtlas(cellW: number, cellH: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_COLS * cellW
  canvas.height = ATLAS_ROWS * cellH
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const col = i % ATLAS_COLS
      const row = Math.floor(i / ATLAS_COLS)
      // uv row 0 is the bottom of the image (flipY), so row 0 draws at the bottom of the canvas
      const x0 = col * cellW
      const y0 = canvas.height - (row + 1) * cellH
      const cx = x0 + cellW * 0.5
      const cy = y0 + cellH * 0.52
      const rx = cellW * (0.3 + 0.06 * ((i * 7) % 3))
      const ry = cellH * (0.28 + 0.05 * ((i * 5) % 3))
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(rx, ry)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
      g.addColorStop(0, 'rgba(255,128,0,1)')
      g.addColorStop(0.55, 'rgba(240,128,0,0.9)')
      g.addColorStop(1, 'rgba(200,128,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(-1, -1, 2, 2)
      ctx.restore()
      // shade the belly (only where the ellipse already has coverage)
      ctx.save()
      ctx.globalCompositeOperation = 'source-atop'
      const v = ctx.createLinearGradient(0, y0, 0, y0 + cellH)
      v.addColorStop(0, 'rgba(255,128,0,0)')
      v.addColorStop(0.45, 'rgba(255,128,0,0)')
      v.addColorStop(1, 'rgba(90,128,0,0.8)')
      ctx.fillStyle = v
      ctx.fillRect(x0, y0, cellW, cellH)
      ctx.restore()
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

/**
 * @param texSize cell width in px (QUALITY[tier].cloudTexSize); the cell is `texSize × texSize/2`
 * @param maxTextureSize renderer cap (`gl.capabilities.maxTextureSize`) — the atlas never exceeds it
 */
export function createCloudAtlas(texSize: number, maxTextureSize: number): CloudAtlas {
  const cellW = Math.max(64, Math.min(texSize, Math.floor(maxTextureSize / ATLAS_COLS)))
  const cellH = cellW >> 1
  const width = ATLAS_COLS * cellW
  const height = ATLAS_ROWS * cellH

  const target = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.NoColorSpace,
  })
  target.texture.wrapS = target.texture.wrapT = THREE.ClampToEdgeWrapping

  const geometry = screenTriangle()
  const material = new THREE.ShaderMaterial({
    vertexShader: cloudBakeVertex,
    fragmentShader: withWispEdge(cloudBakeFragment),
    uniforms: {
      uSeed: { value: BAKE.seed },
      uThreshold: { value: BAKE.threshold },
      uSoftness: { value: BAKE.softness },
      uWarp: { value: BAKE.warp },
      uDetail: { value: BAKE.detail },
      uSun: { value: new THREE.Vector2(BAKE.sun[0], BAKE.sun[1]) },
      uShadow: { value: BAKE.shadow },
    },
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    transparent: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(mesh)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  let baked = 0
  let cleared = false
  let fallback: THREE.CanvasTexture | null = null
  let disposed = false

  const atlas: CloudAtlas = {
    get texture() {
      return fallback ?? target.texture
    },
    get done() {
      return fallback !== null || baked >= CLOUD_COUNT
    },
    cell(i, out, offset, mirrored) {
      const col = i % ATLAS_COLS
      const row = Math.floor(i / ATLAS_COLS)
      const du = 1 / ATLAS_COLS
      const dv = 1 / ATLAS_ROWS
      // inset by one texel so bilinear filtering never reads the neighbouring cell
      const ex = 1 / width
      const ey = 1 / height
      const u0 = col * du + ex
      const uw = du - 2 * ex
      out[offset] = mirrored ? u0 + uw : u0
      out[offset + 1] = row * dv + ey
      out[offset + 2] = mirrored ? -uw : uw
      out[offset + 3] = dv - 2 * ey
    },
    step(gl) {
      if (disposed || atlas.done) return true

      const prevTarget = gl.getRenderTarget()
      const prevAlpha = gl.getClearAlpha()
      gl.getClearColor(scratchColor)
      const prevAutoClear = gl.autoClear
      gl.setClearColor(0x000000, 0)
      gl.autoClear = true

      try {
        if (!cleared) {
          target.scissorTest = false
          target.viewport.set(0, 0, width, height)
          gl.setRenderTarget(target)
          gl.clear(true, false, false)
          cleared = true
        }
        const i = baked
        const x = (i % ATLAS_COLS) * cellW
        const y = Math.floor(i / ATLAS_COLS) * cellH
        target.viewport.set(x, y, cellW, cellH)
        target.scissor.set(x, y, cellW, cellH)
        target.scissorTest = true
        material.uniforms.uSeed.value = BAKE.seed + i * 17.3
        gl.setRenderTarget(target)
        gl.render(scene, camera)
        baked++

        // One-time sanity probe on the first cell: an empty centre means the shader did not run.
        if (i === 0) {
          gl.readRenderTargetPixels(target, x + (cellW >> 1) - 4, y + (cellH >> 1) - 4, 8, 8, probe)
          let any = 0
          for (let k = 3; k < probe.length; k += 4) any |= probe[k]
          if (any === 0) throw new Error('cloud bake produced no coverage')
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[clouds] GPU bake failed, using the procedural fallback', err)
        fallback = createFallbackAtlas(cellW, cellH)
      } finally {
        target.scissorTest = false
        target.viewport.set(0, 0, width, height)
        gl.setRenderTarget(prevTarget)
        gl.setClearColor(scratchColor, prevAlpha)
        gl.autoClear = prevAutoClear
      }
      return atlas.done
    },
    compile(gl) {
      const prev = gl.getRenderTarget()
      gl.setRenderTarget(target)
      try {
        return gl.compileAsync(mesh, camera)
      } finally {
        gl.setRenderTarget(prev)
      }
    },
    reset() {
      baked = 0
      cleared = false
      disposed = false
    },
    dispose() {
      disposed = true
      target.dispose()
      material.dispose()
      geometry.dispose()
      fallback?.dispose()
      fallback = null
    },
  }
  return atlas
}
