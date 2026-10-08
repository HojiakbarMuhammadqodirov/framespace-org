import { PRODUCTS, type ModelStatus, type Product } from '@/features/catalog/data'

/**
 * The business dashboard, as typed local data.
 *
 * ## There is no business API
 *
 * `server/` has four routes: `GET /api/health`, `GET /api/angles`,
 * `POST /api/render`, `POST /api/contact`. There is no auth, no vendor table,
 * no analytics store, no leads inbox and no upload endpoint. Nothing on
 * `/business/*` is live, no screen pretends otherwise, and the bulk-upload
 * form validates and previews locally and then stops — it has nowhere to POST.
 *
 * ## What replaces this module
 *
 * | export             | endpoint that should replace it                                   |
 * | ------------------ | ----------------------------------------------------------------- |
 * | `BUSINESS`         | `GET /api/business/profile`                                       |
 * | `OVERVIEW_METRICS` | `GET /api/business/overview?range=30d`                            |
 * | `ACTIVITY`         | `GET /api/business/activity?limit=`                               |
 * | `VENDOR_PRODUCTS`  | `GET /api/business/products` · `PATCH /api/business/products/:sku` |
 * | (bulk upload)      | `POST /api/business/products/bulk` (multipart: .glb + images + csv) |
 * | `LEADS`            | `GET /api/business/leads?status=` · `PATCH /api/business/leads/:id` |
 * | `ANALYTICS`        | `GET /api/business/analytics?range=30d&metric=`                   |
 * | `BRANDING`         | `GET /api/business/branding` · `PATCH /api/business/branding`     |
 * | `TEAM`             | `GET /api/business/team` · `POST /api/business/team/invite`       |
 * | `getStore(slug)`   | `GET /api/store/:slug` (public, unauthenticated)                  |
 *
 * Conventions, same as the catalog module: integer UZS, centimetres,
 * kilograms, ISO-8601 UTC timestamps, closed enums, and i18n **keys** wherever
 * the string is chrome. Three kinds of string stay literal because they are
 * user-generated content that no translation layer should touch: a customer's
 * message, a person's name, and a vendor's own brand copy.
 */

/* ----------------------------------------------------------------- profile */

export type BusinessPlan = 'trial' | 'studio' | 'atelier'

export interface BusinessProfile {
  id: string
  /** The public `/store/:slug` segment. */
  slug: string
  /** Vendor-entered brand name — user content, never translated. */
  legalName: string
  displayName: string
  city: string
  plan: BusinessPlan
  memberSince: string
  /** Catalog vendor slugs this account owns. */
  vendorSlugs: string[]
  modelQuotaTotal: number
  modelQuotaUsed: number
}

/** `GET /api/business/profile` */
export const BUSINESS: BusinessProfile = {
  id: 'biz-oqtepa-group',
  slug: 'oqtepa',
  legalName: 'OOO «Oqtepa Mebel Group»',
  displayName: 'Oqtepa Mebel',
  city: 'Toshkent',
  plan: 'studio',
  memberSince: '2025-09-04T00:00:00Z',
  vendorSlugs: ['oqtepa', 'chorsu', 'yorug'],
  modelQuotaTotal: 60,
  modelQuotaUsed: 23,
}

/* ---------------------------------------------------------------- overview */

export type MetricTone = 'primary' | 'normal'

export interface OverviewMetric {
  /** i18n key suffix under `business.overview.metrics.<id>`. */
  id: string
  value: number
  /** 'count' | 'uzs' | 'percent' | 'seconds' — decides the formatter. */
  format: 'count' | 'uzs' | 'percent' | 'seconds'
  /** Change against the previous 30-day window, in percent. */
  deltaPct: number
  /** 12 weekly buckets, oldest first — the sparkline. */
  trend: number[]
  /**
   * `primary` gets the big slot. Exactly one metric is primary and it is
   * placements: a view is a glance, a placement is a decision.
   */
  tone: MetricTone
}

