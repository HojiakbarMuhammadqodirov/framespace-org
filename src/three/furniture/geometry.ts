import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Procedural furniture geometry, memoised per scene.
 *
 * Every builder is keyed by its (rounded) parameters and cached in a
 * `GeoCache` that the owning scene creates once and disposes on unmount — the
 * same lifetime rule the rest of `src/three` follows. Nothing is module-global:
 * a geometry shared across WebGL contexts keeps each dead renderer's
 * bookkeeping alive through its dispose listeners.
 */

export type Detail = 'high' | 'low'

const q = (n: number) => Math.round(n * 1000)

/* ------------------------------------------------------------ rounded block */

function axisStops(half: number, r: number, k: number, inner: number): number[] {
  const out: number[] = []
  const a = -half
  const b = -half + r
  const c = half - r
  const d = half
  for (let i = 0; i < k; i += 1) out.push(a + ((b - a) * i) / k)
  for (let i = 0; i < inner; i += 1) out.push(b + ((c - b) * i) / inner)
  for (let i = 0; i <= k; i += 1) out.push(c + ((d - c) * i) / k)
  return out
}

export interface BlockOptions {
  /** Corner radius, clamped to the smallest half-extent. */
  r: number
  /** Dome height added to the two faces across `puffAxis`. */
  puff?: number
  puffAxis?: 'y' | 'z'
  /** Arc segments per rounded edge. */
  k?: number
}

/**
 * A rounded box with an even edge radius and, optionally, a soft dome on two
 * opposite faces — the shape of a seat cushion, a mattress or a pillow.
 *
 * Normals are analytic (exact for the rounding, gradient-corrected for the
 * puff), so there is no crease at the old box edges and no merge pass.
 */
