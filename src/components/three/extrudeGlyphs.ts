import * as THREE from 'three'

/**
 * Extruded, bevelled glyph geometry that stays clean when the bevel is pulled INSIDE the outline.
 *
 * A port of three's ExtrudeGeometry (r186, MIT; straight extrusion only, one step, the same
 * vertex rings, faces, winding and groups) with three changes for the thin v3 wordmark:
 *
 *   1. Clamped contraction. three moves every outline vertex by `bs × m` where `m` is its bevel
 *      vector (≈ unit normal, capped at √2 in sharp corners). With a negative `bevelOffset` the
 *      two sides of any stroke narrower than 2 × |bs| cross each other: Courgette's exit strokes
 *      taper to 10–18° points, so the a / u / h tails and the b join folded into little hooks and
 *      notches. Here a contracting vertex may travel at most `CONTRACT_SHARE` of the distance to
 *      the opposite side of the glyph (ray-cast along −m), so a stroke that is too thin collapses
 *      to a hairline on its medial line instead of folding over. Expanding moves (bs ≥ 0) are
 *      unclamped, exactly like three.
 *   2. Sliver holes are dropped. Overlapping font contours can leave a tiny "hole" at a join
 *      (the q has one of 9 points at its stem); an inset bevel grows it into a visible notch.
 *   3. Indexed, position-only output. three de-indexes every face and adds per-corner UVs and
 *      normals: for "qairuhub" that was 176k vertices, i.e. a 2.1 MB position buffer, a 2.1 MB
 *      normal buffer and a 1.4 MB UV buffer. Chrome uploads anything above its ~1 MB transfer
 *      buffer in chunks, and on an Intel iMac (ANGLE-Metal) the data past the first chunk arrived
 *      corrupted: "qair" rendered, "uhub" shattered (the 1 MiB mark falls 22 % into the first u).
 *      The ring vertices are shared instead (≈ 29k vertices → a 352 KB position buffer and a
 *      352 KB Uint16 index), the materials never sample a UV, and the per-face normals come
 *      from `flatShading` in the fragment shader — the same facets the old per-corner normals
 *      drew. Keep every buffer this module produces under `MAX_BUFFER_BYTES`.
 */

/** Largest vertex / index buffer this module may hand to the GPU (see change 3 above). */
export const MAX_BUFFER_BYTES = 512 * 1024

export interface GlyphExtrudeOptions {
  /** extrusion depth between the two bevels */
  depth: number
  /** outline tessellation per curve */
  curveSegments: number
  bevelThickness: number
  bevelSize: number
  bevelOffset: number
  bevelSegments: number
  /** holes whose |area| is below this are dropped (same units as the shapes) */
  minHoleArea: number
}

/** Share of the distance to the opposite side a contracting vertex may travel (0.5 = the sides touch). */
const CONTRACT_SHARE = 0.45

type Vec = THREE.Vector2

/** three's `mergeOverlappingPoints`: drops index-adjacent points closer than a scaled 1e-10 (in place). */
function mergeOverlappingPoints(points: Vec[]): void {
  const THRESHOLD_SQ = 1e-20
  let prev = points[0]
  for (let i = 1; i <= points.length; i++) {
    const index = i % points.length
    const cur = points[index]
    const dx = cur.x - prev.x
    const dy = cur.y - prev.y
    const scale = Math.max(Math.abs(cur.x), Math.abs(cur.y), Math.abs(prev.x), Math.abs(prev.y))
    if (dx * dx + dy * dy <= THRESHOLD_SQ * scale * scale) {
      points.splice(index, 1)
      i--
      continue
    }
    prev = cur
  }
}

/**
 * three's `getBevelVec`: the translation that moves `pt` onto the contour shifted 1 unit to the
 * left (outside, for a clockwise contour). Not normalised, so corners stay sharp, but capped at √2.
 */