/** `GET /api/business/overview?range=30d` */
export const OVERVIEW_METRICS: OverviewMetric[] = [
  {
    id: 'placements',
    value: 4182,
    format: 'count',
    deltaPct: 18.4,
    trend: [212, 243, 231, 268, 279, 301, 288, 324, 346, 361, 388, 402],
    tone: 'primary',
  },
  {
    id: 'views',
    value: 128_400,
    format: 'count',
    deltaPct: 6.2,
    trend: [8200, 8600, 8100, 9100, 9400, 9900, 9700, 10400, 10900, 11200, 11800, 12100],
    tone: 'normal',
  },
  {
    id: 'rotations',
    value: 41_900,
    format: 'count',
    deltaPct: 11.1,
    trend: [2600, 2800, 2700, 3100, 3200, 3400, 3300, 3600, 3800, 3900, 4100, 4300],
    tone: 'normal',
  },
  {
    id: 'contacts',
    value: 612,
    format: 'count',
    deltaPct: 24.8,
    trend: [28, 31, 30, 36, 38, 41, 44, 48, 52, 56, 61, 66],
    tone: 'normal',
  },
  {
    id: 'pipeline',
    value: 486_400_000,
    format: 'uzs',
    deltaPct: 9.4,
    trend: [
      28_000_000, 31_000_000, 29_000_000, 34_000_000, 36_000_000, 39_000_000, 41_000_000,
      43_000_000, 46_000_000, 48_000_000, 52_000_000, 56_000_000,
    ],
    tone: 'normal',
  },
  {
    id: 'placementRate',
    value: 3.26,
    format: 'percent',
    deltaPct: 12.0,
    trend: [2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.9, 3.0, 3.1, 3.2, 3.2, 3.3],
    tone: 'normal',
  },
]

export interface ActivityEvent {
  id: string
  /** i18n key suffix under `business.overview.activity.<kind>`, interpolated
      with `{{name}}` / `{{count}}`. */
  kind: 'modelReady' | 'lead' | 'placementSpike' | 'priceChange' | 'teamJoined' | 'modelFailed'
  at: string
  /** Literal — a person's or a product's own name. */
  subject: string
  count?: number
}

/** `GET /api/business/activity?limit=` */
export const ACTIVITY: ActivityEvent[] = [
  { id: 'ev-1', kind: 'placementSpike', at: '2026-09-21T07:40:00Z', subject: 'Bahor', count: 214 },
  { id: 'ev-2', kind: 'lead', at: '2026-09-21T06:12:00Z', subject: 'Dilnoza Rahimova' },
  { id: 'ev-3', kind: 'modelReady', at: '2026-09-20T15:02:00Z', subject: 'Shamol' },
  { id: 'ev-4', kind: 'priceChange', at: '2026-09-20T11:35:00Z', subject: 'Dasturxon' },
  { id: 'ev-5', kind: 'modelFailed', at: '2026-09-19T18:20:00Z', subject: 'Marmar' },
  { id: 'ev-6', kind: 'teamJoined', at: '2026-09-18T09:05:00Z', subject: 'Javohir Toʻrayev' },
]

/* ---------------------------------------------------------------- products */

export type ListingState = 'published' | 'draft' | 'archived'

export interface VendorProduct {
  sku: string
  /** Catalog row this listing points at. */
  productId: string
  state: ListingState
  modelStatus: ModelStatus
  /** Size of the `.glb` the pipeline produced, in bytes. 0 when there is none. */
  modelBytes: number
  /** Triangle count after Draco. 0 when there is no model. */
  triangles: number
  /** Integer UZS — the vendor's own price, the catalog mirrors it. */
  priceUzs: number
  stock: number
  updatedAt: string
  views30d: number
  rotations30d: number
  placements30d: number
  contacts30d: number
}

