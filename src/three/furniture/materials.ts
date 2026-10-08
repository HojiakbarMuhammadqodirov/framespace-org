import * as THREE from 'three'

import { getArtPrintMap, getRugPatternMap, getWoodFigureMap, disposeMaterialDeep, type RugPattern } from '../materials/maps'
import { getFabricWeaveMap, getMetalScratchMap, getWoodGrainMap } from '../materials/procedural'

/**
 * Material factories for the procedural furniture. Every material keeps a
 * plain `.color` that callers may lerp — maps are near-white greyscale and
 * only ever multiply that colour, so a palette cross-fade never rebuilds a
 * shader.
 */

export type Tier = 'high' | 'low'

const SHEEN_TINT = new THREE.Color('#ffffff')

/** Woven upholstery: sheen lobe for the grazing highlight cloth has, plus a
 * weave in both roughness and bump so it reads as textile up close. */
export function fabric(color: string, tier: Tier, repeat = 5): THREE.MeshStandardMaterial {
  if (tier === 'low') {
    // Low tier / first paint: no sheen lobe. The physical program is the
    // single slowest shader to compile on ANGLE/D3D.
    const plain = new THREE.MeshStandardMaterial({ color, roughness: 0.92 })
    plain.roughnessMap = getFabricWeaveMap(repeat, repeat)
    return plain
  }
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    sheen: 0.6,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(color).lerp(SHEEN_TINT, 0.35),
  })
  mat.roughnessMap = getFabricWeaveMap(repeat, repeat)
  if (tier === 'high') {
    mat.bumpMap = getFabricWeaveMap(repeat * 2, repeat * 2)
    mat.bumpScale = 0.6
  }
  return mat
}

/** Keep a fabric's sheen in step after its colour was lerped. */
export function syncSheen(mat: THREE.Material) {
  const physical = mat as Partial<THREE.MeshPhysicalMaterial>
  if (physical.sheenColor && physical.color) physical.sheenColor.copy(physical.color).lerp(SHEEN_TINT, 0.35)
}

/** Oiled hardwood: figure in the colour map, grain in roughness, a thin
 * satin clearcoat on capable devices. */
export function wood(color: string, tier: Tier, repeat: [number, number] = [1, 1]): THREE.MeshStandardMaterial {
  const params = { color, roughness: 0.58, metalness: 0 }
  const mat =
    tier === 'high'
      ? new THREE.MeshPhysicalMaterial({ ...params, clearcoat: 0.28, clearcoatRoughness: 0.42 })
      : new THREE.MeshStandardMaterial(params)
  mat.map = getWoodFigureMap(repeat[0], repeat[1])
  mat.roughnessMap = getWoodGrainMap(repeat[0] * 2, repeat[1])
  return mat
}

/** Painted / lacquered case goods: smooth, a soft satin highlight. */
export function lacquer(color: string, tier: Tier): THREE.MeshStandardMaterial {
  return tier === 'high'
    ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.35 })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
}

/** Brushed metal, never chrome. */
export function metal(color: string): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.85 })
  mat.roughnessMap = getMetalScratchMap(2, 2)
  return mat
}

/** Glazed ceramic: a crisp clearcoat over a satin body. */
export function ceramic(color: string, tier: Tier): THREE.MeshStandardMaterial {
  return tier === 'high'
    ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, clearcoat: 0.7, clearcoatRoughness: 0.12 })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.4 })
}

export function leaf(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide })
}

export function matte(color: string, roughness = 0.92): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness })
}

/** Lamp shades and sheers: double-sided, and able to glow from within. */
export function shade(color: string, glow: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.95,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(glow),
    emissiveIntensity: 0,
  })
}

export function rug(color: string, pattern: RugPattern, tier: Tier): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.98 })
  mat.map = getRugPatternMap(pattern)
  mat.roughnessMap = getFabricWeaveMap(14, 10)
  if (tier === 'high') {
    mat.bumpMap = getFabricWeaveMap(28, 20)
    mat.bumpScale = 1.2
  }
  return mat
}

export function art(color: string): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
  mat.map = getArtPrintMap()
  return mat
}

export function books(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78, vertexColors: true })
}

/** An unlit emitter: bulbs, the inside of a lit shade. */
export function glow(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color })
}

/* ---------------------------------------------------------------- the set */

/**
 * The material roles every furniture model paints itself with. Scenes build
 * one set (or map their own materials onto these names) and hand it down.
 */
export interface FurnitureMats {
  upholstery: THREE.Material
  cushion: THREE.Material
  pillow: THREE.Material
  accent: THREE.Material
  wood: THREE.Material
  carcass: THREE.Material
  metal: THREE.Material
  ceramic: THREE.Material
  leaf: THREE.Material
  soil: THREE.Material
  linen: THREE.Material
  sheer: THREE.Material
  shade: THREE.Material
  glow: THREE.Material
  rug: THREE.Material
  books: THREE.Material
  art: THREE.Material
}

export interface FurniturePalette {
  upholstery: string
  cushion: string
  pillow: string
  accent: string
  wood: string
  carcass: string
  metal: string
  ceramic: string
  leaf: string
  linen: string
  rug: string
  art: string
  glow: string
}

export function createFurnitureMats(
  p: FurniturePalette,
  tier: Tier,
  rugPattern: RugPattern = 'border',
): FurnitureMats {
  return {
    upholstery: fabric(p.upholstery, tier, 5),
    cushion: fabric(p.cushion, tier, 6),
    pillow: fabric(p.pillow, tier, 4),
    accent: fabric(p.accent, tier, 4),
    wood: wood(p.wood, tier),
    carcass: wood(p.carcass, tier),
    metal: metal(p.metal),
    ceramic: ceramic(p.ceramic, tier),
    leaf: leaf(p.leaf),
    soil: matte('#3b2c22', 1),
    linen: fabric(p.linen, tier, 7),
    sheer: shade(p.linen, p.glow),
    shade: shade(p.linen, p.glow),
    glow: glow(p.glow),
    rug: rug(p.rug, rugPattern, tier),
    books: books(),
    art: art(p.art),
  }
}

export function disposeFurnitureMats(m: Partial<FurnitureMats>) {
  const seen = new Set<THREE.Material>()
  for (const mat of Object.values(m)) {
    if (!mat || seen.has(mat)) continue
    seen.add(mat)
    disposeMaterialDeep(mat)
  }
}