function bevelVec(pt: Vec, prev: Vec, next: Vec): Vec {
  let tx: number
  let ty: number
  let shrink: number
  const px = pt.x - prev.x
  const py = pt.y - prev.y
  const nx = next.x - pt.x
  const ny = next.y - pt.y
  const prevLenSq = px * px + py * py
  const collinear = px * ny - py * nx
  if (Math.abs(collinear) > Number.EPSILON) {
    const prevLen = Math.sqrt(prevLenSq)
    const nextLen = Math.sqrt(nx * nx + ny * ny)
    const prevShiftX = prev.x - py / prevLen
    const prevShiftY = prev.y + px / prevLen
    const nextShiftX = next.x - ny / nextLen
    const nextShiftY = next.y + nx / nextLen
    const sf = ((nextShiftX - prevShiftX) * ny - (nextShiftY - prevShiftY) * nx) / (px * ny - py * nx)
    tx = prevShiftX + px * sf - pt.x
    ty = prevShiftY + py * sf - pt.y
    const lenSq = tx * tx + ty * ty
    if (lenSq <= 2) return new THREE.Vector2(tx, ty)
    shrink = Math.sqrt(lenSq / 2)
  } else {
    let sameDirection = false
    if (px > Number.EPSILON) {
      if (nx > Number.EPSILON) sameDirection = true
    } else if (px < -Number.EPSILON) {
      if (nx < -Number.EPSILON) sameDirection = true
    } else if (Math.sign(py) === Math.sign(ny)) {
      sameDirection = true
    }
    if (sameDirection) {
      tx = -py
      ty = px
      shrink = Math.sqrt(prevLenSq)
    } else {
      tx = px
      ty = py
      shrink = Math.sqrt(prevLenSq / 2)
    }
  }
  return new THREE.Vector2(tx / shrink, ty / shrink)
}

/**
 * For every vertex of every ring: the most negative bevel parameter it may take, as a positive
 * number (`Infinity` = unclamped). Casts a ray from the vertex along −m (into the material) against
 * every edge of the shape except the vertex's own two edges; only edges within the reach of the
 * deepest contraction `maxContract` are tested.
 */
function contractionLimits(rings: Vec[][], movements: Vec[][], maxContract: number): number[] {
  const limits: number[] = []
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r]
    const n = ring.length
    for (let i = 0; i < n; i++) {
      const m = movements[r][i]
      const len = Math.hypot(m.x, m.y)
      if (maxContract <= 0 || len < 1e-12) {
        limits.push(Infinity)
        continue
      }
      const ux = -m.x / len
      const uy = -m.y / len
      const p = ring[i]
      const reach = (maxContract * len) / CONTRACT_SHARE
      let best = reach
      const prevEdge = (i - 1 + n) % n
      for (let q = 0; q < rings.length; q++) {
        const other = rings[q]
        const k = other.length
        for (let j = 0; j < k; j++) {
          if (q === r && (j === i || j === prevEdge)) continue
          const a = other[j]
          const b = other[(j + 1) % k]
          if (Math.min(a.x, b.x) > p.x + best || Math.max(a.x, b.x) < p.x - best) continue
          if (Math.min(a.y, b.y) > p.y + best || Math.max(a.y, b.y) < p.y - best) continue
          const ex = b.x - a.x
          const ey = b.y - a.y
          const denom = ux * ey - uy * ex
          if (Math.abs(denom) < 1e-14) continue
          const wx = a.x - p.x
          const wy = a.y - p.y
          const t = (wx * ey - wy * ex) / denom
          if (t <= 1e-9 || t >= best) continue
          const s = (wx * uy - wy * ux) / denom
          if (s < 0 || s > 1) continue
          best = t
        }
      }
      limits.push(best < reach ? (CONTRACT_SHARE * best) / len : Infinity)
    }
  }
  return limits
}

