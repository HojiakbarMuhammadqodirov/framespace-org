/**
 * The room-builder scene model (brief §7).
 *
 * Everything is metres, in a single room-local coordinate system whose origin
 * sits at the room's minimum corner: x grows east, z grows south, y is up.
 * Keeping the origin at a corner (rather than the centre) means dragging the
 * east wall changes `width` and nothing else moves — a centred origin makes
 * every wall drag translate the whole room, which reads as a bug.
 */

export interface Vec2 {
  x: number
  z: number
}

export type RoomShape = 'rect' | 'l' | 'studio'

export interface Room {
  shape: RoomShape
  /** East–west extent. */
  width: number
  /** North–south extent. */
  depth: number
  /** Floor to ceiling. */
  height: number
  /** L-shape only: the bite taken out of the south-east corner. */
  notchW: number
  notchD: number
}

/**
 * Stable wall identities rather than array indices, so a fixture stays on "the
 * east wall" when the footprint is re-derived after a resize.
 */
export type WallId = 'north' | 'east' | 'south' | 'west' | 'notchS' | 'notchE' | 'partition'

/** How a drag along a wall's outward normal edits the room. */
export interface WallHandle {
  dim: 'width' | 'depth' | 'notchW' | 'notchD'
  /** newValue = old + gain * metresDraggedOutward */
  gain: 1 | -1
  /** Min-anchored walls carry the contents with them, so nothing teleports. */
  shiftAxis: 'x' | 'z' | null
}

export interface Wall {
  id: WallId
  a: Vec2
  b: Vec2
  mid: Vec2
  /** Unit vector a → b. */
  dx: number
  dz: number
  /** Unit outward normal (points away from the floor area). */
  nx: number
  nz: number
  length: number
  /** Rotation about Y that aligns a box's local +X with a → b. */
  angle: number
  handle: WallHandle | null
  /** A partition standing inside the floor area rather than enclosing it. */
  interior: boolean
}

export type FixtureKind = 'window' | 'door' | 'radiator' | 'socket'

export interface Fixture {
  id: string
  kind: FixtureKind
  wall: WallId
  /** Centre offset in metres measured from the wall's `a` end. */
  t: number
}

/** Finish applied to a placed piece. Labels are translated, values are not. */
export type MaterialKey =
  | 'oak'
  | 'walnut'
  | 'ink'
  | 'linen'
  | 'sand'
  | 'clay'
  | 'olive'
  | 'terracotta'

export interface Item {
  id: string
  catalogId: string
  /** Centre of the footprint, room-local metres. */
  x: number
  z: number
  /** Yaw in radians. 0 faces south (+z), matching a piece against the north wall. */
  rotation: number
  material: MaterialKey
}

export type LightingPreset = 'morning' | 'afternoon' | 'evening' | 'lamps'

export interface Scene {
  room: Room
  fixtures: Fixture[]
  items: Item[]
  lighting: LightingPreset
  /** Chosen budget ceiling, UZS. */
  budget: number
}

export type SelectionKind = 'item' | 'fixture' | 'wall'

export interface Selection {
  kind: SelectionKind
  id: string
}

export type ViewMode = 'plan' | 'perspective'

/** What the pointer is currently pushing around. */
export type Drag =
  | { kind: 'item'; id: string; grabX: number; grabZ: number }
  | { kind: 'rotate'; id: string }
  | { kind: 'fixture'; id: string }
  /** `base` is the scene as it stood when the drag started: every move during
   *  the drag is computed from it, never from the previous frame, so a wall
   *  drag cannot accumulate rounding into a drift. */
  | { kind: 'wall'; id: WallId; origin: Vec2; base: Scene }

/** Screen point → floor point, registered by the scene for HTML drop targets. */
export type FloorPicker = (clientX: number, clientY: number) => Vec2 | null
