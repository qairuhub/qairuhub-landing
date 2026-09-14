import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { LayerProps } from './types'
import { journey } from './journey'
import { QUALITY } from './quality'
import { pointer } from './pointer'
import { CLOUD_COUNT, createCloudAtlas, type CloudAtlas } from './cloudBake'
import { cloudSpriteFragment, cloudSpriteVertex } from './shaders'

/**
 * Baked cumulus sprites (docs/JOURNEY-SPEC.md "Clouds" + "Readability").
 *
 * Three depth layers of camera-facing quads — far (z −14, behind the wordmark), mid (z −6) and
 * near (z +3, passes in FRONT of the wordmark at z 0). Each layer is ONE instanced draw call that
 * samples the atlas baked once by ./cloudBake.ts, so the whole deck costs 3 draw calls and
 * ~26 quads of fill per frame instead of three fullscreen fbm passes.
 *
 * Layout: every sprite lives in a side lane (cut by the frame edge like the reference) whose inner
 * boundary sits at 66 % of the half-width — the visible mass fills the outer 17 % of the frame on
 * each side (the reference's clouds reach ~20 %), so the central 66 % — the reading column plus
 * margin — stays clear and the copy in the feature / agentic cards never lands on cloud; on very
 * wide viewports the boundary follows the 1150px content grid instead. Only the far layer's sprite 0
 * is allowed in the column, small and dim (and it is faded out at night so nothing hangs behind the
 * footer wordmark). Sprites are spread along a vertical conveyor that scrolls up past the camera
 * (`journey.vh × parallax` frame heights, faster for nearer layers) and wraps. Motion is a slow
 * outward-only horizontal sway + a tiny bob (the inner edge never crosses the grid line), plus a
 * mouse parallax whose amplitude is folded into the lane margin for the same reason.
 *
 * Journey: alpha = journey.clouds (0 in space); layers rise from below as space fades (near
 * first); the whiteout scales the near layer up to 1.8× and whitens it; the day phase keeps the
 * reference's near-white cumulus tops (#f4f7fb, faint cool tint) over grey-blue undersides,
 * alpha ≤ .95 and a coverage cap (≤ 30 % of the viewport, by scaling alpha) — the cap, not
 * dimming, is what keeps the copy readable — on portrait viewports, where every sprite is wider than the frame and the
 * lanes cannot clear the copy, the day alpha is eased down a further 35 %; dusk tints lavender
 * with darker bellies; night keeps only the far layer, faint and dark (edge shapes, no grey blob).
 *
 * Reduced motion: no sway/bob/mouse parallax — static positions that still follow the scroll.
 */

/* ------------------------------------------------------------------ tuning */

/** Day-phase cap on Σ(visible sprite area × alpha × FILL) / viewport area. Lower = clearer sky. */
const COVERAGE_MAX = 0.3
/** Fraction of a sprite quad the baked cloud actually covers (alpha-weighted). Measured on the
 *  bake (atlas readback on the reference GPU, after the base slab): 0.19–0.23 per cell, so the
 *  estimate tracks true coverage within ~10 %. Raise if the cap should bite earlier. */
const FILL = 0.21
/** Half-width of the visible cloud mass as a fraction of the sprite width — how far a lane sprite
 *  may reach towards the centre column. The baked cells carry soft mass out to ~0.4 of the quad
 *  width, so 0.42 keeps the visible edge outside the grid (0.3 let ~130px of cloud leak under the
 *  first card row). Lower = clouds intrude a bit more into the column. */
const INNER = 0.42
/** Day palette: the reference's near-white cumulus tops (#e8ecf2 on the shots once the sky shows
 *  through) over grey-blue undersides. Readability comes from the coverage cap + lanes, not from
 *  greying the clouds. */