function addShape(shape: THREE.Shape, o: GlyphExtrudeOptions, geometry: THREE.BufferGeometry, positions: number[], indices: number[]) {
  /** index of this shape's first vertex in the shared position list */
  const base = positions.length / 3
  const { depth, bevelThickness, bevelSize, bevelOffset, bevelSegments } = o
  const steps = 1

  const extracted = shape.extractPoints(o.curveSegments)
  let vertices = extracted.shape
  let holes = extracted.holes.filter((h) => Math.abs(THREE.ShapeUtils.area(h)) >= o.minHoleArea)

  if (!THREE.ShapeUtils.isClockWise(vertices)) {
    vertices = vertices.reverse()
    holes = holes.map((h) => (THREE.ShapeUtils.isClockWise(h) ? h.reverse() : h))
  }
  mergeOverlappingPoints(vertices)
  holes.forEach(mergeOverlappingPoints)

  const contour = vertices
  for (const hole of holes) vertices = vertices.concat(hole)
  const vlen = vertices.length

  const ringMovements = (ring: Vec[]) => ring.map((pt, i) => bevelVec(pt, ring[(i - 1 + ring.length) % ring.length], ring[(i + 1) % ring.length]))
  const contourMovements = ringMovements(contour)
  const holesMovements = holes.map(ringMovements)
  const verticesMovements = contourMovements.concat(...holesMovements)

  // Deepest contraction any ring reaches: the bevel parameter runs from `bevelOffset` (cap) to
  // `bevelSize + bevelOffset` (side wall).
  const maxContract = Math.max(0, -Math.min(bevelOffset, bevelSize + bevelOffset))
  const limits = contractionLimits([contour, ...holes], [contourMovements, ...holesMovements], maxContract)

  /** index of the first vertex of hole h in `vertices` / `limits` */
  const holeStart: number[] = []
  let cursor = contour.length
  for (const hole of holes) {
    holeStart.push(cursor)
    cursor += hole.length
  }

  const moved = (pt: Vec, vec: Vec, bs: number, limit: number) => {
    const s = bs < -limit ? -limit : bs
    return new THREE.Vector2(pt.x + vec.x * s, pt.y + vec.y * s)
  }
  const v = (x: number, y: number, z: number) => {
    positions.push(x, y, z)
  }

  // Front bevel rings (the first one, t = 0, is the cap that gets triangulated).
  let faces: number[][]
  const contracted: Vec[] = []
  const expandedHoles: Vec[][] = []
  for (let b = 0; b < bevelSegments; b++) {
    const t = b / bevelSegments
    const z = bevelThickness * Math.cos((t * Math.PI) / 2)
    const bs = bevelSize * Math.sin((t * Math.PI) / 2) + bevelOffset
    for (let i = 0; i < contour.length; i++) {
      const vert = moved(contour[i], contourMovements[i], bs, limits[i])
      v(vert.x, vert.y, -z)
      if (t === 0) contracted.push(vert)
    }
    for (let h = 0; h < holes.length; h++) {
      const hole = holes[h]
      const ring: Vec[] = []
      for (let i = 0; i < hole.length; i++) {
        const vert = moved(hole[i], holesMovements[h][i], bs, limits[holeStart[h] + i])
        v(vert.x, vert.y, -z)
        if (t === 0) ring.push(vert)
      }
      if (t === 0) expandedHoles.push(ring)
    }
  }
  if (bevelSegments === 0) faces = THREE.ShapeUtils.triangulateShape(contour, holes)
  else faces = THREE.ShapeUtils.triangulateShape(contracted, expandedHoles)
  const flen = faces.length

  // Side wall rings (back, then front).
  const wall = bevelSize + bevelOffset
  for (let s = 0; s <= steps; s++) {
    for (let i = 0; i < vlen; i++) {
      const vert = bevelSegments > 0 ? moved(vertices[i], verticesMovements[i], wall, limits[i]) : vertices[i]
      v(vert.x, vert.y, (depth / steps) * s)
    }
  }

  // Back bevel rings.
  for (let b = bevelSegments - 1; b >= 0; b--) {
    const t = b / bevelSegments
    const z = bevelThickness * Math.cos((t * Math.PI) / 2)
    const bs = bevelSize * Math.sin((t * Math.PI) / 2) + bevelOffset
    for (let i = 0; i < contour.length; i++) {
      const vert = moved(contour[i], contourMovements[i], bs, limits[i])
      v(vert.x, vert.y, depth + z)
    }
    for (let h = 0; h < holes.length; h++) {
      const hole = holes[h]
      for (let i = 0; i < hole.length; i++) {
        const vert = moved(hole[i], holesMovements[h][i], bs, limits[holeStart[h] + i])
        v(vert.x, vert.y, depth + z)
      }
    }
  }

  const f3 = (a: number, b: number, c: number) => {
    indices.push(base + a, base + b, base + c)
  }
  // three splits the quad (a, b, c, d) into (a, b, d) + (b, c, d).
  const f4 = (a: number, b: number, c: number, d: number) => {
    indices.push(base + a, base + b, base + d, base + b, base + c, base + d)
  }

  // Lids.
  let start = indices.length
  if (bevelSegments > 0) {
    let offset = 0
    for (let i = 0; i < flen; i++) f3(faces[i][2] + offset, faces[i][1] + offset, faces[i][0] + offset)
    offset = vlen * (steps + bevelSegments * 2)
    for (let i = 0; i < flen; i++) f3(faces[i][0] + offset, faces[i][1] + offset, faces[i][2] + offset)
  } else {
    for (let i = 0; i < flen; i++) f3(faces[i][2], faces[i][1], faces[i][0])
    for (let i = 0; i < flen; i++) f3(faces[i][0] + vlen * steps, faces[i][1] + vlen * steps, faces[i][2] + vlen * steps)
  }
  geometry.addGroup(start, indices.length - start, 0)

  // Side walls.
  start = indices.length
  const sidewalls = (ring: Vec[], layerOffset: number) => {
    for (let i = ring.length - 1; i >= 0; i--) {
      const j = i
      const k = i - 1 < 0 ? ring.length - 1 : i - 1
      for (let s = 0, sl = steps + bevelSegments * 2; s < sl; s++) {
        const slen1 = vlen * s
        const slen2 = vlen * (s + 1)
        f4(layerOffset + j + slen1, layerOffset + k + slen1, layerOffset + k + slen2, layerOffset + j + slen2)
      }
    }
  }
  let layerOffset = 0
  sidewalls(contour, layerOffset)
  layerOffset += contour.length
  for (const hole of holes) {
    sidewalls(hole, layerOffset)
    layerOffset += hole.length
  }
  geometry.addGroup(start, indices.length - start, 1)
}

