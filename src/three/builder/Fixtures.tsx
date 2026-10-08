import { Fragment, useMemo } from 'react'
import { Instance, Instances } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'

import { FIXTURE_SIZE, findWall, wallPoint } from '@/features/room-builder/geometry'
import { useBuilder } from '@/features/room-builder/store'
import type { Fixture, Wall } from '@/features/room-builder/types'
import { armDrag } from './dragIntent'
import { useKit } from './kit'

/**
 * Windows, doors, radiators and sockets.
 *
 * Openings are drawn as inset panels on the inner face rather than cut out of
 * the wall: a real hole needs CSG per edit, which on a wall drag is a rebuild
 * every pointer move. The daylight rig is aimed through the window anyway, so
 * the room lights the same way it would with a hole in it.
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

function WindowUnit({ p }: { p: Placed }) {
  const { geo, mats } = useKit()
  const frame = 0.07
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, p.wall.angle, 0]} onPointerDown={onGrab(p.fixture.id)}>
      <mesh geometry={geo.box} material={mats.trim} scale={[p.w + frame * 2, p.h + frame * 2, 0.06]} />
      <mesh geometry={geo.plane} material={mats.glass} position={[0, 0, 0.035]} scale={[p.w, p.h, 1]} />
      <mesh geometry={geo.box} material={mats.trim} position={[0, 0, 0.05]} scale={[0.04, p.h, 0.03]} />
    </group>
  )
}

function DoorUnit({ p }: { p: Placed }) {
  const { geo, mats } = useKit()
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, p.wall.angle, 0]} onPointerDown={onGrab(p.fixture.id)}>
      <mesh geometry={geo.box} material={mats.trim} scale={[p.w + 0.12, p.h + 0.06, 0.06]} />
      <mesh geometry={geo.box} material={mats.door} position={[0, 0, 0.04]} scale={[p.w, p.h, 0.04]} />
      <mesh
        geometry={geo.sphere}
        material={mats.metal}
        position={[p.w / 2 - 0.09, -0.05, 0.08]}
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

  return (
    <group>
      {rest.map((p) => (
        <Fragment key={p.fixture.id}>
          {p.fixture.kind === 'window' && <WindowUnit p={p} />}
          {p.fixture.kind === 'door' && <DoorUnit p={p} />}
          {p.fixture.kind === 'radiator' && <RadiatorUnit p={p} />}
          {selection?.kind === 'fixture' && selection.id === p.fixture.id && <Outline p={p} />}
        </Fragment>
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
