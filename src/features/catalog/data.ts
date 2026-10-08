import type { ProductModelKey, ProductPalette } from '@/three/ProductViewer'

/**
 * The public catalog, as typed local data.
 *
 * ## There is no catalog API
 *
 * `server/` exposes four routes and none of them is a catalog:
 * `GET /api/health`, `GET /api/angles`, `POST /api/render`, `POST /api/contact`.
 * There is no product table, no model storage and no search index, so nothing
 * on `/catalog` is live and the UI says so on the page rather than pretending.
 *
 * ## What replaces this module
 *
 * | export                | endpoint that should replace it                                        |
 * | --------------------- | ---------------------------------------------------------------------- |
 * | `PRODUCTS` (list)     | `GET /api/catalog/products?category=&style=&room=&minUzs=&maxUzs=&sort=&cursor=` |
 * | `getProduct(id)`      | `GET /api/catalog/products/:id`                                        |
 * | `relatedProducts(id)` | `GET /api/catalog/products/:id/related`                                |
 * | `CATEGORIES`          | `GET /api/catalog/facets` (counts come from the same response)          |
 * | `PRICE_BOUNDS`        | `GET /api/catalog/facets` → `price.{min,max}`                           |
 *
 * The shapes below are what those responses should return verbatim — the same
 * field names, the same units, the same closed enums — so swapping the import
 * for a fetch is the only change the components need. Filtering and sorting
 * live in `./filters` precisely so they can move to the query string later.
 *
 * Units and conventions:
 * - money is **integer UZS**, never a float and never a formatted string;
 * - dimensions are **centimetres**, weight is **kilograms**;
 * - `createdAt` / `updatedAt` are ISO-8601 UTC;
 * - display names and blurbs are **i18n keys**, not prose. A real endpoint
 *   returns them already localised from `Accept-Language`; keeping them in
 *   `src/i18n/sections/catalog.ts` means the demo honours the same rule the
 *   rest of the app follows — every visible string goes through `t()`.
 */

/* ------------------------------------------------------------------- enums */

/**
 * The closed enum from the render contract — `brief.furniture[].category` in
 * `POST /api/render` (docs/API-INVENTORY.md §3, `server/claude.js`). The
 * catalog reuses it verbatim so an AI-generated shopping list can be resolved
 * against real stock without a mapping table.
 */
export const CATEGORIES = [
  'seating',
  'table',
  'storage',
  'bed',
  'lighting',
  'rug',
  'textiles',
  'wall-decor',
  'plants',
  'paint-and-finishes',
  'other',
] as const

export type ProductCategory = (typeof CATEGORIES)[number]

/** Mirrors the eight style names in `src/lib/styles.js`, which are contract. */
export const STYLE_KEYS = [
  'scandinavian',
  'japandi',
  'minimalist',
  'midCentury',
  'industrial',
  'bohemian',
  'modernLuxe',
  'coastal',
] as const

export type ProductStyle = (typeof STYLE_KEYS)[number]

export const ROOM_KEYS = [
  'living',
  'bedroom',
  'dining',
  'kitchen',
  'office',
  'hallway',
  'kids',
] as const

export type RoomType = (typeof ROOM_KEYS)[number]

export const SORT_KEYS = [
  'featured',
  'priceAsc',
  'priceDesc',
  'newest',
  'placements',
] as const

export type SortKey = (typeof SORT_KEYS)[number]

/** Pipeline state of the piece's 3D asset. Drives the badge on every card. */
export type ModelStatus = 'ready' | 'processing' | 'missing'

/* ------------------------------------------------------------------ shapes */

export interface ProductDimensions {
  widthCm: number
  depthCm: number
  heightCm: number
  /** Seating and beds only. */
  seatHeightCm?: number
}

