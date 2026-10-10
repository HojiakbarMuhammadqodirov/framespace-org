import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Instance, Instances } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'

import { FIXTURE_SIZE, findWall, wallPoint } from '@/features/room-builder/geometry'
import { useBuilder } from '@/features/room-builder/store'
import type { Fixture, Wall } from '@/features/room-builder/types'
import { armDrag } from './dragIntent'
import { useKit } from './kit'

/**
 * Windows, doors, radiators and sockets.
 *
 * Windows sit in real openings: RoomShell splits each wall into piers, a
 * spandrel and a header around them (1D bookkeeping, no CSG, so a wall drag
 * stays cheap). That is what lets the garden show through and the sun lay a
 * patch on the floor. Doors stay a closed leaf on the inner face.
 *
 * Sockets are instanced — they are the one fixture people place a dozen of.
 */

interface Placed {
  fixture: Fixture
  wall: Wall
  x: number
  z: number
  y: number
  w: number
  h: number
}

function usePlacedFixtures(walls: Wall[]): Placed[] {
  const fixtures = useBuilder((s) => s.scene.fixtures)
  return useMemo(
    () =>
      fixtures.flatMap((fixture) => {
        const wall = findWall(walls, fixture.wall)
        if (!wall) return []
        const size = FIXTURE_SIZE[fixture.kind]
        const at = wallPoint(wall, fixture.t)
        return [
          {
            fixture,
            wall,
            // 1 cm proud of the inner face, so it never z-fights the wall.
            x: at.x - wall.nx * 0.01,
            z: at.z - wall.nz * 0.01,
            y: size.sill + size.h / 2,
            w: size.w,
            h: size.h,
          },
        ]
      }),
    [fixtures, walls]
  )
}

function onGrab(id: string) {
  return (event: ThreeEvent<PointerEvent>) => {
    // Hidden with its wall: let the press fall through to what is visible.
    for (let o: THREE.Object3D | null = event.object; o; o = o.parent) if (!o.visible) return
    event.stopPropagation()
    const state = useBuilder.getState()
    state.select({ kind: 'fixture', id })
    armDrag(event, () => useBuilder.getState().beginDrag({ kind: 'fixture', id }))
  }
}

function Outline({ p }: { p: Placed }) {
  const { geo, mats } = useKit()
  return (
    <lineSegments
      geometry={geo.edges}
      material={mats.select}
      position={[p.x, p.y, p.z]}
      rotation={[0, p.wall.angle, 0]}
      scale={[p.w + 0.1, p.h + 0.1, 0.14]}
    />
  )
}

/**
 * A window in its opening (RoomShell cuts the hole). Local frame: origin at
 * the opening's centre, 1 cm inside the inner face, +Z into the room, so the
 * wall runs from z = −0.01 to z = −0.13.
 */
function WindowUnit({ p }: { p: Placed }) {
  const { geo, mats } = useKit()
  const f = 0.06 // frame face
  const z = -0.065 // frame sits mid-wall
  const hw = p.w / 2
  const hh = p.h / 2
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, p.wall.angle, 0]} onPointerDown={onGrab(p.fixture.id)}>
      {/* Frame and mullion: they cast, so the sun patch carries the glazing bars. */}
      <mesh geometry={geo.box} material={mats.trim} position={[0, hh - f / 2, z]} scale={[p.w, f, 0.07]} castShadow />
      <mesh geometry={geo.box} material={mats.trim} position={[0, -hh + f / 2, z]} scale={[p.w, f, 0.07]} castShadow />
      <mesh geometry={geo.box} material={mats.trim} position={[-hw + f / 2, 0, z]} scale={[f, p.h, 0.07]} castShadow />
      <mesh geometry={geo.box} material={mats.trim} position={[hw - f / 2, 0, z]} scale={[f, p.h, 0.07]} castShadow />
      <mesh geometry={geo.box} material={mats.trim} position={[0, 0, z + 0.004]} scale={[0.045, p.h - f * 2, 0.06]} castShadow />
      {/* Glass: Fresnel reflection only; the garden shows through. */}
      <mesh geometry={geo.plane} material={mats.glass} position={[0, 0, z]} scale={[p.w - f * 2, p.h - f * 2, 1]} renderOrder={2} />
      {/* Stool and casing on the room side. */}
      <mesh geometry={geo.box} material={mats.trim} position={[0, -hh + 0.015, 0.0125]} scale={[p.w + 0.12, 0.03, 0.075]} castShadow receiveShadow />
      <mesh geometry={geo.box} material={mats.trim} position={[0, hh + 0.035, 0]} scale={[p.w + 0.14, 0.07, 0.015]} />
      <mesh geometry={geo.box} material={mats.trim} position={[-hw - 0.035, 0, 0]} scale={[0.07, p.h, 0.015]} />
      <mesh geometry={geo.box} material={mats.trim} position={[hw + 0.035, 0, 0]} scale={[0.07, p.h, 0.015]} />
    </group>
  )
}

