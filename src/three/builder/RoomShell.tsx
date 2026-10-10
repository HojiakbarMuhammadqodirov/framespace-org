import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'

import { FIXTURE_SIZE, GRID, WALL_T, footprint } from '@/features/room-builder/geometry'
import { useBuilder } from '@/features/room-builder/store'
import type { Wall, WallId } from '@/features/room-builder/types'
import { DRAG_THRESHOLD_PX, armDrag } from './dragIntent'
import { useKit } from './kit'

/**
 * Floor, walls and the setting-out grid.
 *
 * Walls are boxes rather than planes so the top-down view reads as a plan —
 * an edge-on plane is invisible from above, and a plan with no wall thickness
 * looks like a wireframe, not a drawing. Walls standing between the camera and
 * the room drop out on their own each frame, which is what lets you orbit a
 * closed box without ever seeing the back of one.
 *
 * In plan, every wall that can move carries a grip pill and a wide invisible
 * grab strip: the wall itself is 12 cm, which is narrower than a fingertip.
 */

/** Swaps a derived geometry and disposes the one it replaces. */
function useDisposable<T extends THREE.BufferGeometry>(geometry: T): T {
  const previous = useRef<T | null>(null)
  if (previous.current && previous.current !== geometry) previous.current.dispose()
  previous.current = geometry
  return geometry
}

function FloorPlate() {
  const { mats } = useKit()
  const room = useBuilder((s) => s.scene.room)

  const geometry = useDisposable(
    useMemo(() => {
      const poly = footprint(room)
      const shape = new THREE.Shape()
      // Shapes are built in XY and laid down with a −90° X rotation, which maps
      // (x, y) → (x, −y) in world Z. Negating here puts the plan back the right
      // way round instead of mirrored.
      poly.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, -p.z) : shape.lineTo(p.x, -p.z)))
      shape.closePath()
      return new THREE.ShapeGeometry(shape)
    }, [room])
  )

  return (
    <mesh
      geometry={geometry}
      material={mats.floor}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onClick={(event: ThreeEvent<MouseEvent>) => {
        // Empty floor is the deselect target, the way it is in every editor —
        // but only for a tap. An orbit or a pan that ends over the floor is a
        // camera move, not a request to drop the selection.
        if (event.delta > DRAG_THRESHOLD_PX) return
        if (useBuilder.getState().drag) return
        // Click bubbles through everything under the pointer, so make sure the
        // floor really was the nearest thing hit (hidden walls do not count).
        const nearest = event.intersections.find(
          (hit) => hit.object.visible || hit.object.userData.hit
        )
        if (nearest && nearest.object !== event.object) return
        useBuilder.getState().select(null)
      }}
    />
  )
}

function SettingOutGrid() {
  const room = useBuilder((s) => s.scene.room)
  const view = useBuilder((s) => s.view)

  const geometry = useDisposable(
    useMemo(() => {
      const points: number[] = []
      const step = GRID * 5 // 50 cm — a tape measure, not graph paper
      for (let x = 0; x <= room.width + 1e-6; x += step) points.push(x, 0, 0, x, 0, room.depth)
      for (let z = 0; z <= room.depth + 1e-6; z += step) points.push(0, 0, z, room.width, 0, z)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
      return geo
    }, [room.width, room.depth])
  )

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#a67b5b', transparent: true, opacity: 0.22 }),
    []
  )

  return (
    <lineSegments
      geometry={geometry}
      material={material}
      position={[0, 0.006, 0]}
      visible={view === 'plan'}
    />
  )
}

/** Half-width of the plan-view grab strip: 0.6 m in all, a fingertip at any zoom. */
const STRIP = 0.6

/** One solid piece of a wall, in wall-local metres (s along a→b, y up). */
interface WallPiece {
  s0: number
  s1: number
  y0: number
  y1: number
}

/**
 * Splits a wall around its window openings: full-height piers between them,
 * and a spandrel below and a header above each one. Pure 1D bookkeeping on
 * every change — no CSG — so a wall drag stays cheap. Windows get a real
 * hole because that is what lets the sun and the garden in; doors stay a
 * closed leaf on the face.
 */