export interface Product {
  id: string
  /** URL segment. `/catalog/:id` accepts either this or `id`. */
  slug: string
  /** i18n key suffix under `catalog.products.<nameKey>`. */
  nameKey: string
  brand: string
  vendorSlug: string
  category: ProductCategory
  style: ProductStyle
  rooms: RoomType[]
  /** Integer UZS. */
  priceUzs: number
  /** Integer UZS, or null when the piece has never been discounted. */
  compareAtUzs: number | null
  currency: 'UZS'
  /** Which primitive stand-in `ProductViewer` draws; later, which `.glb` to load. */
  model: ProductModelKey
  modelStatus: ModelStatus
  /** Byte size the eventual `.glb` is budgeted at — shown in the vendor table. */
  modelBytes: number
  palette: ProductPalette
  dimensions: ProductDimensions
  weightKg: number
  /** i18n key suffixes under `catalog.materials.*`. */
  materialKeys: string[]
  /** i18n key suffix under `catalog.colors.*`. */
  colorKey: string
  inStock: boolean
  leadTimeDays: number
  rating: number
  reviews: number
  /** Times a visitor dropped this piece into their own room. The metric. */
  placements: number
  views: number
  /** Gets a wider cell in the bento grid. */
  featured: boolean
  createdAt: string
}

/* ---------------------------------------------------------------- palettes */

/* Palettes are raw material for the WebGL scene, the same way `ROOM_STYLES` in
   HeroRoom.tsx is: they describe a physical product's finish, not the UI, so
   they are hex here and never leak into CSS. */
const P = {
  clayLinen: {
    body: '#C2714B',
    accent: '#8E4A2E',
    wood: '#8A6244',
    metal: '#8E8579',
    fabric: '#E4D9CB',
    neutral: '#F0E7DA',
  },
  paleOak: {
    body: '#E6DCCB',
    accent: '#B9A88F',
    wood: '#CBB394',
    metal: '#9A9186',
    fabric: '#F2ECE1',
    neutral: '#FAF5EC',
  },
  deepClay: {
    body: '#6B4A35',
    accent: '#A9603F',
    wood: '#4A3529',
    metal: '#7A5A2E',
    fabric: '#C9B49A',
    neutral: '#E9DFD0',
  },
  walnut: {
    body: '#7A5136',
    accent: '#C6552F',
    wood: '#5A3A27',
    metal: '#8E8579',
    fabric: '#D8CBBA',
    neutral: '#EFE8DD',
  },
  stone: {
    body: '#D5CEC2',
    accent: '#8E8579',
    wood: '#A98F72',
    metal: '#6F6A63',
    fabric: '#EDE6DB',
    neutral: '#F6F1E9',
  },
  sage: {
    body: '#7E8C6E',
    accent: '#5C6E55',
    wood: '#A67B5B',
    metal: '#8E8579',
    fabric: '#DDE1D3',
    neutral: '#F1F0E7',
  },
  indigo: {
    body: '#4E5A6B',
    accent: '#C6552F',
    wood: '#6B4A35',
    metal: '#B0A99C',
    fabric: '#CED6DF',
    neutral: '#EDEFF2',
  },
  brass: {
    body: '#B4832A',
    accent: '#8A6214',
    wood: '#6B4A35',
    metal: '#C8A24E',
    fabric: '#E4D9CB',
    neutral: '#FBF1DC',
  },
  ecru: {
    body: '#EFE8DD',
    accent: '#C6552F',
    wood: '#C9B49A',
    metal: '#9A9186',
    fabric: '#F6F1E9',
    neutral: '#FFFDF7',
  },
  terracotta: {
    body: '#A8452F',
    accent: '#E4D9CB',
    wood: '#6B4A35',
    metal: '#8E8579',
    fabric: '#C08A63',
    neutral: '#F2E2CB',
  },
} satisfies Record<string, ProductPalette>

/* ---------------------------------------------------------------- the list */