function DoorUnit({ p }: { p: Placed }) {
  const { geo, mats } = useKit()
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, p.wall.angle, 0]} onPointerDown={onGrab(p.fixture.id)}>
      {/* Casing: head and two legs, the way a door is trimmed out. */}
      <mesh geometry={geo.box} material={mats.trim} position={[0, p.h / 2 + 0.035, 0]} scale={[p.w + 0.14, 0.07, 0.02]} />
      <mesh geometry={geo.box} material={mats.trim} position={[-p.w / 2 - 0.035, 0, 0]} scale={[0.07, p.h, 0.02]} />
      <mesh geometry={geo.box} material={mats.trim} position={[p.w / 2 + 0.035, 0, 0]} scale={[0.07, p.h, 0.02]} />
      <mesh geometry={geo.box} material={mats.door} position={[0, 0, 0.012]} scale={[p.w, p.h, 0.04]} receiveShadow />
      <mesh
        geometry={geo.sphere}
        material={mats.metal}
        position={[p.w / 2 - 0.09, -0.05, 0.055]}
        scale={[0.06, 0.06, 0.06]}
      />
    </group>
  )
}

function RadiatorUnit({ p }: { p: Placed }) {
  const { geo, mats } = useKit()
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, p.wall.angle, 0]} onPointerDown={onGrab(p.fixture.id)}>
      <mesh geometry={geo.box} material={mats.radiator} scale={[p.w, p.h, 0.09]} castShadow />
      <mesh
        geometry={geo.box}
        material={mats.metal}
        position={[0, -p.h / 2 - 0.04, 0.02]}
        scale={[p.w * 0.9, 0.03, 0.03]}
      />
    </group>
  )
}

export function Fixtures({ walls }: { walls: Wall[] }) {
  const { geo, mats } = useKit()
  const placed = usePlacedFixtures(walls)
  const selection = useBuilder((s) => s.selection)

  const sockets = placed.filter((p) => p.fixture.kind === 'socket')
  const rest = placed.filter((p) => p.fixture.kind !== 'socket')

  // A window or door belongs to its wall: when RoomShell hides that wall for
  // the cut-away view, the frame must not be left floating in the air.
  const units = useRef(new Map<string, { group: THREE.Group; wall: Wall }>())
  useFrame(({ camera }) => {
    units.current.forEach(({ group, wall }) => {
      const shown =
        wall.interior ||
        (camera.position.x - wall.mid.x) * wall.nx + (camera.position.z - wall.mid.z) * wall.nz < 0.05
      if (group.visible !== shown) group.visible = shown
    })
  })

  return (
    <group>
      {rest.map((p) => (
        <group
          key={p.fixture.id}
          ref={(group) => {
            if (group) units.current.set(p.fixture.id, { group, wall: p.wall })
            else units.current.delete(p.fixture.id)
          }}
        >
          {p.fixture.kind === 'window' && <WindowUnit p={p} />}
          {p.fixture.kind === 'door' && <DoorUnit p={p} />}
          {p.fixture.kind === 'radiator' && <RadiatorUnit p={p} />}
          {selection?.kind === 'fixture' && selection.id === p.fixture.id && <Outline p={p} />}
        </group>
      ))}

      {sockets.length > 0 && (
        <Instances geometry={geo.box} material={mats.socket} limit={64}>
          {sockets.map((p) => (
            <Instance
              key={p.fixture.id}
              position={[p.x, p.y, p.z]}
              rotation={[0, p.wall.angle, 0]}
              scale={[p.w, p.h, 0.03]}
              onPointerDown={onGrab(p.fixture.id)}
            />
          ))}
        </Instances>
      )}
      {sockets
        .filter((p) => selection?.kind === 'fixture' && selection.id === p.fixture.id)
        .map((p) => (
          <Outline key={`sel-${p.fixture.id}`} p={p} />
        ))}
    </group>
  )
}

export default Fixtures