/** `GET /api/business/products` — this account's listings across its vendors. */
export const VENDOR_PRODUCTS: VendorProduct[] = [
  {
    sku: 'OQ-SOF-0114',
    productId: 'fs-sofa-bahor',
    state: 'published',
    modelStatus: 'ready',
    modelBytes: 1_842_000,
    triangles: 48_200,
    priceUzs: 12_400_000,
    stock: 6,
    updatedAt: '2026-09-18T10:20:00Z',
    views30d: 18_420,
    rotations30d: 7_120,
    placements30d: 986,
    contacts30d: 142,
  },
  {
    sku: 'OQ-CHR-0221',
    productId: 'fs-chair-chinor',
    state: 'published',
    modelStatus: 'ready',
    modelBytes: 940_000,
    triangles: 22_400,
    priceUzs: 4_850_000,
    stock: 14,
    updatedAt: '2026-09-16T08:02:00Z',
    views30d: 11_260,
    rotations30d: 4_380,
    placements30d: 604,
    contacts30d: 88,
  },
  {
    sku: 'OQ-SID-0308',
    productId: 'fs-sideboard-sandiq',
    state: 'published',
    modelStatus: 'ready',
    modelBytes: 1_380_000,
    triangles: 31_900,
    priceUzs: 11_200_000,
    stock: 0,
    updatedAt: '2026-09-11T13:44:00Z',
    views30d: 6_140,
    rotations30d: 2_020,
    placements30d: 288,
    contacts30d: 61,
  },
  {
    sku: 'CH-TBL-0402',
    productId: 'fs-table-dasturxon',
    state: 'published',
    modelStatus: 'ready',
    modelBytes: 760_000,
    triangles: 14_800,
    priceUzs: 9_600_000,
    stock: 9,
    updatedAt: '2026-09-20T11:35:00Z',
    views30d: 12_980,
    rotations30d: 4_960,
    placements30d: 712,
    contacts30d: 96,
  },
  {
    sku: 'CH-TBL-0417',
    productId: 'fs-table-marmar',
    state: 'published',
    modelStatus: 'processing',
    modelBytes: 0,
    triangles: 0,
    priceUzs: 5_200_000,
    stock: 11,
    updatedAt: '2026-09-19T18:20:00Z',
    views30d: 8_640,
    rotations30d: 2_410,
    placements30d: 318,
    contacts30d: 44,
  },
  {
    sku: 'CH-BED-0511',
    productId: 'fs-bed-osoyish',
    state: 'published',
    modelStatus: 'ready',
    modelBytes: 1_960_000,
    triangles: 52_600,
    priceUzs: 14_700_000,
    stock: 4,
    updatedAt: '2026-09-14T09:18:00Z',
    views30d: 15_320,
    rotations30d: 6_040,
    placements30d: 874,
    contacts30d: 118,
  },
  {
    sku: 'CH-PNT-0620',
    productId: 'fs-paint-loy',
    state: 'draft',
    modelStatus: 'ready',
    modelBytes: 220_000,
    triangles: 5_200,
    priceUzs: 890_000,
    stock: 120,
    updatedAt: '2026-09-21T05:50:00Z',
    views30d: 2_140,
    rotations30d: 640,
    placements30d: 96,
    contacts30d: 7,
  },
  {
    sku: 'YO-LMP-0703',
    productId: 'fs-lamp-quyosh',
    state: 'published',
    modelStatus: 'ready',
    modelBytes: 420_000,
    triangles: 9_800,
    priceUzs: 2_950_000,
    stock: 32,
    updatedAt: '2026-09-17T16:26:00Z',
    views30d: 9_880,
    rotations30d: 3_640,
    placements30d: 512,
    contacts30d: 52,
  },
  {
    sku: 'YO-LMP-0714',
    productId: 'fs-lamp-shamol',
    state: 'published',
    modelStatus: 'ready',
    modelBytes: 486_000,
    triangles: 11_200,
    priceUzs: 3_400_000,
    stock: 18,
    updatedAt: '2026-09-20T15:02:00Z',
    views30d: 7_420,
    rotations30d: 2_880,
    placements30d: 404,
    contacts30d: 39,
  },
  {
    sku: 'YO-PLT-0808',
    productId: 'fs-planter-bog',
    state: 'archived',
    modelStatus: 'missing',
    modelBytes: 0,
    triangles: 0,
    priceUzs: 1_450_000,
    stock: 0,
    updatedAt: '2026-08-29T12:00:00Z',
    views30d: 1_020,
    rotations30d: 210,
    placements30d: 28,
    contacts30d: 3,
  },
]

/** Joins a listing row to its public catalog record. */
export function catalogFor(sku: string): Product | undefined {
  const row = VENDOR_PRODUCTS.find((p) => p.sku === sku)
  return row ? PRODUCTS.find((p) => p.id === row.productId) : undefined
}

export function productById(productId: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === productId)
}

/* ------------------------------------------------------------------- leads */

export type LeadStatus = 'new' | 'open' | 'won' | 'lost'
export type LeadChannel = 'store' | 'catalog' | 'room' | 'qr'

