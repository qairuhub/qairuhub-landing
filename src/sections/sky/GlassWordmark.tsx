import { Suspense, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hero } from '../../content'
import { preloadTTFFont, useTTFFont } from '../../lib/ttf'
import GlassText, { getGlassGeometry, type GlassTextBevel } from '../../components/three/GlassText'
import { journey } from './journey'
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
const FONTS = ['/fonts/Courgette-Regular.ttf', '/fonts/DancingScript-Variable.ttf'] as const
preloadTTFFont(FONTS, hero.wordmark)

/**
 * Rounded edge for Courgette's stroke half-width of ≈ 0.055 × size: 0.04 per side (≈ 0.7 × the
 * half-width, the same tube ratio GlassText documents for Mr Dafoe's 0.024). The thin joins
 * become full round tubes, the median stroke keeps a narrow flat face and swells to ≈ 0.19 × size.
 *
 * A 0.04 quarter-round is 1.7 × the 0.024 one GLASS_BEVEL's 3 segments were tuned for: at hero
 * scale on a dpr-2 display three facets span ≈ 8 px each on the side walls, and the specular
 * clearcoat picks every ridge out as the run turns its full 360° (stepped ridges along the 'u' /
 * 'b' extrusions mid-rotation). 5 segments (≈ 5 px per facet under the roughness-0.5 blur) read
 * as a smooth tube. The outline tessellation is raised with it (6 → 8 per curve) so the bowls of
 * the script keep pace with the smoother edge profile. The geometry is built ONCE and cached in
 * GlassText's module-level map, so the extra one-time tessellation (≈ 1.5 × the triangles of the
 * 6 / 3 budget, well under the 70k that produced a > 50 ms task) is the whole cost.
 */
const BEVEL: Partial<GlassTextBevel> = { thickness: 0.04, size: 0.04, segments: 5 }
/** Outline tessellation per curve — must reach both `getGlassGeometry` and `<GlassText>` (same cache key). */
const CURVE_SEGMENTS = 8

/** Below this journey weight the run is not on screen at all: no draw, no transmission pass. */
const PRESENCE_MIN = 0.005
/** ≤ 768 px is "mobile" for the fit (inclusive — the 768 px tablet shot used the desktop fit and clipped). */
const MOBILE_MAX = 768

const HERO = {
  z: 0,
  /** share of the visible width at z 0 the run spans (checklist #3: ≈ 0.70, ≤ 0.78 on mobile) */
  fit: 0.7,
  fitMobile: 0.78,
  floatAmp: 0.12,
  floatPeriod: 6,
  /** mouse parallax on top of the scroll turn */
  rotY: 0.06,
  rotX: 0.03,
  rotLerp: 0.05,
  /** world units the run drifts up as `wordmarkHero` goes 1 → 0 */
  exitLift: 6,
  exitScale: 0.9,
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
 * smoothstep, with the mouse parallax and the slow float added on top. Reduced motion: no turn,
 * no float, no parallax.
 *
 * The mesh stays mounted for the life of the scene: unmounting between the two appearances
 * disposed the MeshTransmissionMaterial, so the footer re-linked its large shader on the main
 * thread mid-scroll (≈ 50 ms) and reallocated the FBOs. Instead `mesh.visible` and
 * `material.visible` are set every frame — drei skips the transmission pass and three skips the
 * draw for an invisible run, so the day phase costs nothing.
 */
export default function GlassWordmark(props: LayerProps) {
  return (
    <Suspense fallback={null}>
      <Letters {...props} />
    </Suspense>
  )
}

/** Suspends on the font; the geometry comes from the module-level cache in GlassText. */
function Letters({ tier, reduced }: LayerProps) {
  const font = useTTFFont(FONTS, hero.wordmark)
  const geometry = getGlassGeometry(font, hero.wordmark, { curveSegments: CURVE_SEGMENTS, bevel: BEVEL })
  const bounds = geometry.boundingBox as THREE.Box3
  const runWidth = Math.max(1e-4, bounds.max.x - bounds.min.x)
  const halfWidth = runWidth / 2
  const halfHeight = (bounds.max.y - bounds.min.y) / 2

  const group = useRef<THREE.Group>(null)
  const mesh = useRef<THREE.Mesh>(null)
  /** lerped mouse parallax, kept apart from the scroll turn so the two compose cleanly */
  const parallax = useRef({ yaw: 0, pitch: 0 }).current
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
        // Fit the run to a share of the visible width at its depth; the geometry is centred on
        // the origin, so position is exactly the visual centre.
        const dist = cam.position.z - HERO.z
        const visibleWidth = 2 * dist * halfTan * cam.aspect
        const fit = mobile ? HERO.fitMobile : HERO.fit
        const scale = ((visibleWidth * fit) / runWidth) * (HERO.exitScale + (1 - HERO.exitScale) * wh)
        const bob = reduced ? 0 : Math.sin((t * TAU) / HERO.floatPeriod) * HERO.floatAmp
        const y = bob + (1 - wh) * HERO.exitLift
        g.position.set(0, y, HERO.z)
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

    // Both flags: drei's transmission pass keys off material.visible, the draw off mesh.visible.
    m.visible = visible
    ;(m.material as THREE.Material).visible = visible
  })

  return (
    <group ref={group}>
      <GlassText
        ref={mesh}
        text={hero.wordmark}
        font={font}
        curveSegments={CURVE_SEGMENTS}
        bevel={BEVEL}
        mode={quality.transmission ? 'frosted' : 'physical'}
        material={{
          resolution: quality.glassResolution,
          samples: quality.glassSamples,
          // drei allocates a second FBO for the (unused, `backside: false`) backside pass at
          // `resolution` unless told otherwise — keep it to a token 32² HalfFloat target.
          backsideResolution: 32,
          // > 0 triples the bicubic transmission taps per sample; invisible under the 0.42 roughness
          // blur, so only the high tier pays for the fringe.
          chromaticAberration: tier === 'high' ? 0.02 : 0,
        }}
      />
    </group>
  )
}