const PAL = {
  bright: { lit: 0xffffff, shade: 0x8fa3c6 },
  day: { lit: 0xf4f7fb, shade: 0x8ea3c4 },
  dusk: { lit: 0xc8b8d8, shade: 0x55507e },
  night: { lit: 0x4a5878, shade: 0x243050 },
  whiteout: { lit: 0xffffff, shade: 0xeef3ff },
} as const
/** per-instance tint range: white → #f2f6ff (barely cool, so the tops stay white) */
const TINT_COOL = 0xf2f6ff
const RIM = 0.12
const DAY_ALPHA_MAX = 0.95
/** Content grid (DESIGN-SPEC §layout / `--content-width`) + breathing room the lanes must clear on
 *  very wide viewports (> ~1780px, where the grid is narrower than the 70 % column), CSS px. */
const CONTENT_PX = 1150
const CONTENT_GAP_PX = 96
/** Lane inner boundary as a fraction of the half-width: the visible cloud mass stays in the outer
 *  34 % of each half (17 % of the frame per side). 0.82 left only a ~40px sliver of cloud at 1440
 *  (the day sky read as empty); the reference's clouds reach ~20 % in from the edge. */
const CLEAR_MAX = 0.66
/** Portrait viewports: the day alpha eases down by this much once the frame is taller than wide. */
const PORTRAIT_DIM = 0.35
/** deterministic layout (change to reshuffle the deck) */
const SEED = 20260914
/**
 * Atlas cell of the one sprite allowed in the reading column (far layer, sprite 0). Fixed to the
 * fullest cell (atlas readback: the highest centre coverage) — a random pick landed on a two-lobed
 * cell whose hollow base read as an arch/crescent in the middle of the LEARN / BUILD / LAUNCH copy.
 */
const CENTRE_CELL = 1
/** …and its alpha (0.7 put a pale blob behind the LEARN body copy; 0.45 reads as distant haze). */
const CENTRE_ALPHA = 0.45
/** Night: the far layer (the only one kept) fades to this share of `journey.clouds`… */
const NIGHT_FAR_ALPHA = 0.25
/** …and rises by this many world units, so no grey blob sits in the valley between the hills. */
const NIGHT_FAR_LIFT = 3
/** The centre-lane sprite fades out over this `journey.night` window (alpha 0 from the upper bound
 *  on) so nothing hangs behind / under the footer wordmark above the field. */
const NIGHT_CENTRE_FADE: readonly [number, number] = [0.15, 0.3]

interface LayerDef {
  z: number
  /** share of QUALITY.clouds */
  share: number
  /** sprite width range, world units (height = width / 2) */
  size: [number, number]
  /** frame heights (of this layer's own frame) of upward travel per viewport height of scroll —
   *  nearer layers move faster than the page (the DOM sits at z 0 = 1.0), farther ones slower */
  parallax: number
  /** mouse parallax amplitude, world units */
  mouse: number
  /** sprites visible in the frame at any moment (sets the conveyor band height) */
  density: number
  alpha: [number, number]
  /** horizontal sway amplitude range, world units (peak speed = amp × 2π / period) */
  sway: [number, number]
  /** how much of the whiteout scale-up / whitening this layer takes (near = 1) */
  whiteout: number
  /** rise distance during the descent (near rises further = arrives first) */
  rise: number
  /** stays at night */
  night: boolean
  renderOrder: number
}

const LAYERS: readonly LayerDef[] = [
  { z: -14, share: 0.27, size: [12, 20], parallax: 0.3, mouse: 0.15, density: 2.0, alpha: [0.82, 1], sway: [1.0, 1.6], whiteout: 0.12, rise: 6, night: true, renderOrder: -8 },
  { z: -6, share: 0.33, size: [11, 18], parallax: 0.55, mouse: 0.3, density: 1.6, alpha: [0.82, 1], sway: [0.7, 1.2], whiteout: 0.45, rise: 9, night: false, renderOrder: -7 },
  { z: 3, share: 0.4, size: [9, 15], parallax: 1.1, mouse: 0.5, density: 0.7, alpha: [0.55, 0.8], sway: [0.4, 0.7], whiteout: 1, rise: 12, night: false, renderOrder: 20 },
]

