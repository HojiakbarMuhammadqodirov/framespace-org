import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'

import { useBuilder } from '@/features/room-builder/store'
import type { Room, ViewMode } from '@/features/room-builder/types'
import { useSceneReducedMotion } from '../Canvas'

/**
 * Top-down plan ↔ 3D perspective.
 *
 * The camera is interpolated, never cut: a cut loses the viewer's place in the
 * room, and the whole point of the toggle is that the plan and the perspective
 * are the same room. Under prefers-reduced-motion it becomes a cut, because
 * that is exactly what the preference asks for.
 */

const FOV = 38
/** Standing inside a room needs a wider lens, or all you see is one wall. */
const WALK_FOV = 64
/** Eye height of someone standing in the room. */
const EYE = 1.55
const TRANSITION_MS = 820

interface Pose {
  position: THREE.Vector3
  target: THREE.Vector3
}

/** Minimal shape of drei's OrbitControls as this rig drives it. */
interface ControlsLike {
  /** The camera this instance drives. */
  object?: THREE.Camera
  target: THREE.Vector3
  enabled: boolean
  update: () => void
  addEventListener: (type: 'change', listener: () => void) => void
  removeEventListener: (type: 'change', listener: () => void) => void
}

function poseFor(view: ViewMode, room: Room, aspect = 1.5): Pose {
  const cx = room.width / 2
  const cz = room.depth / 2
  const span = Math.max(room.width, room.depth)

  if (view === 'plan') {
    // Frame the long side with a margin, straight overhead. The 1 mm of Z keeps
    // the view matrix out of the gimbal singularity at a perfectly vertical up.
    const distance = (span / 2 / Math.tan((FOV / 2) * (Math.PI / 180))) * 1.35
    return {
      position: new THREE.Vector3(cx, Math.max(4, distance), cz + 0.001),
      target: new THREE.Vector3(cx, 0, cz),
    }
  }

  if (view === 'walk') {
    // South-west corner, looking across the diagonal: the longest sight line a
    // room has, and the one corner every shape keeps (the L's bite is south-east).
    const eye = Math.min(EYE, room.height - 0.5)
    return {
      position: new THREE.Vector3(room.width * 0.16, eye, room.depth * 0.88),
      target: new THREE.Vector3(room.width * 0.62, eye * 0.72, room.depth * 0.3),
    }
  }

  // Back the camera off far enough that the whole room fits whatever the
  // viewport's shape. A fixed offset cropped the walls on a tall or narrow
  // canvas, which read as the camera sitting inside the room.
  const vFov = (FOV * Math.PI) / 180
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
  const radius = 0.5 * Math.hypot(room.width, room.depth, room.height)
  const distance = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 0.98
  const target = new THREE.Vector3(cx, room.height * 0.36, cz)
  const direction = new THREE.Vector3(0.52, 0.58, 0.78).normalize()
  return { position: target.clone().addScaledVector(direction, distance), target }
}

