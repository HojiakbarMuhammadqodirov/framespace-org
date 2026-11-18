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
import type { FloorKey, Item, ItemSize, MaterialKey } from './types'

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
  | 'tvStand'
  | 'sideTable'
  | 'pouf'
  | 'nightstand'

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
  /**
   * A scanned/modelled .glb that replaces the code-built body on capable
   * devices (see src/three/builder/models.ts). The code-built body stays as
   * the loading state and as the whole story on low-tier GPUs.
   */
  model?: string
  /** False when the piece's look is baked into its model and cannot be re-coloured. */
  tintable?: boolean
  /** Variant handed to the code-built body (plant species, seat count…). */
  variant?: string
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
    w: 2.2,
    d: 1.0,
    h: 0.8,
    model: 'sofa-velvet',
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
    d: 0.62,
    h: 0.72,
    model: 'accent-chair',
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
    w: 0.7,
    d: 0.66,
    h: 0.85,
    model: 'plant-pot',
    tintable: false,
    price: 420_000,
    hugsWall: false,
    material: 'olive',
    legs: 0,
    apiCategory: 'plants',
  },
  {
    id: 'sofa2',
    kind: 'sofa',
    group: 'seating',
    w: 1.6,
    d: 0.9,
    h: 0.82,
    price: 4_300_000,
    hugsWall: true,
    material: 'sand',
    legs: 4,
    apiCategory: 'seating',
  },
  {
    id: 'sofaClassic',
    kind: 'sofa',
    group: 'seating',
    w: 2.7,
    d: 0.92,
    h: 1.1,
    price: 11_500_000,
    hugsWall: true,
    material: 'walnut',
    legs: 4,
    model: 'sofa-classic',
    tintable: false,
    apiCategory: 'seating',
  },
  {
    id: 'pouf',
    kind: 'pouf',
    group: 'seating',
    w: 0.55,
    d: 0.55,
    h: 0.4,
    price: 540_000,
    hugsWall: false,
    material: 'terracotta',
    legs: 0,
    apiCategory: 'seating',
  },
  {
    id: 'sideTable',
    kind: 'sideTable',
    group: 'tables',
    w: 0.5,
    d: 0.5,
    h: 0.52,
    price: 620_000,
    hugsWall: false,
    material: 'walnut',
    legs: 0,
    apiCategory: 'table',
  },
  {
    id: 'tvStand',
    kind: 'tvStand',
    group: 'storage',
    w: 1.6,
    d: 0.42,
    h: 1.2,
    price: 2_900_000,
    hugsWall: true,
    material: 'oak',
    legs: 4,
    apiCategory: 'storage',
  },
  {
    id: 'nightstand',
    kind: 'nightstand',
    group: 'sleep',
    w: 0.48,
    d: 0.4,
    h: 0.52,
    price: 780_000,
    hugsWall: true,
    material: 'oak',
    legs: 4,
    apiCategory: 'storage',
  },
  {
    id: 'bedSingle',
    kind: 'bed',
    group: 'sleep',
    w: 0.95,
    d: 2.0,
    h: 0.5,
    price: 3_900_000,
    hugsWall: true,
    material: 'sand',
    legs: 0,
    apiCategory: 'bed',
  },
  {
    id: 'rugRunner',
    kind: 'rug',
    group: 'soft',
    w: 0.8,
    d: 2.4,
    h: 0.02,
    price: 950_000,
    hugsWall: false,
    material: 'clay',
    legs: 0,
    apiCategory: 'rug',
  },
  {
    id: 'palm',
    kind: 'plant',
    group: 'soft',
    w: 0.6,
    d: 0.6,
    h: 1.5,
    price: 560_000,
    hugsWall: false,
    material: 'olive',
    legs: 0,
    variant: 'palm',
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

/* ------------------------------------------------------------------ sizes */

/** How far a piece may be stretched or shrunk from its catalogue size. */
export const SIZE_RANGE = { min: 0.6, max: 1.6 } as const

/** The dimensions a placed piece actually has: its own if resized, else the catalogue's. */
export function sizeOf(item: Pick<Item, 'catalogId' | 'size'>): ItemSize {
  if (item.size) return item.size
  const entry = entryFor(item.catalogId)
  return { w: entry.w, d: entry.d, h: entry.h }
}

/** Clamps a requested size to a sane range around the catalogue's, at 1 cm. */
export function clampSize(catalogId: string, size: ItemSize): ItemSize {
  const entry = entryFor(catalogId)
  const fit = (value: number, base: number) => {
    const min = Math.max(0.02, base * SIZE_RANGE.min)
    const max = base * SIZE_RANGE.max
    const v = Number.isFinite(value) ? value : base
    return Math.round(Math.min(max, Math.max(min, v)) * 100) / 100
  }
  return { w: fit(size.w, entry.w), d: fit(size.d, entry.d), h: fit(size.h, entry.h) }
}

/** True when the piece is still at its catalogue size. */
export function isStockSize(item: Pick<Item, 'catalogId' | 'size'>): boolean {
  if (!item.size) return true
  const entry = entryFor(item.catalogId)
  return item.size.w === entry.w && item.size.d === entry.d && item.size.h === entry.h
}

/* --------------------------------------------------------------- surfaces */

/** Wall paints offered as swatches. Any hex is valid; these are the presets. */
export const WALL_PAINTS: Array<{ id: string; hex: string }> = [
  { id: 'chalk', hex: '#f4efe6' },
  { id: 'white', hex: '#fbfaf7' },
  { id: 'linen', hex: '#e9e0d1' },
  { id: 'greige', hex: '#d3c8b8' },
  { id: 'sage', hex: '#b9c2ad' },
  { id: 'mist', hex: '#c5d0d6' },
  { id: 'blush', hex: '#e4c9bd' },
  { id: 'ochre', hex: '#d9b06a' },
  { id: 'terracotta', hex: '#bd6a4a' },
  { id: 'forest', hex: '#48604f' },
  { id: 'navy', hex: '#2f3e52' },
  { id: 'charcoal', hex: '#3b3836' },
]

export const CEILING_PAINTS: Array<{ id: string; hex: string }> = [
  { id: 'white', hex: '#fbfaf7' },
  { id: 'chalk', hex: '#f4efe6' },
  { id: 'linen', hex: '#e9e0d1' },
  { id: 'charcoal', hex: '#3b3836' },
]

/** Swatch colour per floor covering (the 3D texture is drawn in src/three/materials/floors.ts). */
export const FLOORS: Array<{ id: FloorKey; hex: string }> = [
  { id: 'oak', hex: '#c8a47a' },
  { id: 'ash', hex: '#dcc9ac' },
  { id: 'walnut', hex: '#6f4d36' },
  { id: 'herringbone', hex: '#b98f63' },
  { id: 'tile', hex: '#d9d4cb' },
  { id: 'concrete', hex: '#a9a6a0' },
  { id: 'carpet', hex: '#b9ae9f' },
]

export const DEFAULT_SURFACES = {
  wall: '#f4efe6',
  wallOverrides: {},
  floor: 'oak' as FloorKey,
  ceiling: '#fbfaf7',
}

/** A finish surcharge would be a lie without a supplier, so it is flat. */
export function priceOf(catalogId: string): number {
  return entryFor(catalogId).price
}
