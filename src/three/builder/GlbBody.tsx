import { Component, useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'

import type { ItemSize } from '@/features/room-builder/types'

/**
 * Modelled furniture (.glb) for the pieces where primitives stop being
 * convincing: buttoned upholstery, turned legs, real foliage.
 *
 * The files live in /public/models, meshopt-compressed with WebP textures
 * (see docs/MODELS.md for sources, licences and how to add one). They are
 * fetched only when a piece that uses them is placed, and only on capable
 * devices — the code-built body is both the loading state and the low-tier
 * fallback, so the editor never waits on a download.
 *
 * A model is normalised on load: centred on its footprint, stood on the floor,
 * and scaled to the piece's catalogue (or resized) dimensions. That keeps the
 * collision boxes, wall snapping and the budget's "2.2 × 1.0 m" all truthful
 * regardless of the units the artist worked in.
 */

/** Which of a model's materials take the piece's finish colour. */
const TINTABLE: Record<string, RegExp> = {
  'sofa-velvet': /fabric/i,
  'accent-chair': /fabric/i,
}

/**
 * Quarter-turns that bring a model's front round to +Z, the way every
 * code-built piece faces. Artists do not agree on which way is forward.
 */
const YAW: Record<string, number> = {
  'sofa-velvet': Math.PI,
}

export function modelUrl(name: string): string {
  return `${import.meta.env.BASE_URL}models/${name}.glb`
}

interface Built {
  root: THREE.Object3D
  natural: THREE.Vector3
  tinted: THREE.MeshStandardMaterial[]
}

export function GlbModel({ name, size, tint }: { name: string; size: ItemSize; tint: string | null }) {
  // Draco off, meshopt on: the decoder is bundled, nothing is fetched from a CDN.
  const gltf = useGLTF(modelUrl(name), false, true)
  const invalidate = useThree((state) => state.invalidate)

  const built = useMemo<Built>(() => {
    // Every placed piece gets its own node tree (so two sofas can stand in one
    // room) but shares geometry and textures with the cached original.
    const root = gltf.scene.clone(true)
    root.rotation.y = YAW[name] ?? 0
    const tintable = TINTABLE[name]
    const own = new Map<THREE.Material, THREE.MeshStandardMaterial>()
    root.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const material = mesh.material
      if (!tintable || Array.isArray(material) || !tintable.test(material.name)) return
      // The finish belongs to this piece alone: clone once, re-colour freely.
      let mine = own.get(material)
      if (!mine) {
        mine = (material as THREE.MeshStandardMaterial).clone()
        own.set(material, mine)
      }
      mesh.material = mine
    })
    root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(root)
    const natural = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    root.position.set(-centre.x, -box.min.y, -centre.z)
    // Own wrapper, so the centring offset is not multiplied into the yaw.
    const holder = new THREE.Group()
    holder.add(root)
    return { root: holder, natural, tinted: [...own.values()] }
  }, [gltf, name])

  useEffect(() => {
    invalidate()
    return () => built.tinted.forEach((material) => material.dispose())
  }, [built, invalidate])

  useEffect(() => {
    if (!tint) return
    for (const material of built.tinted) {
      material.color.set(tint)
      // Velvet and bouclé get their look from sheen; keep it in the fabric's
      // own hue, lifted toward white, or a dark finish goes grey at the edges.
      const physical = material as THREE.MeshPhysicalMaterial
      if (physical.isMeshPhysicalMaterial && physical.sheen > 0) {
        physical.sheenColor.set(tint).lerp(WHITE, 0.35)
      }
    }
    invalidate()
  }, [built, tint, invalidate])

  const { natural } = built
  return (
    <group
      scale={[
        size.w / Math.max(natural.x, 1e-3),
        size.h / Math.max(natural.y, 1e-3),
        size.d / Math.max(natural.z, 1e-3),
      ]}
    >
      <primitive object={built.root} />
    </group>
  )
}

const WHITE = new THREE.Color('#ffffff')

/**
 * A model that fails to download (offline, a blocked request) must not take
 * the editor down with it: the code-built body simply stays.
 */
export class ModelBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
