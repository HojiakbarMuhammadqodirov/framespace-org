import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'

import { GRID, WALL_T, footprint } from '@/features/room-builder/geometry'
import { useBuilder } from '@/features/room-builder/store'
import type { Wall, WallId } from '@/features/room-builder/types'
import { DRAG_THRESHOLD_PX, armDrag } from './dragIntent'
import { useKit } from './kit'
import { applyFloor } from '../materials/floors'

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

/** Floor outline as a flat shape; shared by the floor and the ceiling. */
function useFootprintGeometry() {
  const room = useBuilder((s) => s.scene.room)
  return useDisposable(
    useMemo(() => {
      const poly = footprint(room)
      const shape = new THREE.Shape()
      poly.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, -p.z) : shape.lineTo(p.x, -p.z)))
      shape.closePath()
      return new THREE.ShapeGeometry(shape)
    }, [room])
  )
}

/**
 * The lid. It exists only while the camera is below it: from above (plan, or
 * an orbit looking down) it would hide the room, from inside it is what makes
 * the space read as a room rather than a stage set.
 */
function Ceiling() {
  const { mats } = useKit()
  const height = useBuilder((s) => s.scene.room.height)
  const paint = useBuilder((s) => s.scene.surfaces.ceiling)
  const geometry = useFootprintGeometry()
  const mesh = useRef<THREE.Mesh>(null)
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    mats.ceiling.color.set(paint)
    invalidate()
  }, [mats, paint, invalidate])

  useFrame(({ camera }) => {
    if (mesh.current) mesh.current.visible = camera.position.y < height - 0.02
  })

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={mats.ceiling}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, height, 0]}
      receiveShadow
    />
  )
}

function FloorPlate() {
  const { mats, tier } = useKit()
  const room = useBuilder((s) => s.scene.room)
  const covering = useBuilder((s) => s.scene.surfaces.floor)
  const invalidate = useThree((state) => state.invalidate)

  // Same material, new maps: changing the floor never recompiles a shader.
  useEffect(() => {
    applyFloor(mats.floor, covering, tier)
    invalidate()
  }, [mats, covering, tier, invalidate])

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
      // Grid lines would otherwise be "hit" from up to a metre away and stand
      // between a tap and the floor, so tapping empty floor failed to deselect.
      raycast={() => null}
      geometry={geometry}
      material={material}
      position={[0, 0.006, 0]}
      visible={view === 'plan'}
    />
  )
}

/** Half-width of the plan-view grab strip: 0.6 m in all, a fingertip at any zoom. */
const STRIP = 0.6

/** Skirting board: 8 cm of painted timber where the wall meets the floor. */
const SKIRT_H = 0.08
const SKIRT_T = 0.014

function WallBox({
  wall,
  paint,
  register,
}: {
  wall: Wall
  paint: THREE.Material
  register: (id: string, mesh: THREE.Mesh | null) => void
}) {
  const { geo, mats } = useKit()
  const view = useBuilder((s) => s.view)
  const selection = useBuilder((s) => s.selection)
  const height = useBuilder((s) => s.scene.room.height)
  const solid = useRef<THREE.Mesh | null>(null)

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

  return (
    <group>
      <mesh
        ref={(mesh) => {
          solid.current = mesh
          register(wall.id, mesh)
        }}
        geometry={geo.box}
        material={selected && view === 'plan' ? mats.handle : paint}
        position={centre}
        rotation={[0, wall.angle, 0]}
        scale={[wall.length, height, WALL_T]}
        castShadow
        receiveShadow
        onPointerDown={onDown}
        onPointerOver={grabbable ? () => void (document.body.style.cursor = cursor) : undefined}
        onPointerOut={grabbable ? () => void (document.body.style.cursor = '') : undefined}
      />
      {/* Follows its wall's visibility (see RoomShell's frame pass) by being
          registered under the same id with a `skirt` flag. */}
      {view !== 'plan' && (
        <mesh
          ref={(mesh) => register(`${wall.id}:skirt`, mesh)}
          geometry={geo.box}
          material={mats.skirting}
          position={[
            wall.mid.x - (wall.nx * SKIRT_T) / 2,
            SKIRT_H / 2,
            wall.mid.z - (wall.nz * SKIRT_T) / 2,
          ]}
          rotation={[0, wall.angle, 0]}
          scale={[wall.length, SKIRT_H, SKIRT_T]}
          receiveShadow
        />
      )}
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

export function RoomShell({ walls }: { walls: Wall[] }) {
  const meshes = useRef(new Map<string, THREE.Mesh>())
  const register = useCallback((id: string, mesh: THREE.Mesh | null) => {
    if (mesh) meshes.current.set(id, mesh)
    else meshes.current.delete(id)
  }, [])

  // One pass for every wall, only on frames that are drawn anyway (the canvas
  // renders on demand). Positive dot = the camera stands outside this wall
  // looking in, so it would occlude the room: hide it, and the far walls keep
  // the space readable.
  useFrame(({ camera }) => {
    for (const wall of walls) {
      const mesh = meshes.current.get(wall.id)
      if (!mesh) continue
      if (wall.interior) {
        mesh.visible = true
        continue
      }
      const outside =
        (camera.position.x - wall.mid.x) * wall.nx + (camera.position.z - wall.mid.z) * wall.nz
      mesh.visible = outside < 0.05
      const skirt = meshes.current.get(`${wall.id}:skirt`)
      if (skirt) skirt.visible = mesh.visible
    }
  })

  // One material per paint colour in use, not per wall: four walls in the room
  // colour share a single material, an accent wall adds exactly one more.
  const surfaces = useBuilder((s) => s.scene.surfaces)
  const invalidate = useThree((state) => state.invalidate)
  const paints = useRef(new Map<string, THREE.MeshStandardMaterial>())
  const paintFor = (hex: string) => {
    let material = paints.current.get(hex)
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.96 })
      paints.current.set(hex, material)
    }
    return material
  }
  useEffect(() => {
    // Drop paints no wall wears any more (a colour picker drag makes dozens).
    const inUse = new Set<string>([surfaces.wall, ...Object.values(surfaces.wallOverrides)])
    for (const [hex, material] of paints.current) {
      if (!inUse.has(hex)) {
        material.dispose()
        paints.current.delete(hex)
      }
    }
    invalidate()
  }, [surfaces, invalidate])
  useEffect(() => {
    const store = paints.current
    return () => {
      store.forEach((material) => material.dispose())
      store.clear()
    }
  }, [])

  return (
    <group>
      <FloorPlate />
      <Ceiling />
      <SettingOutGrid />
      {walls.map((wall) => (
        <WallBox
          key={wall.id}
          wall={wall}
          paint={paintFor(surfaces.wallOverrides[wall.id] ?? surfaces.wall)}
          register={register}
        />
      ))}
    </group>
  )
}

export default RoomShell
