import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'

import { DimensionLine } from '@/ui/DimensionLine'
import { buildWalls, findWall, snap } from '@/features/room-builder/geometry'
import { findCollisions, useBuilder } from '@/features/room-builder/store'
import { QUALITY } from '@/features/room-builder/quality'
import type { LightingPreset, Vec2, Wall } from '@/features/room-builder/types'
import { useProjects } from '@/store/projects'
import { CameraRig } from './CameraRig'
import { Fixtures } from './Fixtures'
import { Furniture } from './Furniture'
import { RoomShell } from './RoomShell'
import { GeoCache } from '../furniture/geometry'
import { disposeFurnitureMats } from '../furniture/materials'
import { FurnitureGeoContext } from '../furniture/models'
import { SoftEnvironment, ToneMapping } from '../effects/Studio'
import { OutdoorEnvironment } from '../environment/OutdoorEnvironment'
import { skyRotationFor, toFinishStyle, type FinishStyle, type SkyId } from '../environment/catalog'
import {
  KitContext,
  createBuilderFurnitureMats,
  createBuilderGeometries,
  createBuilderMaterials,
  dressBuilderShell,
  loadBuilderFinish,
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
  /** Which photographed sky stands outside. */
  sky: SkyId
  /** Sun height above the horizon, degrees. */
  elevation: number
  /**
   * Where the sun stands relative to the main window's outward normal,
   * degrees. The sun is aimed through a window on purpose: a patch of
   * sunlight on the boards is what makes a room read as real.
   */
  azimuthOffset: number
  color: string
  intensity: number
  ambient: number
  ambientColor: string
  /** Image-based light strength (the sky's HDR). */
  env: number
  /** Brightness of the visible sky and lawn. */
  backdrop: number
}

const LIGHT_RIGS: Record<LightingPreset, LightRig> = {
  morning: { sky: 'day', elevation: 30, azimuthOffset: -38, color: '#ffe8cc', intensity: 6.5, ambient: 1.35, ambientColor: '#f4efe8', env: 0.5, backdrop: 0.96 },
  afternoon: { sky: 'day', elevation: 42, azimuthOffset: 24, color: '#fff2df', intensity: 7.5, ambient: 1.5, ambientColor: '#fbf3e8', env: 0.55, backdrop: 1 },
  evening: { sky: 'golden', elevation: 13, azimuthOffset: 34, color: '#ffb36e', intensity: 6, ambient: 0.95, ambientColor: '#f1dcc4', env: 0.4, backdrop: 1.1 },
  lamps: { sky: 'dusk', elevation: 3, azimuthOffset: 0, color: '#9fb2d4', intensity: 0.05, ambient: 0.4, ambientColor: '#b9a690', env: 0.2, backdrop: 0.75 },
}

/** Default sun bearing (radians, atan2(z, x)) when the room has no window. */
const NO_WINDOW_AZIMUTH = Math.atan2(0.9, 0.6)

/** Bearing of the main window's outward normal, or null. */
function useWindowAzimuth(walls: Wall[]): number | null {
  const fixtures = useBuilder((s) => s.scene.fixtures)
  return useMemo(() => {
    const win = fixtures.find((f) => f.kind === 'window')
    const wall = win && findWall(walls, win.wall)
    return wall ? Math.atan2(wall.nz, wall.nx) : null
  }, [fixtures, walls])
}

