/**
 * Layout, height field and shared uniforms of the field at the golden-hour ending (the last layer
 * of the journey — it used to be a moonlit night, see docs/GOLDEN-HOUR-BRIEF.md).
 *
 * Frame: the shared camera is fixed at (0, 0, 10), fov 40, looking down −z. The whole field is
 * one <group> that rises from `riseFrom` to `riseTo` on `journey.ground`; every number below is
 * in that group's local space. At ground = 1 (group y = −2.2):
 *
 *   near ridge (z ≈ 2, |x| ≈ 6)    ground −0.6 → screen y ≈ −0.21 + blade fringe ≈ −0.10
 *   valley floor (x = 0, z ≈ 2)    ground −1.9 → screen y ≈ −0.66 (bottom 17 % of the frame)
 *   far ridge (x = 0, z ≈ −13)     ground −4.8 → screen y ≈ −0.55, 85 % faded into the sky
 *   plane edge (z = −20)           screen y ≈ −0.67, hidden behind the far ridge + fully faded
 *
 * so the letters of the footer wordmark (y ≈ 1.15 at z 0.5 → screen y ≈ +0.33) float well above
 * the valley, and the hills fill the bottom ~45 % of the frame at the sides.
 */
import * as THREE from 'three'
import type { QualityTier } from '../quality'

export const FIELD = {
  /** group y at journey.ground = 0 (fully below the frame) */
  riseFrom: -9,
  /** group y at journey.ground = 1 (final composition) */
  riseTo: -2.2,
  /** terrain plane extents (local): x ∈ [−30, 30], z ∈ [zFar, zNear] */
  width: 60,
  depth: 30,
  zFar: -20,
  zNear: 10,
  /** grass extent along z (near → far) */
  grassNear: 8,
  grassFar: -16,
  /** in-shader distance fade (view distance, world units) toward the sky colour at the skyline.
   *  Starts earlier than the night field's 9 → 25: against a bright horizon the far blades were a
   *  crunchy black comb, and atmospheric perspective is half of what makes the hour read. */
  fadeNear: 7,
  fadeFar: 22,
  /** global scale of the 0.07 × 0.9 blade so the fringe reads ~0.1 of the frame at the ridge */
  bladeScale: 0.42,
  /** the shared camera (SkyScene): z and tan(fov / 2) — used to reject blades below the frame */
  cameraZ: 10,
  tanHalfFov: Math.tan((40 / 2) * (Math.PI / 180)),
} as const

/** Terrain tessellation per tier (`hillSegments × hillSegments / 2` on the 60 × 30 plane). */
export const HILL_SEGMENTS: Record<QualityTier, number> = { high: 128, medium: 96, low: 64 }

/**
 * Colours drawn only inside the field (sRGB hex). Golden hour: the sun is behind the ridge, so the
 * field is backlit — but it is GRASS, and grass at this hour reads green: a deep green in the
 * shadow at the base, a warm green up the blade, and a gold rim on the tips the light rakes.
 * (The first pass made the land a blue-black silhouette; it bought contrast at the price of the
 * meadow. The copy's contrast is now carried by the sky band geometry — see sky/copyBox.ts — and
 * by the footer scrim, so the field is free to be green.)
 */
export const FIELD_COLORS = {
  grassBase: '#132c1c',
  grassMid: '#3c6f38',
  grassTip: '#ffc684',
  soil: '#18311f',
  /** the soil the low sun still rakes — the crest edges and the sun-facing flanks */
  soilLit: '#7c6b43',
  stalk: '#2d5a33',
  petal: '#a83b46',
  pistil: '#ffd48a',
  cap: '#a3343c',
  cream: '#bda88f',
  dot: '#e0cba9',
} as const

/**
 * Direction of the key light for the blades — the sun that has just dropped behind the far ridge
 * (matches SceneLights' SUN_POS_SUNSET (4, 1.3, −15): low and away from the camera, so the rim is
 * on the far edge of every blade).
 */
export const SUN_DIR = new THREE.Vector3(4, 1.3, -15).normalize()

/** The valley haze at the golden hour: pale and warm-neutral, only in the FAR half of the field. */
export const MIST_COLOR = '#d6a893'

const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** The two hills (left at x ≈ −6.5, right at x ≈ 7) with the valley between them — no depth term. */
export function hillProfile(x: number): number {
  const l = x + 6.5
  const r = x - 7
  return 1.6 * Math.exp(-(l * l) / 18) + 1.8 * Math.exp(-(r * r) / 18)
}

/**
 * h(x, z): hills + gentle ripple, flat in front of the ridge (z > 2), falling away behind it so the
 * far terrain sits lower on screen than the near ridge, with a final drop past z ≈ −11 that hides
 * the plane's far edge behind the far ridge line.
 */
export function hillHeight(x: number, z: number): number {
  const ripple = 0.12 * Math.sin(x * 0.8) * Math.cos(z * 0.5) + 0.05 * Math.sin(x * 2.3 + z * 1.1)
  const slope = -0.18 * Math.max(0, 2 - z)
  const farDrop = -1.4 * smooth(clamp01((-11 - z) / 8))
  return hillProfile(x) + ripple + slope + farDrop
}

/** Screen-space y (NDC, −1..1) of a point at group-local height `y` (plus group y) and depth `z`. */
export function screenY(worldY: number, z: number): number {
  return worldY / (FIELD.tanHalfFov * (FIELD.cameraZ - z))
}