export interface Lead {
  id: string
  /** Literal — the customer typed it. */
  name: string
  /** Masked in the demo the way an unexported record should be. */
  phone: string
  city: string
  channel: LeadChannel
  status: LeadStatus
  productId: string | null
  /** Integer UZS, or null when they did not say. */
  budgetUzs: number | null
  /** Literal — the customer's own words, never translated. */
  message: string
  /** How many room photos they attached to the enquiry. */
  photos: number
  /** Whether they had already placed the piece in their room before writing. */
  placedFirst: boolean
  createdAt: string
}

/** `GET /api/business/leads` */
export const LEADS: Lead[] = [
  {
    id: 'ld-2411',
    name: 'Dilnoza Rahimova',
    phone: '+998 90 ••• 42 18',
    city: 'Toshkent',
    channel: 'room',
    status: 'new',
    productId: 'fs-sofa-bahor',
    budgetUzs: 15_000_000,
    message:
      'Divanni xonamga qoʻyib koʻrdim, oʻlchami toʻgʻri keldi. Terrakota rangi boshqa matoda ham bormi?',
    photos: 4,
    placedFirst: true,
    createdAt: '2026-09-21T06:12:00Z',
  },
  {
    id: 'ld-2410',
    name: 'Sardor Yusupov',
    phone: '+998 93 ••• 07 55',
    city: 'Samarqand',
    channel: 'catalog',
    status: 'new',
    productId: 'fs-bed-osoyish',
    budgetUzs: 20_000_000,
    message: 'Karavot 160×200 oʻlchamda ham chiqadimi? Yetkazib berish Samarqandga qancha turadi?',
    photos: 0,
    placedFirst: false,
    createdAt: '2026-09-20T17:48:00Z',
  },
  {
    id: 'ld-2409',
    name: 'Nigora Abdullayeva',
    phone: '+998 97 ••• 31 06',
    city: 'Toshkent',
    channel: 'store',
    status: 'open',
    productId: 'fs-table-dasturxon',
    budgetUzs: 12_000_000,
    message:
      'Здравствуйте! Стол понравился, но нужна длина 220 см. Делаете на заказ? Фото комнаты прикрепила.',
    photos: 3,
    placedFirst: true,
    createdAt: '2026-09-20T09:22:00Z',
  },
  {
    id: 'ld-2408',
    name: 'Javlon Ergashev',
    phone: '+998 91 ••• 88 24',
    city: 'Buxoro',
    channel: 'qr',
    status: 'open',
    productId: 'fs-lamp-quyosh',
    budgetUzs: null,
    message: 'Doʻkonda QR kodni skanerladim. Shu chiroqdan 6 dona kerak, restoran uchun.',
    photos: 1,
    placedFirst: false,
    createdAt: '2026-09-19T14:05:00Z',
  },
  {
    id: 'ld-2407',
    name: 'Kamola Sobirova',
    phone: '+998 99 ••• 12 77',
    city: 'Toshkent',
    channel: 'room',
    status: 'won',
    productId: 'fs-chair-chinor',
    budgetUzs: 6_000_000,
    message: 'Ikkita kursi oldim, rahmat. Xonaga qoʻyib koʻrganim juda yordam berdi.',
    photos: 6,
    placedFirst: true,
    createdAt: '2026-09-17T11:40:00Z',
  },
  {
    id: 'ld-2406',
    name: 'Rustam Qodirov',
    phone: '+998 90 ••• 63 91',
    city: 'Namangan',
    channel: 'catalog',
    status: 'lost',
    productId: 'fs-sideboard-sandiq',
    budgetUzs: 8_000_000,
    message: 'Narxi byudjetdan oshib ketdi. Arzonroq variant boʻlsa yozing.',
    photos: 0,
    placedFirst: false,
    createdAt: '2026-09-15T08:30:00Z',
  },
  {
    id: 'ld-2405',
    name: 'Malika Tursunova',
    phone: '+998 94 ••• 55 03',
    city: 'Toshkent',
    channel: 'store',
    status: 'open',
    productId: 'fs-lamp-shamol',
    budgetUzs: 4_000_000,
    message: 'Тоrsher понравился. Можно посмотреть его вживую в шоуруме на Чиланзаре?',
    photos: 2,
    placedFirst: true,
    createdAt: '2026-09-14T16:18:00Z',
  },
  {
    id: 'ld-2404',
    name: 'Bekzod Nazarov',
    phone: '+998 88 ••• 29 40',
    city: 'Andijon',
    channel: 'room',
    status: 'won',
    productId: 'fs-bed-osoyish',
    budgetUzs: 18_000_000,
    message: 'Karavot va tumbani birga oldim. Xona rasmiga qoʻyganda aniq koʻrindi, shuning uchun.',
    photos: 5,
    placedFirst: true,
    createdAt: '2026-09-12T13:02:00Z',
  },
]

