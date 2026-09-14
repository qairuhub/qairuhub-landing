import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { FIELD_COLORS, hillHeight, type FieldUniforms } from './terrain'
import { patchSway } from './grassShaders'

/**
 * Eight red flowers on stalks and two mushrooms on the near slopes, all merged into ONE
 * vertex-coloured geometry (one draw call). Each vertex carries `aRoot` (the object's root, for
 * the wind phase) and `aSway` (amplitude ∝ height²) so the MeshStandardMaterial's patched vertex
 * shader sways flowers and, much less, mushrooms with the same wind as the grass.
 *
 * Positions were chosen on the visible slopes of the final composition (see terrain.ts):
 * every root projects inside the 1440 × 900 frame, none in the hidden valley floor, and none
 * under the footer's pinned content row (Footer.css `.footer__content`: the link row along the
 * bottom-left and the social buttons + copyright in the bottom-right ≈ 320 × 140 px corner).
 * Camera (0, 0, 10), fov 40, group y −2.2: a root at (x, z) lands at screen
 * x = x / (0.364 · (10 − z) · aspect), y = (hillHeight − 2.2) / (0.364 · (10 − z)) — the near
 * right corner (x ≳ 2.2 with z ≳ 4) is exactly that footer corner, so keep flora out of it.
 */
const FLOWERS: ReadonlyArray<readonly [x: number, z: number, height: number]> = [
  [-3.4, 3.6, 0.36],
  [-2.4, 2.2, 0.4],
  [-1.6, 0.6, 0.34],
  [-2.7, 4.3, 0.38],
  [1.9, 1.4, 0.36],
  [2.6, 3.9, 0.42],
  [3.0, 3.2, 0.34],
  [3.6, 2.0, 0.38],
]
const MUSHROOMS: ReadonlyArray<readonly [x: number, z: number]> = [
  [1.6, 3.4],
  [-2.2, 3.0],
]
/** white dots on the cap (cap-local, before the 0.7 vertical squash) */
const CAP_DOTS: ReadonlyArray<readonly [number, number, number]> = [
  [0.062, 0.088, 0.053],
  [-0.07, 0.08, 0.044],
  [0.018, 0.044, -0.106],
  [-0.026, 0.115, -0.018],
]

interface Piece {
  geo: THREE.BufferGeometry
  color: THREE.Color
}

const euler = new THREE.Euler()
const q = new THREE.Quaternion()
const p = new THREE.Vector3()
const s = new THREE.Vector3()
const m4 = new THREE.Matrix4()

/** Applies translate ∘ rotate ∘ scale (in that order of effect: scale first) to a geometry. */
function xf(
  geo: THREE.BufferGeometry,
  t: { p?: readonly [number, number, number]; r?: readonly [number, number, number]; s?: readonly [number, number, number] },
) {
  p.set(...(t.p ?? [0, 0, 0]))
  euler.set(...(t.r ?? [0, 0, 0]))
  q.setFromEuler(euler)
  s.set(...(t.s ?? [1, 1, 1]))
  geo.applyMatrix4(m4.compose(p, q, s))
  return geo
}

function flower(h: number, colors: Record<'stalk' | 'petal' | 'pistil', THREE.Color>): Piece[] {
  const pieces: Piece[] = []
  pieces.push({ geo: xf(new THREE.CylinderGeometry(0.008, 0.012, h, 5, 1), { p: [0, h / 2, 0] }), color: colors.stalk })
  pieces.push({
    geo: xf(new THREE.SphereGeometry(0.03, 6, 4), { p: [0.028, h * 0.45, 0], r: [0, 0, 0.5], s: [1.6, 0.35, 0.7] }),
    color: colors.stalk,
  })
  for (let i = 0; i < 5; i++) {
    const petal = xf(new THREE.SphereGeometry(0.04, 8, 6), { p: [0.04, 0, 0], s: [1.35, 0.42, 0.8] })
    xf(petal, { r: [0, (i / 5) * Math.PI * 2, 0] })
    xf(petal, { p: [0, h, 0], r: [0.25, 0, 0] }) // head tilts toward the camera
    pieces.push({ geo: petal, color: colors.petal })
  }
  pieces.push({ geo: xf(new THREE.SphereGeometry(0.022, 8, 6), { p: [0, h + 0.012, 0], r: [0.25, 0, 0] }), color: colors.pistil })
  return pieces
}

