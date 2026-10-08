/**
 * Plan geometry: footprints, walls, snapping and collision.
 *
 * Pure functions only — no React, no three. The scene and the panels both read
 * from here so a dimension label and a wall mesh can never disagree.
 */
import type { FixtureKind, Item, Room, RoomShape, Vec2, Wall, WallId } from './types'

/** Grid the whole editor snaps to. 10 cm is what a tape measure actually gives. */
export const GRID = 0.1
/** Wall thickness used for the drawn shell; fixtures sit on the inner face. */
export const WALL_T = 0.12
/** A piece closer than this to a wall is treated as meant to be against it. */
export const WALL_MAGNET = 0.45

export const ROOM_LIMITS = {
  width: [2, 12] as const,
  depth: [2, 12] as const,
  height: [2.2, 4.2] as const,
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function snap(v: number, step: number = GRID): number {
  return Math.round(v / step) * step
}

/** Kills the −0 and the 0.30000000000000004 that shows up in a label. */
export function tidy(v: number): number {
  return Math.round(v * 1000) / 1000 + 0
}

/* ------------------------------------------------------------------ shapes */

export const SHAPE_PRESETS: Record<RoomShape, Room> = {
  rect: { shape: 'rect', width: 4, depth: 3, height: 2.7, notchW: 1.4, notchD: 1.2 },
  l: { shape: 'l', width: 5.2, depth: 4.4, height: 2.8, notchW: 1.8, notchD: 1.6 },
  studio: { shape: 'studio', width: 6.2, depth: 3.6, height: 3, notchW: 1.4, notchD: 1.2 },
}

/** The studio's partition stands off the north wall at this fraction of width. */
const PARTITION_AT = 0.62

export function normaliseRoom(room: Room): Room {
  const width = clamp(snap(room.width), ROOM_LIMITS.width[0], ROOM_LIMITS.width[1])
  const depth = clamp(snap(room.depth), ROOM_LIMITS.depth[0], ROOM_LIMITS.depth[1])
  return {
    ...room,
    width,
    depth,
    height: clamp(snap(room.height, 0.05), ROOM_LIMITS.height[0], ROOM_LIMITS.height[1]),
    notchW: clamp(snap(room.notchW), 0.6, Math.max(0.6, width - 1.2)),
    notchD: clamp(snap(room.notchD), 0.6, Math.max(0.6, depth - 1.2)),
  }
}

/** Closed floor outline, counter-clockwise when read on a plan. */
export function footprint(room: Room): Vec2[] {
  const { width: w, depth: d } = room
  if (room.shape === 'l') {
    const nw = clamp(room.notchW, 0.6, w - 1.2)
    const nd = clamp(room.notchD, 0.6, d - 1.2)
    return [
      { x: 0, z: 0 },
      { x: w, z: 0 },
      { x: w, z: d - nd },
      { x: w - nw, z: d - nd },
      { x: w - nw, z: d },
      { x: 0, z: d },
    ]
  }
  return [
    { x: 0, z: 0 },
    { x: w, z: 0 },
    { x: w, z: d },
    { x: 0, z: d },
  ]
}

function makeWall(
  id: WallId,
  a: Vec2,
  b: Vec2,
  n: Vec2,
  handle: Wall['handle'],
  interior = false
): Wall {
  const vx = b.x - a.x
  const vz = b.z - a.z
  const length = Math.hypot(vx, vz) || 0.0001
  return {
    id,
    a,
    b,
    mid: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 },
    dx: vx / length,
    dz: vz / length,
    nx: n.x,
    nz: n.z,
    length,
    // Three's Y rotation turns +X toward −Z, hence the negated z component.
    angle: Math.atan2(-vz, vx),
    handle,
    interior,
  }
}

/**
 * Walls in draw order with their drag semantics baked in.
 *
 * North and west are min-anchored: dragging them outward grows the room *and*
 * carries the furniture, because the coordinate origin is pinned to that corner.
 */