/* --------------------------------------------------------------- analytics */

export type AnalyticsMetric = 'views' | 'rotations' | 'placements' | 'contacts'

export interface AnalyticsPoint {
  /** ISO date, no time — daily buckets. */
  date: string
  value: number
}

export interface AnalyticsSeries {
  metric: AnalyticsMetric
  /** Whole-window total, so the UI never re-sums and disagrees with the API. */
  total: number
  /** Change against the previous window of the same length, percent. */
  deltaPct: number
  points: AnalyticsPoint[]
}

export interface FunnelStep {
  metric: AnalyticsMetric
  value: number
  /** Share of the step above, 0–1. Null for the first step. */
  ofPrevious: number | null
}

/**
 * Daily buckets are produced by a seeded generator rather than written out as
 * 120 literals. The output is deterministic — the same numbers on every load,
 * the same shape every reviewer sees — and it stands in for stored rows, not
 * for a request. `GET /api/business/analytics?range=30d` returns exactly this
 * structure.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 0xffffffff
  }
}

function buildSeries(
  metric: AnalyticsMetric,
  base: number,
  growth: number,
  noise: number,
  seed: number,
  deltaPct: number,
): AnalyticsSeries {
  const random = seeded(seed)
  const days = 30
  const points: AnalyticsPoint[] = []
  const end = Date.UTC(2026, 8, 21) // 2026-09-21, the dashboard's "today"

  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(end - i * 86_400_000)
    const weekday = day.getUTCDay()
    // Weekends run hot: people rearrange their living rooms on a Saturday.
    const weekendLift = weekday === 0 || weekday === 6 ? 1.22 : 1
    const trend = 1 + growth * ((days - 1 - i) / (days - 1))
    const jitter = 1 + (random() - 0.5) * noise
    points.push({
      date: day.toISOString().slice(0, 10),
      value: Math.round(base * trend * weekendLift * jitter),
    })
  }

  return {
    metric,
    total: points.reduce((sum, point) => sum + point.value, 0),
    deltaPct,
    points,
  }
}

/** `GET /api/business/analytics?range=30d` */
export const ANALYTICS: {
  rangeDays: number
  series: Record<AnalyticsMetric, AnalyticsSeries>
  funnel: FunnelStep[]
  /** Placements per listing, best first — the table under the funnel. */
  byProduct: Array<{ productId: string; placements: number; contacts: number; views: number }>
} = (() => {
  const views = buildSeries('views', 3_700, 0.34, 0.18, 20260921, 6.2)
  const rotations = buildSeries('rotations', 1_240, 0.42, 0.2, 77, 11.1)
  const placements = buildSeries('placements', 118, 0.56, 0.24, 1301, 18.4)
  const contacts = buildSeries('contacts', 17, 0.62, 0.3, 4409, 24.8)

  const funnel: FunnelStep[] = [
    { metric: 'views', value: views.total, ofPrevious: null },
    { metric: 'rotations', value: rotations.total, ofPrevious: rotations.total / views.total },
    {
      metric: 'placements',
      value: placements.total,
      ofPrevious: placements.total / rotations.total,
    },
    { metric: 'contacts', value: contacts.total, ofPrevious: contacts.total / placements.total },
  ]

  const byProduct = VENDOR_PRODUCTS.map((row) => ({
    productId: row.productId,
    placements: row.placements30d,
    contacts: row.contacts30d,
    views: row.views30d,
  })).sort((a, b) => b.placements - a.placements)

  return { rangeDays: 30, series: { views, rotations, placements, contacts }, funnel, byProduct }
})()

/* ---------------------------------------------------------------- branding */

