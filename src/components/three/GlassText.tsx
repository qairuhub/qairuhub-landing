import { useCallback, useEffect, useMemo, useRef, type Ref } from 'react'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import { MeshTransmissionMaterial, type MeshTransmissionMaterialProps } from '@react-three/drei'
import * as THREE from 'three'
import { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import type { TypefaceData } from '../../lib/ttf'
import { extrudeGlyphShapes } from './extrudeGlyphs'

/**
 * The one frosted-glass lettering recipe (docs/JOURNEY-SPEC.md "Frosted glass wordmark").
 *
 *   - geometry: extruded glyph outlines (./extrudeGlyphs, three's ExtrudeGeometry with clamped
 *     inset bevels) with a ROUNDED bevel that turns every script stroke into a tube-like rounded
 *     bar, optionally pulled inside the outline (`offset`). Built once per (font, text, shape)
 *     and kept in a module-level cache, so a sculpture can mount/unmount for free (the
 *     transmission pass only exists while it is on screen). Disposed on full page unload only.
 *   - material: `frosted` = drei MeshTransmissionMaterial with blurred transmission (the matte
 *     look), `physical` = a cheap MeshPhysicalMaterial stand-in for the low quality tier.
 *   - backlight (frosted only): a lit gradient that exists ONLY inside drei's transmission pass,
 *     so the strokes always refract something bright over the near-black space / night dome.
 */

export type GlassMode = 'frosted' | 'physical'

/** Rounded-edge profile of the extruded glyphs, in multiples of `size`. */
export interface GlassTextBevel {
  /** how deep the rounded edge runs into the extrusion */
  thickness: number
  /** how far the rounded edge swells OUT from the glyph outline (three's bevel grows outward) */
  size: number
  /** quarter-round subdivisions — 3 is all a 0.024-unit quarter-round can show at hero scale */
  segments: number
  /**
   * Shifts the whole bevel profile along the outline normal (three's `bevelOffset`): negative
   * values pull the cap face INSIDE the glyph outline, so the rounded tube can end up thinner
   * than the font's own stroke. Strokes narrower than the inset collapse to a hairline instead of
   * folding (clamped in ./extrudeGlyphs.ts). Default 0.
   */
  offset?: number
}

export interface GlassGeometryOptions {
  /** cap height in local units (default 1) */
  size?: number
  /** extrusion depth (default 0.14 × size) */
  height?: number
  /** curve tessellation of the outlines (default 6) */
  curveSegments?: number
  bevel?: Partial<GlassTextBevel>
}

export const GLASS_HEIGHT = 0.14
/**
 * Tessellation budget. The run is built synchronously (earcut + extrude) the moment the font
 * resolves, and the transmission FBO pass draws it a second time every frame, so triangles are
 * paid twice. curveSegments 10 / bevelSegments 5 produced ≈ 70k triangles and a ≈ 100 ms main-thread
 * task (spec: no long task > 50 ms after load); 6 / 3 roughly halves both. A 0.024 × size
 * quarter-round on a 0.08 × size stroke cannot show more than 3 steps at hero scale, and the
 * blurred transmission hides outline facets far coarser than 6 segments per curve.
 */
export const GLASS_CURVE_SEGMENTS = 6
/**
 * Mr Dafoe strokes measure ≈ 0.08 × size across (median of the wordmark glyphs, ray-cast
 * against the outlines), i.e. a half-width of 0.04. The rounded edge is 0.6 × that half-width
 * per side (a quarter-circle profile: size == thickness): the flat face stays the original
 * stroke, the body swells to ≈ 1.6 × the stroke and the two quarter-rounds take ~38 % of the
 * visible width — a soft rounded bar, not a chunky slab. (0.45 × read as a flat bar with a
 * chamfer at hero scale; 0.6 × is the first ratio that reads as a tube.)
 */
export const GLASS_BEVEL: GlassTextBevel = { thickness: 0.024, size: 0.024, segments: 3 }

/**
 * Frosted defaults (high / medium tiers) — the spec recipe verbatim. `thickness` and
 * `attenuationDistance` are local units — drei's shader multiplies them by the mesh's world
 * scale, so they track `size`. Owners pass `resolution` / `samples` from their quality tier.
 *
 * Why transmission 1 (not a diffuse mix): three composes the body as
 * mix(diffuse, transmitted, transmission). Any diffuse share (0.62–0.7 in earlier rounds) lit
 * the whole stroke with the environment's flat #f3f7ff — measured on the reference laptop the
 * run sampled #abafbc / #b0b7ca over #040419 space: opaque grey plastic, no stars or limb
 * through the strokes, no rims. At 1.0 the body IS the blurred, refracted, attenuated backdrop —
 * the transparent tube of the reference — and the letterform is drawn by the Fresnel of the
 * rounded bevel: the environment (soft white top, cool blue left rim, warm fill) reflects in
 * the clearcoat (roughness 0.15 → crisp rims) and, softer, in the 0.42-rough base lobe. The
 * one thing pure transmission cannot do is lift a black backdrop — over space the flat face of
 * a stroke would read navy on navy — so `GLASS_BACKLIGHT` puts a lit gradient into the
 * transmission pass (see `TransmissionBacklight`), and the faint emissive is only a floor
 * against a black silhouette at grazing angles. No sheen: its velvet edge term was part of the
 * plastic read, and the reference rims are specular.
 */
export const GLASS_MATERIAL: MeshTransmissionMaterialProps = {
  transmission: 1,
  roughness: 0.42,
  thickness: 0.6,
  ior: 1.4,
  color: '#f3f7ff',
  attenuationColor: '#dbe6ff',
  attenuationDistance: 2,
  chromaticAberration: 0.02,
  anisotropicBlur: 0.35,
  // distortion > 0 costs three snoiseFractal (12 simplex-3D) calls per fragment in drei's
  // shader for an invisible wobble; measured ≈ 10 ms/frame on an Intel UHD at hero scale.
  distortion: 0,
  distortionScale: 0.5,
  temporalDistortion: 0,
  samples: 6,
  resolution: 512,
  backside: false,
  clearcoat: 1,
  clearcoatRoughness: 0.15,
  envMapIntensity: 1.2,
  emissive: '#9db4ff',
  emissiveIntensity: 0.08,
  toneMapped: true,
}

export type GlassPhysicalProps = Omit<ThreeElements['meshPhysicalMaterial'], 'ref' | 'args' | 'attach' | 'children'>

/** Low tier: no transmission pass — a milky, sheened physical surface lit by the same environment. */
export const GLASS_PHYSICAL: GlassPhysicalProps = {
  transparent: true,
  opacity: 0.9,
  color: '#eef3ff',
  roughness: 0.5,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.15,
  sheen: 0.4,
  sheenColor: '#ffffff',
  sheenRoughness: 0.6,
  envMapIntensity: 1.3,
  emissive: '#9db4ff',
  emissiveIntensity: 0.12,
  toneMapped: true,
}

/* ------------------------------------------------------------------ transmission backlight */

/** The lit backdrop the transmission pass refracts: a screen-space vertical gradient (sRGB hex). */
export interface GlassBacklight {
  /** colour at the top of the frame */
  top: string
  /** colour at the bottom of the frame */
  bottom: string
  /** multiplier on the gradient (1 = the gradient as given) */
  strength: number
}

/**
 * A small lit sky — periwinkle above, deep blue below — so a stroke over #040419 space
 * transmits a soft blue-white body (the stars and the atmosphere limb still add on top of it)
 * instead of a navy silhouette. Additive, so it lifts rather than replaces the real backdrop.
 */
export const GLASS_BACKLIGHT: GlassBacklight = { top: '#9db4ff', bottom: '#1b3a8a', strength: 1 }

/** Draw order of the backlight inside the transmission pass: after the dome (-10), with the stars (-9, additive too — order among additive layers is moot), before the far clouds (-8). */
const BACKLIGHT_RENDER_ORDER = -9

/**
 * drei's `useFrame` runs at priority 0 and is subscribed by the material (a child of our mesh,
 * so its layout effect fires first); our visibility hook must run before it, and r3f sorts
 * subscribers by priority ascending — only priorities > 0 switch r3f to manual rendering.
 */
const BEFORE_TRANSMISSION_PASS = -1

const backlightVertex = /* glsl */ `
  varying float vY;
  void main() {
    // Clip-space fullscreen triangle: the mesh transform (the glass run's) is ignored on purpose.
    vY = position.y * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`
const backlightFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform float uStrength;
  varying float vY;
  void main() {
    vec3 c = mix(uBottom, uTop, smoothstep(0.0, 1.0, vY)) * uStrength;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`

interface TransmissionUniforms {
  uniforms?: { _transmission?: { value: number } }
}

/**
 * Why not drei's `background` prop: it only swaps `scene.background` for the FBO render, and
 * three draws the background plane before every other object — the sky dome (a fullscreen
 * triangle at renderOrder -10 with no depth test) paints straight over it in that pass as well,
 * so a background texture never reaches the transmission buffer in this scene. This layer is
 * the same idea one step later in the draw order: a fullscreen additive gradient that is made
 * visible just before drei's transmission pass (priority -1 `useFrame`, mirroring drei's own
 * "material visible, transmission ≠ 0" gate) and hides itself in `onAfterRender` — i.e. after
 * its single draw into the FBO and before the main render, which therefore never sees it. The
 * real backdrop (dome, stars, limb, clouds, field) is still what refracts; the gradient only
 * lifts it, so the glass never goes dark and yet stays transparent. Cost: one fullscreen
 * triangle at FBO resolution (≤ 512²) per frame while the run is on screen, nothing otherwise.
 */
function TransmissionBacklight({ top, bottom, strength }: GlassBacklight) {
  const ref = useRef<THREE.Mesh>(null)

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
    return g
  }, [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: backlightVertex,
        fragmentShader: backlightFragment,
        uniforms: {
          uTop: { value: new THREE.Color(GLASS_BACKLIGHT.top) },
          uBottom: { value: new THREE.Color(GLASS_BACKLIGHT.bottom) },
          uStrength: { value: GLASS_BACKLIGHT.strength },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    [],
  )

  useEffect(() => {
    const u = material.uniforms
    ;(u.uTop.value as THREE.Color).set(top)
    ;(u.uBottom.value as THREE.Color).set(bottom)
    u.uStrength.value = strength
  }, [material, top, bottom, strength])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  // Just before drei renders the scene into its FBO: show the layer under exactly the
  // conditions drei renders that pass (else it would leak into the main render).
  useFrame(() => {
    const glow = ref.current
    if (!glow) return
    const parent = glow.parent as THREE.Mesh | null
    const mat = parent?.material as (THREE.Material & TransmissionUniforms) | undefined
    glow.visible = !!parent && parent.visible && !!mat && mat.visible && (mat.uniforms?._transmission?.value ?? 0) !== 0
  }, BEFORE_TRANSMISSION_PASS)

  // Drawn once (into the transmission buffer), then gone for the main render of this frame.
  const hideAfterDraw = useCallback(() => {
    const glow = ref.current
    if (glow) glow.visible = false
  }, [])

  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      visible={false}
      frustumCulled={false}
      renderOrder={BACKLIGHT_RENDER_ORDER}
      onAfterRender={hideAfterDraw}
    />
  )
}

/* ------------------------------------------------------------------ geometry cache */

/**
 * Holes smaller than this (× size²) are slivers left by overlapping font contours at a join, not
 * counters: Courgette's q carries one (≈ 5e-7) where the stem meets the bowl, while the real
 * counters of a / b / q are ≈ 0.05. An inset bevel would grow the sliver into a notch.
 */
const MIN_HOLE_AREA = 5e-4

const geometries = new Map<string, THREE.BufferGeometry>()
const fonts = new WeakMap<TypefaceData, Font>()
let unloadHooked = false

function disposeAll() {
  geometries.forEach((g) => g.dispose())
  geometries.clear()
}

/**
 * Extruded + rounded-bevel glyph run, centred on the origin (bounding box and sphere computed).
 * Cached per font file (`familyName` is the TTF's file name, see lib/ttf.ts), text and shape
 * parameters; the same instance is handed to every mount, so never dispose it yourself.
 */
export function getGlassGeometry(font: TypefaceData, text: string, opts: GlassGeometryOptions = {}): THREE.BufferGeometry {
  const size = opts.size ?? 1
  const height = opts.height ?? GLASS_HEIGHT * size
  const curveSegments = opts.curveSegments ?? GLASS_CURVE_SEGMENTS
  const bevel: GlassTextBevel = { ...GLASS_BEVEL, ...opts.bevel }
  const bevelOffset = bevel.offset ?? 0
  const key = [font.familyName, text, size, height, curveSegments, bevel.thickness, bevel.size, bevelOffset, bevel.segments].join('|')
  let geometry = geometries.get(key)
  if (!geometry) {
    let typeface = fonts.get(font)
    if (!typeface) {
      typeface = new Font(font)
      fonts.set(font, typeface)
    }
    // Same shapes and parameters as three's TextGeometry; the extruder clamps an inset bevel so
    // thin tails collapse to a hairline instead of folding (see extrudeGlyphs.ts).
    geometry = extrudeGlyphShapes(typeface.generateShapes(text, size), {
      depth: height,
      curveSegments,
      bevelThickness: bevel.thickness * size,
      bevelSize: bevel.size * size,
      bevelOffset: bevelOffset * size,
      bevelSegments: bevel.segments,
      minHoleArea: MIN_HOLE_AREA * size * size,
    })
    // Centre from the BEVELLED bounds (the bevel swells the outline), so the visual centre of the
    // run is the origin whatever the viewport does — the fit is then pure scale.
    geometry.computeBoundingBox()
    const bb = geometry.boundingBox
    if (bb) geometry.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2)
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    geometries.set(key, geometry)
    if (!unloadHooked && typeof window !== 'undefined') {
      unloadHooked = true
      window.addEventListener('pagehide', disposeAll, { once: true })
    }
  }
  return geometry
}

/* ------------------------------------------------------------------ component */

export interface GlassTextProps extends Omit<ThreeElements['mesh'], 'ref' | 'children' | 'material' | 'geometry' | 'args'> {
  /** The glyph run to extrude (the brand wordmark from src/i18n/shared.ts). */
  text: string
  /** Parsed typeface from lib/ttf.ts `useTTFFont` (stable identity — the geometry cache keys on it). */
  font: TypefaceData
  /** Cap height in local units. Default 1. */
  size?: number
  /** Extrusion depth in local units. Default 0.14 × size. */
  height?: number
  /** Curve tessellation of the glyph outlines. Default 6. */
  curveSegments?: number
  bevel?: Partial<GlassTextBevel>
  /** `frosted` (transmission, high/medium tiers) or `physical` (low tier). Default frosted. */
  mode?: GlassMode
  /** Overrides merged over `GLASS_MATERIAL` (frosted mode). */
  material?: MeshTransmissionMaterialProps
  /** Overrides merged over `GLASS_PHYSICAL` (physical mode). */
  physical?: GlassPhysicalProps
  /**
   * The lit backdrop refracted by the transmission pass (frosted mode). Default `GLASS_BACKLIGHT`;
   * `false` refracts the bare scene (only sensible over a bright backdrop).
   */
  backlight?: Partial<GlassBacklight> | false
  ref?: Ref<THREE.Mesh>
}

/**
 * Frosted glass lettering: the cached rounded-bevel geometry + the shared material recipe (+ the
 * transmission backlight). Owners keep their own motion (scroll / pointer / float) on a parent
 * group and read the run's extent from `getGlassGeometry(...).boundingBox` (centred on the
 * origin). The geometry prop is shared and never disposed by r3f (Mesh has no dispose); the
 * material is disposed on unmount. Setting `mesh.visible` / `material.visible` false (as the
 * owners do off screen) also skips the backlight and the transmission pass.
 */
export default function GlassText({
  text,
  font,
  size = 1,
  height,
  curveSegments,
  bevel,
  mode = 'frosted',
  material,
  physical,
  backlight,
  ref,
  ...mesh
}: GlassTextProps) {
  const geometry = getGlassGeometry(font, text, { size, height, curveSegments, bevel })
  const frosted = mode === 'frosted'
  const light = backlight === false ? null : { ...GLASS_BACKLIGHT, ...backlight }
  return (
    <mesh ref={ref} geometry={geometry} {...mesh}>
      {frosted ? <MeshTransmissionMaterial {...GLASS_MATERIAL} {...material} /> : <meshPhysicalMaterial {...GLASS_PHYSICAL} {...physical} />}
      {frosted && light && <TransmissionBacklight top={light.top} bottom={light.bottom} strength={light.strength} />}
    </mesh>
  )
}