/**
 * Extrudes `shapes` (e.g. `Font.generateShapes(text, size)`) into one indexed, position-only
 * BufferGeometry (no normals, no UVs: render it with a `flatShading` material). Throws if a
 * buffer would exceed `MAX_BUFFER_BYTES`, so a longer text or a finer tessellation cannot quietly
 * bring the Mac corruption back.
 */
export function extrudeGlyphShapes(shapes: THREE.Shape[], options: GlyphExtrudeOptions): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions: number[] = []
  const indices: number[] = []
  for (const shape of shapes) addShape(shape, options, geometry, positions, indices)
  const position = new THREE.Float32BufferAttribute(positions, 3)
  const vertexCount = positions.length / 3
  const index = vertexCount > 65535 ? new THREE.Uint32BufferAttribute(indices, 1) : new THREE.Uint16BufferAttribute(indices, 1)
  const largest = Math.max(position.array.byteLength, index.array.byteLength)
  if (largest > MAX_BUFFER_BYTES) {
    throw new Error(`extrudeGlyphShapes: ${largest} B buffer exceeds ${MAX_BUFFER_BYTES} B (${vertexCount} vertices, ${indices.length} indices); lower curveSegments / bevelSegments`)
  }
  geometry.setAttribute('position', position)
  geometry.setIndex(index)
  return geometry
}
