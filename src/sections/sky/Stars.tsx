import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { journey } from './journey'
import { pointer } from './pointer'
import { QUALITY } from './quality'
import { starsFragment, starsVertex } from './skyShaders'
import type { LayerProps } from './types'

/** dome radius (world units) — well inside the camera's far plane (120) */
const RADIUS = 60
/** the camera never moves; the dome is centred on it */
const CAMERA_Z = 10
/** share of stars that live in the denser diagonal band */
const BAND_SHARE = 0.38
/** share of larger, warmer stars with a soft glow */
const WARM_SHARE = 0.04
/** the dome tilts up as we descend (scroll in vh × this, capped at the end of the descent) */
const DRIFT = 0.15
const DRIFT_CAP = 2.2
const PARALLAX = 0.02

/** small deterministic PRNG so the sky is identical on every load */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildGeometry(count: number) {
  const rand = rng(90210)
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const seeds = new Float32Array(count)
  const bright = new Float32Array(count)
  const warm = new Float32Array(count)
  // band: a great circle through the view direction, running bottom-left → top-right
  const bandNormal = new THREE.Vector3(0.7, -0.7, 0.12).normalize()
  const bandU = new THREE.Vector3(1, 0, 0).cross(bandNormal).normalize()
  const bandV = new THREE.Vector3().crossVectors(bandNormal, bandU)
  const dir = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  const HALF_AZ = Math.PI * 0.22 // ±40° around −z (covers a 21:9 viewport)
  for (let i = 0; i < count; i++) {
    let ok = false
    for (let tries = 0; tries < 8 && !ok; tries++) {
      if (rand() < BAND_SHARE) {
        const phi = rand() * Math.PI * 2
        const spread = (rand() + rand() - 1) * 0.16
        dir.copy(bandU).multiplyScalar(Math.cos(phi)).add(tmp.copy(bandV).multiplyScalar(Math.sin(phi)))
        dir.add(tmp.copy(bandNormal).multiplyScalar(spread)).normalize()
      } else {
        const az = (rand() * 2 - 1) * HALF_AZ
        // elevation −41° … 23°: the dome tilts up ~19° during the descent, so the stars that
        // start below the frame drift into it (nothing above +23° is ever on screen)
        const el = -0.72 + 1.12 * Math.pow(rand(), 0.9)
        dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))
      }
      // keep the part of the dome that can ever be on screen
      ok = dir.z < -0.45 && dir.y > -0.75 && dir.y < 0.45
    }
    const r = RADIUS * (0.9 + rand() * 0.2)
    positions[i * 3] = dir.x * r
    positions[i * 3 + 1] = dir.y * r
    positions[i * 3 + 2] = dir.z * r
    const isWarm = rand() < WARM_SHARE
    warm[i] = isWarm ? 1 : 0
    sizes[i] = isWarm ? 2.2 + rand() * 0.4 : 1 + Math.pow(rand(), 2.4) * 1.6
    seeds[i] = rand()
    bright[i] = isWarm ? 0.85 + rand() * 0.15 : 0.35 + Math.pow(rand(), 1.6) * 0.65
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  g.setAttribute('aBright', new THREE.BufferAttribute(bright, 1))
  g.setAttribute('aWarm', new THREE.BufferAttribute(warm, 1))
  return g
}

/**
 * The star field: one <points> on a far dome around the camera (mostly in front and above the
 * horizon, with a denser diagonal band and ~4 % larger warm stars). Screen-pixel sizes, vertex
 * twinkle, additive blending; global alpha follows `journey.stars` and the whole draw is
 * skipped (visible=false) while the stars are out. Mouse parallax + a slow upward tilt while
 * descending — never per-vertex work on the CPU.
 */
export default function Stars({ tier, reduced }: LayerProps) {
  const dpr = useThree((s) => s.viewport.dpr)
  const group = useRef<THREE.Group>(null)
  const points = useRef<THREE.Points>(null)

  const geometry = useMemo(() => buildGeometry(QUALITY[tier].stars), [tier])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starsVertex,
        fragmentShader: starsFragment,
        uniforms: {
          uTime: { value: 0 },
          uDpr: { value: 1 },
          uTwinkle: { value: 1 },
          uAlpha: { value: 1 },
          uNight: { value: 0 },
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
    material.uniforms.uDpr.value = dpr
    material.uniforms.uTwinkle.value = reduced ? 0 : 1
  }, [dpr, reduced, material])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const p = points.current
    const g = group.current
    if (!p || !g) return
    const alpha = journey.stars
    const on = alpha > 0.002
    p.visible = on
    if (!on) return
    const u = material.uniforms
    u.uTime.value = reduced ? 0 : journey.time
    u.uAlpha.value = alpha * (1 - 0.1 * journey.night)
    u.uNight.value = journey.night
    const mx = reduced ? 0 : pointer.x
    const my = reduced ? 0 : pointer.y
    g.rotation.x = Math.min(journey.vh, DRIFT_CAP) * DRIFT - my * PARALLAX
    g.rotation.y = mx * PARALLAX
  })

  return (
    <group ref={group} position={[0, 0, CAMERA_Z]}>
      <points ref={points} geometry={geometry} material={material} frustumCulled={false} renderOrder={-9} />
    </group>
  )
}
