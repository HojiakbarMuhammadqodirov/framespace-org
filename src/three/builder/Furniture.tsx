import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'

import { MATERIAL_HEX, entryFor, type CatalogEntry, type PieceKind } from '@/features/room-builder/catalog'
import { useBuilder } from '@/features/room-builder/store'
import type { Item } from '@/features/room-builder/types'
import { armDrag } from './dragIntent'
import { useKit } from './kit'
import {
  fabric,
  leaf,
  rug,
  shade,
  syncSheen,
  wood,
  type FurnitureMats,
  type Tier,
} from '../furniture/materials'
import { disposeMaterialDeep } from '../materials/maps'
import { QUALITY } from '@/features/room-builder/quality'
import { BUILDER_REAL_MODEL, RealOrProcedural, preloadRealModel } from '../furniture/real'
import {
  Armchair,
  Bed,
  Bookshelf,
  CoffeeTable,
  Desk,
  DiningChair,
  DiningTable,
  FloorLamp,
  Plant,
  Rug,
  Sideboard,
  Sofa,
  Wardrobe,
} from '../furniture/models'

/**
 * Catalogue pieces at each entry's real dimensions: a real, freely licensed
 * glTF model where one exists for the kind (`src/three/furniture/real.tsx`,
 * credits in `public/models/furniture/CREDITS.md`), otherwise — and while that
 * model loads, or if it fails — the shared procedural furniture library
 * (`src/three/furniture/models.tsx`).
 *
 * Real models are measured and scaled into the catalogue box, so the
 * footprint the store collides and wall-snaps with is still the truth.
 * Pointer events bubble from any of a model's meshes to the piece group, so
 * selecting, dragging and the selection outline work identically either way.
 * Finish colour reaches a real model only on upholstered kinds (sofa,
 * armchair); wood, stone and metal keep their photographed textures, because
 * multiplying a scanned walnut by an "oak" swatch reads as paint, not timber.
 *
 * Every piece owns exactly one material — its finish — so a finish change is
 * a colour cross-fade rather than a cut, the same lerp idiom HeroRoom uses.
 * Which part of the piece the finish paints depends on the kind (upholstery
 * on a sofa, boards on a table, foliage on a plant); every other role comes
 * from the kit's shared set. Models stay inside their catalogue footprint, so
 * the collision boxes and wall snapping in the store remain truthful.
 *
 * Local axes: +Z is the direction the piece faces, +X is its width.
 */

const LERP_MS = 320

type FinishRole = keyof FurnitureMats

/** Which furniture role the item's finish paints, per kind. */
const FINISH_ROLE: Record<PieceKind, FinishRole[]> = {
  sofa: ['upholstery', 'cushion'],
  armchair: ['upholstery', 'cushion'],
  bed: ['upholstery'],
  chair: ['wood'],
  lowTable: ['wood'],
  diningTable: ['wood'],
  desk: ['wood'],
  wardrobe: ['carcass'],
  shelf: ['carcass'],
  sideboard: ['carcass'],
  rug: ['rug'],
  floorLamp: ['shade'],
  plant: ['leaf'],
}

function makeFinish(kind: PieceKind, color: string, tier: Tier): THREE.MeshStandardMaterial {
  switch (FINISH_ROLE[kind][0]) {
    case 'upholstery':
      return fabric(color, tier, 5)
    case 'rug':
      return rug(color, 'border', tier)
    case 'shade':
      return shade(color, '#ffd9a8')
    case 'leaf':
      return leaf(color)
    default:
      return wood(color, tier)
  }
}

function useFinish(item: Item, kind: PieceKind) {
  const tier = useBuilder((s) => s.quality)
  const material = useMemo(
    () => makeFinish(kind, MATERIAL_HEX[item.material], tier),
    // Built once per piece (and tier) and then lerped; rebuilding it on a
    // finish change would recompile a shader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, tier]
  )
  const anim = useRef({ t: 1, from: new THREE.Color(), to: new THREE.Color() })
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    const target = new THREE.Color(MATERIAL_HEX[item.material])
    if (material.color.equals(target)) return
    anim.current = { t: 0, from: material.color.clone(), to: target }
    invalidate()
  }, [item.material, material, invalidate])

  useEffect(() => () => disposeMaterialDeep(material), [material])

  useFrame((_, delta) => {
    const a = anim.current
    if (a.t >= 1) return
    a.t = Math.min(1, a.t + (Math.min(delta, 1 / 30) * 1000) / LERP_MS)
    const e = 1 - Math.pow(1 - a.t, 3)
    material.color.copy(a.from).lerp(a.to, e)
    syncSheen(material)
    // Demand-rendered canvas: the cross-fade asks for frames until it lands.
    if (a.t < 1) invalidate()
  })

  return material
}

/** Height the body sits at. Kept for callers that size things off the legs. */
export function legHeight(entry: CatalogEntry): number {
  switch (entry.kind) {
    case 'sofa':
      return 0.14
    case 'armchair':
      return 0.2
    case 'chair':
      return 0.42
    case 'sideboard':
      return 0.14
    default:
      return entry.h - 0.06
  }
}

/* ------------------------------------------------------------------ bodies */

function FloorLampPiece({ entry, m }: { entry: CatalogEntry; m: FurnitureMats }) {
  const lighting = useBuilder((s) => s.scene.lighting)
  const lit = lighting === 'lamps' || lighting === 'evening'
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    // The finish is this piece's own material, so the glow is per lamp.
    ;(m.shade as THREE.MeshStandardMaterial).emissiveIntensity = lit ? 0.6 : 0
    invalidate()
  }, [m.shade, lit, invalidate])
  return <FloorLamp m={m} h={entry.h} lit={lit} intensity={lighting === 'lamps' ? 7 : 4} />
}

