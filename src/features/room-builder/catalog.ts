/**
 * The furniture catalogue.
 *
 * There are no .glb assets in this repository and none are wanted, so every
 * piece is described here as a box of real dimensions and built from primitive
 * geometry in src/three/builder. Prices are UZS, mid-market Tashkent retail —
 * they exist to make the budget counter mean something, not as a price list.
 *
 * Labels are NOT here: they live in src/i18n/sections/builder.ts under
 * `builder.catalog.<id>`, because the catalogue is data and data is not copy.
 */
import type { MaterialKey } from './types'

export type CatalogGroup = 'seating' | 'tables' | 'storage' | 'sleep' | 'soft' | 'lighting'

/** Which primitive assembly draws the piece. */
export type PieceKind =
  | 'sofa'
  | 'armchair'
  | 'lowTable'
  | 'diningTable'
  | 'chair'
  | 'desk'
  | 'bed'
  | 'wardrobe'
  | 'shelf'
  | 'sideboard'
  | 'rug'
  | 'floorLamp'
  | 'plant'

export interface CatalogEntry {
  id: string
  kind: PieceKind
  group: CatalogGroup
  /** Footprint and height in metres: w = east–west at rotation 0. */
  w: number
  d: number
  h: number
  /** UZS. */
  price: number
  /** Pieces that want their back against a wall snap and align when close. */
  hugsWall: boolean
  material: MaterialKey
  /** Number of legs the shared instanced leg mesh should draw under it. */
  legs: 0 | 4
  /** Carries a lamp in the "lamps only" lighting preset. */
  emits?: boolean
  /** The closed `furniture.category` enum the render API already speaks. */
  apiCategory:
    | 'seating'
    | 'table'
    | 'storage'
    | 'bed'
    | 'lighting'
    | 'rug'
    | 'textiles'
    | 'plants'
    | 'other'
}

export const CATALOG: CatalogEntry[] = [
  {
    id: 'sofa3',
    kind: 'sofa',
    group: 'seating',
    w: 2.1,
    d: 0.9,
    h: 0.82,
    price: 5_900_000,
    hugsWall: true,
    material: 'linen',
    legs: 4,
    apiCategory: 'seating',
  },
  {
    id: 'armchair',
    kind: 'armchair',
    group: 'seating',
    w: 0.82,
    d: 0.86,
    h: 0.78,
    price: 2_400_000,
    hugsWall: false,
    material: 'clay',
    legs: 4,
    apiCategory: 'seating',
  },
  {
    id: 'chair',
    kind: 'chair',
    group: 'seating',
    w: 0.46,
    d: 0.5,
    h: 0.88,
    price: 690_000,
    hugsWall: false,
    material: 'oak',
    legs: 4,
    apiCategory: 'seating',
  },
  {
    id: 'coffeeTable',
    kind: 'lowTable',
    group: 'tables',
    w: 1.1,
    d: 0.6,
    h: 0.42,
    price: 1_350_000,
    hugsWall: false,
    material: 'oak',
    legs: 4,
    apiCategory: 'table',
  },
  {
    id: 'diningTable',
    kind: 'diningTable',
    group: 'tables',
    w: 1.6,
    d: 0.9,
    h: 0.75,
    price: 3_200_000,
    hugsWall: false,
    material: 'walnut',
    legs: 4,
    apiCategory: 'table',
  },
  {
    id: 'desk',
    kind: 'desk',
    group: 'tables',
    w: 1.4,
    d: 0.7,
    h: 0.75,
    price: 2_300_000,
    hugsWall: true,
    material: 'oak',
    legs: 4,
    apiCategory: 'table',
  },
  {
    id: 'wardrobe',
    kind: 'wardrobe',
    group: 'storage',
    w: 1.8,
    d: 0.6,
    h: 2.1,
    price: 6_800_000,
    hugsWall: true,
    material: 'walnut',
    legs: 0,
    apiCategory: 'storage',
  },
  {
    id: 'shelf',
    kind: 'shelf',
    group: 'storage',
    w: 0.9,
    d: 0.35,
    h: 1.8,
    price: 2_100_000,
    hugsWall: true,
    material: 'oak',
    legs: 0,
    apiCategory: 'storage',
  },
  {
    id: 'sideboard',
    kind: 'sideboard',
    group: 'storage',
    w: 1.4,
    d: 0.45,
    h: 0.72,
    price: 3_600_000,
    hugsWall: true,
    material: 'walnut',
    legs: 4,
    apiCategory: 'storage',
  },
  {
    id: 'bed',
    kind: 'bed',
    group: 'sleep',
    w: 1.6,
    d: 2.0,
    h: 0.55,
    price: 7_400_000,
    hugsWall: true,
    material: 'linen',
    legs: 0,
    apiCategory: 'bed',
  },
  {
    id: 'rug',
    kind: 'rug',
    group: 'soft',
    w: 2.4,
    d: 1.7,
    h: 0.02,
    price: 1_800_000,
    hugsWall: false,
    material: 'terracotta',
    legs: 0,
    apiCategory: 'rug',
  },
  {
    id: 'plant',
    kind: 'plant',
    group: 'soft',
    w: 0.6,
    d: 0.6,
    h: 1.1,
    price: 420_000,
    hugsWall: false,
    material: 'olive',
    legs: 0,
    apiCategory: 'plants',
  },
  {
    id: 'floorLamp',
    kind: 'floorLamp',
    group: 'lighting',
    w: 0.44,
    d: 0.44,
    h: 1.72,
    price: 980_000,
    hugsWall: false,
    material: 'sand',
    legs: 0,
    emits: true,
    apiCategory: 'lighting',
  },
]

export const CATALOG_GROUPS: CatalogGroup[] = [
  'seating',
  'tables',
  'storage',
  'sleep',
  'soft',
  'lighting',
]

const BY_ID = new Map(CATALOG.map((entry) => [entry.id, entry]))

/** Never throws: an unknown id falls back to the first entry so the scene renders. */
export function entryFor(catalogId: string): CatalogEntry {
  return BY_ID.get(catalogId) ?? CATALOG[0]
}

/** Every finish offered in the inspector, in swatch order. */
export const MATERIAL_KEYS: MaterialKey[] = [
  'oak',
  'walnut',
  'ink',
  'linen',
  'sand',
  'clay',
  'olive',
  'terracotta',
]

/** Hex per finish. The 3D scene cannot read a CSS variable, so the ramp lives here. */
export const MATERIAL_HEX: Record<MaterialKey, string> = {
  oak: '#c9a87c',
  walnut: '#6b4a35',
  ink: '#2a1d16',
  linen: '#efe8dd',
  sand: '#e4d9cb',
  clay: '#a67b5b',
  olive: '#6e7f63',
  terracotta: '#c6552f',
}

/** A finish surcharge would be a lie without a supplier, so it is flat. */
export function priceOf(catalogId: string): number {
  return entryFor(catalogId).price
}
