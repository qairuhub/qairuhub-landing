import { Suspense, useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { brand } from '../../i18n/shared'
import { loadTTFFont, preloadTTFFont, useTTFFont } from '../../lib/ttf'
import GlassText, { GLASS_PHYSICAL, getGlassGeometry, prebuildGlassGeometry, type GlassTextBevel } from '../../components/three/GlassText'
import type { TypefaceData } from '../../lib/ttf'
import { delay, nextTask, wordmarkGateFade } from './warmup'
import { WORDMARK_FONTS } from './wordmarkFont'
import { journey, smoothstep } from './journey'
import { QUALITY } from './quality'
import { pointer } from './pointer'
import type { LayerProps } from './types'

/**
 * Courgette — the medium-weight friendly script of JOURNEY-SPEC v2.1 checklist #2. Its strokes
 * measure ≈ 0.11 × size across (median of the wordmark glyphs, scanline-sampled; the thin joins
 * ≈ 0.09), heavy enough to read as legible tube lettering where the thin Mr Dafoe (0.08) and
 * Sacramento (0.04) collapsed into "gairuhub". Dancing Script is only the fallback if Courgette
 * fails to download or parse. Both are TrueType glyf fonts parsed at runtime by lib/ttf.ts.
 */
const FONTS = WORDMARK_FONTS

/**
 * Starts the Courgette download + parse. SkyScene calls it on the home page only: sub-pages never
 * mount the wordmark, so they must not fetch the TTF either (V3-BUILD-PLAN WP1 C). Idempotent.
 */
export function preloadGlassWordmark(): void {
  preloadTTFFont(FONTS, brand.wordmark)
  // Build the extrusion (one glyph per task) while the rest of the scene mounts.
  loadTTFFont(FONTS, brand.wordmark)
    .then((font) => prebuiltEntry(font).promise)
    .catch(() => {})
}

/** Object name of the wordmark group (SkyScene's warm-up compiles it last). */
export const GLASS_WORDMARK_NAME = 'qh-glass-wordmark'

/* ---- readiness for SkyScene's warm-up: the run is in the scene (or failed / timed out) ---- */
let markMounted: () => void = () => {}
const mounted = new Promise<void>((resolve) => (markMounted = resolve))
/** Resolves once the wordmark mesh is committed to the scene, it failed, or after `timeoutMs`. */
export function glassWordmarkSettled(timeoutMs = 6000): Promise<void> {
  return Promise.race([mounted, delay(timeoutMs)])
}
/** Rendered by SkyScene's error boundary around the wordmark: a failed font still settles. */
export function GlassWordmarkFailed() {
  useLayoutEffect(() => markMounted(), [])
  return null
}

/* ---- geometry built one glyph per task before Letters renders (Suspense) ---- */
const prebuilt = new WeakMap<TypefaceData, { done: boolean; promise: Promise<void> }>()
function usePrebuiltGeometry(font: TypefaceData) {
  const entry = prebuiltEntry(font)
  if (!entry.done) throw entry.promise
}
function prebuiltEntry(font: TypefaceData) {
  let entry = prebuilt.get(font)
  if (!entry) {
    const e = { done: false, promise: Promise.resolve() }
    e.promise = prebuildGlassGeometry(font, brand.wordmark, { height: HEIGHT, curveSegments: CURVE_SEGMENTS, bevel: BEVEL }, nextTask)
      .catch(() => {})
      .then(() => {
        e.done = true
      })
    prebuilt.set(font, e)
    entry = e
  }
  return entry
}

/**
 * v3 thin tube (DECISIONS §9: "thinner", legibility of "qairuhub" must stay perfect).
 *
 * three's bevel grows OUTWARD from the glyph outline, so v2's { 0.04, 0.04 } swelled Courgette's
 * ≈ 0.11 × size stroke to ≈ 0.19 × size, the fat inflated read. v3 keeps a rounded profile but
 * pulls it inside the outline with `offset`: the side wall sits at outline + (size + offset) =
 * −0.01 per side and the cap face at −0.03, so the widest point of the median stroke is
 * ≈ 0.11 + 2 × (0.02 − 0.03) = 0.09 × size (−53 %). `thickness` 0.025 keeps the quarter-round a
 * little deeper than it is wide, which reads as a tube rather than a slab. Courgette's exit strokes
 * taper to 10–18° points narrower than the inset: three's extruder folded them into hooks, so
 * GlassText builds the run with components/three/extrudeGlyphs.ts, which lets a too-thin tail
 * collapse to a hairline point instead (checked through the full turn at 1440 and 390 px).
 *
 * 5 quarter-round segments + 8 outline segments per curve (the v2 budget): the side walls stay
 * smooth under the clearcoat through the full 360° turn. The geometry is built ONCE and cached in
 * GlassText's module-level map (the offset is part of the cache key), and the footer run shares it.
 *
 * Plan fallback (V3-BUILD-PLAN WP1 A) if the run ever reads bold or shows artefacts again:
 * { thickness: 0.022, size: 0.012, offset: 0, segments: 4 } (≈ 0.134 × size) with HEIGHT 0.06.
 */
const BEVEL: Partial<GlassTextBevel> = { thickness: 0.025, size: 0.02, offset: -0.03, segments: 5 }

/**
 * The glass in the golden hour.
 *
 * The brief names the wordmark as a target for the new light and the rig that lights it is baked
 * once (`<Environment frames={1}>`, SceneLights) — re-baking it per frame is out of the question,
 * and that is why the run reads leftover-cool over a coral sky. What is NOT out of the question is
 * the glass's own volume: three tints transmitted light by the material's colour and by its
 * attenuation over the path length, and all three are plain properties on a material this frame
 * already writes to. Shortening the attenuation distance is what makes it read — at the recipe's
 * 2.0 against a 0.3-thick stroke the light barely picks anything up.
 *
 * Per frame: three colour lerps and one number, no allocation, no re-bake, no extra pass. It is a
 * hint of warmth rather than a full re-light, which is the honest ceiling without touching the rig.
 */
interface GlassMaterial extends THREE.Material {
  color?: THREE.Color
  emissive?: THREE.Color
  attenuationColor?: THREE.Color
  attenuationDistance?: number
}
const GLASS_COOL = new THREE.Color('#f3f7ff')
const GLASS_WARM = new THREE.Color('#ffeedd')
const GLASS_ATTEN_COOL = new THREE.Color('#dbe6ff')
const GLASS_ATTEN_WARM = new THREE.Color('#ffc59b')
const GLASS_EMISSIVE_COOL = new THREE.Color('#9db4ff')
const GLASS_EMISSIVE_WARM = new THREE.Color('#ffc8a2')
const ATTEN_DISTANCE = { cool: 2, warm: 1.15 }

function warmGlass(material: GlassMaterial, sunset: number): void {
  if (!material.color) return
  material.color.lerpColors(GLASS_COOL, GLASS_WARM, sunset)
  if (material.emissive) material.emissive.lerpColors(GLASS_EMISSIVE_COOL, GLASS_EMISSIVE_WARM, sunset)
  if (material.attenuationColor) {
    material.attenuationColor.lerpColors(GLASS_ATTEN_COOL, GLASS_ATTEN_WARM, sunset)
    material.attenuationDistance = ATTEN_DISTANCE.cool + (ATTEN_DISTANCE.warm - ATTEN_DISTANCE.cool) * sunset
  }
}
/**
 * Extrusion depth (× size). Side-on during the spin the depth reads as weight, so it thins with the
 * stroke (v2 0.14, v3 first pass 0.08 still read chunky at scroll ≈ 300): DECISIONS §9 fallback depth.
 * The inset BEVEL above stays: the plan fallback profile (offset 0) would widen the face stroke to
 * ≈ 0.134 × size, bolder at y 0, while its side-on depth (0.06 + 2 × 0.022) matches this one within 0.006.
 */
const HEIGHT = 0.06
/** Outline tessellation per curve: must reach both `getGlassGeometry` and `<GlassText>` (same cache key). */
const CURVE_SEGMENTS = 8

/** Below this journey weight the run is not on screen at all: no draw, no transmission pass. */
const PRESENCE_MIN = 0.005
/** ≤ 768 px is "mobile" for the fit (inclusive — the 768 px tablet shot used the desktop fit and clipped). */
const MOBILE_MAX = 768

const HERO = {
  /** start depth; the fit is computed once for this depth (see `baseDist`) */
  z: 0,
  /** share of the visible width at z 0 the run spans (v3, DECISIONS §9 "~15 % smaller": 0.60, 0.66 on mobile) */
  fit: 0.6,
  fitMobile: 0.66,
  floatAmp: 0.12,
  floatPeriod: 6,
  /** mouse parallax on top of the scroll turn */
  rotY: 0.06,
  rotX: 0.03,
  rotLerp: 0.05,
  /**
   * world units the run drifts up as `wordmarkHero` goes 1 → 0, at the start depth. Multiplied by
   * dist / baseDist while it recedes (the frame is taller further away), so it still clears the
   * frame top on the v2 timing.
   */
  exitLift: 6,
  /** world units the run recedes toward −z by the exit (the mid cloud deck sits at z −6) */
  exitDepth: 5,
  /** the recede lags the turn slightly: recede = smoothstep(recedeFrom, 1, 1 − wordmarkHero) */
  recedeFrom: 0.05,
  /** extra scale at the exit. 1: the perspective does the shrink now (10 / 15 ≈ 0.67) */
  exitScale: 1,
} as const

const FOOTER = {
  z: 0.5,
  /** checklist #3: ≈ 0.42 of the visible width at z 0.5, 0.7 on mobile */
  fit: 0.42,
  fitMobile: 0.7,
  /**
   * descends from yStart (just above the frame) to yEnd — screen y ≈ +0.33, hovering above the
   * near ridge of the field (field/terrain.ts frames the hills against this height).
   */
  yStart: 4.5,
  yEnd: 1.15,
  floatAmp: 0.08,
  floatPeriod: 7,
  /** slow sine yaw + mouse parallax on top of the scroll turn */
  yawAmp: 0.03,
  yawPeriod: 11,
  rotY: 0.03,
  rotX: 0.03,
} as const

const DEG2RAD = Math.PI / 180
const TAU = Math.PI * 2

/**
 * True once the whole run has drifted above the frame top at its depth — nothing left to
 * refract, so the draw and the transmission pass are skipped. The yawed run's nearest point
 * (half the run × |sin yaw| closer to the camera) sets the depth: the perspective is strongest
 * there, so the frame edge it is tested against is the most conservative one. 1.15 covers the
 * extrusion and the bevel swell.
 */
function aboveFrame(y: number, halfHeight: number, halfWidth: number, yaw: number, dist: number, halfTan: number): boolean {
  const near = Math.max(0.5, dist - halfWidth * Math.abs(Math.sin(yaw)))
  return y - halfHeight * 1.15 > near * halfTan
}

/**
 * The frosted glass QairuHub wordmark — ONE mesh in the shared scene that appears twice in the
 * journey: centred among the stars in the hero (space phase), then smaller above the moonlit
 * valley at the very end (night phase). Both appearances turn a full 360° with the scroll
 * (checklist #4): `rotation.y = (1 − journey.wordmarkHero) × 2π` as it drifts away, and
 * `(1 − journey.wordmarkFooter) × 2π` as it descends into place — eased by the journey's
 * smoothstep, with the mouse parallax and the slow float added on top.
 *
 * v3 hero exit (DECISIONS §9): while it turns and rises the run also RECEDES into depth
 * (z 0 → −5). The fit is computed once for the start depth (`baseDist`), so the perspective
 * really shrinks it (≈ −30 % apparent size by the time it leaves the frame) instead of the fit
 * re-growing it. Reduced motion: no turn, no float, no parallax, no recede.
 *
 * The mesh stays mounted for the life of the scene: unmounting between the two appearances
 * disposed the MeshTransmissionMaterial, so the footer re-linked its large shader on the main
 * thread mid-scroll (≈ 50 ms) and reallocated the FBOs. Instead `mesh.visible` and
 * `material.visible` are set every frame — drei skips the transmission pass and three skips the
 * draw for an invisible run, so the day phase costs nothing.
 */
export default function GlassWordmark(props: LayerProps & { gateKey: string }) {
  return (
    <Suspense fallback={null}>
      <Letters {...props} />
    </Suspense>
  )
}

/** Suspends on the font; the geometry comes from the module-level cache in GlassText. */
function Letters({ tier, reduced, gateKey }: LayerProps & { gateKey: string }) {
  const font = useTTFFont(FONTS, brand.wordmark)
  usePrebuiltGeometry(font)
  useLayoutEffect(() => markMounted(), [])
  const geometry = getGlassGeometry(font, brand.wordmark, { height: HEIGHT, curveSegments: CURVE_SEGMENTS, bevel: BEVEL })
  const bounds = geometry.boundingBox as THREE.Box3
  const runWidth = Math.max(1e-4, bounds.max.x - bounds.min.x)
  const halfWidth = runWidth / 2
  const halfHeight = (bounds.max.y - bounds.min.y) / 2

  const group = useRef<THREE.Group>(null)
  const mesh = useRef<THREE.Mesh>(null)
  /** lerped mouse parallax, kept apart from the scroll turn so the two compose cleanly */
  const parallax = useRef({ yaw: 0, pitch: 0 }).current
  /**
   * Reveal ramp, last applied value. The run is the slowest program to link, so the sky is revealed
   * without it (SkyScene <Warmup>) and the letters arrive once their program is ready — blended in
   * over `WORDMARK_FADE_MS` on the low tier, in one frame on the frosted tiers (see below).
   */
  const fadeState = useRef({ applied: -1 }).current
  const quality = QUALITY[tier]

  useFrame((state) => {
    const g = group.current
    const m = mesh.current
    if (!g || !m) return

    const wh = journey.wordmarkHero
    const wf = journey.wordmarkFooter
    const inHero = wh > PRESENCE_MIN && wh >= wf
    const inFooter = !inHero && wf > PRESENCE_MIN
    let visible = inHero || inFooter

    if (visible) {
      const cam = state.camera as THREE.PerspectiveCamera
      const mobile = state.size.width <= MOBILE_MAX
      const t = journey.time
      const halfTan = Math.tan(cam.fov * 0.5 * DEG2RAD)

      if (inHero) {
        // Fit the run to a share of the visible width at its START depth, once: measured at the
        // live depth the fit would re-grow the run exactly as fast as it recedes. The geometry is
        // centred on the origin, so position is exactly the visual centre.
        const baseDist = cam.position.z - HERO.z
        const visibleWidth = 2 * baseDist * halfTan * cam.aspect
        const fit = mobile ? HERO.fitMobile : HERO.fit
        const scale = ((visibleWidth * fit) / runWidth) * (HERO.exitScale + (1 - HERO.exitScale) * wh)
        const recede = reduced ? 0 : smoothstep(HERO.recedeFrom, 1, 1 - wh)
        const z = HERO.z - recede * HERO.exitDepth
        const dist = cam.position.z - z
        const bob = reduced ? 0 : Math.sin((t * TAU) / HERO.floatPeriod) * HERO.floatAmp
        const y = bob + (1 - wh) * HERO.exitLift * (dist / baseDist)
        g.position.set(0, y, z)
        g.scale.setScalar(scale)
        // One full turn as the run scrolls away (0 at the top of the page), plus the parallax.
        const spin = reduced ? 0 : (1 - wh) * TAU
        parallax.pitch += ((reduced ? 0 : -pointer.y * HERO.rotX) - parallax.pitch) * HERO.rotLerp
        parallax.yaw += ((reduced ? 0 : pointer.x * HERO.rotY) - parallax.yaw) * HERO.rotLerp
        const yaw = spin + parallax.yaw
        g.rotation.set(parallax.pitch, yaw, 0)
        if (aboveFrame(y, halfHeight * scale, halfWidth * scale, yaw, dist, halfTan)) visible = false
      } else {
        const dist = cam.position.z - FOOTER.z
        const visibleWidth = 2 * dist * halfTan * cam.aspect
        const fit = mobile ? FOOTER.fitMobile : FOOTER.fit
        const scale = (visibleWidth * fit) / runWidth
        const bob = reduced ? 0 : Math.sin((t * TAU) / FOOTER.floatPeriod) * FOOTER.floatAmp
        const y = FOOTER.yStart + (FOOTER.yEnd - FOOTER.yStart) * wf + bob
        g.position.set(0, y, FOOTER.z)
        g.scale.setScalar(scale)
        // One full turn as it descends into place (settles at 0), the slow float and the parallax.
        const spin = reduced ? 0 : (1 - wf) * TAU
        const float = reduced ? 0 : Math.sin((t * TAU) / FOOTER.yawPeriod) * FOOTER.yawAmp
        parallax.pitch += ((reduced ? 0 : -pointer.y * FOOTER.rotX) - parallax.pitch) * HERO.rotLerp
        parallax.yaw += ((reduced ? 0 : pointer.x * FOOTER.rotY) - parallax.yaw) * HERO.rotLerp
        const yaw = spin + float + parallax.yaw
        g.rotation.set(parallax.pitch, yaw, 0)
        if (aboveFrame(y, halfHeight * scale, halfWidth * scale, yaw, dist, halfTan)) visible = false
      }
    }

    // The run only exists once its program is linked (SkyScene's <Warmup> opens the gate).
    const fade = wordmarkGateFade(gateKey, reduced)
    if (fade <= 0) visible = false

    // Both flags: drei's transmission pass keys off material.visible, the draw off mesh.visible.
    m.visible = visible
    const material = m.material as THREE.Material
    material.visible = visible
    warmGlass(material as GlassMaterial, journey.sunset)
    // The ramp is applied as opacity ONLY where the recipe is already transparent — the low tier's
    // MeshPhysicalMaterial stand-in. `material.transparent` is part of three's program cache key
    // (`parameters.opaque` → `#define OPAQUE`, which pins the fragment alpha to 1), so turning it on
    // for the frosted MeshTransmissionMaterial would either change nothing (three keeps the linked
    // program until `needsUpdate`) or link a SECOND program on the main thread in the middle of the
    // reveal — the exact stall this gate exists to avoid. The frosted run therefore appears in one
    // frame, over a sky that is already drawn and fully faded in.
    if (visible && material.transparent && fadeState.applied !== fade) {
      material.opacity = (GLASS_PHYSICAL.opacity ?? 1) * fade
      fadeState.applied = fade
    }
  })

  return (
    <group ref={group} name={GLASS_WORDMARK_NAME}>
      <GlassText
        ref={mesh}
        text={brand.wordmark}
        font={font}
        height={HEIGHT}
        curveSegments={CURVE_SEGMENTS}
        bevel={BEVEL}
        mode={quality.transmission ? 'frosted' : 'physical'}
        material={{
          resolution: quality.glassResolution,
          samples: quality.glassSamples,
          // drei allocates a second FBO for the (unused, `backside: false`) backside pass at
          // `resolution` unless told otherwise — keep it to a token 32² HalfFloat target.
          backsideResolution: 32,
          // v3 thin strokes: half the v2 optical thickness and a longer attenuation, so a 0.09 × size
          // tube stays milky and bright instead of tinting toward the attenuation colour.
          thickness: 0.3,
          attenuationDistance: 3,
          // > 0 triples the bicubic transmission taps per sample; invisible under the 0.42 roughness
          // blur, so only the high tier pays for the fringe.
          chromaticAberration: tier === 'high' ? 0.02 : 0,
        }}
      />
    </group>
  )
}
