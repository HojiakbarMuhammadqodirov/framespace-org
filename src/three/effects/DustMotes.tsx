import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useSceneReducedMotion } from '../Canvas'
import { getGlowSpriteTexture } from '../materials/procedural'

export interface DustMotesProps {
  /** Centre of the drift volume, in world units. */
  center: [number, number, number]
  /** Half-extents of the drift volume the motes wrap inside. */
  size: [number, number, number]
  count?: number
  color?: string
}

/**
 * A single `THREE.Points` cloud drifting inside a box near the window —
 * one draw call, a tiny additive sprite, a per-mote sine sway computed on
 * plain typed arrays (no allocation in the frame loop).
 *
 * Frozen in place (not hidden) under `prefers-reduced-motion`: the motes
 * still read as dust in the light, they just stop moving.
 */
export function DustMotes({ center, size, count = 200, color = '#FFE1B0' }: DustMotesProps) {
  const reduced = useSceneReducedMotion()
  const pointsRef = useRef<THREE.Points>(null)
  const speeds = useMemo(() => {
    const arr = new Float32Array(count)
    for (let i = 0; i < count; i += 1) arr[i] = 0.018 + Math.random() * 0.05
    return arr
  }, [count])

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      positions[i * 3 + 0] = center[0] + (Math.random() * 2 - 1) * size[0]
      positions[i * 3 + 1] = center[1] + (Math.random() * 2 - 1) * size[1]
      positions[i * 3 + 2] = center[2] + (Math.random() * 2 - 1) * size[2]
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const map = getGlowSpriteTexture()
    const mat = new THREE.PointsMaterial({
      size: 0.02,
      map: map ?? undefined,
      color,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    })
    return { geometry: geo, material: mat }
    // Volume + count are fixed for the lifetime of one mount; re-seeding on
    // every colour cross-fade would be visible as a pop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  useEffect(
    () => () => {
      geometry.dispose()
      material.map?.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((_, delta) => {
    if (reduced) return
    const pos = geometry.attributes.position as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const top = center[1] + size[1]
    const bottom = center[1] - size[1]
    for (let i = 0; i < count; i += 1) {
      const iy = i * 3 + 1
      arr[iy] += speeds[i] * delta
      if (arr[iy] > top) arr[iy] = bottom
      const ix = i * 3
      arr[ix] += Math.sin(arr[iy] * 2.1 + i) * 0.0006
    }
    pos.needsUpdate = true
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
}