export interface Branding {
  slug: string
  /** Vendor-entered brand copy — literal, per the note at the top. */
  displayName: string
  tagline: string
  /** Two or three letters for the mark; there is no logo file to upload to. */
  monogram: string
  /** Hex, straight from the vendor. Applied to `/store/:slug` as CSS variables. */
  colors: {
    paper: string
    ink: string
    accent: string
    /** The text-safe accent — must clear 4.5:1 on `paper`. */
    accentInk: string
  }
  typeface: 'serif' | 'sans'
  corner: 'soft' | 'sharp'
  updatedAt: string
}

/** `GET /api/business/branding` · `PATCH /api/business/branding` */
export const BRANDING: Branding = {
  slug: 'oqtepa',
  displayName: 'Oqtepa Mebel',
  tagline: 'Toshkentda yasalgan. Xonangizda koʻriladi.',
  monogram: 'OQ',
  colors: {
    paper: '#F6F1E9',
    ink: '#2A1D16',
    accent: '#C6552F',
    accentInk: '#B44D2B',
  },
  typeface: 'serif',
  corner: 'soft',
  updatedAt: '2026-09-10T07:30:00Z',
}

/** Preset palettes offered in the branding editor. */
export const BRAND_PRESETS: Array<{ id: string; colors: Branding['colors'] }> = [
  {
    id: 'clay',
    colors: { paper: '#F6F1E9', ink: '#2A1D16', accent: '#C6552F', accentInk: '#B44D2B' },
  },
  {
    id: 'ink',
    colors: { paper: '#EFEDE8', ink: '#1C1C1A', accent: '#3F5147', accentInk: '#35453C' },
  },
  {
    id: 'brass',
    colors: { paper: '#F7F2E6', ink: '#2B2416', accent: '#B4832A', accentInk: '#876220' },
  },
  {
    id: 'indigo',
    colors: { paper: '#F1F2F4', ink: '#1B2129', accent: '#4E5A6B', accentInk: '#3E4856' },
  },
]

export interface StorePayload {
  branding: Branding
  profile: BusinessProfile
  products: Product[]
}

/** `GET /api/store/:slug` — public, unauthenticated. */
export function getStore(slug: string | undefined): StorePayload | null {
  if (!slug || slug !== BRANDING.slug) return null
  const published = new Set(
    VENDOR_PRODUCTS.filter((row) => row.state === 'published').map((row) => row.productId),
  )
  return {
    branding: BRANDING,
    profile: BUSINESS,
    products: PRODUCTS.filter((product) => published.has(product.id)),
  }
}

/* -------------------------------------------------------------------- team */

export type TeamRole = 'owner' | 'manager' | 'uploader' | 'analyst' | 'viewer'
export type TeamStatus = 'active' | 'invited' | 'suspended'

export interface TeamMember {
  id: string
  /** Literal — a person's name. */
  name: string
  email: string
  role: TeamRole
  status: TeamStatus
  twoFactor: boolean
  lastActiveAt: string | null
  /** Models this member uploaded, all time. */
  uploads: number
}

/** `GET /api/business/team` */
export const TEAM: TeamMember[] = [
  {
    id: 'tm-1',
    name: 'Aziza Karimova',
    email: 'aziza@oqtepa.uz',
    role: 'owner',
    status: 'active',
    twoFactor: true,
    lastActiveAt: '2026-09-21T07:55:00Z',
    uploads: 14,
  },
  {
    id: 'tm-2',
    name: 'Javohir Toʻrayev',
    email: 'javohir@oqtepa.uz',
    role: 'manager',
    status: 'active',
    twoFactor: true,
    lastActiveAt: '2026-09-21T06:40:00Z',
    uploads: 31,
  },
  {
    id: 'tm-3',
    name: 'Zilola Mirzayeva',
    email: 'zilola@oqtepa.uz',
    role: 'uploader',
    status: 'active',
    twoFactor: false,
    lastActiveAt: '2026-09-20T18:12:00Z',
    uploads: 52,
  },
  {
    id: 'tm-4',
    name: 'Otabek Sultonov',
    email: 'otabek@chorsu.uz',
    role: 'analyst',
    status: 'active',
    twoFactor: true,
    lastActiveAt: '2026-09-19T10:04:00Z',
    uploads: 0,
  },
  {
    id: 'tm-5',
    name: 'Shahzoda Yoʻldosheva',
    email: 'shahzoda@yorug.uz',
    role: 'viewer',
    status: 'invited',
    twoFactor: false,
    lastActiveAt: null,
    uploads: 0,
  },
  {
    id: 'tm-6',
    name: 'Timur Ashurov',
    email: 'timur@oqtepa.uz',
    role: 'uploader',
    status: 'suspended',
    twoFactor: false,
    lastActiveAt: '2026-08-02T09:40:00Z',
    uploads: 9,
  },
]

