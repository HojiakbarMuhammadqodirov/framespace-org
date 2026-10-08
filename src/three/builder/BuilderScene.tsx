import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'

import { DimensionLine } from '@/ui/DimensionLine'
import { buildWalls, findWall, snap } from '@/features/room-builder/geometry'
import { findCollisions, useBuilder } from '@/features/room-builder/store'
import { QUALITY } from '@/features/room-builder/quality'
import type { LightingPreset, Vec2 } from '@/features/room-builder/types'
import { CameraRig } from './CameraRig'
import { Fixtures } from './Fixtures'
import { Furniture } from './Furniture'
import { RoomShell } from './RoomShell'
import { GeoCache } from '../furniture/geometry'
import { disposeFurnitureMats } from '../furniture/materials'
import { FurnitureGeoContext } from '../furniture/models'
import { SoftEnvironment, ToneMapping } from '../effects/Studio'
import {
  KitContext,
  createBuilderFurnitureMats,
  createBuilderGeometries,
  createBuilderMaterials,
  disposeGeometries,
  disposeMaterials,
  useKit,
  useThemeVersion,
  type BuilderKit,
} from './kit'

/**
 * The editor scene: shell, fixtures, furniture, light and the one plane that
 * turns a pointer into a floor coordinate.
 *
 * Mounted inside the shared <SceneCanvas>, which already owns WebGL detection,
 * the no-WebGL fallback, the reduced-motion flag and frameloop pausing.
 *
 * The canvas renders on demand: an idle editor draws zero frames. Anything that
 * changes the picture asks for a frame — every store change, every camera move,
 * and each running transition while it is still running.
 */

/* ------------------------------------------------------------------ light */

interface LightRig {
  /** Direction the sun comes FROM, in room-relative units. */
  dir: [number, number, number]
  color: string
  intensity: number
  ambient: number
  ambientColor: string
  /** Image-based light strength (the baked Lightformer environment). */
  env: number
}

const LIGHT_RIGS: Record<LightingPreset, LightRig> = {
  morning: { dir: [-1.1, 0.75, 0.35], color: '#ffe6c2', intensity: 1.15, ambient: 0.3, ambientColor: '#f6f1e9', env: 0.5 },
  afternoon: { dir: [0.6, 1.5, 0.9], color: '#fff6e6', intensity: 1.5, ambient: 0.34, ambientColor: '#ffffff', env: 0.6 },
  evening: { dir: [1.25, 0.42, -0.5], color: '#e9a06a', intensity: 0.85, ambient: 0.18, ambientColor: '#d8c6b4', env: 0.26 },
  lamps: { dir: [0.2, 1.1, 0.4], color: '#cbb9a4', intensity: 0.1, ambient: 0.12, ambientColor: '#9e8d7e', env: 0.07 },
}

