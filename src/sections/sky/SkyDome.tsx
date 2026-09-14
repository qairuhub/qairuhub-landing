import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE, blendPalette, journey } from './journey'
import { domeFragment, domeVertex, nebulaFragment } from './skyShaders'
import type { LayerProps } from './types'

/** position of the mid gradient stop (0 top … 1 bottom) — matches the old CSS fallback (55%) */
const MID_STOP = 0.55
/** the nebula is baked at 1/NEBULA_DIV of the canvas resolution (soft haze — nothing sharp in it) */
const NEBULA_DIV = 4

const srgb = (hex: string) => {
  const v = parseInt(hex.slice(1), 16)
  return new THREE.Vector3(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255)
}

/**
 * The sky itself: a single clip-space triangle drawn first (renderOrder -10, no depth), whose
 * fragment blends the journey gradient with the space nebula + atmosphere limb, the descent
 * whiteout, dusk warmth and the night moon glow (see skyShaders.ts). Uniforms are refreshed
 * every frame from `journey` with no allocation.
 */
export default function SkyDome({ reduced }: LayerProps) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2))
    return g
  }, [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: domeVertex,
        fragmentShader: domeFragment,
        uniforms: {
          uNebula: { value: null as THREE.Texture | null },
          uTop: { value: srgb(PALETTE.space.top) },
          uMid: { value: srgb(PALETTE.space.mid) },
          uBottom: { value: srgb(PALETTE.space.bottom) },
          uMidStop: { value: MID_STOP },
          uAspect: { value: 1.6 },
          uTime: { value: 0 },
          uSpace: { value: 1 },
          uWhiteout: { value: 0 },
          uDusk: { value: 0 },
          uNight: { value: 0 },
          uDuskGlow: { value: srgb(PALETTE.dusk.glow) },
        },
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    [],
  )

  /** Nebula bake: its own material, scene and camera (the vertex stage ignores the camera). */
  const bake = useMemo(() => {
    const nebulaMaterial = new THREE.ShaderMaterial({
      vertexShader: domeVertex,
      fragmentShader: nebulaFragment,
      uniforms: { uAspect: { value: 1.6 } },
      depthWrite: false,
      depthTest: false,
    })
    const target = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    })
    const scene = new THREE.Scene()
    const mesh = new THREE.Mesh(geometry, nebulaMaterial)
    mesh.frustumCulled = false
    scene.add(mesh)
    return { nebulaMaterial, target, scene, camera: new THREE.Camera() }
  }, [geometry])
  material.uniforms.uNebula.value = bake.target.texture

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      bake.nebulaMaterial.dispose()
      bake.target.dispose()
    },
    [geometry, material, bake],
  )

  /** scratch {r,g,b} targets for blendPalette → copied into the vec3 uniforms */
  const rgb = useMemo(() => ({ top: { r: 0, g: 0, b: 0 }, mid: { r: 0, g: 0, b: 0 }, bottom: { r: 0, g: 0, b: 0 } }), [])

  useFrame((state) => {
    const u = material.uniforms
    const aspect = state.size.width / Math.max(1, state.size.height)

    // (Re)bake the nebula when the backing store size changes (first frame, resize). Quarter
    // resolution, no per-frame cost afterwards: the dome samples it with one texture tap.
    const dpr = state.viewport.dpr
    const bw = Math.max(64, Math.round((state.size.width * dpr) / NEBULA_DIV))
    const bh = Math.max(64, Math.round((state.size.height * dpr) / NEBULA_DIV))
    if (bake.target.width !== bw || bake.target.height !== bh) {
      bake.target.setSize(bw, bh)
      bake.nebulaMaterial.uniforms.uAspect.value = aspect
      const gl = state.gl
      const prev = gl.getRenderTarget()
      gl.setRenderTarget(bake.target)
      gl.render(bake.scene, bake.camera)
      gl.setRenderTarget(prev)
    }

    const top = blendPalette('top', rgb.top)
    const mid = blendPalette('mid', rgb.mid)
    const bottom = blendPalette('bottom', rgb.bottom)
    ;(u.uTop.value as THREE.Vector3).set(top.r, top.g, top.b)
    ;(u.uMid.value as THREE.Vector3).set(mid.r, mid.g, mid.b)
    ;(u.uBottom.value as THREE.Vector3).set(bottom.r, bottom.g, bottom.b)
    u.uAspect.value = aspect
    u.uTime.value = reduced ? 0 : journey.time
    u.uSpace.value = journey.space
    u.uWhiteout.value = journey.whiteout
    u.uDusk.value = journey.dusk
    u.uNight.value = journey.night
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-10} />
}