/** Height of a blade at full scale — the fringe standing on top of the ridge line. */
const GRASS_TIP = 0.9 * FIELD.bladeScale

/**
 * Screen y (0 at the top of the frame, 1 at the bottom) of the highest point of the field THIS
 * viewport actually shows, grass fringe included: the visible skyline.
 *
 * Measured off the real geometry rather than reasoned about, because the answer is not intuitive.
 * The camera's fov is vertical, so a narrow frame does not see less sky — it sees less *width*,
 * and the ridges live at x ≈ ±6.5 and ±7. A laptop (aspect 1.6) sees them and its skyline is the
 * crest at 0.561; a phone (aspect 0.46) sees only the valley floor between them and its skyline
 * falls to 0.707, a seventh of the frame lower. Anything that places the sunset relative to the
 * land has to read this, or it is tuned at two viewports and guessed at every other one.
 *
 * Pure and allocation-free; ~2k evaluations of `hillHeight`, called on resize, not per frame.
 */
export function skylineScreenY(aspect: number, groundY: number = FIELD.riseTo): number {
  let top = 1
  for (let i = 0; i <= 64; i++) {
    const z = FIELD.zNear - ((FIELD.zNear - FIELD.zFar) * i) / 64
    const dist = FIELD.cameraZ - z
    if (dist <= 0.1) continue
    const halfX = FIELD.tanHalfFov * dist * aspect
    for (let j = 0; j <= 32; j++) {
      const x = -halfX + (2 * halfX * j) / 32
      if (Math.abs(x) > FIELD.width / 2) continue
      const tip = z >= FIELD.grassFar && z <= FIELD.grassNear ? GRASS_TIP : 0
      const frac = (1 - screenY(hillHeight(x, z) + tip + groundY, z)) / 2
      if (frac < top) top = frac
    }
  }
  return Math.min(1, Math.max(0, top))
}

/**
 * How much of the low sun's grazing light a point of the field gets, 0..1 — the field's own
 * modelling, baked once.
 *
 * Deliberately NOT a shadow test. The sun sits 4.8° above the horizon and only ~15° off the view
 * axis, the ridges run away from the camera in z, and the steepest lateral slope `hillProfile` ever
 * reaches (0.323) is the light's own lateral rise (0.325) — so in this scene nothing occludes
 * anything, and a ray-marched cast-shadow term measured out as identically zero everywhere. What
 * the light really does is RAKE: the far half of the valley, whose ground tips away from the lens,
 * turns into it and reads at 0.2–0.4, while the near flats sit at 0.0–0.2 and fall to the violet
 * sky fill alone. That is the long ramp running toward the lens, and it comes out of `hillHeight`
 * and SUN_DIR — the same vector SceneLights aims the key light along — rather than being painted
 * in by hand. The height field's ripple rides along in the gradient, so neighbouring blades differ
 * and the lit crests sparkle instead of banding.
 *
 * Build time only: hill vertex colours and per-instance grass tints, never per frame.
 */
export function sunGraze(x: number, z: number): number {
  const e = 0.4
  const h = hillHeight(x, z)
  const nx = -(hillHeight(x + e, z) - h) / e
  const nz = -(hillHeight(x, z + e) - h) / e
  const inv = 1 / Math.hypot(nx, 1, nz)
  // 0.42 is the brightest this terrain ever turns into a light 4.8° up: rescale so the ramp uses
  // the whole 0..1 range instead of the top fifth of it.
  return clamp01(((nx * SUN_DIR.x + SUN_DIR.y + nz * SUN_DIR.z) * inv) / 0.42)
}

/** Tiny deterministic PRNG (mulberry32) so the field is identical on every mount. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Uniforms shared by every field material (one object each; Field.tsx writes `uTime` / `uWind`
 * per frame, the materials reference the same objects — no per-frame allocation).
 * `uFade` is the sky colour at the skyline as RAW sRGB floats (a Vector3, deliberately outside colour
 * management) because the fade is applied after tone mapping + sRGB conversion so the far
 * terrain lands exactly on the sky gradient's colour. Field.tsx rewrites it every frame from
 * `blendPalette`, so the far ridge melts into whatever the sky is doing at that moment.
 */
export interface FieldUniforms {
  uTime: { value: number }
  uWind: { value: number }
  uSunDir: { value: THREE.Vector3 }
  uFade: { value: THREE.Vector3 }
  uFadeNear: { value: number }
  uFadeFar: { value: number }
  /** valley haze colour (raw sRGB, applied after tone mapping like `uFade`) */
  uMist: { value: THREE.Vector3 }
  /** 0..1 — strength of the valley haze; Field.tsx eases it in with `journey.sunset` */
  uMistAmount: { value: number }
}

const srgbVec = (hex: string) => {
  const v = parseInt(hex.slice(1), 16)
  return new THREE.Vector3(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255)
}

export function createFieldUniforms(fadeHex: string): FieldUniforms {
  return {
    uTime: { value: 0 },
    uWind: { value: 1 },
    uSunDir: { value: SUN_DIR.clone() },
    uFade: { value: srgbVec(fadeHex) },
    uFadeNear: { value: FIELD.fadeNear },
    uFadeFar: { value: FIELD.fadeFar },
    uMist: { value: srgbVec(MIST_COLOR) },
    uMistAmount: { value: 0 },
  }
}
