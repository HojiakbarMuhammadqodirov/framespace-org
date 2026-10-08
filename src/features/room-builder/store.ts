/**
 * Editor state: one scene, a past and a future.
 *
 * History is snapshot-based rather than command-based. A scene is a few hundred
 * numbers, so cloning one costs nothing measurable, and snapshots cannot drift
 * out of sync with the model the way inverse commands do.
 *
 * Drags remember the scene at `beginDrag` but only push it onto the past once
 * the first real change lands, so dragging a sofa across the room is a single
 * undo, not four hundred, and a tap that merely selects a piece is no undo at
 * all.
 *
 * The scene (and only the scene) is persisted per room under
 * `framespace.room.<id>`. Writes are debounced and every storage call is
 * wrapped: private mode or a full quota must never take the editor down.
 */
import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import { entryFor, MATERIAL_KEYS } from './catalog'
import {
  GRID,
  WALL_MAGNET,
  boxesOverlap,
  buildWalls,
  clamp,
  clampFixtureT,
  containPoint,
  findWall,
  itemBox,
  nearestWall,
  nextId,
  normaliseRoom,
  ROOM_LIMITS,
  snap,
  SHAPE_PRESETS,
  wallPoint,
} from './geometry'
import { detectQuality, type QualityTier } from './quality'
import type {
  Drag,
  Fixture,
  FixtureKind,
  FloorPicker,
  Item,
  LightingPreset,
  MaterialKey,
  Room,
  RoomShape,
  Scene,
  Selection,
  Vec2,
  ViewMode,
  Wall,
  WallId,
} from './types'

const HISTORY_LIMIT = 60

/** 18 mln UZS ≈ a modest one-room refit. A real default beats an empty field. */
export const DEFAULT_BUDGET = 18_000_000

export const BUDGET_PRESETS = [9_000_000, 18_000_000, 35_000_000, 70_000_000]

function initialScene(): Scene {
  const room = { ...SHAPE_PRESETS.rect }
  return {
    room,
    // A window and a door so the room is a room, not a box, on first paint.
    fixtures: [
      { id: nextId('fx'), kind: 'window', wall: 'north', t: room.width / 2 },
      { id: nextId('fx'), kind: 'door', wall: 'west', t: room.depth / 2 },
    ],
    items: [],
    lighting: 'afternoon',
    budget: DEFAULT_BUDGET,
  }
}

/** Same content, compared cheaply. Only used until a drag has recorded. */
function sameScene(a: Scene, b: Scene): boolean {
  return (
    JSON.stringify([a.room, a.items, a.fixtures]) === JSON.stringify([b.room, b.items, b.fixtures])
  )
}

function cloneScene(scene: Scene): Scene {
  return {
    room: { ...scene.room },
    fixtures: scene.fixtures.map((f) => ({ ...f })),
    items: scene.items.map((i) => ({ ...i })),
    lighting: scene.lighting,
    budget: scene.budget,
  }
}

export interface BuilderState {
  scene: Scene
  past: Scene[]
  future: Scene[]
  view: ViewMode
  selection: Selection | null
  drag: Drag | null
  quality: QualityTier
  /** Registered by the scene so HTML drop targets can hit the floor plane. */
  picker: FloorPicker | null
  /** True while the generate sheet is open. */
  generateOpen: boolean
  /** The room this scene is persisted under, once `load` has run. */
  roomId: string | null

  walls: () => Wall[]
  selectedItem: () => Item | null
  selectedFixture: () => Fixture | null

  setView: (view: ViewMode) => void
  select: (selection: Selection | null) => void
  setPicker: (picker: FloorPicker | null) => void
  setQuality: (tier: QualityTier) => void
  openGenerate: (open: boolean) => void
  /** Switches persistence to `framespace.room.<id>` and restores that scene. */
  load: (id: string) => void

  applyPreset: (shape: RoomShape) => void
  setRoom: (patch: Partial<Room>, record?: boolean) => void
  resizeByWall: (wallId: WallId, metresOutward: number, base: Scene) => void