export function roundedBlock(
  w: number,
  h: number,
  d: number,
  { r, puff = 0, puffAxis = 'y', k = 4 }: BlockOptions,
): THREE.BufferGeometry {
  const hw = w / 2
  const hh = h / 2
  const hd = d / 2
  const rr = Math.max(0.0005, Math.min(r, hw - 1e-4, hh - 1e-4, hd - 1e-4))
  const half = [hw, hh, hd]
  const innerSegs = (len: number) => Math.max(1, Math.min(8, Math.round(len / 0.12)))
  const stops = half.map((hx) => axisStops(hx, rr, k, innerSegs(hx * 2 - rr * 2)))

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const p = new THREE.Vector3()
  const c = new THREE.Vector3()
  const n = new THREE.Vector3()
  const inner = [hw - rr, hh - rr, hd - rr]

  // Six faces: fixed axis + sign, and the two free axes.
  const faces: Array<[number, number, number, number]> = [
    [0, 1, 2, 1],
    [0, -1, 2, 1],
    [1, 1, 0, 2],
    [1, -1, 0, 2],
    [2, 1, 0, 1],
    [2, -1, 0, 1],
  ]

  for (const [fixed, sign, ua, va] of faces) {
    const us = stops[ua]
    const vs = stops[va]
    const base = positions.length / 3
    for (let j = 0; j < vs.length; j += 1) {
      for (let i = 0; i < us.length; i += 1) {
        const coord = [0, 0, 0]
        coord[fixed] = sign * half[fixed]
        coord[ua] = us[i]
        coord[va] = vs[j]
        p.set(coord[0], coord[1], coord[2])
        c.set(
          THREE.MathUtils.clamp(p.x, -inner[0], inner[0]),
          THREE.MathUtils.clamp(p.y, -inner[1], inner[1]),
          THREE.MathUtils.clamp(p.z, -inner[2], inner[2]),
        )
        n.subVectors(p, c)
        if (n.lengthSq() < 1e-12) n.set(0, 0, 0).setComponent(fixed, sign)
        n.normalize()
        p.copy(c).addScaledVector(n, rr)

        if (puff > 0) {
          if (puffAxis === 'y') {
            const nx = p.x / hw
            const nz = p.z / hd
            const bx = Math.max(0, 1 - nx * nx)
            const bz = Math.max(0, 1 - nz * nz)
            const t = p.y / hh
            p.y += t * puff * bx * bz
            // Slope of the dome, weighted by how much this vertex faces up.
            const gx = (-2 * nx * bz * puff) / hw
            const gz = (-2 * nz * bx * puff) / hd
            const wgt = Math.sign(t) * Math.abs(n.y)
            n.x -= gx * wgt
            n.z -= gz * wgt
            n.normalize()
          } else {
            const nx = p.x / hw
            const ny = p.y / hh
            const bx = Math.max(0, 1 - nx * nx)
            const by = Math.max(0, 1 - ny * ny)
            const t = p.z / hd
            p.z += t * puff * bx * by
            const gx = (-2 * nx * by * puff) / hw
            const gy = (-2 * ny * bx * puff) / hh
            const wgt = Math.sign(t) * Math.abs(n.z)
            n.x -= gx * wgt
            n.y -= gy * wgt
            n.normalize()
          }
        }

        positions.push(p.x, p.y, p.z)
        normals.push(n.x, n.y, n.z)
        uvs.push((us[i] + half[ua]) / (2 * half[ua]), (vs[j] + half[va]) / (2 * half[va]))
      }
    }
    // Winding: test the first quad against the face direction, flip if needed.
    const row = us.length
    const i0 = base
    const i1 = base + 1
    const i2 = base + row
    const ax = positions.slice(i0 * 3, i0 * 3 + 3)
    const bx = positions.slice(i1 * 3, i1 * 3 + 3)
    const cx = positions.slice(i2 * 3, i2 * 3 + 3)
    const e1 = new THREE.Vector3(bx[0] - ax[0], bx[1] - ax[1], bx[2] - ax[2])
    const e2 = new THREE.Vector3(cx[0] - ax[0], cx[1] - ax[1], cx[2] - ax[2])
    const cross = e1.cross(e2)
    const flip = cross.getComponent(fixed) * sign < 0
    for (let j = 0; j < vs.length - 1; j += 1) {
      for (let i = 0; i < us.length - 1; i += 1) {
        const a = base + j * row + i
        const b = a + 1
        const cc = a + row
        const dd = cc + 1
        if (flip) indices.push(a, cc, b, b, cc, dd)
        else indices.push(a, b, cc, b, dd, cc)
      }
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeBoundingSphere()
  return g
}

/* ------------------------------------------------------------------- leaf */

/**
 * One leaf blade, base at the origin, running out along +X: an almond
 * outline, folded along the midrib and drooping toward the tip.
 */
function leafGeometry(detail: Detail, fold = 0.18, droop = 0.28): THREE.BufferGeometry {
  const nt = detail === 'high' ? 10 : 5
  const nw = detail === 'high' ? 4 : 2
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= nt; i += 1) {
    const t = i / nt
    const width = 0.34 * Math.sin(Math.PI * Math.pow(t, 0.75)) * (1 - 0.15 * t)
    for (let j = 0; j <= nw * 2; j += 1) {
      const s = j / nw - 1 // -1..1 across the blade
      const z = s * width
      const y = Math.abs(s) * width * fold - droop * t * t
      positions.push(t, y, z)
      uvs.push(t, (s + 1) / 2)
    }
  }
  const row = nw * 2 + 1
  for (let i = 0; i < nt; i += 1) {
    for (let j = 0; j < nw * 2; j += 1) {
      const a = i * row + j
      indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

export type FoliageKind = 'fiddle' | 'palm' | 'bush'

/**
 * A whole crown of leaves merged into one geometry — one draw call per plant
 * instead of thirty. Phyllotaxis (golden-angle) placement keeps it natural.
 */
function foliageGeometry(kind: FoliageKind, detail: Detail): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const m = new THREE.Matrix4()
  const qy = new THREE.Quaternion()
  const qz = new THREE.Quaternion()
  const sc = new THREE.Vector3()
  const pos = new THREE.Vector3()
  const golden = Math.PI * (3 - Math.sqrt(5))
  const count = detail === 'high' ? (kind === 'bush' ? 46 : kind === 'palm' ? 18 : 30) : 14
  let seed = 3
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < count; i += 1) {
    const f = i / count
    let height: number
    let len: number
    let tilt: number
    let fold = 0.18
    let droop = 0.28
    if (kind === 'fiddle') {
      // Broad leaves up a central trunk, larger lower down.
      height = 0.35 + f * 0.62
      len = 0.26 - f * 0.08 + rand() * 0.04
      tilt = 0.25 + (1 - f) * 0.35
      fold = 0.12
      droop = 0.12
    } else if (kind === 'palm') {
      // Long arching fronds from one crown.
      height = 0.18 + rand() * 0.05
      len = 0.62 + rand() * 0.22
      tilt = 0.9 - f * 0.5 + rand() * 0.1
      fold = 0.3
      droop = 0.55
    } else {
      height = 0.1 + Math.sqrt(f) * 0.55
      len = 0.2 + rand() * 0.07
      tilt = 0.15 + (1 - f) * 0.65
      fold = 0.2
      droop = 0.22
    }
    const leaf = leafGeometry(detail, fold, droop)
    const yaw = i * golden
    qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    qz.setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt)
    qy.multiply(qz)
    const width = kind === 'palm' ? 0.35 : kind === 'fiddle' ? 1.55 : 0.9
    sc.set(len, len, len * width)
    const offset = kind === 'fiddle' ? 0.02 : 0.01
    pos.set(Math.cos(yaw) * offset, height, -Math.sin(yaw) * offset)
    m.compose(pos, qy, sc)
    leaf.applyMatrix4(m)
    parts.push(leaf)
  }
  const merged = mergeGeometries(parts, false) ?? new THREE.BufferGeometry()
  parts.forEach((p) => p.dispose())
  merged.computeBoundingSphere()
  return merged
}

/* -------------------------------------------------------------------- books */

const BOOK_TONES = ['#8C3B2A', '#3F4A3A', '#D8CBB8', '#2A2A33', '#B4832A', '#6B4A35', '#E9E2D6', '#4F5D6B']

/** A run of book spines, vertex-coloured, merged into one geometry. */
function booksGeometry(width: number, seed: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  let s = seed + 1
  const rand = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  let x = -width / 2
  const color = new THREE.Color()
  while (x < width / 2 - 0.02) {
    const t = 0.022 + rand() * 0.028
    const h = 0.17 + rand() * 0.09
    const d = 0.13 + rand() * 0.06
    const lean = x > width / 2 - 0.1 && rand() > 0.4 ? 0.22 : 0
    const g = roundedBlock(t, h, d, { r: 0.004, k: 1 })
    g.rotateZ(-lean)
    g.translate(x + t / 2 + (lean ? h * 0.1 : 0), h / 2, 0)
    color.set(BOOK_TONES[Math.floor(rand() * BOOK_TONES.length)])
    const n = g.getAttribute('position').count
    const cols = new Float32Array(n * 3)
    for (let i = 0; i < n; i += 1) {
      cols[i * 3] = color.r
      cols[i * 3 + 1] = color.g
      cols[i * 3 + 2] = color.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
    parts.push(g)
    x += t + 0.003
    if (lean) break
  }
  const merged = mergeGeometries(parts, false) ?? new THREE.BufferGeometry()
  parts.forEach((p) => p.dispose())
  return merged
}

/* ------------------------------------------------------------------ curtain */

function curtainGeometry(w: number, h: number, detail: Detail): THREE.BufferGeometry {
  const sx = detail === 'high' ? 64 : 24
  const g = new THREE.PlaneGeometry(w, h, sx, 6)
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const folds = Math.max(3, Math.round(w / 0.11))
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const t = (h / 2 - y) / h // 0 top, 1 bottom
    const amp = 0.035 + t * 0.02
    pos.setZ(i, Math.sin(((x + w / 2) / w) * folds * Math.PI * 2) * amp)
  }
  g.computeVertexNormals()
  return g
}

/* ------------------------------------------------------------------- cache */

export class GeoCache {
  readonly detail: Detail
  private map = new Map<string, THREE.BufferGeometry>()

  constructor(detail: Detail = 'high') {
    this.detail = detail
  }

  get<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
    let g = this.map.get(key) as T | undefined
    if (!g) {
      g = make()
      this.map.set(key, g)
    }
    return g
  }

  /** Arc segments per rounded edge, by tier. */
  private get k() {
    return this.detail === 'high' ? 4 : 2
  }

  private get seg() {
    return this.detail === 'high' ? 24 : 12
  }

  block(w: number, h: number, d: number, r = 0.01, puff = 0, puffAxis: 'y' | 'z' = 'y') {
    return this.get(`blk:${q(w)}:${q(h)}:${q(d)}:${q(r)}:${q(puff)}:${puffAxis}`, () =>
      roundedBlock(w, h, d, { r, puff, puffAxis, k: r < 0.006 ? 1 : this.k }),
    )
  }

  /** Tapered round leg, centred on its own height. */
  leg(rTop: number, rBottom: number, h: number) {
    return this.get(`leg:${q(rTop)}:${q(rBottom)}:${q(h)}`, () =>
      new THREE.CylinderGeometry(rTop, rBottom, h, this.detail === 'high' ? 14 : 8),
    )
  }

  cyl(rTop: number, rBottom: number, h: number, open = false) {
    return this.get(`cyl:${q(rTop)}:${q(rBottom)}:${q(h)}:${open}`, () =>
      new THREE.CylinderGeometry(rTop, rBottom, h, this.seg, 1, open),
    )
  }

  sphere(r: number) {
    return this.get(`sph:${q(r)}`, () =>
      new THREE.SphereGeometry(r, this.seg, Math.round(this.seg * 0.66)),
    )
  }

  torus(r: number, tube: number, arc = Math.PI * 2) {
    return this.get(`tor:${q(r)}:${q(tube)}:${q(arc)}`, () =>
      new THREE.TorusGeometry(r, tube, 8, this.seg, arc),
    )
  }

  /** Lathe from a profile of [radius, y] points (named so it caches). */
  lathe(name: string, profile: Array<[number, number]>) {
    return this.get(`lathe:${name}`, () => {
      const g = new THREE.LatheGeometry(
        profile.map(([x, y]) => new THREE.Vector2(x, y)),
        this.detail === 'high' ? 40 : 16,
      )
      g.computeVertexNormals()
      return g
    })
  }

  /** Half-round flute, axis along Y, flat side facing -Z. */
  flute(r: number, h: number) {
    return this.get(`flute:${q(r)}:${q(h)}`, () => {
      const g = new THREE.CylinderGeometry(r, r, h, this.detail === 'high' ? 10 : 6, 1, false, -Math.PI / 2, Math.PI)
      return g
    })
  }

  foliage(kind: FoliageKind) {
    return this.get(`fol:${kind}`, () => foliageGeometry(kind, this.detail))
  }

  books(width: number, seed = 1) {
    return this.get(`books:${q(width)}:${seed}`, () => booksGeometry(width, seed))
  }

  curtain(w: number, h: number) {
    return this.get(`cur:${q(w)}:${q(h)}`, () => curtainGeometry(w, h, this.detail))
  }

  /** A run of half-round flutes across `width`, bulging toward +Z. One draw. */
  flutes(width: number, h: number, r = 0.016) {
    return this.get(`flutes:${q(width)}:${q(h)}:${q(r)}`, () => {
      const pitch = r * 2 + 0.002
      const n = Math.max(1, Math.floor(width / pitch))
      const start = -((n - 1) * pitch) / 2
      const seg = this.detail === 'high' ? 10 : 5
      const parts: THREE.BufferGeometry[] = []
      for (let i = 0; i < n; i += 1) {
        const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true, -Math.PI / 2, Math.PI)
        g.translate(start + i * pitch, 0, 0)
        parts.push(g)
      }
      const merged = mergeGeometries(parts, false) ?? new THREE.BufferGeometry()
      parts.forEach((p) => p.dispose())
      return merged
    })
  }

  /** Knotted fringe for both short ends of a rug of width `w` (X) and depth `d`. */
  fringe(w: number, d: number) {
    return this.get(`fringe:${q(w)}:${q(d)}`, () => {
      const parts: THREE.BufferGeometry[] = []
      const len = 0.07
      const n = Math.floor((d - 0.04) / 0.022)
      for (const side of [-1, 1]) {
        for (let i = 0; i < n; i += 1) {
          const z = -d / 2 + 0.02 + i * 0.022 + 0.011
          const g = new THREE.BoxGeometry(len, 0.004, 0.006)
          g.translate(side * (w / 2 + len / 2 - 0.004), 0.002, z)
          parts.push(g)
        }
      }
      const merged = mergeGeometries(parts, false) ?? new THREE.BufferGeometry()
      parts.forEach((p) => p.dispose())
      return merged
    })
  }

  plane() {
    return this.get('plane', () => new THREE.PlaneGeometry(1, 1))
  }

  box() {
    return this.get('box', () => new THREE.BoxGeometry(1, 1, 1))
  }

  dispose() {
    this.map.forEach((g) => g.dispose())
    this.map.clear()
  }
}
