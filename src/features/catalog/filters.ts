import {
  CATEGORIES,
  PRICE_BOUNDS,
  PRODUCTS,
  ROOM_KEYS,
  SORT_KEYS,
  STYLE_KEYS,
  type Product,
  type ProductCategory,
  type ProductStyle,
  type RoomType,
  type SortKey,
} from './data'

/**
 * Filtering and sorting, kept out of the components on purpose.
 *
 * When `GET /api/catalog/products` exists this whole module collapses into a
 * query-string builder — the `CatalogQuery` fields are already named the way
 * the parameters should be, so `toQueryString()` below is the migration.
 */

export interface CatalogQuery {
  category: ProductCategory | 'all'
  style: ProductStyle | 'all'
  room: RoomType | 'all'
  minUzs: number
  maxUzs: number
  inStockOnly: boolean
  sort: SortKey
  /** Free text over the brand; product names are i18n keys, so the page
      resolves those to strings and passes them in via `names`. */
  search: string
}

export const DEFAULT_QUERY: CatalogQuery = {
  category: 'all',
  style: 'all',
  room: 'all',
  minUzs: PRICE_BOUNDS.minUzs,
  maxUzs: PRICE_BOUNDS.maxUzs,
  inStockOnly: false,
  sort: 'featured',
  search: '',
}

/** How many facets the visitor has actually narrowed — drives the "reset" pill. */
export function activeFilterCount(query: CatalogQuery): number {
  let n = 0
  if (query.category !== 'all') n += 1
  if (query.style !== 'all') n += 1
  if (query.room !== 'all') n += 1
  if (query.minUzs > PRICE_BOUNDS.minUzs || query.maxUzs < PRICE_BOUNDS.maxUzs) n += 1
  if (query.inStockOnly) n += 1
  if (query.search.trim()) n += 1
  return n
}

const SORTERS: Record<SortKey, (a: Product, b: Product) => number> = {
  featured: (a, b) =>
    Number(b.featured) - Number(a.featured) || b.placements - a.placements,
  priceAsc: (a, b) => a.priceUzs - b.priceUzs,
  priceDesc: (a, b) => b.priceUzs - a.priceUzs,
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  placements: (a, b) => b.placements - a.placements,
}

/**
 * `names` maps product id -> the localised name, so search can match what the
 * visitor actually sees. A real endpoint searches server-side instead.
 */
export function runQuery(
  query: CatalogQuery,
  names: Record<string, string> = {},
  source: Product[] = PRODUCTS,
): Product[] {
  const needle = query.search.trim().toLocaleLowerCase()

  const filtered = source.filter((product) => {
    if (query.category !== 'all' && product.category !== query.category) return false
    if (query.style !== 'all' && product.style !== query.style) return false
    if (query.room !== 'all' && !product.rooms.includes(query.room)) return false
    if (product.priceUzs < query.minUzs || product.priceUzs > query.maxUzs) return false
    if (query.inStockOnly && !product.inStock) return false
    if (needle) {
      const haystack = `${names[product.id] ?? ''} ${product.brand}`.toLocaleLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })

  return filtered.sort(SORTERS[query.sort] ?? SORTERS.featured)
}

/** The migration path: the same query as `?category=…&minUzs=…`. */
export function toQueryString(query: CatalogQuery): string {
  const params = new URLSearchParams()
  if (query.category !== 'all') params.set('category', query.category)
  if (query.style !== 'all') params.set('style', query.style)
  if (query.room !== 'all') params.set('room', query.room)
  if (query.minUzs > PRICE_BOUNDS.minUzs) params.set('minUzs', String(query.minUzs))
  if (query.maxUzs < PRICE_BOUNDS.maxUzs) params.set('maxUzs', String(query.maxUzs))
  if (query.inStockOnly) params.set('inStock', '1')
  if (query.sort !== 'featured') params.set('sort', query.sort)
  if (query.search.trim()) params.set('q', query.search.trim())
  return params.toString()
}

/**
 * The inverse of `toQueryString()`: reads `/catalog?category=…&q=…` back into
 * a query, so a shared or refreshed link lands on the same filtered grid.
 * Anything unknown or out of range falls back to the default for that field.
 */
export function fromSearchParams(params: URLSearchParams): CatalogQuery {
  const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T | 'all') =>
    value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
  const price = (value: string | null, fallback: number) => {
    const n = Number(value)
    return value !== null && Number.isFinite(n)
      ? Math.min(Math.max(n, PRICE_BOUNDS.minUzs), PRICE_BOUNDS.maxUzs)
      : fallback
  }

  const minUzs = price(params.get('minUzs'), DEFAULT_QUERY.minUzs)
  const maxUzs = price(params.get('maxUzs'), DEFAULT_QUERY.maxUzs)

  return {
    category: pick(params.get('category'), CATEGORIES, 'all'),
    style: pick(params.get('style'), STYLE_KEYS, 'all'),
    room: pick(params.get('room'), ROOM_KEYS, 'all'),
    minUzs: Math.min(minUzs, maxUzs),
    maxUzs: Math.max(minUzs, maxUzs),
    inStockOnly: params.get('inStock') === '1',
    sort: pick(params.get('sort'), SORT_KEYS, 'featured') as SortKey,
    search: params.get('q') ?? '',
  }
}

/**
 * Bento placement. The grid is six columns wide on desktop and every cycle of
 * nine cards fills four rows exactly — hero+narrow, narrow×3, wide×2,
 * narrow+hero — so the rhythm never settles into three identical cards in a
 * row. Featured pieces are pulled onto the hero slots by the `featured` sort.
 */
export type BentoSpan = 'hero' | 'wide' | 'narrow'

const BENTO_CYCLE: BentoSpan[] = [
  'hero',
  'narrow',
  'narrow',
  'narrow',
  'narrow',
  'wide',
  'wide',
  'narrow',
  'hero',
]

export function bentoSpan(index: number): BentoSpan {
  return BENTO_CYCLE[index % BENTO_CYCLE.length]
}