function SceneLights() {
  const preset = useBuilder((s) => s.scene.lighting)
  const room = useBuilder((s) => s.scene.room)
  const tier = useBuilder((s) => s.quality)
  const q = QUALITY[tier]

  const sun = useRef<THREE.DirectionalLight>(null)
  const ambient = useRef<THREE.AmbientLight>(null)
  const invalidate = useThree((state) => state.invalidate)
  const scene = useThree((state) => state.scene)
  const current = useRef({
    env: LIGHT_RIGS.afternoon.env,
    pos: new THREE.Vector3(),
    color: new THREE.Color(LIGHT_RIGS.afternoon.color),
    intensity: LIGHT_RIGS.afternoon.intensity,
    ambient: LIGHT_RIGS.afternoon.ambient,
    ambientColor: new THREE.Color(LIGHT_RIGS.afternoon.ambientColor),
    ready: false,
  })

  const span = Math.max(room.width, room.depth)
  const centre = useMemo(
    () => new THREE.Vector3(room.width / 2, 0, room.depth / 2),
    [room.width, room.depth]
  )
  const target = useMemo(() => {
    const object = new THREE.Object3D()
    object.position.copy(centre)
    return object
  }, [centre])

  const rig = LIGHT_RIGS[preset]
  // Resolved once per preset — never a fresh Color per frame.
  const rigColor = useMemo(() => new THREE.Color(rig.color), [rig])
  const rigAmbient = useMemo(() => new THREE.Color(rig.ambientColor), [rig])
  const wanted = useMemo(
    () =>
      new THREE.Vector3(
        centre.x + rig.dir[0] * span,
        rig.dir[1] * span + room.height,
        centre.z + rig.dir[2] * span
      ),
    [centre, rig, span, room.height]
  )

  // The light travels to its new position rather than teleporting, so the
  // shadows visibly swing round the room when the preset changes.
  useFrame((_, rawDelta) => {
    // Clamp: on a demand canvas the first frame after idling carries the whole
    // idle time, which would teleport the sun instead of swinging it round.
    const delta = Math.min(rawDelta, 1 / 30)
    const c = current.current
    const k = Math.min(1, delta * 3.2)
    if (!c.ready) {
      c.pos.copy(wanted)
      c.ready = true
    } else {
      c.pos.lerp(wanted, k)
    }
    c.color.lerp(rigColor, k)
    c.ambientColor.lerp(rigAmbient, k)
    c.intensity += (rig.intensity - c.intensity) * k
    c.ambient += (rig.ambient - c.ambient) * k
    c.env += (rig.env - c.env) * k
    scene.environmentIntensity = c.env

    // Keep asking for frames until the light has arrived.
    const settling =
      c.pos.distanceToSquared(wanted) > 1e-6 ||
      Math.abs(c.intensity - rig.intensity) > 1e-3 ||
      Math.abs(c.ambient - rig.ambient) > 1e-3 ||
      Math.abs(c.env - rig.env) > 1e-3 ||
      !colorsClose(c.color, rigColor) ||
      !colorsClose(c.ambientColor, rigAmbient)
    if (settling) invalidate()

    if (sun.current) {
      sun.current.position.copy(c.pos)
      sun.current.color.copy(c.color)
      sun.current.intensity = c.intensity
    }
    if (ambient.current) {
      ambient.current.color.copy(c.ambientColor)
      ambient.current.intensity = c.ambient
    }
  })

  const half = span * 0.9 + 2

  return (
    <>
      <ambientLight ref={ambient} intensity={LIGHT_RIGS.afternoon.ambient} />
      <primitive object={target} />
      <directionalLight
        ref={sun}
        target={target}
        intensity={LIGHT_RIGS.afternoon.intensity}
        castShadow={q.shadows}
        shadow-mapSize={[q.shadowMap, q.shadowMap]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
        shadow-radius={3}
        shadow-camera-near={0.5}
        shadow-camera-far={span * 4 + 12}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
      />
      {/* Unshadowed fill so front faces are readable while editing, not muddy. */}
      {q.detail && (
        <directionalLight
          position={[centre.x - span, span * 0.7, centre.z + span]}
          intensity={0.16}
          color="#e4d9cb"
        />
      )}
    </>
  )
}

function colorsClose(a: THREE.Color, b: THREE.Color): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 2e-3
}

/* ------------------------------------------------------------- drag plane */

/** 15° detents: a piece square to the room without fighting for it. */
const ROTATE_STEP = Math.PI / 12

function DragPlane() {
  const drag = useBuilder((s) => s.drag)
  const room = useBuilder((s) => s.scene.room)
  const { geo } = useKit()

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    []
  )
  useEffect(() => () => material.dispose(), [material])

  // The pointer routinely leaves the plane (and the canvas) mid-drag, so the
  // release is caught on the window, never on the mesh.
  useEffect(() => {
    if (!drag) return
    const end = () => useBuilder.getState().endDrag()
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [drag])

  if (!drag) return null

  function onMove(event: ThreeEvent<PointerEvent>) {
    const state = useBuilder.getState()
    const active = state.drag
    if (!active) return
    const p: Vec2 = { x: event.point.x, z: event.point.z }

    if (active.kind === 'item') {
      state.moveItem(active.id, p.x - active.grabX, p.z - active.grabZ)
      return
    }
    if (active.kind === 'rotate') {
      const item = state.scene.items.find((i) => i.id === active.id)
      if (!item) return
      const raw = Math.atan2(p.x - item.x, p.z - item.z)
      state.rotateItem(active.id, Math.round(raw / ROTATE_STEP) * ROTATE_STEP)
      return
    }
    if (active.kind === 'fixture') {
      state.moveFixtureTo(active.id, p)
      return
    }
    const wall = findWall(buildWalls(active.base.room), active.id)
    if (!wall) return
    const outward = (p.x - active.origin.x) * wall.nx + (p.z - active.origin.z) * wall.nz
    state.resizeByWall(active.id, outward, active.base)
  }

  const reach = Math.max(room.width, room.depth) * 3 + 12

  // Shared unit plane, scaled — a fresh geometry per pointer move during a wall
  // drag would allocate a buffer thousands of times over one gesture.
  return (
    <mesh
      geometry={geo.plane}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[room.width / 2, 0, room.depth / 2]}
      scale={[reach, reach, 1]}
      onPointerMove={onMove}
    />
  )
}