  addItem: (catalogId: string, at?: Vec2) => string
  moveItem: (id: string, x: number, z: number, magnet?: boolean) => void
  rotateItem: (id: string, rotation: number) => void
  /** Turns the selected piece by `step` radians, snapped to 15° — one undo step. */
  rotateSelected: (step: number) => void
  removeItem: (id: string) => void
  setItemMaterial: (id: string, material: MaterialKey) => void
  cycleItemMaterial: (id: string) => void
  duplicateSelected: () => void

  addFixture: (kind: FixtureKind, at?: Vec2) => string
  moveFixtureTo: (id: string, at: Vec2) => void
  setFixtureOffset: (id: string, t: number) => void

  nudge: (dx: number, dz: number) => void
  removeSelected: () => void

  setLighting: (preset: LightingPreset) => void
  setBudget: (budget: number) => void

  /** Pushes an undo step without changing anything, so a run of small edits
   *  (typing into a dimension field) collapses into one. */
  snapshot: () => void
  beginDrag: (drag: Drag) => void
  endDrag: () => void

  undo: () => void
  redo: () => void
  reset: () => void
}

export const useBuilder = create<BuilderState>()(
  persist(
    (set, get) => {
      /**
       * The scene as it stood when the current drag began. It joins the past only
       * once the drag actually changes something.
       */
      let dragStart: { scene: Scene; recorded: boolean } | null = null
      /** Last keyboard nudge; a held arrow key collapses into one undo step. */
      let nudgeAt = 0
      let nudgeId = ''

      /** Applies a change to the scene, optionally recording an undo step. */
      function mutate(updater: (scene: Scene) => Scene, record = true) {
        const state = get()
        const next = updater(cloneScene(state.scene))
        set({
          scene: next,
          past: record ? [...state.past, state.scene].slice(-HISTORY_LIMIT) : state.past,
          future: record ? [] : state.future,
        })
      }

      /**
       * Continuous edits (pointer drags, typed values). Never records on its own;
       * inside a drag, the first change that really moves something pushes the
       * drag's start scene and clears the redo stack.
       */
      function mutateLive(updater: (scene: Scene) => Scene) {
        const state = get()
        const next = updater(cloneScene(state.scene))
        if (dragStart && !dragStart.recorded) {
          if (sameScene(next, state.scene)) return
          dragStart.recorded = true
          set({
            scene: next,
            past: [...state.past, dragStart.scene].slice(-HISTORY_LIMIT),
            future: [],
          })
          return
        }
        set({ scene: next })
      }

      /** Snapshot without changing anything — used before a run of small edits. */
      function record() {
        const state = get()
        // Focusing a field twice, or tapping a stepper that changes nothing,
        // must not leave empty steps on the undo stack.
        if (state.past[state.past.length - 1] === state.scene) return
        set({ past: [...state.past, state.scene].slice(-HISTORY_LIMIT), future: [] })
      }

      return {
        scene: initialScene(),
        past: [],
        future: [],
        view: 'plan',
        selection: null,
        drag: null,
        quality: detectQuality(),
        picker: null,
        generateOpen: false,
        roomId: null,

        walls: () => buildWalls(get().scene.room),
        selectedItem: () => {
          const { selection, scene } = get()
          if (selection?.kind !== 'item') return null
          return scene.items.find((i) => i.id === selection.id) ?? null
        },
        selectedFixture: () => {
          const { selection, scene } = get()
          if (selection?.kind !== 'fixture') return null
          return scene.fixtures.find((f) => f.id === selection.id) ?? null
        },

        setView: (view) => set({ view }),
        select: (selection) => set({ selection }),
        setPicker: (picker) => set({ picker }),
        setQuality: (quality) => set({ quality }),
        openGenerate: (generateOpen) => set({ generateOpen }),

        load: (id) => {
          if (get().roomId === id) return
          dragStart = null
          nudgeAt = 0
          // Point persistence at the new key *before* touching state: any write
          // queued under the previous key would otherwise carry this room's
          // placeholder scene into it and overwrite the saved one.
          useBuilder.persist.setOptions({ name: roomKey(id) })
          void useBuilder.persist.rehydrate()
          set({ roomId: id, selection: null, drag: null })
        },

        applyPreset: (shape) =>
          mutate((scene) => {
            const room = { ...SHAPE_PRESETS[shape] }
            const walls = buildWalls(room)
            return {
              ...scene,
              room,
              // Fixtures survive a shape change by re-clamping onto their own wall;
              // a fixture whose wall no longer exists moves to the north wall.
              fixtures: scene.fixtures.map((fixture) => {
                const wall = findWall(walls, fixture.wall) ?? walls[0]
                return { ...fixture, wall: wall.id, t: clampFixtureT(fixture.kind, wall, fixture.t) }
              }),
              // Nothing is thrown away on a shape change: every piece is pulled
              // back inside the new outline instead.
              items: scene.items.map((item) => place(item, room, false)),
            }
          }),

        setRoom: (patch, rec = true) =>
          mutate((scene) => {
            const room = normaliseRoom({ ...scene.room, ...patch })
            return { ...scene, room, ...reflow(scene, room) }
          }, rec),

        resizeByWall: (wallId, metresOutward, base) => {
          const wall = findWall(buildWalls(base.room), wallId)
          if (!wall?.handle) return
          const { dim, gain, shiftAxis } = wall.handle
          const delta = snap(metresOutward * gain)
          const limits = dim === 'width' || dim === 'depth' ? ROOM_LIMITS[dim] : ([0.6, 40] as const)
          const target = clamp(base.room[dim] + delta, limits[0], limits[1])
          const applied = target - base.room[dim]
          if (get().scene.room[dim] === target) return

          mutateLive((scene) => {
            const room = normaliseRoom({ ...base.room, [dim]: target })
            // Min-anchored walls carry the contents: the origin is pinned to that
            // corner, so growing the room there would otherwise slide every piece.
            const moved = shiftAxis
              ? base.items.map((item) => ({ ...item, [shiftAxis]: item[shiftAxis] + applied }))
              : base.items
            return {
              ...scene,
              room,
              items: moved,
              ...reflow({ ...base, items: moved }, room),
            }
          })
        },

        addItem: (catalogId, at) => {
          const { scene } = get()
          const entry = entryFor(catalogId)
          const id = nextId('it')
          const base: Item = {
            id,
            catalogId,
            x: at?.x ?? scene.room.width / 2,
            z: at?.z ?? scene.room.depth / 2,
            rotation: 0,
            material: entry.material,
          }
          // A drop lands where it was dropped; a tap looks for the nearest free
          // floor so ten taps do not stack ten pieces on one spot.
          const placed = at
            ? place(base, scene.room, true)
            : freeSpot(place(base, scene.room, false), scene)
          mutate((next) => ({ ...next, items: [...next.items, placed] }))
          set({ selection: { kind: 'item', id } })
          return id
        },

        moveItem: (id, x, z, magnet = true) =>
          mutateLive((scene) => ({
            ...scene,
            items: scene.items.map((item) =>
              item.id === id ? place({ ...item, x, z }, scene.room, magnet) : item
            ),
          })),

        rotateItem: (id, rotation) =>
          mutateLive((scene) => ({
            ...scene,
            items: scene.items.map((item) =>
              item.id === id ? place({ ...item, rotation }, scene.room, false) : item
            ),
          })),

        rotateSelected: (step) => {
          const item = get().selectedItem()
          if (!item) return
          const detent = Math.PI / 12
          const rotation = Math.round((item.rotation + step) / detent) * detent
          mutate((scene) => ({
            ...scene,
            items: scene.items.map((i) =>
              i.id === item.id ? place({ ...i, rotation }, scene.room, false) : i
            ),
          }))
        },

        removeItem: (id) => {
          const { selection } = get()
          mutate((scene) => ({ ...scene, items: scene.items.filter((i) => i.id !== id) }))
          if (selection?.kind === 'item' && selection.id === id) set({ selection: null })
        },

        setItemMaterial: (id, material) =>
          mutate((scene) => ({
            ...scene,
            items: scene.items.map((item) => (item.id === id ? { ...item, material } : item)),
          })),

        cycleItemMaterial: (id) =>
          mutate((scene) => ({
            ...scene,
            items: scene.items.map((item) => {
              if (item.id !== id) return item
              const at = MATERIAL_KEYS.indexOf(item.material)
              return { ...item, material: MATERIAL_KEYS[(at + 1) % MATERIAL_KEYS.length] }
            }),
          })),

        duplicateSelected: () => {
          const item = get().selectedItem()
          if (!item) return
          const id = nextId('it')
          mutate((scene) => ({
            ...scene,
            items: [
              ...scene.items,
              freeSpot(
                place({ ...item, id, x: item.x + 0.4, z: item.z + 0.4 }, scene.room, false),
                scene
              ),
            ],
          }))
          set({ selection: { kind: 'item', id } })
        },

        addFixture: (kind, at) => {
          const { scene } = get()
          const walls = buildWalls(scene.room)
          const target = at ? nearestWall(walls, at) : { wall: walls[0], t: walls[0].length / 2 }
          const id = nextId('fx')
          mutate((next) => ({
            ...next,
            fixtures: [
              ...next.fixtures,
              { id, kind, wall: target.wall.id, t: clampFixtureT(kind, target.wall, target.t) },
            ],
          }))
          set({ selection: { kind: 'fixture', id } })
          return id
        },

        moveFixtureTo: (id, at) =>
          mutateLive((scene) => {
            const walls = buildWalls(scene.room)
            return {
              ...scene,
              fixtures: scene.fixtures.map((fixture) => {
                if (fixture.id !== id) return fixture
                const hit = nearestWall(walls, at)
                return {
                  ...fixture,
                  wall: hit.wall.id,
                  t: clampFixtureT(fixture.kind, hit.wall, hit.t),
                }
              }),
            }
          }),

        setFixtureOffset: (id, t) =>
          mutate((scene) => {
            const walls = buildWalls(scene.room)
            return {
              ...scene,
              fixtures: scene.fixtures.map((fixture) => {
                if (fixture.id !== id) return fixture
                const wall = findWall(walls, fixture.wall)
                return wall ? { ...fixture, t: clampFixtureT(fixture.kind, wall, t) } : fixture
              }),
            }
          }, false),

        nudge: (dx, dz) => {
          const { selection, scene } = get()
          if (!selection) return
          if (selection.kind === 'item') {
            const item = scene.items.find((i) => i.id === selection.id)
            if (!item) return
            const now = Date.now()
            const repeat = nudgeId === item.id && now - nudgeAt < 700
            nudgeAt = now
            nudgeId = item.id
            mutate((next) => ({
              ...next,
              items: next.items.map((i) =>
                i.id === item.id ? place({ ...i, x: i.x + dx, z: i.z + dz }, next.room, false) : i
              ),
            }), !repeat)
            return
          }
          if (selection.kind === 'fixture') {
            mutate((next) => {
              const walls = buildWalls(next.room)
              return {
                ...next,
                fixtures: next.fixtures.map((fixture) => {
                  if (fixture.id !== selection.id) return fixture
                  const wall = findWall(walls, fixture.wall)
                  if (!wall) return fixture
                  // Along-wall travel: whichever arrow points along this wall wins.
                  const along = dx * wall.dx + dz * wall.dz
                  return { ...fixture, t: clampFixtureT(fixture.kind, wall, fixture.t + along) }
                }),
              }
            })
          }
        },

        removeSelected: () => {
          const { selection } = get()
          // Walls are part of the room, not deletable objects.
          if (!selection || selection.kind === 'wall') return
          mutate((scene) => ({
            ...scene,
            items: scene.items.filter((i) => selection.kind !== 'item' || i.id !== selection.id),
            fixtures: scene.fixtures.filter(
              (f) => selection.kind !== 'fixture' || f.id !== selection.id
            ),
          }))
          set({ selection: null })
        },

        setLighting: (lighting) => mutate((scene) => ({ ...scene, lighting })),
        setBudget: (budget) =>
          mutate((scene) => ({ ...scene, budget: Math.max(0, Math.round(budget)) })),

        snapshot: () => record(),
        beginDrag: (drag) => {
          dragStart = { scene: get().scene, recorded: false }
          set({ drag })
        },
        endDrag: () => {
          const { drag, scene } = get()
          if (!drag) return
          const moved = dragStart?.recorded ?? false
          dragStart = null
          // Land the piece on the grid only once the pointer is up: snapping mid-drag
          // makes the piece stutter under the finger. A press that never moved the
          // piece leaves it exactly where it was.
          if (moved && drag.kind === 'item') {
            set({
              scene: {
                ...scene,
                items: scene.items.map((item) =>
                  item.id === drag.id
                    ? place({ ...item, x: snap(item.x), z: snap(item.z) }, scene.room, true)
                    : item
                ),
              },
            })
          }
          set({ drag: null })
        },

        undo: () => {
          const { past, future, scene } = get()
          if (!past.length) return
          set({
            scene: past[past.length - 1],
            past: past.slice(0, -1),
            future: [scene, ...future].slice(0, HISTORY_LIMIT),
            selection: null,
          })
        },

        redo: () => {
          const { past, future, scene } = get()
          if (!future.length) return
          set({
            scene: future[0],
            past: [...past, scene].slice(-HISTORY_LIMIT),
            future: future.slice(1),
            selection: null,
          })
        },

        // Starting over is undoable: it is one keystroke away from losing an hour
        // of work, so it goes on the history stack like everything else.
        reset: () => {
          record()
          dragStart = null
          set({ scene: initialScene(), selection: null, drag: null })
        },
      }
    },
    {
      name: roomKey('draft'),
      storage: createSafeStorage<PersistedBuilder>(),
      partialize: (state): PersistedBuilder => ({ scene: state.scene }),
      // A room with nothing stored starts fresh rather than inheriting the
      // previous room's scene; history never crosses rooms.
      merge: (persisted, current) => {
        const stored = (persisted as Partial<PersistedBuilder> | undefined)?.scene
        return {
          ...current,
          scene: isScene(stored) ? stored : initialScene(),
          past: [],
          future: [],
          selection: null,
          drag: null,
        }
      },
      // `load(id)` picks the key; hydrating the placeholder would be wasted work.
      skipHydration: true,
      version: 1,
    }
  )
)

