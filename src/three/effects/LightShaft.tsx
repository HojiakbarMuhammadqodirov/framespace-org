import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export interface LightShaftProps {
  /** Where the beam starts, roughly at the window opening. */
  origin: [number, number, number]
  /** Where the beam reaches into the room. */
  target: [number, number, number]
  /** Beam width at the widest point. */
  width?: number
  color?: string
  opacity?: number
}

let shaftCanvas: HTMLCanvasElement | null | undefined

/** A soft rectangle: bright core fading to transparent at both long edges
 * (the sides of the beam) and fading out toward the far end (the "how far
 * the light reaches" falloff). Built once, shared by every LightShaft. */
function getShaftTexture(): THREE.Texture | null {
  if (shaftCanvas === undefined) {
    if (typeof document === 'undefined') {
      shaftCanvas = null
    } else {
      const w = 48
      const h = 96
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const horizontal = ctx.createLinearGradient(0, 0, w, 0)
        horizontal.addColorStop(0, 'rgba(255,255,255,0)')
        horizontal.addColorStop(0.5, 'rgba(255,255,255,1)')
        horizontal.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = horizontal
        ctx.fillRect(0, 0, w, h)

        // Fade the far end (bottom of the canvas maps to the target end).
        ctx.globalCompositeOperation = 'destination-out'
        const vertical = ctx.createLinearGradient(0, 0, 0, h)
        vertical.addColorStop(0, 'rgba(0,0,0,0.05)')
        vertical.addColorStop(1, 'rgba(0,0,0,0.85)')
        ctx.fillStyle = vertical
        ctx.fillRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'source-over'

        shaftCanvas = canvas
      } else {
        shaftCanvas = null
      }
    }
  }
  if (!shaftCanvas) return null
  const texture = new THREE.CanvasTexture(shaftCanvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/**
 * A cheap stand-in for a volumetric light shaft: two crossed, additively
 * blended planes running from the window opening into the room, textured
 * with a soft gradient so they read as haze rather than a hard sheet.
 * Fully static after mount — no `useFrame`, no per-frame cost at all.
 */
export function LightShaft({ origin, target, width = 1.6, color = '#FFE6C4', opacity = 0.08 }: LightShaftProps) {
  const { geometry, material, mid, quaternion } = useMemo(() => {
    const o = new THREE.Vector3(...origin)
    const t = new THREE.Vector3(...target)
    const length = o.distanceTo(t)
    const geo = new THREE.PlaneGeometry(width, length)
    const map = getShaftTexture()
    const mat = new THREE.MeshBasicMaterial({
      map: map ?? undefined,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
    const dir = t.clone().sub(o).normalize()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    const midpoint = o.clone().add(t).multiplyScalar(0.5)
    return {
      geometry: geo,
      material: mat,
      mid: [midpoint.x, midpoint.y, midpoint.z] as [number, number, number],
      quaternion: quat,
    }
    // Static beam geometry — origin/target define the room's window rig and
    // never change after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.map?.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return (
    <group position={mid} quaternion={quaternion}>
      <mesh geometry={geometry} material={material} renderOrder={5} />
      <mesh geometry={geometry} material={material} rotation={[0, Math.PI / 2, 0]} renderOrder={5} />
    </group>
  )
}