/** `GET /api/catalog/products` → `{ items: Product[], nextCursor: string | null }`. */
export const PRODUCTS: Product[] = [
  {
    id: 'fs-sofa-bahor',
    slug: 'bahor-uch-kishilik-divan',
    nameKey: 'sofaBahor',
    brand: 'Oqtepa Mebel',
    vendorSlug: 'oqtepa',
    category: 'seating',
    style: 'japandi',
    rooms: ['living'],
    priceUzs: 12_400_000,
    compareAtUzs: 14_900_000,
    currency: 'UZS',
    model: 'sofa',
    modelStatus: 'ready',
    modelBytes: 1_842_000,
    palette: P.clayLinen,
    dimensions: { widthCm: 220, depthCm: 92, heightCm: 78, seatHeightCm: 42 },
    weightKg: 64,
    materialKeys: ['linen', 'oak', 'foam'],
    colorKey: 'terracotta',
    inStock: true,
    leadTimeDays: 14,
    rating: 4.7,
    reviews: 128,
    placements: 3421,
    views: 41_200,
    featured: true,
    createdAt: '2026-02-11T09:00:00Z',
  },
  {
    id: 'fs-chair-chinor',
    slug: 'chinor-dam-olish-kursisi',
    nameKey: 'chairChinor',
    brand: 'Oqtepa Mebel',
    vendorSlug: 'oqtepa',
    category: 'seating',
    style: 'scandinavian',
    rooms: ['living', 'office'],
    priceUzs: 4_850_000,
    compareAtUzs: null,
    currency: 'UZS',
    model: 'armchair',
    modelStatus: 'ready',
    modelBytes: 940_000,
    palette: P.paleOak,
    dimensions: { widthCm: 84, depthCm: 80, heightCm: 86, seatHeightCm: 44 },
    weightKg: 18,
    materialKeys: ['oak', 'wool', 'foam'],
    colorKey: 'sand',
    inStock: true,
    leadTimeDays: 7,
    rating: 4.5,
    reviews: 64,
    placements: 1980,
    views: 22_700,
    featured: false,
    createdAt: '2026-03-02T09:00:00Z',
  },
  {
    id: 'fs-sofa-registon',
    slug: 'registon-modul-divan',
    nameKey: 'sofaRegiston',
    brand: 'Registon Atelier',
    vendorSlug: 'registon',
    category: 'seating',
    style: 'modernLuxe',
    rooms: ['living'],
    priceUzs: 21_900_000,
    compareAtUzs: null,
    currency: 'UZS',
    model: 'sofa',
    modelStatus: 'ready',
    modelBytes: 2_410_000,
    palette: P.deepClay,
    dimensions: { widthCm: 268, depthCm: 104, heightCm: 74, seatHeightCm: 41 },
    weightKg: 92,
    materialKeys: ['velvet', 'walnut', 'brass'],
    colorKey: 'clay',
    inStock: true,
    leadTimeDays: 28,
    rating: 4.9,
    reviews: 41,
    placements: 2764,
    views: 38_900,
    featured: true,
    createdAt: '2026-01-19T09:00:00Z',
  },
  {
    id: 'fs-table-dasturxon',
    slug: 'dasturxon-ovqat-stoli',
    nameKey: 'tableDasturxon',
    brand: 'Chorsu Works',
    vendorSlug: 'chorsu',
    category: 'table',
    style: 'midCentury',
    rooms: ['dining', 'kitchen'],
    priceUzs: 9_600_000,
    compareAtUzs: 10_400_000,
    currency: 'UZS',
    model: 'diningTable',
    modelStatus: 'ready',
    modelBytes: 760_000,
    palette: P.walnut,
    dimensions: { widthCm: 190, depthCm: 92, heightCm: 75 },
    weightKg: 46,
    materialKeys: ['walnut', 'steel'],
    colorKey: 'walnut',
    inStock: true,
    leadTimeDays: 21,
    rating: 4.6,
    reviews: 87,
    placements: 2210,
    views: 26_400,
    featured: false,
    createdAt: '2026-02-24T09:00:00Z',
  },
  {
    id: 'fs-table-marmar',
    slug: 'marmar-jurnal-stoli',
    nameKey: 'tableMarmar',
    brand: 'Chorsu Works',
    vendorSlug: 'chorsu',
    category: 'table',
    style: 'minimalist',
    rooms: ['living'],
    priceUzs: 5_200_000,
    compareAtUzs: null,
    currency: 'UZS',
    model: 'coffeeTable',
    modelStatus: 'processing',
    modelBytes: 512_000,
    palette: P.stone,
    dimensions: { widthCm: 110, depthCm: 60, heightCm: 38 },
    weightKg: 34,
    materialKeys: ['travertine', 'ash'],
    colorKey: 'stone',
    inStock: true,
    leadTimeDays: 10,
    rating: 4.4,
    reviews: 52,
    placements: 1408,
    views: 18_300,
    featured: false,
    createdAt: '2026-03-14T09:00:00Z',
  },
  {
    id: 'fs-shelf-toq',
    slug: 'toq-ochiq-javon',
    nameKey: 'shelfToq',
    brand: 'Registon Atelier',
    vendorSlug: 'registon',
    category: 'storage',
    style: 'midCentury',
    rooms: ['living', 'office'],
    priceUzs: 7_300_000,
    compareAtUzs: null,
    currency: 'UZS',
    model: 'shelf',
    modelStatus: 'ready',
    modelBytes: 1_120_000,
    palette: P.walnut,
    dimensions: { widthCm: 112, depthCm: 34, heightCm: 192 },
    weightKg: 41,
    materialKeys: ['walnut', 'steel'],
    colorKey: 'walnut',
    inStock: true,
    leadTimeDays: 18,
    rating: 4.6,
    reviews: 39,
    placements: 1642,
    views: 15_900,
    featured: false,
    createdAt: '2026-02-05T09:00:00Z',
  },
  {
    id: 'fs-sideboard-sandiq',
    slug: 'sandiq-komod',
    nameKey: 'sideboardSandiq',
    brand: 'Oqtepa Mebel',
    vendorSlug: 'oqtepa',
    category: 'storage',
    style: 'modernLuxe',
    rooms: ['dining', 'hallway'],
    priceUzs: 11_200_000,
    compareAtUzs: 12_800_000,
    currency: 'UZS',
    model: 'sideboard',
    modelStatus: 'ready',
    modelBytes: 1_380_000,
    palette: P.indigo,
    dimensions: { widthCm: 166, depthCm: 46, heightCm: 82 },
    weightKg: 58,
    materialKeys: ['lacquer', 'oak', 'brass'],
    colorKey: 'indigo',
    inStock: false,
    leadTimeDays: 35,
    rating: 4.8,
    reviews: 23,
    placements: 1120,
    views: 12_600,
    featured: false,
    createdAt: '2026-01-08T09:00:00Z',
  },
  {
    id: 'fs-bed-osoyish',
    slug: 'osoyish-platforma-karavot',
    nameKey: 'bedOsoyish',
    brand: 'Chorsu Works',
    vendorSlug: 'chorsu',
    category: 'bed',
    style: 'japandi',
    rooms: ['bedroom'],
    priceUzs: 14_700_000,
    compareAtUzs: null,
    currency: 'UZS',
    model: 'bed',
    modelStatus: 'ready',
    modelBytes: 1_960_000,
    palette: P.paleOak,
    dimensions: { widthCm: 186, depthCm: 208, heightCm: 92, seatHeightCm: 38 },
    weightKg: 78,
    materialKeys: ['ash', 'linen'],
    colorKey: 'sand',
    inStock: true,
    leadTimeDays: 24,
    rating: 4.8,
    reviews: 96,
    placements: 3010,
    views: 34_800,
    featured: true,
    createdAt: '2026-02-18T09:00:00Z',
  },
  {
    id: 'fs-bed-ipak',
    slug: 'ipak-yumshoq-karavot',
    nameKey: 'bedIpak',
    brand: 'Registon Atelier',
    vendorSlug: 'registon',
    category: 'bed',
    style: 'modernLuxe',
    rooms: ['bedroom'],
    priceUzs: 18_300_000,
    compareAtUzs: null,
    currency: 'UZS',
    model: 'bed',
    modelStatus: 'processing',
    modelBytes: 2_180_000,
    palette: P.deepClay,
    dimensions: { widthCm: 192, depthCm: 214, heightCm: 118, seatHeightCm: 40 },
    weightKg: 96,
    materialKeys: ['velvet', 'walnut', 'foam'],
    colorKey: 'clay',
    inStock: true,
    leadTimeDays: 30,
    rating: 4.7,
    reviews: 31,
    placements: 1486,
    views: 17_400,
    featured: false,
    createdAt: '2026-03-06T09:00:00Z',
  },
  {
    id: 'fs-lamp-quyosh',
    slug: 'quyosh-osma-chiroq',
    nameKey: 'lampQuyosh',
    brand: 'Yorugʻ Studio',
    vendorSlug: 'yorug',
    category: 'lighting',
    style: 'industrial',
    rooms: ['dining', 'kitchen'],
    priceUzs: 2_950_000,
    compareAtUzs: null,
    currency: 'UZS',
    model: 'pendant',
    modelStatus: 'ready',
    modelBytes: 420_000,
    palette: P.brass,
    dimensions: { widthCm: 46, depthCm: 46, heightCm: 112 },
    weightKg: 4.2,
    materialKeys: ['brass', 'steel'],
    colorKey: 'brass',
    inStock: true,
    leadTimeDays: 5,
    rating: 4.5,
    reviews: 142,
    placements: 2890,
    views: 29_100,
    featured: false,
    createdAt: '2026-03-21T09:00:00Z',
  },
  {
    id: 'fs-lamp-shamol',
    slug: 'shamol-tokcha-chiroq',
    nameKey: 'lampShamol',
    brand: 'Yorugʻ Studio',
    vendorSlug: 'yorug',
    category: 'lighting',
    style: 'japandi',
    rooms: ['living', 'bedroom'],
    priceUzs: 3_400_000,
    compareAtUzs: 3_900_000,
    currency: 'UZS',
    model: 'floorLamp',
    modelStatus: 'ready',
    modelBytes: 486_000,
    palette: P.ecru,
    dimensions: { widthCm: 50, depthCm: 50, heightCm: 172 },
    weightKg: 6.8,
    materialKeys: ['paper', 'ash', 'steel'],
    colorKey: 'ecru',
    inStock: true,
    leadTimeDays: 6,
    rating: 4.6,
    reviews: 74,
    placements: 2115,
    views: 21_500,
    featured: false,
    createdAt: '2026-03-11T09:00:00Z',
  },
  {
    id: 'fs-rug-suzani',
    slug: 'suzani-qoʻlbola-gilam',
    nameKey: 'rugSuzani',
    brand: 'Marg‘ilon Textile',
    vendorSlug: 'margilon',
    category: 'rug',
    style: 'bohemian',
    rooms: ['living', 'bedroom'],
    priceUzs: 8_900_000,
    compareAtUzs: null,
    currency: 'UZS',
    model: 'rug',
    modelStatus: 'ready',
    modelBytes: 640_000,
    palette: P.terracotta,
    dimensions: { widthCm: 240, depthCm: 170, heightCm: 2 },
    weightKg: 12,
    materialKeys: ['wool', 'silk'],
    colorKey: 'terracotta',
    inStock: true,
    leadTimeDays: 12,
    rating: 4.9,
    reviews: 58,
    placements: 3288,
    views: 36_200,
    featured: true,
    createdAt: '2026-01-29T09:00:00Z',
  },
  {
    id: 'fs-curtain-zarafshon',
    slug: 'zarafshon-zigir-parda',
    nameKey: 'curtainZarafshon',
    brand: 'Marg‘ilon Textile',
    vendorSlug: 'margilon',
    category: 'textiles',
    style: 'coastal',
    rooms: ['bedroom', 'living'],
    priceUzs: 2_100_000,
    compareAtUzs: null,
    currency: 'UZS',
    model: 'curtain',
    modelStatus: 'processing',
    modelBytes: 380_000,
    palette: P.stone,
    dimensions: { widthCm: 210, depthCm: 8, heightCm: 260 },
    weightKg: 3.4,
    materialKeys: ['linen'],
    colorKey: 'stone',
    inStock: true,
    leadTimeDays: 9,
    rating: 4.3,
    reviews: 112,
    placements: 1042,
    views: 14_100,
    featured: false,
    createdAt: '2026-03-25T09:00:00Z',
  },
  {
    id: 'fs-panel-ganch',
    slug: 'ganch-devor-paneli',
    nameKey: 'panelGanch',
    brand: 'Registon Atelier',
    vendorSlug: 'registon',
    category: 'wall-decor',
    style: 'modernLuxe',
    rooms: ['hallway', 'living'],
    priceUzs: 6_400_000,
    compareAtUzs: null,
    currency: 'UZS',
    model: 'wallPanel',
    modelStatus: 'missing',
    modelBytes: 0,
    palette: P.ecru,
    dimensions: { widthCm: 130, depthCm: 7, heightCm: 100 },
    weightKg: 16,
    materialKeys: ['plaster', 'oak'],
    colorKey: 'ecru',
    inStock: true,
    leadTimeDays: 26,
    rating: 4.8,
    reviews: 17,
    placements: 624,
    views: 8_900,
    featured: false,
    createdAt: '2026-02-01T09:00:00Z',
  },
  {
    id: 'fs-planter-bog',
    slug: 'bog-terrazzo-guldon',
    nameKey: 'planterBog',
    brand: 'Yorugʻ Studio',
    vendorSlug: 'yorug',
    category: 'plants',
    style: 'minimalist',
    rooms: ['living', 'office'],
    priceUzs: 1_450_000,
    compareAtUzs: 1_690_000,
    currency: 'UZS',
    model: 'planter',
    modelStatus: 'ready',
    modelBytes: 310_000,
    palette: P.sage,
    dimensions: { widthCm: 44, depthCm: 44, heightCm: 124 },
    weightKg: 9.5,
    materialKeys: ['terrazzo', 'steel'],
    colorKey: 'sage',
    inStock: true,
    leadTimeDays: 4,
    rating: 4.4,
    reviews: 203,
    placements: 1876,
    views: 24_800,
    featured: false,
    createdAt: '2026-04-02T09:00:00Z',
  },
  {
    id: 'fs-paint-loy',
    slug: 'loy-mineral-boyoq-toplami',
    nameKey: 'paintLoy',
    brand: 'Chorsu Works',
    vendorSlug: 'chorsu',
    category: 'paint-and-finishes',
    style: 'minimalist',
    rooms: ['living', 'bedroom', 'kitchen', 'office', 'hallway', 'kids'],
    priceUzs: 890_000,
    compareAtUzs: null,
    currency: 'UZS',
    model: 'paintSet',
    modelStatus: 'ready',
    modelBytes: 220_000,
    palette: P.clayLinen,
    dimensions: { widthCm: 96, depthCm: 60, heightCm: 32 },
    weightKg: 14,
    materialKeys: ['mineral'],
    colorKey: 'clay',
    inStock: true,
    leadTimeDays: 3,
    rating: 4.2,
    reviews: 311,
    placements: 742,
    views: 19_600,
    featured: false,
    createdAt: '2026-04-09T09:00:00Z',
  },
  {
    id: 'fs-divider-panjara',
    slug: 'panjara-xona-boluvchi',
    nameKey: 'dividerPanjara',
    brand: 'Marg‘ilon Textile',
    vendorSlug: 'margilon',
    category: 'other',
    style: 'bohemian',
    rooms: ['living', 'office', 'kids'],
    priceUzs: 4_300_000,
    compareAtUzs: null,
    currency: 'UZS',
    model: 'divider',
    modelStatus: 'ready',
    modelBytes: 880_000,
    palette: P.sage,
    dimensions: { widthCm: 186, depthCm: 4, heightCm: 180 },
    weightKg: 22,
    materialKeys: ['ash', 'paper'],
    colorKey: 'sage',
    inStock: true,
    leadTimeDays: 15,
    rating: 4.5,
    reviews: 28,
    placements: 968,
    views: 11_300,
    featured: false,
    createdAt: '2026-03-30T09:00:00Z',
  },
]