/* ------------------------------------------------------------- persistence */

interface PersistedBuilder {
  scene: Scene
}

function roomKey(id: string): string {
  return `framespace.room.${id}`
}

function isScene(value: unknown): value is Scene {
  if (!value || typeof value !== 'object') return false
  const scene = value as Partial<Scene>
  return (
    !!scene.room &&
    typeof scene.room === 'object' &&
    Array.isArray(scene.items) &&
    Array.isArray(scene.fixtures) &&
    typeof scene.budget === 'number'
  )
}

/** When the last write actually reached storage. Drives the quiet "Saved" pill. */
export const useBuilderSaved = create<{ savedAt: number }>(() => ({ savedAt: 0 }))

const WRITE_DEBOUNCE_MS = 600

/**
 * localStorage behind a debounce and a try/catch. Persist calls `setItem` on
 * every state change (selection, view, drags); only a changed scene, settled
 * for a moment, is written.
 */
function createSafeStorage<S>(): PersistStorage<S> {
  const pending = new Map<string, ReturnType<typeof setTimeout>>()
  const written = new Map<string, string>()

  return {
    getItem: (name) => {
      let value: string | null = null
      try {
        value = window.localStorage.getItem(name)
      } catch {
        return null
      }
      if (value === null) return null
      written.set(name, value)
      try {
        return JSON.parse(value) as StorageValue<S>
      } catch {
        return null
      }
    },
    setItem: (name, stored) => {
      const value = JSON.stringify(stored)
      const timer = pending.get(name)
      if (timer) clearTimeout(timer)
      pending.set(
        name,
        setTimeout(() => {
          pending.delete(name)
          if (written.get(name) === value) return
          // The very first write of a brand-new room is just its starting
          // scene; announcing "Saved" before any edit would be noise.
          const quiet = !written.has(name)
          try {
            window.localStorage.setItem(name, value)
            written.set(name, value)
            if (!quiet) useBuilderSaved.setState({ savedAt: Date.now() })
          } catch {
            // Quota or private mode: keep editing, just without the safety net.
          }
        }, WRITE_DEBOUNCE_MS)
      )
    },
    removeItem: (name) => {
      try {
        window.localStorage.removeItem(name)
      } catch {
        /* ignore */
      }
    },
  }
}