/* ------------------------------------------------------------------ resources */

interface LayerRuntime {
  def: LayerDef
  n: number
  geometry: THREE.InstancedBufferGeometry
  material: THREE.ShaderMaterial
  pos: THREE.InstancedBufferAttribute
  /** per-instance tint + alpha; only the centre sprite's alpha is ever rewritten (night fade) */
  tint: THREE.InstancedBufferAttribute
  /** index of the centre-lane sprite in this layer, −1 if none */
  centre: number
  /** last centre-sprite alpha factor uploaded (avoids a buffer update per frame) */
  centreFade: number
  /** per sprite: −1 left lane, +1 right lane, 0 centre lane */
  laneSign: Float32Array
  /** 0 = touching the centre column, 1 = mostly outside the frame */
  laneR: Float32Array
  /** 0..1 position along the vertical conveyor band */
  band: Float32Array
  w: Float32Array
  h: Float32Array
  alpha: Float32Array
  swayAmp: Float32Array
  swayW: Float32Array
  swayPhase: Float32Array
  bobAmp: Float32Array
  bobW: Float32Array
  bobPhase: Float32Array
  maxH: number
  lit: THREE.Color
  shade: THREE.Color
}

interface Resources {
  tier: LayerProps['tier']
  atlas: CloudAtlas
  layers: LayerRuntime[]
  dispose(): void
}

/** mulberry32 — tiny seeded PRNG so the deck is identical on every load */
function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const WHITE = new THREE.Color(0xffffff)
const COOL = new THREE.Color(TINT_COOL)
const scratchTint = new THREE.Color()
const scratchPal = new THREE.Color()

function buildLayer(def: LayerDef, n: number, atlas: CloudAtlas, rnd: () => number): LayerRuntime {
  const plane = new THREE.PlaneGeometry(1, 1)
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setIndex(plane.getIndex())
  geometry.setAttribute('position', plane.getAttribute('position'))
  geometry.setAttribute('uv', plane.getAttribute('uv'))
  geometry.instanceCount = n
  // the quad is expanded in view space by the shader; never cull the layer as a whole
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)

  const posArr = new Float32Array(n * 3)
  const sizeArr = new Float32Array(n * 2)
  const cellArr = new Float32Array(n * 4)
  const tintArr = new Float32Array(n * 4)
  const laneSign = new Float32Array(n)
  const laneR = new Float32Array(n)
  const band = new Float32Array(n)
  const w = new Float32Array(n)
  const h = new Float32Array(n)
  const alpha = new Float32Array(n)
  const swayAmp = new Float32Array(n)
  const swayW = new Float32Array(n)
  const swayPhase = new Float32Array(n)
  const bobAmp = new Float32Array(n)
  const bobW = new Float32Array(n)
  const bobPhase = new Float32Array(n)
  let maxH = 0

  const centreLane = def.z < -10 && n >= 3
  for (let i = 0; i < n; i++) {
    const centre = centreLane && i === 0
    const sizeT = rnd()
    let width = lerp(def.size[0], def.size[1], sizeT)
    if (centre) width *= 0.7
    w[i] = width
    h[i] = width * 0.5
    maxH = Math.max(maxH, h[i])
    sizeArr[i * 2] = width
    sizeArr[i * 2 + 1] = h[i]

    laneSign[i] = centre ? 0 : i % 2 === 0 ? -1 : 1
    // bias towards the inner boundary so more of each cloud shows in the frame
    const r = rnd()
    laneR[i] = r * r
    // stratified along the conveyor, alternating lanes → even spacing on both sides
    band[i] = (i + 0.15 + 0.7 * rnd()) / n

    // the centre-lane sprite passes behind the storytelling copy: keep it a faint haze, not a blob
    alpha[i] = centre ? CENTRE_ALPHA : lerp(def.alpha[0], def.alpha[1], rnd())
    swayAmp[i] = lerp(def.sway[0], def.sway[1], rnd())
    swayW[i] = (Math.PI * 2) / lerp(55, 95, rnd())
    swayPhase[i] = rnd() * Math.PI * 2
    bobAmp[i] = lerp(0.05, 0.11, rnd())
    bobW[i] = (Math.PI * 2) / lerp(8, 14, rnd())
    bobPhase[i] = rnd() * Math.PI * 2

    // distinct neighbours on the conveyor: stride through the atlas with a random start
    const pick = (i * 3 + Math.floor(rnd() * CLOUD_COUNT)) % CLOUD_COUNT
    atlas.cell(centre ? CENTRE_CELL : pick, cellArr, i * 4, rnd() < 0.5)

    scratchTint.copy(WHITE).lerp(COOL, rnd())
    tintArr[i * 4] = scratchTint.r
    tintArr[i * 4 + 1] = scratchTint.g
    tintArr[i * 4 + 2] = scratchTint.b
    tintArr[i * 4 + 3] = alpha[i]
  }

  const pos = new THREE.InstancedBufferAttribute(posArr, 3)
  pos.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('aPos', pos)
  geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizeArr, 2))
  geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cellArr, 4))
  const tint = new THREE.InstancedBufferAttribute(tintArr, 4)
  if (centreLane) tint.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('aTint', tint)
  plane.dispose()

  const material = new THREE.ShaderMaterial({
    vertexShader: cloudSpriteVertex,
    fragmentShader: cloudSpriteFragment,
    uniforms: {
      uMap: { value: atlas.texture },
      uOffset: { value: new THREE.Vector3() },
      uScale: { value: 1 },
      uLit: { value: new THREE.Color(PAL.bright.lit) },
      uShade: { value: new THREE.Color(PAL.bright.shade) },
      uRim: { value: RIM },
      uOpacity: { value: 0 },
    },
    transparent: true,
    premultipliedAlpha: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  })

  return {
    def,
    n,
    geometry,
    material,
    pos,
    tint,
    centre: centreLane ? 0 : -1,
    centreFade: 1,
    laneSign,
    laneR,
    band,
    w,
    h,
    alpha,
    swayAmp,
    swayW,
    swayPhase,
    bobAmp,
    bobW,
    bobPhase,
    maxH,
    lit: material.uniforms.uLit.value as THREE.Color,
    shade: material.uniforms.uShade.value as THREE.Color,
  }
}

