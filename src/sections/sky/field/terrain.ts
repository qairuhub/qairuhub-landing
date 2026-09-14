/**
 * Layout, height field and shared uniforms of the night field (the last layer of the journey).
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
  /** in-shader distance fade (view distance, world units) toward the night sky colour */
  fadeNear: 9,
  fadeFar: 25,
  /** global scale of the 0.07 × 0.9 blade so the fringe reads ~0.1 of the frame at the ridge */
  bladeScale: 0.42,
  /** the shared camera (SkyScene): z and tan(fov / 2) — used to reject blades below the frame */
  cameraZ: 10,
  tanHalfFov: Math.tan((40 / 2) * (Math.PI / 180)),
} as const

/** Terrain tessellation per tier (`hillSegments × hillSegments / 2` on the 60 × 30 plane). */
export const HILL_SEGMENTS: Record<QualityTier, number> = { high: 128, medium: 96, low: 64 }

/** Colours drawn only inside the field (sRGB hex). Night: moonlit, never neon. */
export const FIELD_COLORS = {
  grassBase: '#163d1c',
  grassMid: '#2e7a34',
  grassTip: '#8fd07a',
  soil: '#143a19',
  stalk: '#215d29',
  petal: '#e41a2f',
  pistil: '#f4c542',
  cap: '#d81e2b',
  cream: '#efe4cf',
  dot: '#f7f2e8',
} as const

/** Moonlight direction (matches SceneLights' night sun position (6, 7, 4): upper-right). */
export const MOON_DIR = new THREE.Vector3(6, 7, 4).normalize()

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
 * `uFade` is the night sky colour as RAW sRGB floats (a Vector3, deliberately outside colour
 * management) because the fade is applied after tone mapping + sRGB conversion so the far
 * terrain lands exactly on the sky gradient's colour.
 */
export interface FieldUniforms {
  uTime: { value: number }
  uWind: { value: number }
  uMoonDir: { value: THREE.Vector3 }
  uFade: { value: THREE.Vector3 }
  uFadeNear: { value: number }
  uFadeFar: { value: number }
}

export function createFieldUniforms(fadeHex: string): FieldUniforms {
  const v = parseInt(fadeHex.slice(1), 16)
  return {
    uTime: { value: 0 },
    uWind: { value: 1 },
    uMoonDir: { value: MOON_DIR.clone() },
    uFade: { value: new THREE.Vector3(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255) },
    uFadeNear: { value: FIELD.fadeNear },
    uFadeFar: { value: FIELD.fadeFar },
  }
}
