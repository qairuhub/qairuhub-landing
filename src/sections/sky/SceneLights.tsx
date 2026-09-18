import { memo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { journey } from './journey'
import type { LayerProps } from './types'

/* Light recipe (linear THREE.Color instances, reused every frame — no allocation). */
const HEMI_SKY = '#9fc4ff'
const HEMI_GROUND = '#1b4a22'
const SUN_DAY = new THREE.Color('#fff3e2')
const SUN_NIGHT = new THREE.Color('#9fb7ff')
const SUN_POS_DAY = new THREE.Vector3(-6, 8, 6)
const SUN_POS_NIGHT = new THREE.Vector3(6, 7, 4)

/**
 * Golden hour (home only — a sub-page's frozen sky keeps the moon, see journey.ts). The key light
 * is the sun that has just gone down BEHIND the far ridge: low (≈ 5°) and at −z, so every slope
 * facing the camera falls to the hemisphere fill alone and the field reads as a deep, cool
 * silhouette, while the crests and the grass tips that face away pick up a warm rim. The fill
 * turns violet-cobalt to match the zenith — warm key against cool fill is what makes the hour
 * read as golden (GOLDEN-HOUR-BRIEF, craft notes).
 */
const HEMI_SKY_SUNSET = new THREE.Color('#6f70d2')
const HEMI_GROUND_SUNSET = new THREE.Color('#2a1a2e')
const SUN_SUNSET = new THREE.Color('#ff9d5e')
const SUN_POS_SUNSET = new THREE.Vector3(4, 1.3, -15)
const HEMI_SKY_C = new THREE.Color(HEMI_SKY)
const HEMI_GROUND_C = new THREE.Color(HEMI_GROUND)

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * The environment's contents, created once. drei's <Environment> portal re-renders its cube
 * camera (six faces) and flags the texture for a new PMREM conversion whenever its `children`
 * change identity, so fresh elements on every SceneLights render would re-bake the environment
 * each time SkyScene re-renders (reveal, visibility, profile changes).
 */
const LIGHTFORMERS = (
  <>
    {/* big soft white top light */}
    <Lightformer form="rect" intensity={2.5} color="white" position={[0, 6, 2]} scale={[14, 8, 1]} target={[0, 0, 0]} />
    {/* cool blue rim from the left */}
    <Lightformer form="rect" intensity={2} color="#8fb4ff" position={[-6, 1, -2]} rotation-y={Math.PI / 2} scale={[6, 8, 1]} />
    {/* faint warm fill from below-right */}
    <Lightformer form="rect" intensity={0.8} color="#ffe9c9" position={[5, -4, 3]} scale={[6, 4, 1]} target={[0, 0, 0]} />
  </>
)

/**
 * The ONLY lighting/environment in the scene. A static procedural <Environment> built from
 * three Lightformers (soft white top, cool blue rim from the left, faint warm fill from
 * below-right) is what makes the frosted wordmark read as glass; the hemisphere + directional
 * sun light the field and follow the journey (space → day → dusk → afterglow, or → moonlit night
 * on a sub-page) every frame. The wordmark itself picks the golden hour up through its own
 * transmission pass, which re-renders this sky behind it — the Lightformer rig is deliberately
 * untouched so the hero in space looks exactly as it does today.
 * No scene.fog — it would fog the sky and stars; the field fades distance in-shader.
 *
 * Memoised: its props (tier, reduced) rarely change, and a parent re-render must not repeat the
 * environment bake (see LIGHTFORMERS).
 */
function SceneLights(_props: LayerProps) {
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)

  useFrame(() => {
    const h = hemi.current
    const s = sun.current
    const day = 1 - journey.space
    const night = journey.night
    const sunset = journey.sunset
    if (h) {
      h.intensity = lerp(lerp(lerp(0.35, 0.9, day), 0.4, night), 0.34, sunset)
      h.color.lerpColors(HEMI_SKY_C, HEMI_SKY_SUNSET, sunset)
      h.groundColor.lerpColors(HEMI_GROUND_C, HEMI_GROUND_SUNSET, sunset)
    }
    if (s) {
      s.color.lerpColors(SUN_DAY, SUN_NIGHT, night).lerp(SUN_SUNSET, sunset)
      s.intensity = lerp(lerp(lerp(0.5, 1.2, day), 0.6, night), 1.05, sunset)
      s.position.lerpVectors(SUN_POS_DAY, SUN_POS_NIGHT, night).lerp(SUN_POS_SUNSET, sunset)
    }
  })

  return (
    <>
      <Environment resolution={64} frames={1}>
        {LIGHTFORMERS}
      </Environment>
      <hemisphereLight ref={hemi} color={HEMI_SKY} groundColor={HEMI_GROUND} intensity={0.35} />
      <directionalLight ref={sun} color={SUN_DAY} intensity={0.5} position={[-6, 8, 6]} />
    </>
  )
}

export default memo(SceneLights)