export function buildWalls(room: Room): Wall[] {
  const { width: w, depth: d } = room
  const out: Wall[] = []

  if (room.shape === 'l') {
    const nw = clamp(room.notchW, 0.6, w - 1.2)
    const nd = clamp(room.notchD, 0.6, d - 1.2)
    out.push(
      makeWall('north', { x: 0, z: 0 }, { x: w, z: 0 }, { x: 0, z: -1 }, {
        dim: 'depth',
        gain: 1,
        shiftAxis: 'z',
      }),
      makeWall('east', { x: w, z: 0 }, { x: w, z: d - nd }, { x: 1, z: 0 }, {
        dim: 'width',
        gain: 1,
        shiftAxis: null,
      }),
      makeWall('notchS', { x: w, z: d - nd }, { x: w - nw, z: d - nd }, { x: 0, z: 1 }, {
        dim: 'notchD',
        gain: -1,
        shiftAxis: null,
      }),
      makeWall('notchE', { x: w - nw, z: d - nd }, { x: w - nw, z: d }, { x: -1, z: 0 }, {
        dim: 'notchW',
        gain: 1,
        shiftAxis: null,
      }),
      makeWall('south', { x: w - nw, z: d }, { x: 0, z: d }, { x: 0, z: 1 }, {
        dim: 'depth',
        gain: 1,
        shiftAxis: null,
      }),
      makeWall('west', { x: 0, z: d }, { x: 0, z: 0 }, { x: -1, z: 0 }, {
        dim: 'width',
        gain: 1,
        shiftAxis: 'x',
      })
    )
    return out
  }

  out.push(
    makeWall('north', { x: 0, z: 0 }, { x: w, z: 0 }, { x: 0, z: -1 }, {
      dim: 'depth',
      gain: 1,
      shiftAxis: 'z',
    }),
    makeWall('east', { x: w, z: 0 }, { x: w, z: d }, { x: 1, z: 0 }, {
      dim: 'width',
      gain: 1,
      shiftAxis: null,
    }),
    makeWall('south', { x: w, z: d }, { x: 0, z: d }, { x: 0, z: 1 }, {
      dim: 'depth',
      gain: 1,
      shiftAxis: null,
    }),
    makeWall('west', { x: 0, z: d }, { x: 0, z: 0 }, { x: -1, z: 0 }, {
      dim: 'width',
      gain: 1,
      shiftAxis: 'x',
    })
  )

  if (room.shape === 'studio') {
    const px = snap(w * PARTITION_AT)
    const pl = Math.min(1.4, d * 0.45)
    out.push(
      makeWall('partition', { x: px, z: 0 }, { x: px, z: pl }, { x: 1, z: 0 }, null, true)
    )
  }

  return out
}

export function findWall(walls: Wall[], id: WallId): Wall | undefined {
  return walls.find((wall) => wall.id === id)
}

/** Point on a wall, `t` metres from its `a` end. */
export function wallPoint(wall: Wall, t: number): Vec2 {
  return { x: wall.a.x + wall.dx * t, z: wall.a.z + wall.dz * t }
}

/** Nearest wall to a floor point, with the clamped offset along it. */
export function nearestWall(walls: Wall[], p: Vec2): { wall: Wall; t: number; distance: number } {
  let best = { wall: walls[0], t: 0, distance: Infinity }
  for (const wall of walls) {
    const raw = (p.x - wall.a.x) * wall.dx + (p.z - wall.a.z) * wall.dz
    const t = clamp(raw, 0, wall.length)
    const at = wallPoint(wall, t)
    const distance = Math.hypot(p.x - at.x, p.z - at.z)
    if (distance < best.distance) best = { wall, t, distance }
  }
  return best
}

/* ---------------------------------------------------------------- fixtures */

export const FIXTURE_SIZE: Record<FixtureKind, { w: number; h: number; sill: number }> = {
  window: { w: 1.2, h: 1.4, sill: 0.85 },
  door: { w: 0.9, h: 2.1, sill: 0 },
  radiator: { w: 0.9, h: 0.55, sill: 0.14 },
  socket: { w: 0.09, h: 0.09, sill: 0.28 },
}

/** Keeps a fixture wholly on its wall, snapped to the grid. */
export function clampFixtureT(kind: FixtureKind, wall: Wall, t: number): number {
  const half = FIXTURE_SIZE[kind].w / 2 + 0.06
  if (wall.length <= half * 2) return wall.length / 2
  return clamp(snap(t), half, wall.length - half)
}

/* --------------------------------------------------------------- collision */

export interface Box2 {
  x: number
  z: number
  w: number
  d: number
  rotation: number
}

/**
 * Corners in the same handedness three.js uses for a Y rotation: local +X maps
 * to (cos, −sin) and local +Z to (sin, cos). Getting this backwards puts the
 * collision box at the mirror of the drawn piece, which only shows up at angles
 * that are not multiples of 90°.
 */