function mushroom(colors: Record<'cream' | 'cap' | 'dot', THREE.Color>): Piece[] {
  const pieces: Piece[] = []
  pieces.push({ geo: xf(new THREE.CylinderGeometry(0.045, 0.06, 0.2, 8, 1), { p: [0, 0.1, 0] }), color: colors.cream })
  pieces.push({
    geo: xf(new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, 0.19, 0], s: [1, 0.7, 1] }),
    color: colors.cap,
  })
  for (const [dx, dy, dz] of CAP_DOTS) {
    pieces.push({ geo: xf(new THREE.SphereGeometry(0.024, 6, 4), { p: [dx, 0.19 + dy * 0.7, dz] }), color: colors.dot })
  }
  return pieces
}

/**
 * Turns object-local pieces (root at the origin, y up) into finished, non-indexed geometries in
 * group space carrying `color`, `aRoot` and `aSway`.
 */
function finishObject(
  pieces: Piece[],
  root: THREE.Vector3,
  yaw: number,
  swayAmp: number,
  swayHeight: number,
  out: THREE.BufferGeometry[],
) {
  for (const piece of pieces) {
    const geo = piece.geo.toNonIndexed()
    piece.geo.dispose()
    xf(geo, { r: [0, yaw, 0] })
    const pos = geo.attributes.position as THREE.BufferAttribute
    const n = pos.count
    const color = new Float32Array(n * 3)
    const sway = new Float32Array(n)
    const roots = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      color[i * 3] = piece.color.r
      color[i * 3 + 1] = piece.color.g
      color[i * 3 + 2] = piece.color.b
      const k = Math.min(1, Math.max(0, pos.getY(i) / swayHeight))
      sway[i] = swayAmp * k * k
      roots[i * 3] = root.x
      roots[i * 3 + 1] = root.y
      roots[i * 3 + 2] = root.z
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3))
    geo.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1))
    geo.setAttribute('aRoot', new THREE.Float32BufferAttribute(roots, 3))
    geo.translate(root.x, root.y, root.z)
    out.push(geo)
  }
}

/** Concatenates non-indexed geometries that share the same attribute set into one. */
function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry()
  for (const name of ['position', 'normal', 'color', 'aSway', 'aRoot'] as const) {
    let total = 0
    let itemSize = 3
    for (const g of parts) {
      const a = g.attributes[name] as THREE.BufferAttribute
      total += a.count
      itemSize = a.itemSize
    }
    const data = new Float32Array(total * itemSize)
    let offset = 0
    for (const g of parts) {
      const a = g.attributes[name] as THREE.BufferAttribute
      data.set(a.array as Float32Array, offset)
      offset += a.count * itemSize
    }
    merged.setAttribute(name, new THREE.Float32BufferAttribute(data, itemSize))
  }
  for (const g of parts) g.dispose()
  merged.computeBoundingSphere()
  return merged
}

export default function Flora({ uniforms }: { uniforms: FieldUniforms }) {
  const geometry = useMemo(() => {
    const colors = {
      stalk: new THREE.Color(FIELD_COLORS.stalk),
      petal: new THREE.Color(FIELD_COLORS.petal),
      pistil: new THREE.Color(FIELD_COLORS.pistil),
      cream: new THREE.Color(FIELD_COLORS.cream),
      cap: new THREE.Color(FIELD_COLORS.cap),
      dot: new THREE.Color(FIELD_COLORS.dot),
    }
    const parts: THREE.BufferGeometry[] = []
    const root = new THREE.Vector3()
    FLOWERS.forEach(([x, z, h], i) => {
      root.set(x, hillHeight(x, z) - 0.01, z)
      finishObject(flower(h, colors), root, (i * 1.7) % Math.PI, 0.05, h, parts)
    })
    MUSHROOMS.forEach(([x, z], i) => {
      root.set(x, hillHeight(x, z) - 0.02, z)
      finishObject(mushroom(colors), root, i * 2.1, 0.012, 0.3, parts)
    })
    return mergeParts(parts)
  }, [])

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, envMapIntensity: 0.2 })
    m.onBeforeCompile = (shader) => patchSway(shader, uniforms)
    return m
  }, [uniforms])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return <mesh geometry={geometry} material={material} />
}