/* ----------------------------------------------------------------- helpers */

/**
 * Keeps a piece inside the room, and — for pieces that want a wall — rotates it
 * to face into the room with its back flush once it is close enough.
 */
function place(item: Item, room: Room, magnet: boolean): Item {
  const entry = entryFor(item.catalogId)
  const walls = buildWalls(room)
  let { x, z, rotation } = item

  if (magnet && entry.hugsWall) {
    const hit = nearestWall(walls, { x, z })
    if (hit.distance < WALL_MAGNET) {
      const wall = hit.wall
      // Face the inward normal: the back of the piece ends up on the wall.
      rotation = Math.atan2(-wall.nx, -wall.nz)
      const t = clamp(hit.t, entry.w / 2, Math.max(entry.w / 2, wall.length - entry.w / 2))
      const on = wallPoint(wall, t)
      const back = entry.d / 2 + 0.01
      x = on.x - wall.nx * back
      z = on.z - wall.nz * back
    }
  }

  // The whole footprint stays inside the room and out of the L notch.
  const inside = containPoint(x, z, entry, rotation, room)
  return { ...item, rotation, x: inside.x, z: inside.z }
}

/**
 * Nearest spot to `item` where it overlaps nothing, searched on a widening
 * ring of grid points. Falls back to where it was if the room is full.
 */