function splitWall(length: number, height: number, openings: { s0: number; s1: number; y0: number; y1: number }[]): WallPiece[] {
  const sorted = openings
    .map((o) => ({ ...o, s0: Math.max(0, o.s0), s1: Math.min(length, o.s1) }))
    .filter((o) => o.s1 - o.s0 > 0.05)
    .sort((a, b) => a.s0 - b.s0)
  // Overlapping windows merge into one opening.
  const merged: typeof sorted = []
  for (const o of sorted) {
    const last = merged[merged.length - 1]
    if (last && o.s0 <= last.s1) {
      last.s1 = Math.max(last.s1, o.s1)
      last.y0 = Math.min(last.y0, o.y0)
      last.y1 = Math.max(last.y1, o.y1)
    } else merged.push({ ...o })
  }
  const pieces: WallPiece[] = []
  let cursor = 0
  for (const o of merged) {
    if (o.s0 - cursor > 1e-3) pieces.push({ s0: cursor, s1: o.s0, y0: 0, y1: height })
    if (o.y0 > 1e-3) pieces.push({ s0: o.s0, s1: o.s1, y0: 0, y1: o.y0 })
    if (height - o.y1 > 1e-3) pieces.push({ s0: o.s0, s1: o.s1, y0: Math.min(o.y1, height), y1: height })
    cursor = o.s1
  }
  if (length - cursor > 1e-3) pieces.push({ s0: cursor, s1: length, y0: 0, y1: height })
  return pieces
}

function useWallPieces(wall: Wall, height: number): WallPiece[] {
  const fixtures = useBuilder((s) => s.scene.fixtures)
  return useMemo(() => {
    const size = FIXTURE_SIZE.window
    const openings = fixtures
      .filter((f) => f.kind === 'window' && f.wall === wall.id)
      .map((f) => ({ s0: f.t - size.w / 2, s1: f.t + size.w / 2, y0: size.sill, y1: size.sill + size.h }))
    return splitWall(wall.length, height, openings)
  }, [fixtures, wall.id, wall.length, height])
}

function pieceTransform(wall: Wall, p: WallPiece) {
  const s = (p.s0 + p.s1) / 2
  return {
    position: [
      wall.a.x + wall.dx * s + (wall.nx * WALL_T) / 2,
      (p.y0 + p.y1) / 2,
      wall.a.z + wall.dz * s + (wall.nz * WALL_T) / 2,
    ] as [number, number, number],
    rotation: [0, wall.angle, 0] as [number, number, number],
    scale: [p.s1 - p.s0, p.y1 - p.y0, WALL_T] as [number, number, number],
  }
}

const noRaycast = () => {}

function WallBox({
  wall,
  register,
}: {
  wall: Wall
  register: (id: WallId, group: THREE.Object3D | null) => void
}) {
  const { geo, mats } = useKit()
  const view = useBuilder((s) => s.view)
  const selection = useBuilder((s) => s.selection)
  const height = useBuilder((s) => s.scene.room.height)
  const solid = useRef<THREE.Group | null>(null)
  const pieces = useWallPieces(wall, height)

  const selected = selection?.kind === 'wall' && selection.id === wall.id
  const grabbable = view === 'plan' && Boolean(wall.handle)
  // In plan, Z runs up the screen: a wall lying along X moves up and down.
  const cursor = Math.abs(wall.dx) > Math.abs(wall.dz) ? 'ns-resize' : 'ew-resize'

  useEffect(() => () => void (document.body.style.cursor = ''), [])

  function onDown(event: ThreeEvent<PointerEvent>) {
    // A wall hidden because the camera stands behind it is not a target; let
    // the press fall through to whatever is visible underneath.
    if (solid.current && !solid.current.visible) return
    event.stopPropagation()
    const state = useBuilder.getState()
    state.select({ kind: 'wall', id: wall.id })
    if (!wall.handle || state.view !== 'plan') return
    const origin = { x: event.point.x, z: event.point.z }
    armDrag(event, () => {
      const now = useBuilder.getState()
      now.beginDrag({ kind: 'wall', id: wall.id, origin, base: now.scene })
    })
  }

  const centre: [number, number, number] = [
    wall.mid.x + (wall.nx * WALL_T) / 2,
    height / 2,
    wall.mid.z + (wall.nz * WALL_T) / 2,
  ]
  const material = selected && view === 'plan' ? mats.handle : mats.wall

  return (
    <group>
      {/* What the camera sees. It never casts: the stand-ins below do, so a
          wall hidden for the cut-away view still keeps the sun out. */}
      <group
        ref={(group) => {
          solid.current = group
          register(wall.id, group)
        }}
        onPointerDown={onDown}
        onPointerOver={grabbable ? () => void (document.body.style.cursor = cursor) : undefined}
        onPointerOut={grabbable ? () => void (document.body.style.cursor = '') : undefined}
      >
        {pieces.map((p, i) => (
          <mesh key={i} geometry={geo.box} material={material} {...pieceTransform(wall, p)} receiveShadow />
        ))}
      </group>
      {/* Shadow-only twins: invisible to the camera, solid to the sun. */}
      {pieces.map((p, i) => (
        <mesh
          key={`c${i}`}
          geometry={geo.box}
          material={mats.shadowCaster}
          {...pieceTransform(wall, p)}
          castShadow
          raycast={noRaycast}
        />
      ))}
      {grabbable && (
        <>
          {/* Invisible grab strip from the inner face outward, so a thumb does
              not have to land on 12 cm of wall. It never reaches into the
              room, where it would steal taps from pieces standing against it. */}
          <mesh
            geometry={geo.box}
            position={[
              wall.mid.x + (wall.nx * STRIP) / 2,
              height / 2,
              wall.mid.z + (wall.nz * STRIP) / 2,
            ]}
            rotation={[0, wall.angle, 0]}
            scale={[wall.length, height, STRIP]}
            visible={false}
            userData={{ hit: true }}
            onPointerDown={onDown}
            onPointerOver={() => void (document.body.style.cursor = cursor)}
            onPointerOut={() => void (document.body.style.cursor = '')}
          />
          {/* Grip pill at the midpoint: the visible promise that this pulls. */}
          <mesh
            geometry={geo.box}
            material={mats.handle}
            position={[centre[0], height + 0.02, centre[2]]}
            rotation={[0, wall.angle, 0]}
            scale={[Math.min(0.6, wall.length * 0.3), 0.04, WALL_T * 1.6]}
          />
        </>
      )}
    </group>
  )
}

