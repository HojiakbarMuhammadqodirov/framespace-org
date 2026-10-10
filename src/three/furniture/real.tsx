import { Component, Suspense, useEffect, useMemo, type ErrorInfo, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'

import { syncSheen } from './materials'

/**
 * Real, photographed furniture: freely licensed glTF models (Poly Haven CC0,
 * Khronos glTF-Sample-Assets CC0 / CC-BY 4.0 — see
 * `public/models/furniture/CREDITS.md`), optimised offline by
 * `scripts/furniture/build-models.mjs`:
 *
 *   glTF 2.0 -> dedup/prune/weld -> WebP textures (1024, sofa 2048)
 *            -> Meshopt geometry (EXT_meshopt_compression + quantization) -> .glb
 *
 * Meshopt's decoder ships inside three-stdlib (inline WASM), so nothing is
 * fetched from a CDN at runtime — the only requests are the .glb files
 * themselves, served from `public/`. Draco is deliberately unused.
 *
 * Every model was re-rooted at build time so it faces +Z with its width on X
 * (the procedural library's convention). At runtime the bounding box is
 * measured once per clone and the piece is scaled to the caller's real
 * dimensions and sat on the floor, so catalogue footprints, collision boxes
 * and wall snapping stay truthful.
 *
 * Loading always goes through `<RealOrProcedural>`: the procedural stand-in is
 * the Suspense fallback (nothing pops to empty) and the error fallback (a
 * missing or corrupt file degrades to the stand-in instead of taking down the
 * canvas).
 *
 * Disposal: geometry and textures belong to drei's `useGLTF` cache and are
 * shared by every instance and every canvas on the page, so they are not
 * disposed per piece. What a piece owns — its per-instance clones of the
 * tintable materials — is disposed when it unmounts.
 */

/* ---------------------------------------------------------------- registry */

export type RealModelId =
  | 'sofa-glam'
  | 'armchair-lounge'
  | 'armchair-modern'
  | 'chair-dining'
  | 'coffeetable-stone'
  | 'diningtable-wood'
  | 'desk-metal'
  | 'shelf-cube'
  | 'sideboard-fluted'
  | 'plant-ficus'
  | 'pendant-globe'
  | 'divider-screen'

/**
 * How the measured model is mapped onto the caller's w × d × h box.
 * - `box`: per-axis scale to exactly w, h, d (case goods, tables, seating whose
 *   proportions are close to the catalogue's).
 * - `footprint`: one uniform scale that fits inside w × d; height follows.
 * - `height`: one uniform scale to height h, centred (plants, screens).
 * - `native`: the model's own metres (pendants hang from `top`).
 */
export type RealFit = 'box' | 'footprint' | 'height' | 'native'

export interface RealModelSpec {
  fit: RealFit
  /** Sit on the floor (default) or hang so the model's top is at `top`. */
  anchor?: 'floor' | 'top'
  /** Has upholstery whose colour follows the catalogue finish. */
  tintable?: boolean
  /** Material-name pattern of a diffuser that should read as lit (lamps). */
  glow?: RegExp
}

export const REAL_MODELS: Record<RealModelId, RealModelSpec> = {
  'sofa-glam': { fit: 'box', tintable: true },
  'armchair-lounge': { fit: 'box', tintable: true },
  'armchair-modern': { fit: 'footprint', tintable: true },
  'chair-dining': { fit: 'box' },
  'coffeetable-stone': { fit: 'box' },
  'diningtable-wood': { fit: 'box' },
  'desk-metal': { fit: 'box' },
  'shelf-cube': { fit: 'box' },
  'sideboard-fluted': { fit: 'box' },
  'plant-ficus': { fit: 'height' },
  'pendant-globe': { fit: 'native', anchor: 'top', glow: /globe/i },
  'divider-screen': { fit: 'height' },
}

/**
 * Room-builder piece kind -> model. Kinds absent here (bed, wardrobe, rug,
 * floor lamp) have no freely licensed photoreal model good enough yet and keep
 * the procedural piece. Keyed by string so this module does not import the
 * builder's catalogue types.
 */
export const BUILDER_REAL_MODEL: Readonly<Record<string, RealModelId>> = {
  sofa: 'sofa-glam',
  armchair: 'armchair-lounge',
  chair: 'chair-dining',
  lowTable: 'coffeetable-stone',
  diningTable: 'diningtable-wood',
  desk: 'desk-metal',
  shelf: 'shelf-cube',
  sideboard: 'sideboard-fluted',
  plant: 'plant-ficus',
}

/** Catalogue `ProductModelKey` -> model. Absent keys stay procedural. */
export const PRODUCT_REAL_MODEL: Readonly<Record<string, RealModelId>> = {
  sofa: 'sofa-glam',
  armchair: 'armchair-modern',
  diningTable: 'diningtable-wood',
  coffeeTable: 'coffeetable-stone',
  shelf: 'shelf-cube',
  sideboard: 'sideboard-fluted',
  planter: 'plant-ficus',
  pendant: 'pendant-globe',
  divider: 'divider-screen',
}

export function realModelUrl(id: RealModelId): string {
  return `${import.meta.env.BASE_URL}models/furniture/${id}.glb`
}

/** Meshopt on, Draco off (no file uses it, and it would mean a CDN fetch). */
const USE_DRACO = false
const USE_MESHOPT = true

export function preloadRealModel(id: RealModelId | null | undefined) {
  if (id) useGLTF.preload(realModelUrl(id), USE_DRACO, USE_MESHOPT)
}

/* ------------------------------------------------------------------- model */

export interface RealModelProps {
  id: RealModelId
  /** Target dimensions in metres: width (x), depth (z), height (y). */
  w: number
  d: number
  h: number
  /** For hanging models: world y of the model's top. */
  top?: number
  /**
   * Upholstery colour. A live `THREE.Color` (e.g. a procedural material's
   * colour that is being cross-faded elsewhere) is followed every frame; a
   * string is applied once. Omit to keep the model's own colour.
   */
  tint?: THREE.Color | string | null
  /** Cast shadow-map shadows (off on low tier). */
  castShadow?: boolean
}

const MAX_ANISOTROPY = 4
const TEXTURE_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'] as const

type TintMat = THREE.MeshStandardMaterial & Partial<Pick<THREE.MeshPhysicalMaterial, 'sheenColor'>>

/** Warm diffuser glow for lamp shades that should read as switched on. */
const GLOW = new THREE.Color('#ffe2b8')

function prepare(source: THREE.Object3D, anisotropy: number, glow?: RegExp) {
  const object = source.clone(true)
  const tintable: TintMat[] = []
  /** Every per-instance material clone (tint and glow) — this piece owns them. */
  const owned: THREE.Material[] = []
  const clones = new Map<THREE.Material, THREE.Material>()

  const remap = (material: THREE.Material) => {
    const record = material as unknown as Record<string, THREE.Texture | null | undefined>
    for (const slot of TEXTURE_SLOTS) {
      const tex = record[slot]
      // Textures are shared through the loader cache (and across canvases):
      // set once per texture, never per instance.
      if (tex && tex.isTexture && !tex.userData.fsAniso) {
        tex.userData.fsAniso = true
        tex.anisotropy = anisotropy
        tex.needsUpdate = true
      }
    }
    const tint = Boolean(material.userData?.fsTint)
    const lit = Boolean(glow?.test(material.name))
    if (!tint && !lit) return material
    let copy = clones.get(material)
    if (!copy) {
      copy = material.clone()
      clones.set(material, copy)
      owned.push(copy)
      if (tint) tintable.push(copy as TintMat)
      const std = copy as THREE.MeshStandardMaterial
      if (lit && std.isMeshStandardMaterial) {
        std.emissive.copy(GLOW)
        std.emissiveMap = std.map
        std.emissiveIntensity = 0.9
      }
    }
    return copy
  }

  object.traverse((node) => {
    const mesh = node as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(remap) : remap(mesh.material)
  })

  object.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(object)
  return { object, tintable, owned, box }
}

function placement(spec: RealModelSpec, box: THREE.Box3, w: number, d: number, h: number, top?: number) {
  const size = box.getSize(new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  const sx0 = w / Math.max(size.x, 1e-4)
  const sy0 = h / Math.max(size.y, 1e-4)
  const sz0 = d / Math.max(size.z, 1e-4)
  let scale: [number, number, number]
  switch (spec.fit) {
    case 'box':
      scale = [sx0, sy0, sz0]
      break
    case 'footprint': {
      const s = Math.min(sx0, sz0)
      scale = [s, s, s]
      break
    }
    case 'height':
      scale = [sy0, sy0, sy0]
      break
    default:
      scale = [1, 1, 1]
  }
  const y = spec.anchor === 'top' ? (top ?? h) - box.max.y * scale[1] : -box.min.y * scale[1]
  const position: [number, number, number] = [-centre.x * scale[0], y, -centre.z * scale[2]]
  return { scale, position }
}

export function RealModel({ id, w, d, h, top, tint, castShadow = true }: RealModelProps) {
  const spec = REAL_MODELS[id]
  const gltf = useGLTF(realModelUrl(id), USE_DRACO, USE_MESHOPT)
  const invalidate = useThree((state) => state.invalidate)
  const maxAniso = useThree((state) => state.gl.capabilities.getMaxAnisotropy())

  const { object, tintable, owned, box } = useMemo(
    () => prepare(gltf.scene, Math.min(MAX_ANISOTROPY, maxAniso), spec.glow),
    [gltf.scene, maxAniso, spec.glow]
  )
  const { scale, position } = useMemo(() => placement(spec, box, w, d, h, top), [spec, box, w, d, h, top])

  useEffect(() => {
    object.traverse((node) => {
      const mesh = node as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = castShadow
      mesh.receiveShadow = true
    })
    invalidate()
  }, [object, castShadow, invalidate])

  // Per-instance material clones are this piece's to free.
  useEffect(() => () => owned.forEach((m) => m.dispose()), [owned])

  // A string tint is applied once; ask for the frame that applies it.
  useEffect(() => {
    if (tint) invalidate()
  }, [tint, invalidate])

  const scratch = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    if (!tint || tintable.length === 0) return
    const target = typeof tint === 'string' ? scratch.set(tint) : tint
    for (const mat of tintable) {
      if (mat.color.equals(target)) continue
      mat.color.copy(target)
      syncSheen(mat)
    }
  })

  return (
    <group position={position} scale={scale}>
      <primitive object={object} />
    </group>
  )
}

/* ----------------------------------------------------------------- wrapper */

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (import.meta.env.DEV) console.warn('[furniture] model failed, using the procedural stand-in', error, info)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/**
 * The real model when there is one, the procedural piece while it loads, if
 * it fails, or when `id` is null.
 */
export function RealOrProcedural({
  id,
  fallback,
  ...props
}: Omit<RealModelProps, 'id'> & { id: RealModelId | null | undefined; fallback: ReactNode }) {
  if (!id) return <>{fallback}</>
  return (
    <ModelBoundary key={id} fallback={fallback}>
      <Suspense fallback={fallback}>
        <RealModel id={id} {...props} />
      </Suspense>
    </ModelBoundary>
  )
}
