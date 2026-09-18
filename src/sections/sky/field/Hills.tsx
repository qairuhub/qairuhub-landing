import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { FIELD, FIELD_COLORS, hillHeight, hillProfile, sunGraze, type FieldUniforms } from './terrain'
import { patchDistanceFade } from './grassShaders'

/**
 * The hills: one PlaneGeometry (60 × 30, `segments` × `segments / 2`) laid flat, displaced by
 * `hillHeight`, vertex colours darkening in the valley and right in front of the lens.
 * MeshLambertMaterial so SceneLights (hemisphere + the low sun) shade it; valley haze and distance
 * fade in-shader.
 * One draw call. Lambert, not Standard: the hills fill the bottom ~45 % of the footer frame and
 * the PBR fragment (GGX + PMREM env taps for a roughness-1 soil whose env share was 0.2) cost
 * ~1 ms of the ~12.5 ms GPU frame on the Intel UHD reference laptop (footer 49 → 54 fps with the
 * hills hidden); a matte night slope lit by the hemisphere + moon light looks the same.
 */
/** Light gain standing in for the dropped env irradiance (see the material below). */
const HILL_LIGHT_GAIN = 1.5
/**
 * Flat ambient (sRGB) standing in for the env rig's light on the soil. At the golden hour the sun
 * is BEHIND the ridge, so every camera-facing slope gets almost nothing from the directional light
 * and this deep blue-violet is most of what you see: the hills read as a silhouette against the
 * glow, which is both the look and what keeps the footer copy on a dark ground.
 */
const HILL_AMBIENT = '#1b2340'

export default function Hills({ segments, uniforms }: { segments: number; uniforms: FieldUniforms }) {
  // Built in useMemo, disposed in the effect below (StrictMode's dev double-invoke re-uploads
  // the disposed buffers lazily on the next render — nothing leaks in production).
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(FIELD.width, FIELD.depth, segments, Math.max(1, Math.round(segments / 2)))
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0, (FIELD.zNear + FIELD.zFar) / 2) // z from −20 (far) to 10 (the camera plane)
    const pos = g.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const soil = new THREE.Color(FIELD_COLORS.soil)
    const soilLit = new THREE.Color(FIELD_COLORS.soilLit)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const h = hillHeight(x, z)
      pos.setY(i, h)
      // Darker on the valley floor (low hill profile) and in the near foreground.
      const lift = THREE.MathUtils.smoothstep(hillProfile(x), 0.1, 1.5)
      const near = THREE.MathUtils.smoothstep(z, 3, 9)
      const shade = (0.45 + 0.55 * lift) * (1 - 0.35 * near)
      // The low sun grazing the ridges from the side (see `sunGraze`): the land between the crest
      // lines gets real internal modelling instead of one flat dark mass, which is the single
      // thing the valley band was missing. Where the light reaches, the soil slides toward
      // `soilLit`; where it does not, the soil is MULTIPLIED down rather than mixed toward a dark
      // stop — a mix greys the hue out, a multiply keeps it and stays dark.
      const lit = sunGraze(x, z)
      const k = 0.66 + 0.5 * lit
      const r = soil.r + (soilLit.r - soil.r) * lit
      const gc = soil.g + (soilLit.g - soil.g) * lit
      const b = soil.b + (soilLit.b - soil.b) * lit
      colors[i * 3] = r * shade * k
      colors[i * 3 + 1] = gc * shade * k * 0.97
      colors[i * 3 + 2] = b * shade * (k * 0.9 + 0.12)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [segments])

  const material = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({
      vertexColors: true,
      // Cool multiplier on the soil: the violet hemisphere fill is the only light reaching these
      // slopes now, and a neutral tint turned them muddy brown-grey.
      // Scaled by HILL_LIGHT_GAIN: Lambert ignores `scene.environment`, and the Standard version's
      // 0.2 share of the Lightformer rig was most of the light on the slopes (without the
      // gain the ground sampled near-black where the Standard hills read #2a3d2f).
      color: new THREE.Color('#a5bce8').multiplyScalar(HILL_LIGHT_GAIN),
      // The Lightformer rig's white top light and warm fill also put a little red and blue into
      // the soil; the hemisphere + key light cannot reach the near slopes at all, so this flat
      // ambient is what gives the silhouette its shape instead of a dead black mass.
      emissive: HILL_AMBIENT,
    })
    m.onBeforeCompile = (shader) => patchDistanceFade(shader, uniforms)
    return m
  }, [uniforms])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}