/**
 * The lid nobody sees: the cut-away view has no ceiling, but the sun must
 * not know that, or it would pour in over the wall tops and every window
 * would stop mattering. Shadow-only, like the wall twins.
 */
function CeilingCaster() {
  const { mats } = useKit()
  const room = useBuilder((s) => s.scene.room)
  const geometry = useDisposable(
    useMemo(() => {
      const poly = footprint(room)
      const shape = new THREE.Shape()
      poly.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, -p.z) : shape.lineTo(p.x, -p.z)))
      shape.closePath()
      return new THREE.ShapeGeometry(shape)
    }, [room])
  )
  // Grown a wall thickness all round so no light leaks at the outer corners.
  const grow = (Math.max(room.width, room.depth) + WALL_T * 4) / Math.max(room.width, room.depth)
  return (
    <mesh
      geometry={geometry}
      material={mats.shadowCaster}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[(room.width / 2) * (1 - grow), room.height + 0.02, (room.depth / 2) * (1 - grow)]}
      scale={[grow, grow, 1]}
      castShadow
      raycast={noRaycast}
    />
  )
}

/** The house's shadow on the lawn: a shadow-only plane over the ground. */
function GroundShadow() {
  const { geo, mats } = useKit()
  const room = useBuilder((s) => s.scene.room)
  const span = Math.max(room.width, room.depth) * 4 + 8
  return (
    <mesh
      geometry={geo.plane}
      material={mats.groundShadow}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[room.width / 2, -0.004, room.depth / 2]}
      scale={[span, span, 1]}
      receiveShadow
      raycast={noRaycast}
    />
  )
}

export function RoomShell({ walls }: { walls: Wall[] }) {
  const meshes = useRef(new Map<WallId, THREE.Object3D>())
  const register = useCallback((id: WallId, group: THREE.Object3D | null) => {
    if (group) meshes.current.set(id, group)
    else meshes.current.delete(id)
  }, [])

  // One pass for every wall, only on frames that are drawn anyway (the canvas
  // renders on demand). Positive dot = the camera stands outside this wall
  // looking in, so it would occlude the room: hide it, and the far walls keep
  // the space readable. Visibility goes on every piece too, so hit tests that
  // check `object.visible` see a hidden wall as hidden.
  useFrame(({ camera }) => {
    for (const wall of walls) {
      const group = meshes.current.get(wall.id)
      if (!group) continue
      let shown = true
      if (!wall.interior) {
        const outside =
          (camera.position.x - wall.mid.x) * wall.nx + (camera.position.z - wall.mid.z) * wall.nz
        shown = outside < 0.05
      }
      if (group.visible !== shown) group.traverse((o) => void (o.visible = shown))
    }
  })

  return (
    <group>
      <FloorPlate />
      <SettingOutGrid />
      {walls.map((wall) => (
        <WallBox key={wall.id} wall={wall} register={register} />
      ))}
      <CeilingCaster />
      <GroundShadow />
    </group>
  )
}

export default RoomShell
