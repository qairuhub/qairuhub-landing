import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { FIELD, FIELD_COLORS, hillHeight, hillProfile, type FieldUniforms } from './terrain'
import { patchDistanceFade } from './grassShaders'

/**
 * The hills: one PlaneGeometry (60 × 30, `segments` × `segments / 2`) laid flat, displaced by
 * `hillHeight`, vertex colours darkening in the valley and right in front of the lens.
 * MeshLambertMaterial so SceneLights (hemisphere + moon) shade it; distance fade in-shader.
 * One draw call. Lambert, not Standard: the hills fill the bottom ~45 % of the footer frame and
 * the PBR fragment (GGX + PMREM env taps for a roughness-1 soil whose env share was 0.2) cost
 * ~1 ms of the ~12.5 ms GPU frame on the Intel UHD reference laptop (footer 49 → 54 fps with the
 * hills hidden); a matte night slope lit by the hemisphere + moon light looks the same.
 */
/** Light gain standing in for the dropped env irradiance (see the material below). */
const HILL_LIGHT_GAIN = 1.5
/** Flat warm-grey ambient (sRGB) standing in for the env rig's white / warm light on the soil. */
const HILL_AMBIENT = '#33403c'

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
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      pos.setY(i, hillHeight(x, z))
      // Darker on the valley floor (low hill profile) and in the near foreground.
      const lift = THREE.MathUtils.smoothstep(hillProfile(x), 0.1, 1.5)
      const near = THREE.MathUtils.smoothstep(z, 3, 9)
      const shade = (0.45 + 0.55 * lift) * (1 - 0.35 * near)
      colors[i * 3] = soil.r * shade
      colors[i * 3 + 1] = soil.g * shade
      colors[i * 3 + 2] = soil.b * shade
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [segments])

  const material = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({
      vertexColors: true,
      // Slight green multiplier: the blue hemisphere light otherwise greys the soil between blades.
      // Scaled by HILL_LIGHT_GAIN: Lambert ignores `scene.environment`, and the Standard version's
      // 0.2 share of the Lightformer rig was most of the moonlight on the slopes (without the
      // gain the ground sampled #001c03 where the Standard hills read #2a3d2f).
      color: new THREE.Color('#b9f0b9').multiplyScalar(HILL_LIGHT_GAIN),
      // The Lightformer rig's white top light and warm fill also put a little red and blue into
      // the soil; the hemisphere + moon light are all blue-green, so a faint warm-grey ambient
      // restores the Standard version's grey-green moonlit slope instead of a saturated green.
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