/* ----------------------------------------------------------------- derived */

/** `GET /api/catalog/facets` → `price: { minUzs, maxUzs }`. */
export const PRICE_BOUNDS = {
  minUzs: PRODUCTS.reduce((min, p) => Math.min(min, p.priceUzs), Infinity),
  maxUzs: PRODUCTS.reduce((max, p) => Math.max(max, p.priceUzs), 0),
}

/** Facet counts, as `GET /api/catalog/facets` would return them. */
export function categoryCounts(): Record<ProductCategory, number> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<ProductCategory, number>
  for (const product of PRODUCTS) out[product.category] += 1
  return out
}

/** `GET /api/catalog/products/:id` — accepts the id or the slug. */
export function getProduct(idOrSlug: string | undefined): Product | undefined {
  if (!idOrSlug) return undefined
  return PRODUCTS.find((p) => p.id === idOrSlug || p.slug === idOrSlug)
}

/** `GET /api/catalog/products/:id/related` — same style first, then category. */
export function relatedProducts(id: string, limit = 3): Product[] {
  const product = getProduct(id)
  if (!product) return PRODUCTS.slice(0, limit)
  const score = (other: Product) =>
    (other.style === product.style ? 2 : 0) + (other.category === product.category ? 1 : 0)
  return PRODUCTS.filter((p) => p.id !== product.id)
    .sort((a, b) => score(b) - score(a) || b.placements - a.placements)
    .slice(0, limit)
}