function buildResources(tier: LayerProps['tier'], gl: THREE.WebGLRenderer): Resources {
  const q = QUALITY[tier]
  const atlas = createCloudAtlas(q.cloudTexture, gl.capabilities.maxTextureSize)
  const rnd = prng(SEED)
  const total = Math.max(3, q.clouds)
  const counts = LAYERS.map((l) => Math.max(1, Math.round(total * l.share)))
  const layers = LAYERS.map((def, i) => buildLayer(def, counts[i], atlas, rnd))
  return {
    tier,
    atlas,
    layers,
    dispose() {
      atlas.dispose()
      for (const l of layers) {
        l.geometry.dispose()
        l.material.dispose()
      }
    },
  }
}

/* ------------------------------------------------------------------ component */

/** bright (descent) → day → dusk → night, then towards pure white by the whiteout. Linear colours, no allocation. */
const paletteBlend = (out: THREE.Color, day: number, dusk: number, night: number, white: number, litSide: boolean) => {
  const p = litSide ? 'lit' : 'shade'
  out.setHex(PAL.bright[p])
  if (day > 0) out.lerp(scratchPal.setHex(PAL.day[p]), day)
  if (dusk > 0) out.lerp(scratchPal.setHex(PAL.dusk[p]), dusk)
  if (night > 0) out.lerp(scratchPal.setHex(PAL.night[p]), night)
  if (white > 0) out.lerp(scratchPal.setHex(PAL.whiteout[p]), white)
  return out
}

