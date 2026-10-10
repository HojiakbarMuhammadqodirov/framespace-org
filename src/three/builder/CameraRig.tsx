import { useEffect, useMemo, useRef } from 'react'
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
const TRANSITION_MS = 820

interface Pose {
  position: THREE.Vector3
  target: THREE.Vector3
}

/** Minimal shape of drei's OrbitControls as this rig drives it. */
interface ControlsLike {
  target: THREE.Vector3
  enabled: boolean
  update: () => void
  addEventListener: (type: 'change', listener: () => void) => void
  removeEventListener: (type: 'change', listener: () => void) => void
}

function poseFor(view: ViewMode, room: Room): Pose {
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

  return {
    position: new THREE.Vector3(
      cx + room.width * 0.62,
      room.height * 1.45,
      cz + room.depth * 0.95 + 1.2
    ),
    target: new THREE.Vector3(cx, room.height * 0.34, cz),
  }
}

export function CameraRig() {
  const view = useBuilder((s) => s.view)
  const room = useBuilder((s) => s.scene.room)
  const drag = useBuilder((s) => s.drag)
  const reduced = useSceneReducedMotion()
  const { camera } = useThree()
  const invalidate = useThree((state) => state.invalidate)
  const controls = useThree((state) => state.controls) as unknown as ControlsLike | null

  const anim = useRef({ t: 1, from: null as Pose | null, to: null as Pose | null })
  const placed = useRef(false)

  const pose = useMemo(() => poseFor(view, room), [view, room])

  // Place the camera the moment the controls exist, so the first frame is
  // already framed on the room instead of flying in from the world origin.
  useEffect(() => {
    if (placed.current || !controls) return
    placed.current = true
    const state = useBuilder.getState()
    const start = poseFor(state.view, state.scene.room)
    camera.position.copy(start.position)
    controls.target.copy(start.target)
    controls.update()
  }, [controls, camera])

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
    const to = poseFor(view, useBuilder.getState().scene.room)
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

    // While a wall is being dragged the plan must stay framed, or the room
    // grows straight out of shot. Damped, so it reads as the camera easing back.
    if (view === 'plan' && drag?.kind === 'wall' && controls) {
      const k = reduced ? 1 : Math.min(1, delta * 4)
      camera.position.lerp(pose.position, k)
      controls.target.lerp(pose.target, k)
      controls.update()
      if (camera.position.distanceToSquared(pose.position) > 1e-6) invalidate()
    }
  })

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
      {/* far: the projected garden is a 60 m dome round the room. */}
      <PerspectiveCamera makeDefault fov={FOV} near={0.1} far={160} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.5}
        zoomSpeed={0.7}
        // Rotation is off in plan rather than clamped: a polar clamp would fight
        // the transition and snap the camera overhead the moment it started.
        enableRotate={view === 'perspective'}
        minDistance={1.5}
        maxDistance={40}
        minPolarAngle={0}
        maxPolarAngle={1.52}
      />
    </>
  )
}

export default CameraRig