/** Every product a given vendor lists — the business dashboard's product set. */
export function productsByVendor(vendorSlug: string): Product[] {
  return PRODUCTS.filter((p) => p.vendorSlug === vendorSlug)
}

/* ---------------------------------------------------------------- finishes */

/** Every finish the stand-in models can be shown in. i18n: `catalog.finishes.<key>`. */
export const FINISHES = P
export type FinishKey = keyof typeof P

const FINISH_ORDER = Object.keys(P) as FinishKey[]

/**
 * The finishes a piece is offered in: its own first, then three neighbours on
 * the palette wheel. Deterministic per product, so a shared link and a reload
 * show the same choice. A real `GET /api/catalog/products/:id` returns
 * `variants[]` instead.
 */
export function finishesFor(product: Product, limit = 4): Array<{ key: FinishKey; palette: ProductPalette }> {
  const own = FINISH_ORDER.find((key) => P[key] === product.palette) ?? FINISH_ORDER[0]
  const seed = product.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  const rest = FINISH_ORDER.filter((key) => key !== own)
  const picks: FinishKey[] = [own]
  for (let i = 0; picks.length < Math.min(limit, FINISH_ORDER.length); i += 1) {
    const key = rest[(seed + i * 3) % rest.length]
    if (!picks.includes(key)) picks.push(key)
  }
  return picks.map((key) => ({ key, palette: P[key] }))
}

/* ------------------------------------------------------------ room builder */

/**
 * Which piece in the 3D room builder (`features/room-builder/catalog.ts`) stands
 * in for a product's model. Pieces without one (curtains, paint, wall panels…)
 * fall back to the photo flow, because the builder has no wall-dressing yet.
 */
const BUILDER_PIECE: Partial<Record<ProductModelKey, string>> = {
  sofa: 'sofa3',
  armchair: 'armchair',
  diningTable: 'diningTable',
  coffeeTable: 'coffeeTable',
  shelf: 'shelf',
  sideboard: 'sideboard',
  bed: 'bed',
  floorLamp: 'floorLamp',
  rug: 'rug',
  planter: 'plant',
}

export function builderPieceFor(product: Product): string | null {
  return BUILDER_PIECE[product.model] ?? null
}