/* ------------------------------------------------------------- bulk upload */

/**
 * What `POST /api/business/products/bulk` would accept. The form on
 * `/business/products` validates against this locally and then stops, because
 * there is nothing to send it to.
 */
export const UPLOAD_RULES = {
  model: {
    extensions: ['.glb', '.gltf'],
    maxBytes: 12 * 1024 * 1024,
    /** After Draco. A listing over this is rejected by the pipeline. */
    maxTriangles: 150_000,
  },
  images: {
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    maxBytes: 4 * 1024 * 1024,
    maxCount: 8,
  },
  price: { minUzs: 50_000, maxUzs: 500_000_000 },
  dimensions: { minCm: 1, maxCm: 600 },
  tags: { max: 12, maxLength: 24 },
} as const

export type UploadIssue = {
  /** i18n key suffix under `business.products.upload.issues.<code>`. */
  code:
    | 'modelExtension'
    | 'modelTooBig'
    | 'imageExtension'
    | 'imageTooBig'
    | 'tooManyImages'
    | 'missingModel'
    | 'missingImages'
    | 'missingTitle'
    | 'priceRange'
    | 'dimensionRange'
  /** Which form field the issue belongs to — drives `aria-invalid`. */
  field?: 'title' | 'model' | 'images' | 'priceUzs' | 'dimensions'
  /** Literal — the file the visitor chose. */
  file?: string
}

export interface UploadDraft {
  /** Literal — the vendor's own product name. */
  title: string
  model: File | null
  images: File[]
  priceUzs: number | null
  widthCm: number | null
  depthCm: number | null
  heightCm: number | null
  tags: string[]
}

/** Pure, synchronous, and entirely local — no request is made or implied. */
export function validateUpload(draft: UploadDraft): UploadIssue[] {
  const issues: UploadIssue[] = []
  const ext = (name: string) => name.slice(name.lastIndexOf('.')).toLowerCase()

  if (!draft.title.trim()) issues.push({ code: 'missingTitle', field: 'title' })

  if (!draft.model) {
    issues.push({ code: 'missingModel', field: 'model' })
  } else {
    if (!UPLOAD_RULES.model.extensions.includes(ext(draft.model.name) as '.glb' | '.gltf')) {
      issues.push({ code: 'modelExtension', field: 'model', file: draft.model.name })
    }
    if (draft.model.size > UPLOAD_RULES.model.maxBytes) {
      issues.push({ code: 'modelTooBig', field: 'model', file: draft.model.name })
    }
  }

  if (draft.images.length === 0) issues.push({ code: 'missingImages', field: 'images' })
  if (draft.images.length > UPLOAD_RULES.images.maxCount) {
    issues.push({ code: 'tooManyImages', field: 'images' })
  }

  for (const image of draft.images) {
    if (!(UPLOAD_RULES.images.extensions as readonly string[]).includes(ext(image.name))) {
      issues.push({ code: 'imageExtension', field: 'images', file: image.name })
    }
    if (image.size > UPLOAD_RULES.images.maxBytes) {
      issues.push({ code: 'imageTooBig', field: 'images', file: image.name })
    }
  }

  const { minUzs, maxUzs } = UPLOAD_RULES.price
  if (draft.priceUzs === null || draft.priceUzs < minUzs || draft.priceUzs > maxUzs) {
    issues.push({ code: 'priceRange', field: 'priceUzs' })
  }

  const { minCm, maxCm } = UPLOAD_RULES.dimensions
  const dims = [draft.widthCm, draft.depthCm, draft.heightCm]
  if (dims.some((value) => value === null || value < minCm || value > maxCm)) {
    issues.push({ code: 'dimensionRange', field: 'dimensions' })
  }

  return issues
}