export function boxCorners(box: Box2): Vec2[] {
  const c = Math.cos(box.rotation)
  const s = Math.sin(box.rotation)
  const hw = box.w / 2
  const hd = box.d / 2
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([lx, lz]) => ({
    x: box.x + lx * c + lz * s,
    z: box.z - lx * s + lz * c,
  }))
}

function project(points: Vec2[], ax: number, az: number) {
  let min = Infinity
  let max = -Infinity
  for (const p of points) {
    const v = p.x * ax + p.z * az
    if (v < min) min = v
    if (v > max) max = v
  }
  return { min, max }
}

/**
 * Separating-axis test on two rotated footprints. A 2 cm slack stops two pieces
 * pushed deliberately flush against each other from screaming about it.
 */
export function boxesOverlap(a: Box2, b: Box2, slack = 0.02): boolean {
  const ca = boxCorners(a)
  const cb = boxCorners(b)
  const axes = [
    { x: Math.cos(a.rotation), z: -Math.sin(a.rotation) },
    { x: Math.sin(a.rotation), z: Math.cos(a.rotation) },
    { x: Math.cos(b.rotation), z: -Math.sin(b.rotation) },
    { x: Math.sin(b.rotation), z: Math.cos(b.rotation) },
  ]
  for (const axis of axes) {
    const pa = project(ca, axis.x, axis.z)
    const pb = project(cb, axis.x, axis.z)
    if (pa.max - slack <= pb.min || pb.max - slack <= pa.min) return false
  }
  return true
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    const hit =
      a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z || 1e-9) + a.x
    if (hit) inside = !inside
  }
  return inside
}

/* ----------------------------------------------------------------- metrics */

export function polygonArea(poly: Vec2[]): number {
  let sum = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    sum += (poly[j].x + poly[i].x) * (poly[j].z - poly[i].z)
  }
  return Math.abs(sum / 2)
}

export function polygonPerimeter(poly: Vec2[]): number {
  let sum = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    sum += Math.hypot(poly[i].x - poly[j].x, poly[i].z - poly[j].z)
  }
  return sum
}

/** Degrees clockwise from north, for the serialised payload. */
export function wallAzimuth(wall: Wall): number {
  const deg = (Math.atan2(wall.nx, -wall.nz) * 180) / Math.PI
  return Math.round((deg + 360) % 360)
}

/* ------------------------------------------------------------------- misc */

let seq = 0
export function nextId(prefix: string): string {
  seq += 1
  return `${prefix}-${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function itemBox(item: Item, size: { w: number; d: number }): Box2 {
  return { x: item.x, z: item.z, w: size.w, d: size.d, rotation: item.rotation }
}

/* ------------------------------------------------------------- containment */

/** Half extents of a rotated footprint's axis-aligned bounding box. */
export function halfExtents(size: { w: number; d: number }, rotation: number) {
  const c = Math.abs(Math.cos(rotation))
  const s = Math.abs(Math.sin(rotation))
  return {
    hx: (c * size.w + s * size.d) / 2,
    hz: (s * size.w + c * size.d) / 2,
  }
}

/**
 * Pulls a piece's whole footprint (not just its centre) inside the room, and
 * out of the L-shape's missing corner. A piece bigger than the room is centred
 * on that axis rather than flung against one wall.
 */
export function containPoint(
  x: number,
  z: number,
  size: { w: number; d: number },
  rotation: number,
  room: Room
): Vec2 {
  const { hx, hz } = halfExtents(size, rotation)
  const fit = (v: number, half: number, extent: number) =>
    half * 2 >= extent ? extent / 2 : clamp(v, half, extent - half)
  let nx = fit(x, hx, room.width)
  let nz = fit(z, hz, room.depth)

  if (room.shape === 'l') {
    const nw = clamp(room.notchW, 0.6, room.width - 1.2)
    const nd = clamp(room.notchD, 0.6, room.depth - 1.2)
    const notchX = room.width - nw
    const notchZ = room.depth - nd
    // Overlap of the piece's box with the notch rectangle.
    const overX = nx + hx - notchX
    const overZ = nz + hz - notchZ
    if (overX > 0.001 && overZ > 0.001) {
      // Leave along whichever axis costs the shorter move.
      const canX = notchX - hx >= hx - 0.001
      const canZ = notchZ - hz >= hz - 0.001
      if ((overX <= overZ && canX) || !canZ) nx = Math.max(hx, notchX - hx)
      else nz = Math.max(hz, notchZ - hz)
    }
  }
  return { x: nx, z: nz }
}