export default function CloudSprites({ tier, reduced }: LayerProps) {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)

  // Built lazily in a ref (not useMemo) so StrictMode's double render creates ONE set of GL objects.
  // A tier change builds a new set; the effect cleanup below disposes the previous one.
  const res = useRef<Resources | null>(null)
  if (res.current === null || res.current.tier !== tier) res.current = buildResources(tier, gl)
  const resources = res.current

  useEffect(() => {
    resources.atlas.reset()
    invalidate()
    return () => resources.dispose()
  }, [resources, invalidate])

  const last = useRef({ vh: -1, hW: 0, hH: 0, px: 0, moving: true })

  useFrame((state) => {
    const { atlas, layers } = resources
    if (!atlas.done) {
      atlas.step(gl)
      if (!atlas.done) invalidate()
    }

    const cam = state.camera as THREE.PerspectiveCamera
    const tanHalf = Math.tan((cam.fov * Math.PI) / 360)
    const aspect = cam.aspect
    const t = reduced ? 0 : journey.time
    const mx = reduced ? 0 : pointer.x
    const my = reduced ? 0 : pointer.y
    const rise = 1 - journey.space
    const day = journey.day
    const dusk = journey.dusk
    const night = journey.night
    const whiteout = journey.whiteout
    const moving = !reduced
    const scrolled = journey.vh !== last.current.vh
    const l0 = layers[0]
    const dist0 = cam.position.z - l0.def.z
    const hH0 = dist0 * tanHalf
    const px = state.size.width
    const resized = hH0 !== last.current.hH || hH0 * aspect !== last.current.hW || px !== last.current.px
    const dirty = moving || scrolled || resized || last.current.moving !== moving
    last.current.vh = journey.vh
    last.current.hH = hH0
    last.current.hW = hH0 * aspect
    last.current.px = px
    last.current.moving = moving

    // Lane inner boundary as a fraction of each layer's half-width: CLEAR_MAX (the outer 17 % of the
    // frame per side), or the content grid plus breathing room on very wide viewports, so cloud never
    // sits under the copy in the cards. Perspective scales every layer by the same ratio, so one
    // CSS-px fraction serves all depths.
    const clear = Math.min(CLEAR_MAX, (CONTENT_PX + CONTENT_GAP_PX) / Math.max(1, px))
    // Portrait: sprites are wider than the frame and the lanes cannot clear the copy → dim the day
    // deck instead. Short ramp (aspect 1 → .85) so a tablet rotation never pops.
    const portrait = Math.min(1, Math.max(0, (1 - aspect) / 0.15))
    // Night: the centre-lane sprite fades out (1 → 0 across NIGHT_CENTRE_FADE) so no cloud sits
    // behind the footer wordmark or over the valley; the lane sprites stay as faint edge shapes.
    const centreFade =
      1 - Math.min(1, Math.max(0, (night - NIGHT_CENTRE_FADE[0]) / (NIGHT_CENTRE_FADE[1] - NIGHT_CENTRE_FADE[0])))

    // Pass 1: positions + coverage estimate (pre-cap alpha).
    let coverage = 0
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li]
      const def = L.def
      const dist = cam.position.z - def.z
      const hH = dist * tanHalf
      const hW = hH * aspect
      const frameH = hH * 2
      const bandH = Math.max(frameH + L.maxH * 1.1, (L.n * frameH) / def.density)
      const conveyor = journey.vh * def.parallax * frameH
      const wo = whiteout * def.whiteout
      const scale = 1 + 0.8 * wo
      const arr = L.pos.array as Float32Array
      const layerAlpha = journey.clouds * (def.night ? 1 - (1 - NIGHT_FAR_ALPHA) * night : 1 - night)
      const frameArea = 4 * hW * hH
      const offY = -def.rise * (1 - rise) + my * def.mouse * 0.6 + (def.night ? NIGHT_FAR_LIFT * night : 0)
      const offX = mx * def.mouse

      // the mouse parallax amplitude is folded into the lane margin so it can never pull a cloud in
      const laneEdge = hW * clear + def.mouse

      for (let i = 0; i < L.n; i++) {
        const w = L.w[i]
        const inner = w * INNER
        const sign = L.laneSign[i]
        const r = L.laneR[i]
        // lane sprites: visible mass starts at the lane edge and drifts outward with r
        let x = sign === 0 ? (r - 0.5) * 0.4 * hW : sign * (laneEdge + (hW - laneEdge) * r + inner * (1 - 0.4 * r))
        let yv = L.band[i] * bandH + conveyor
        yv = ((yv % bandH) + bandH) % bandH - bandH * 0.5
        if (moving) {
          // outward-only sway for lane sprites (0..amp, away from the column); centred for the centre lane
          const s = Math.sin(t * L.swayW[i] + L.swayPhase[i])
          x += sign === 0 ? L.swayAmp[i] * s : sign * L.swayAmp[i] * (0.5 + 0.5 * s)
          yv += L.bobAmp[i] * Math.sin(t * L.bobW[i] + L.bobPhase[i])
        }
        if (dirty) {
          arr[i * 3] = x
          arr[i * 3 + 1] = yv
          arr[i * 3 + 2] = 0
        }
        // visible area of this sprite in its layer's frame (after layer offsets), normalised
        const hw = w * 0.5 * scale
        const hh = L.h[i] * 0.5 * scale
        const cx = x + offX
        const cy = yv + offY
        const vx = Math.min(hW, cx + hw) - Math.max(-hW, cx - hw)
        const vy = Math.min(hH, cy + hh) - Math.max(-hH, cy - hh)
        const spriteAlpha = L.alpha[i] * (i === L.centre ? centreFade : 1)
        if (vx > 0 && vy > 0) coverage += ((vx * vy) / frameArea) * FILL * spriteAlpha * layerAlpha
      }
      if (dirty) L.pos.needsUpdate = true
    }

    // Day cap: alpha ≤ .9 and Σ coverage ≤ COVERAGE_MAX (scale alpha, never geometry).
    const dayCov = coverage * DAY_ALPHA_MAX
    const capScale = dayCov > COVERAGE_MAX ? COVERAGE_MAX / dayCov : 1
    const dayAlpha = DAY_ALPHA_MAX * capScale * (1 - PORTRAIT_DIM * portrait)

    // Pass 2: per-layer uniforms.
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li]
      const def = L.def
      const u = L.material.uniforms
      const wo = whiteout * def.whiteout
      let a = journey.clouds * (def.night ? 1 - (1 - NIGHT_FAR_ALPHA) * night : 1 - night)
      a *= lerp(1, dayAlpha, day)
      a = lerp(a, 1, wo)
      u.uOpacity.value = a
      // an invisible layer (space phase, mid/near at night) is skipped entirely — no fill cost
      L.material.visible = a > 0.002
      u.uScale.value = 1 + 0.8 * wo
      u.uMap.value = atlas.texture
      u.uRim.value = RIM * (1 - 0.4 * day) * (1 - night)
      ;(u.uOffset.value as THREE.Vector3).set(
        mx * def.mouse,
        -def.rise * (1 - rise) + my * def.mouse * 0.6 + (def.night ? NIGHT_FAR_LIFT * night : 0),
        0,
      )
      paletteBlend(L.lit, day, dusk, night, wo, true)
      paletteBlend(L.shade, day, dusk, night, wo, false)
      // centre-lane sprite: alpha 0 once night > NIGHT_CENTRE_FADE[1] (tiny upload, only on change)
      if (L.centre >= 0 && L.centreFade !== centreFade) {
        L.centreFade = centreFade
        ;(L.tint.array as Float32Array)[L.centre * 4 + 3] = L.alpha[L.centre] * centreFade
        L.tint.needsUpdate = true
      }
    }
  })

  return (
    <>
      {resources.layers.map((L, i) => (
        <mesh
          key={i}
          geometry={L.geometry}
          material={L.material}
          position-z={L.def.z}
          frustumCulled={false}
          renderOrder={L.def.renderOrder}
        />
      ))}
    </>
  )
}