/**
 * The real, photographed model for the kind when one exists (see
 * `../furniture/real.tsx`), with the procedural piece as its loading and
 * error fallback, so nothing ever pops to empty. Upholstered kinds follow the
 * item's finish: the procedural finish material keeps cross-fading and the
 * model's tintable fabric copies its colour every frame.
 */
function Body({ entry, m }: { entry: CatalogEntry; m: FurnitureMats }) {
  const tier = useBuilder((s) => s.quality)
  const procedural = <ProceduralBody entry={entry} m={m} />
  const id = BUILDER_REAL_MODEL[entry.kind]
  const upholstered = FINISH_ROLE[entry.kind][0] === 'upholstery'
  return (
    <RealOrProcedural
      id={id}
      fallback={procedural}
      w={entry.w}
      d={entry.d}
      h={entry.h}
      tint={upholstered ? (m.upholstery as THREE.MeshStandardMaterial).color : null}
      castShadow={QUALITY[tier].shadows}
    />
  )
}

function ProceduralBody({ entry, m }: { entry: CatalogEntry; m: FurnitureMats }) {
  const { w, d, h } = entry
  switch (entry.kind) {
    case 'sofa':
      return <Sofa m={m} w={w} d={d} h={h} />
    case 'armchair':
      return <Armchair m={m} w={w} d={d} h={h} />
    case 'lowTable':
      return <CoffeeTable m={m} w={w} d={d} h={h} />
    case 'diningTable':
      return <DiningTable m={m} w={w} d={d} h={h} />
    case 'desk':
      return <Desk m={m} w={w} d={d} h={h} />
    case 'chair':
      return <DiningChair m={m} w={w} d={d} h={h} />
    case 'bed':
      return <Bed m={m} w={w} d={d} h={h} />
    case 'wardrobe':
      return <Wardrobe m={m} w={w} d={d} h={h} />
    case 'shelf':
      return <Bookshelf m={m} w={w} d={d} h={h} />
    case 'sideboard':
      return <Sideboard m={m} w={w} d={d} h={h} />
    case 'rug':
      return <Rug m={m} w={w} d={d} fringe={false} />
    case 'floorLamp':
      return <FloorLampPiece entry={entry} m={m} />
    default:
      return <Plant m={m} h={h} w={w} kind="fiddle" />
  }
}

/* ------------------------------------------------------------------ piece */

function RotateHandle({ item, entry }: { item: Item; entry: CatalogEntry }) {
  const { geo, mats } = useKit()
  const reach = entry.d / 2 + 0.3
  return (
    <group
      position={[0, 0.02, reach]}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation()
        armDrag(event, () => useBuilder.getState().beginDrag({ kind: 'rotate', id: item.id }))
      }}
    >
      <mesh geometry={geo.ring} material={mats.handle} rotation={[-Math.PI / 2, 0, 0]} scale={0.34} />
      {/* An invisible disc gives the ring a 44px-equivalent grab area. */}
      <mesh
        geometry={geo.cyl}
        rotation={[0, 0, 0]}
        scale={[0.34, 0.04, 0.34]}
        visible={false}
        userData={{ hit: true }}
      />
    </group>
  )
}

function Piece({ item, colliding }: { item: Item; colliding: boolean }) {
  const { geo, mats, fmats } = useKit()
  const entry = entryFor(item.catalogId)
  const material = useFinish(item, entry.kind)
  const m = useMemo<FurnitureMats>(() => {
    const set = { ...fmats }
    for (const role of FINISH_ROLE[entry.kind]) set[role] = material
    return set
  }, [fmats, material, entry.kind])
  const selected = useBuilder((s) => s.selection?.kind === 'item' && s.selection.id === item.id)

  function onDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation()
    const state = useBuilder.getState()
    state.select({ kind: 'item', id: item.id })
    // The grab offset is taken now, at the press, so the piece does not jump
    // by the threshold distance when the drag finally starts.
    const grabX = event.point.x - item.x
    const grabZ = event.point.z - item.z
    armDrag(event, () =>
      useBuilder.getState().beginDrag({ kind: 'item', id: item.id, grabX, grabZ })
    )
  }

  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.rotation, 0]} onPointerDown={onDown}>
      <Body entry={entry} m={m} />
      {(selected || colliding) && (
        <lineSegments
          geometry={geo.edges}
          material={colliding ? mats.collide : mats.select}
          position={[0, entry.h / 2 + 0.01, 0]}
          scale={[entry.w + 0.04, entry.h + 0.02, entry.d + 0.04]}
        />
      )}
      {selected && <RotateHandle item={item} entry={entry} />}
    </group>
  )
}

export function Furniture({ collisions }: { collisions: Set<string> }) {
  const items = useBuilder((s) => s.scene.items)
  // Start every model in the room downloading at once instead of one
  // Suspense boundary at a time (useGLTF de-dupes repeat requests).
  // Keyed on the set of catalogue ids, not on positions, so a drag does not re-run it.
  const catalogKey = [...new Set(items.map((item) => item.catalogId))].sort().join(',')
  useEffect(() => {
    for (const id of catalogKey.split(',')) {
      if (id) preloadRealModel(BUILDER_REAL_MODEL[entryFor(id).kind])
    }
  }, [catalogKey])
  return (
    <group>
      {items.map((item) => (
        <Piece key={item.id} item={item} colliding={collisions.has(item.id)} />
      ))}
    </group>
  )
}

export default Furniture