export function CameraRig() {
  const view = useBuilder((s) => s.view)
  const room = useBuilder((s) => s.scene.room)
  const drag = useBuilder((s) => s.drag)
  const reduced = useSceneReducedMotion()
  const { camera } = useThree()
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height))
  const invalidate = useThree((state) => state.invalidate)
  const controls = useThree((state) => state.controls) as unknown as ControlsLike | null

  const anim = useRef({ t: 1, from: null as Pose | null, to: null as Pose | null })
  const placed = useRef(false)
  const placedFor = useRef<ControlsLike | null>(null)

  const aspectRef = useRef(aspect)
  aspectRef.current = aspect

  // Place the camera the moment the controls exist, so the first frame is
  // already framed on the room instead of flying in from the world origin.
  useEffect(() => {
    if (!controls || placedFor.current === controls) return
    // drei builds one OrbitControls per camera. `makeDefault` on the camera
    // below swaps the canvas camera a tick after mount, which replaces the
    // controls too — so the instance that exists first is bound to the camera
    // that is about to be thrown away. Placing against that one (as this did)
    // left the real controls aimed at the world origin: the editor opened
    // looking at the room's north-west corner at a slant instead of at the
    // plan. Wait for the pair that will actually be used, and re-place if the
    // controls are ever rebuilt.
    if (controls.object && controls.object !== camera) return
    placedFor.current = controls
    placed.current = true
    const state = useBuilder.getState()
    const start = poseFor(state.view, state.scene.room, aspectRef.current)
    camera.position.copy(start.position)
    controls.target.copy(start.target)
    controls.update()
    // The canvas renders on demand and the `change` listener below is not
    // attached yet, so without this the first frame — drawn from wherever the
    // camera was born — stays on screen until something else asks for one.
    invalidate()
  }, [controls, camera, invalidate])

  // The canvas renders on demand: every orbit, pan, zoom and damping step asks
  // for its own frame, and an untouched camera costs nothing.
  useEffect(() => {
    if (!controls) return
    const onChange = () => invalidate()
    controls.addEventListener('change', onChange)
    return () => controls.removeEventListener('change', onChange)
  }, [controls, invalidate])

  // View switches animate; everything else leaves the camera where the user put it.
  useEffect(() => {
    if (!placed.current) return
    const to = poseFor(view, useBuilder.getState().scene.room, aspectRef.current)
    if (reduced) {
      camera.position.copy(to.position)
      if (controls) {
        controls.target.copy(to.target)
        controls.update()
      }
      anim.current.t = 1
      invalidate()
      return
    }
    invalidate()
    anim.current = {
      t: 0,
      from: {
        position: camera.position.clone(),
        target: controls ? controls.target.clone() : to.target.clone(),
      },
      to,
    }
    // `room` is deliberately absent: resizing mid-view must not re-fly the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, reduced])

  useFrame((_, rawDelta) => {
    // Demand-rendered: the first frame after an idle spell reports the whole
    // idle time as its delta, which would skip the transition outright.
    const delta = Math.min(rawDelta, 1 / 30)

    // The lens eases with the view: 38° to study the plan, 64° to stand in it.
    const lens = camera as THREE.PerspectiveCamera
    const wantFov = view === 'walk' ? WALK_FOV : FOV
    if (lens.isPerspectiveCamera && Math.abs(lens.fov - wantFov) > 0.02) {
      lens.fov = reduced ? wantFov : lens.fov + (wantFov - lens.fov) * Math.min(1, delta * 5)
      if (Math.abs(lens.fov - wantFov) <= 0.02) lens.fov = wantFov
      lens.updateProjectionMatrix()
      invalidate()
    }

    const a = anim.current
    if (a.t < 1 && a.from && a.to) {
      a.t = Math.min(1, a.t + (delta * 1000) / TRANSITION_MS)
      const e = 1 - Math.pow(1 - a.t, 3)
      camera.position.lerpVectors(a.from.position, a.to.position, e)
      if (controls) {
        controls.target.lerpVectors(a.from.target, a.to.target, e)
        controls.update()
      } else {
        camera.lookAt(a.to.target)
      }
      if (a.t < 1) invalidate()
      return
    }

  })

  // A wall drag re-frames the plan when the wall is let go — never during the
  // drag. Re-framing live moved the floor under a still pointer: the camera
  // pulled back, the same pixel now meant a point further out, the wall
  // followed it, and the room grew nearly three metres for one metre of drag.
  const wasWallDrag = useRef(false)
  useEffect(() => {
    const isWallDrag = drag?.kind === 'wall'
    const released = wasWallDrag.current && !isWallDrag
    wasWallDrag.current = isWallDrag
    if (!released || view !== 'plan') return
    const to = poseFor('plan', useBuilder.getState().scene.room, aspectRef.current)
    if (reduced) {
      camera.position.copy(to.position)
      if (controls) {
        controls.target.copy(to.target)
        controls.update()
      }
    } else {
      anim.current = {
        t: 0,
        from: {
          position: camera.position.clone(),
          target: controls ? controls.target.clone() : to.target.clone(),
        },
        to,
      }
    }
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag])

  // The pointer is busy pushing geometry around; orbiting at the same time turns
  // a drag into a camera swing.
  useEffect(() => {
    if (!controls) return
    controls.enabled = !drag
    return () => {
      controls.enabled = true
    }
  }, [controls, drag])

  return (
    <>
      <PerspectiveCamera makeDefault fov={FOV} near={0.1} far={90} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.5}
        zoomSpeed={0.7}
        // Rotation is off in plan rather than clamped: a polar clamp would fight
        // the transition and snap the camera overhead the moment it started.
        enableRotate={view !== 'plan'}
        // Inside the room the camera has to be able to stand close to things
        // and tip up toward the ceiling; from outside neither makes sense.
        minDistance={view === 'walk' ? 0.3 : 1.5}
        maxDistance={40}
        minPolarAngle={0}
        maxPolarAngle={view === 'walk' ? 1.95 : 1.52}
      />
    </>
  )
}

export default CameraRig