/* ------------------------------------------------------- dimension labels */

/**
 * Architectural dimension lines, live. They are DOM (the DimensionLine
 * component) parked at a world point, so the ticks stay hairline-crisp at any
 * zoom instead of turning into thick 3D tubes.
 */
function DimensionLabels() {
  const room = useBuilder((s) => s.scene.room)
  const view = useBuilder((s) => s.view)
  const walls = useMemo(() => buildWalls(room), [room])

  if (view !== 'plan') return null

  return (
    <group>
      {walls
        .filter((wall) => !wall.interior)
        .map((wall) => (
          <Html
            key={wall.id}
            position={[wall.mid.x + wall.nx * 0.5, 0.02, wall.mid.z + wall.nz * 0.5]}
            center
            zIndexRange={[20, 0]}
            style={{ pointerEvents: 'none', width: 128 }}
          >
            <DimensionLine value={snap(wall.length, 0.01)} />
          </Html>
        ))}
    </group>
  )
}

/* ------------------------------------------------------------------ scene */

function Registrar() {
  const { camera, size, gl } = useThree()
  const setPicker = useBuilder((s) => s.setPicker)

  // Lets an HTML drop target ask where on the floor the pointer is.
  useEffect(() => {
    const raycaster = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hit = new THREE.Vector3()
    const ndc = new THREE.Vector2()

    setPicker((clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect()
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      return raycaster.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null
    })
    return () => setPicker(null)
  }, [camera, gl, setPicker, size.width, size.height])

  return null
}

export function BuilderScene() {
  const tier = useBuilder((s) => s.quality)
  const items = useBuilder((s) => s.scene.items)
  const collisions = useMemo(() => findCollisions(items), [items])
  const invalidate = useThree((state) => state.invalidate)
  const theme = useThemeVersion()

  // Any edit, selection or drag changes the picture: one frame per change.
  useEffect(() => useBuilder.subscribe(() => invalidate()), [invalidate])

  const geo = useMemo(() => createBuilderGeometries(tier), [tier])
  // Tokens are re-resolved when the theme flips, so the room follows the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mats = useMemo(() => createBuilderMaterials(), [theme])
  useEffect(() => () => disposeGeometries(geo), [geo])
  useEffect(() => () => disposeMaterials(mats), [mats])

  const fgeo = useMemo(() => new GeoCache(tier), [tier])
  const fmats = useMemo(() => createBuilderFurnitureMats(tier), [tier])
  useEffect(() => () => fgeo.dispose(), [fgeo])
  useEffect(() => () => disposeFurnitureMats(fmats), [fmats])

  const kit = useMemo<BuilderKit>(
    () => ({ geo, mats, tier, fgeo, fmats }),
    [geo, mats, tier, fgeo, fmats]
  )

  const room = useBuilder((s) => s.scene.room)
  const wallList = useMemo(() => buildWalls(room), [room])

  return (
    <KitContext.Provider value={kit}>
      <FurnitureGeoContext.Provider value={fgeo}>
      <ToneMapping mode="neutral" exposure={1} />
      <SoftEnvironment mood="daylight" intensity={0.5} resolution={tier === 'low' ? 32 : 64} />
      <CameraRig />
      <Registrar />
      <SceneLights />
      <RoomShell walls={wallList} />
      <Fixtures walls={wallList} />
      <Furniture collisions={collisions} />
      <DimensionLabels />
      <DragPlane />
      </FurnitureGeoContext.Provider>
    </KitContext.Provider>
  )
}

export default BuilderScene
