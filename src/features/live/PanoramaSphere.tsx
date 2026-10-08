import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  Quaternion,
  SRGBColorSpace,
  type PerspectiveCamera,
} from 'three'

import { useSceneReducedMotion } from '@/three/Canvas'
import { detectSceneTier } from '@/three/effects/quality'
import { clamp, smoothing, yawQuaternion } from './orientation'
import type { LiveOrientation } from './useLiveOrientation'

/**
 * The inside of a sphere with the stitched panorama on it, and a camera driven
 * by the phone.
 *
 * ## Why the sphere is scaled −1 on X
 *
 * `SphereGeometry` puts texture column `u` on the equator at
 * `(−cos 2πu, 0, sin 2πu)`. Viewed from inside that is *mirrored*: turning
 * right would show the wall on your left, which is the single most common bug
 * in hand-rolled panorama viewers and is almost invisible on a desk. Scaling
 * X by −1 makes it `(cos 2πu, 0, sin 2πu)`, so azimuth `atan2(z, x)` equals
 * `360·u` and increases clockwise, matching the phone.
 *
 * `buildEquirect` centres sector `i` at `u = (i + ½)/n`, i.e. world azimuth
 * `roomYaw + halfSector` — the relation `useAlignment` inverts to get `kappa`.
 *
 * (Three flips the winding order itself for a negative determinant, so the
 * default `FrontSide` material draws the inside face correctly.)
 */

const RADIUS = 500
export const MIN_FOV = 48
export const MAX_FOV = 92
export const DEFAULT_FOV = 74
/** Seconds. A short second pass that bridges sensor rate to refresh rate. */
const TAU = 0.05
/** Per-second decay of the fling after a drag. Light: it glides, it does not spin. */
const INERTIA_DECAY = 5
/** Low-tier phones get a 2048 texture: a quarter of the memory, same room. */
const LOW_TIER_MAX_TEXTURE = 2048

export interface ManualLook {
  yaw: number
  pitch: number
  /** Zoom, degrees. Wheel and pinch write it; the sphere clamps it. */
  fov?: number
  /** Fling velocity in degrees per second, applied once the finger lifts. */
  vyaw?: number
  vpitch?: number
  /** True while a finger or the mouse is holding the view. */
  dragging?: boolean
}

export interface PanoramaSphereProps {
  canvas: HTMLCanvasElement
  orientation: LiveOrientation
  /** Camera yaw offset in degrees, read every frame, never a prop update. */
  kappa: { current: number }
  /** Drag-to-look fallback for devices with no gyroscope. */
  manual?: { current: ManualLook }
  /** When false the manual look takes over. */
  gyro: boolean
  fov?: number
}

export function PanoramaSphere({
  canvas,
  orientation,
  kappa,
  manual,
  gyro,
  fov = DEFAULT_FOV,
}: PanoramaSphereProps) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const invalidate = useThree((state) => state.invalidate)
  const reduced = useSceneReducedMotion()

  const target = useMemo(() => new Quaternion(), [])
  const offset = useMemo(() => new Quaternion(), [])

  /* 4096px is above `MAX_TEXTURE_SIZE` on older GPUs, where the upload fails
     silently and leaves a black sphere. Halve until it fits — and on low-tier
     phones, until it is 2048, which they can hold without paging. */
  const texture = useMemo(() => {
    const gpuMax = gl.capabilities?.maxTextureSize ?? 4096
    const max = detectSceneTier() === 'low' ? Math.min(gpuMax, LOW_TIER_MAX_TEXTURE) : gpuMax
    let source: HTMLCanvasElement = canvas
    while (source.width > max && source.width > 256) {
      const half = document.createElement('canvas')
      half.width = Math.floor(source.width / 2)
      half.height = Math.floor(source.height / 2)
      half.getContext('2d')?.drawImage(source, 0, 0, half.width, half.height)
      source = half
    }
    const tex = new CanvasTexture(source)
    tex.colorSpace = SRGBColorSpace
    tex.magFilter = LinearFilter
    tex.minFilter = LinearMipmapLinearFilter
    tex.generateMipmaps = true
    tex.anisotropy = Math.min(8, gl.capabilities?.getMaxAnisotropy?.() ?? 1)
    tex.needsUpdate = true
    return tex
  }, [canvas, gl])

  useEffect(() => () => texture.dispose(), [texture])

  useEffect(() => {
    camera.fov = clamp(fov, MIN_FOV, MAX_FOV)
    camera.near = 0.1
    camera.far = RADIUS * 2.2
    camera.position.set(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, fov])

  useFrame((_, delta) => {
    const frame = orientation.frame.current

    if (gyro && frame.live) {
      // camera = yaw(−kappa) · device. See useAlignment for the derivation.
      yawQuaternion(offset, -kappa.current)
      target.copy(offset).multiply(frame.quaternion)
      // Reduced motion: snap. The view still tracks the phone — that motion is
      // the person's own — but nothing eases, so nothing floats.
      camera.quaternion.slerp(target, reduced ? 1 : smoothing(delta, TAU))
      return
    }

    if (manual) {
      const look = manual.current
      // Light inertia after a fling. The canvas renders on demand in manual
      // mode, so the glide asks for its own frames until it settles.
      if (!look.dragging && (look.vyaw || look.vpitch)) {
        look.yaw += (look.vyaw ?? 0) * delta
        look.pitch = clamp(look.pitch + (look.vpitch ?? 0) * delta, -80, 80)
        const decay = Math.exp(-INERTIA_DECAY * delta)
        look.vyaw = (look.vyaw ?? 0) * decay
        look.vpitch = (look.vpitch ?? 0) * decay
        if (Math.abs(look.vyaw) < 0.5 && Math.abs(look.vpitch) < 0.5) {
          look.vyaw = 0
          look.vpitch = 0
        } else {
          invalidate()
        }
      }

      camera.rotation.order = 'YXZ'
      camera.rotation.y = MathUtils.degToRad(-look.yaw)
      camera.rotation.x = MathUtils.degToRad(clamp(look.pitch, -80, 80))
      camera.rotation.z = 0

      if (look.fov !== undefined) {
        const next = clamp(look.fov, MIN_FOV, MAX_FOV)
        if (camera.fov !== next) {
          camera.fov = next
          camera.updateProjectionMatrix()
        }
      }
    }
  })

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[RADIUS, 64, 40]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}