function freeSpot(item: Item, scene: Scene): Item {
  const entry = entryFor(item.catalogId)
  if (entry.kind === 'rug') return item
  const others = scene.items
    .filter((other) => other.id !== item.id && entryFor(other.catalogId).kind !== 'rug')
    .map((other) => itemBox(other, entryFor(other.catalogId)))
  const clear = (candidate: Item) =>
    !others.some((box) => boxesOverlap(itemBox(candidate, entry), box, 0.04))
  if (clear(item)) return item
  const step = 0.2
  for (let ring = 1; ring <= 30; ring += 1) {
    for (let i = -ring; i <= ring; i += 1) {
      for (const [dx, dz] of [
        [i, -ring],
        [i, ring],
        [-ring, i],
        [ring, i],
      ]) {
        const moved = place(
          { ...item, x: item.x + dx * step, z: item.z + dz * step },
          scene.room,
          false
        )
        if (clear(moved)) return moved
      }
    }
  }
  return item
}

/** After the room changes shape, pull everything back inside it. */
function reflow(scene: Scene, room: Room): Pick<Scene, 'items' | 'fixtures'> {
  const walls = buildWalls(room)
  return {
    items: scene.items.map((item) => place(item, room, false)),
    fixtures: scene.fixtures.map((fixture) => {
      const wall = findWall(walls, fixture.wall) ?? walls[0]
      return { ...fixture, wall: wall.id, t: clampFixtureT(fixture.kind, wall, fixture.t) }
    }),
  }
}

/** Ids of every piece that overlaps another. Recomputed from the item list. */
export function findCollisions(items: Item[]): Set<string> {
  const hits = new Set<string>()
  const boxes = items.map((item) => {
    const entry = entryFor(item.catalogId)
    return { item, entry, box: itemBox(item, entry) }
  })
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      // A rug is meant to have furniture standing on it, and so is a plant in a
      // corner beside a shelf — flat pieces never raise a collision.
      if (boxes[i].entry.kind === 'rug' || boxes[j].entry.kind === 'rug') continue
      if (boxesOverlap(boxes[i].box, boxes[j].box)) {
        hits.add(boxes[i].item.id)
        hits.add(boxes[j].item.id)
      }
    }
  }
  return hits
}

export const NUDGE_STEP = GRID