function SceneLights({ walls }: { walls: Wall[] }) {
  const preset = useBuilder((s) => s.scene.lighting)
  const room = useBuilder((s) => s.scene.room)
  const tier = useBuilder((s) => s.quality)
  const q = QUALITY[tier]

  const sun = useRef<THREE.DirectionalLight>(null)
  const ambient = useRef<THREE.HemisphereLight>(null)
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
  // Without a shadow map the sun would light every wall and the whole floor at
  // patch strength, as if the room had no walls. Low tier keeps it a hint.
  const sunIntensity = q.shadows ? rig.intensity : rig.intensity * 0.22
  const windowAzimuth = useWindowAzimuth(walls)
  const azimuth =
    windowAzimuth === null ? NO_WINDOW_AZIMUTH : windowAzimuth + THREE.MathUtils.degToRad(rig.azimuthOffset)
  // Resolved once per preset — never a fresh Color per frame.
  const rigColor = useMemo(() => new THREE.Color(rig.color), [rig])
  const rigAmbient = useMemo(() => new THREE.Color(rig.ambientColor), [rig])
  const distance = span * 2 + 8
  const wanted = useMemo(() => {
    const el = THREE.MathUtils.degToRad(rig.elevation)
    return new THREE.Vector3(
      centre.x + Math.cos(el) * Math.cos(azimuth) * distance,
      Math.sin(el) * distance,
      centre.z + Math.cos(el) * Math.sin(azimuth) * distance
    )
  }, [centre, rig, azimuth, distance])

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
    c.intensity += (sunIntensity - c.intensity) * k
    c.ambient += (rig.ambient - c.ambient) * k
    c.env += (rig.env - c.env) * k
    scene.environmentIntensity = c.env

    // Keep asking for frames until the light has arrived.
    const settling =
      c.pos.distanceToSquared(wanted) > 1e-6 ||
      Math.abs(c.intensity - sunIntensity) > 1e-3 ||
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

  // Shadow box: the room plus the stretch of lawn its shadow falls on.
  const half = span * 0.9 + 2.5

  return (
    <>
      {/* The world outside: lights the room and fills the windows. The room
          stands on the photographed lawn (ground projection), turned so the
          photo's sun is where our sun is. Low-tier devices get the small
          files; the studio light stands in until the sky has loaded. */}
      <OutdoorEnvironment
        sky={rig.sky}
        tier={tier}
        rotation={skyRotationFor(rig.sky, azimuth)}
        background="ground"
        ground={{ height: 1.7, radius: 60, center: [centre.x, centre.z] }}
        backgroundIntensity={rig.backdrop}
        fallback={<SoftEnvironment mood="daylight" intensity={0.5} resolution={tier === 'low' ? 32 : 64} />}
      />
      {/* Bounce: a room's shade is lit by its own warm floor and walls, not by
          the blue sky the HDR knows about. */}
      <hemisphereLight ref={ambient} intensity={LIGHT_RIGS.afternoon.ambient} groundColor="#c4a584" />
      <primitive object={target} />
      <directionalLight
        ref={sun}
        target={target}
        intensity={LIGHT_RIGS.afternoon.intensity}
        castShadow={q.shadows}
        shadow-mapSize={[q.shadowMap, q.shadowMap]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
        shadow-radius={2}
        shadow-camera-near={0.5}
        shadow-camera-far={distance + span * 2 + 4}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
      />
      {/* Unshadowed fill so front faces are readable while editing, not muddy. */}
      {q.detail && (
        <directionalLight
          position={[centre.x - span, span * 0.7, centre.z + span]}
          intensity={0.12}
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
  // The room wears its project's style (Japandi boards for a Japandi
  // project); a room with no project keeps the paper-and-pale-oak default.
  const roomId = useBuilder((s) => s.roomId)
  const projectStyle = useProjects((s) => s.projects.find((p) => p.id === roomId)?.style)
  const finish: FinishStyle = projectStyle ? toFinishStyle(projectStyle) : 'minimal'
  // Tokens are re-resolved when the theme flips, so the room follows the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mats = useMemo(() => createBuilderMaterials(finish), [theme, finish])
  useEffect(() => () => disposeGeometries(geo), [geo])
  useEffect(() => () => disposeMaterials(mats), [mats])

  // Real surfaces arrive after first paint and are put on in one go.
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    let live = true
    loadBuilderFinish(finish, tier)
      .then(() => {
        if (!live) return
        dressBuilderShell(mats, finish, tier, Math.min(8, gl.capabilities.getMaxAnisotropy()))
        invalidate()
      })
      .catch(() => {
        // Offline: the plain palette materials are a complete room on their own.
      })
    return () => {
      live = false
    }
  }, [mats, finish, tier, gl, invalidate])

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
      <ToneMapping mode="neutral" exposure={1.35} />

      <CameraRig />
      <Registrar />
      <SceneLights walls={wallList} />
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
