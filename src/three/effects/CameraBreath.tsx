import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { useSceneReducedMotion } from '../Canvas'

export interface CameraBreathProps {
  /** Peak field-of-view swing, in degrees. */
  amount?: number
  /** Full cycle length, in seconds. */
  period?: number
}

/**
 * Near-imperceptible idle life for a static hero shot: the field of view
 * breathes by a fraction of a degree on a slow sine.
 *
 * Deliberately touches `camera.fov`, not `camera.position` — `OrbitControls`
 * (with damping) re-derives position from its own spherical state every
 * frame, so writing position here would just be overwritten. `fov` is free
 * real estate. Snaps back to the base value and stops entirely under
 * `prefers-reduced-motion`.
 */
export function CameraBreath({ amount = 0.14, period = 9 }: CameraBreathProps) {
  const { camera } = useThree()
  const reduced = useSceneReducedMotion()
  const base = useRef<number | null>(null)

  useFrame(({ clock }) => {
    const cam = camera as THREE.PerspectiveCamera
    if (typeof cam.fov !== 'number') return
    if (base.current === null) base.current = cam.fov

    if (reduced) {
      if (cam.fov !== base.current) {
        cam.fov = base.current
        cam.updateProjectionMatrix()
      }
      return
    }

    const swing = Math.sin((clock.elapsedTime / period) * Math.PI * 2) * amount
    cam.fov = base.current + swing
    cam.updateProjectionMatrix()
  })

  return null
}
