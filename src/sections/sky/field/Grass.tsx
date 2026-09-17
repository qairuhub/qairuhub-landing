import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { FIELD, FIELD_COLORS, createRng, hillHeight, hillProfile, screenY, type FieldUniforms } from './terrain'
import { grassFragment, grassVertex } from './grassShaders'

/** Share of the blades drawn into the (blurred) glass transmission buffer: 1 / this. */
const TRANSMISSION_BLADE_DIVISOR = 4

/**
 * Blades per InstancedMesh. Each instance carries a mat4 (64 B), so 8000 keeps the instance
 * matrix buffer at 512 KB — the per-buffer GPU budget (uploads above ~1 MB came out corrupted on
 * an Intel iMac, see components/three/extrudeGlyphs.ts). The high tier's 14000 blades become two
 * draws (8000 + 6000) instead of one 896 KB upload.
 */
const MAX_BLADES_PER_MESH = 8000

/**
 * The grass: `count` tapered blades in InstancedMesh chunks of ≤ MAX_BLADES_PER_MESH (PlaneGeometry 0.07 × 0.9, 1 × 4
 * segments, tapered through the vertex positions) placed on the hill surface — denser toward the
 * camera, random yaw, height 0.6–1.3 (× FIELD.bladeScale), per-instance tint (darker in the
 * valley and right in front of the lens). Wind, moonlight and the distance fade live in the
 * ShaderMaterial (grassShaders.ts). One draw call per chunk per pass; the glass transmission FBO
 * pass draws only a quarter of each chunk's instances (see onBeforeRender below).
 */
export default function Grass({ count, uniforms }: { count: number; uniforms: FieldUniforms }) {
  const field = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(0.07, 0.9, 1, 4)
    geometry.translate(0, 0.45, 0) // base at y = 0
    {
      const pos = geometry.attributes.position as THREE.BufferAttribute
      const uv = geometry.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        const t = uv.getY(i)
        pos.setX(i, pos.getX(i) * (1 - 0.96 * t * t)) // taper to a point
      }
    }

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: uniforms.uTime,
        uWind: uniforms.uWind,
        uMoonDir: uniforms.uMoonDir,
        uFade: uniforms.uFade,
        uFadeNear: uniforms.uFadeNear,
        uFadeFar: uniforms.uFadeFar,
        uBase: { value: new THREE.Color(FIELD_COLORS.grassBase) },
        uMid: { value: new THREE.Color(FIELD_COLORS.grassMid) },
        uTip: { value: new THREE.Color(FIELD_COLORS.grassTip) },
      },
      vertexShader: grassVertex,
      fragmentShader: grassFragment,
      side: THREE.DoubleSide,
    })

    // The frosted wordmark's transmission pass (drei MeshTransmissionMaterial) re-renders the
    // whole scene into a small FBO that roughness 0.5 then blurs beyond recognition, so the
    // footer frame was two full field renders (~48k double-sided blade triangles each). The
    // main pass renders to the default framebuffer (null); any other target is that FBO, where
    // a quarter of the blades reads identically after the blur. Instances are placed in random
    // order (z, x and tint all come from the rng per index), so the first quarter of every chunk
    // is a uniform random subset of the field, not a spatial band. Bakes (nebula, cloud atlas)
    // render their own private scenes and never see these meshes.
    const meshes: THREE.InstancedMesh[] = []
    for (let first = 0; first < count; first += MAX_BLADES_PER_MESH) {
      const n = Math.min(MAX_BLADES_PER_MESH, count - first)
      const chunk = new THREE.InstancedMesh(geometry, material, n)
      const fboCount = Math.ceil(n / TRANSMISSION_BLADE_DIVISOR)
      chunk.onBeforeRender = (renderer) => {
        if (renderer.getRenderTarget() !== null) chunk.count = fboCount
      }
      chunk.onAfterRender = () => {
        chunk.count = n
      }
      meshes.push(chunk)
    }

    const rng = createRng(4242 + count)
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const axis = new THREE.Vector3(0, 1, 0)
    const color = new THREE.Color()
    const span = FIELD.grassNear - FIELD.grassFar
    const bladeTop = 0.9 * 1.3 * FIELD.bladeScale

    for (let i = 0; i < count; i++) {
      // Bias z toward the front; reject spots whose tallest blade would still sit below the frame
      // (the valley floor right in front of the camera) so the budget goes where it is seen.
      let x = 0
      let z = 0
      let h = 0
      for (let tries = 0; tries < 6; tries++) {
        z = FIELD.grassNear - span * Math.pow(rng(), 1.35)
        const halfW = 0.62 * (FIELD.cameraZ - z) + 1.2
        x = (rng() * 2 - 1) * halfW
        h = hillHeight(x, z)
        if (screenY(FIELD.riseTo + h + bladeTop, z) > -1.08) break
      }
      position.set(x, h - 0.02, z)
      quaternion.setFromAxisAngle(axis, rng() * Math.PI)
      // 0.6–1.3, eased down right in front of the lens so the foreground doesn't swallow the frame.
      const hs = (0.6 + rng() * 0.7) * (1 - 0.3 * THREE.MathUtils.smoothstep(z, 5, FIELD.grassNear))
      // Far blades a little wider so they don't dissolve into sub-pixel shimmer.
      const ws = (0.8 + rng() * 0.5) * (1 + 0.6 * THREE.MathUtils.clamp((2 - z) / 18, 0, 1))
      scale.set(ws * FIELD.bladeScale, hs * FIELD.bladeScale, ws * FIELD.bladeScale)
      matrix.compose(position, quaternion, scale)
      const m = meshes[Math.floor(i / MAX_BLADES_PER_MESH)]
      const j = i % MAX_BLADES_PER_MESH
      m.setMatrixAt(j, matrix)

      const lift = THREE.MathUtils.smoothstep(hillProfile(x), 0.1, 1.5)
      const near = THREE.MathUtils.smoothstep(z, 4, FIELD.grassNear)
      const l = (0.72 + 0.28 * lift) * (1 - 0.25 * near) * (0.85 + rng() * 0.25)
      color.setRGB(l, l * (0.97 + rng() * 0.06), l)
      m.setColorAt(j, color)
    }
    const group = new THREE.Group()
    for (const m of meshes) {
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      m.computeBoundingSphere()
      group.add(m)
    }
    return { group, meshes, geometry, material }
  }, [count, uniforms])

  useEffect(
    () => () => {
      field.geometry.dispose()
      field.material.dispose()
      for (const m of field.meshes) m.dispose()
    },
    [field],
  )

  return <primitive object={field.group} />
}
