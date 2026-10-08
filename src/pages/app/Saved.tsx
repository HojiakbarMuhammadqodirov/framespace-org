import { Suspense, lazy, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AnimatePresence } from 'framer-motion'

import { TextReveal } from '@/ui/TextReveal'
import { Tilt } from '@/ui/Interactive'
import { Seo } from '@/lib/seo'
import { cn } from '@/lib/cn'
import { useSaved, type SavedItem } from '@/store/projects'
import { PRODUCTS, type Product } from '@/features/catalog/data'
import { ViewportGate } from '@/features/catalog/chrome'
import { useMoneyIn } from '@/features/capture/money'

import { AppStyles, ArrowCta, Bezel, Eyebrow, IconButton, RevealBlur } from './Dashboard'

const ProductViewer = lazy(() => import('@/three/ProductViewer'))
const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]))

/**
 * /app/saved — the furniture shortlist.
 *
 * Same card language as the dashboard (double bezel, drawn cover, hover
 * tools), packed tighter: a dense auto-fill grid where every fifth pin takes
 * two columns, so the wall still has a rhythm instead of reading as a
 * spreadsheet.
 *
 * Pins that come from the catalog render their live 3D model and link back to
 * the product page. The empty state offers three featured catalog pieces the
 * visitor can pin with one tap.
 */

type Kind = 'sofa' | 'table' | 'shelf' | 'lamp' | 'rug' | 'chair'

const CATEGORY_KIND: Record<string, Kind> = {
  seating: 'sofa',
  table: 'table',
  storage: 'shelf',
  lighting: 'lamp',
  textile: 'rug',
  decor: 'chair',
}

const CATEGORIES = ['seating', 'table', 'storage', 'lighting', 'textile', 'decor'] as const

/** Three featured catalog pieces, one per category, for the empty state. */
const SUGGESTIONS: Product[] = (() => {
  const out: Product[] = []
  const seen = new Set<string>()
  const ranked = [...PRODUCTS].sort(
    (a, b) => Number(b.featured) - Number(a.featured) || b.placements - a.placements
  )
  for (const p of ranked) {
    if (seen.has(p.category)) continue
    seen.add(p.category)
    out.push(p)
    if (out.length === 3) break
  }
  return out
})()

/** The pin's picture: a live model for catalog pieces, a drawing otherwise. */
function PinFigure({ product, kind, label }: { product?: Product; kind: Kind; label: string }) {
  const glyph = <FurnitureGlyph kind={kind} />
  if (!product) return glyph
  return (
    <ViewportGate className="fss-pin__canvas" placeholder={glyph}>
      <Suspense fallback={glyph}>
        <ProductViewer
          model={product.model}
          palette={product.palette}
          spin
          spinSpeed={0.25}
          style={{ width: '100%', height: '100%' }}
          label={label}
        />
      </Suspense>
    </ViewportGate>
  )
}

/* ------------------------------------------------------------- blueprints */

/** Stroke-only furniture, drawn the same way as the room plans. */
function FurnitureGlyph({ kind }: { kind: Kind }) {
  const stroke = 'var(--clay-300)'
  const hair = 'var(--hairline)'
  return (
    <svg
      viewBox="0 0 200 150"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      aria-hidden="true"
    >
      <g stroke={hair} strokeWidth="1">
        <path d="M20 128 H180" />
        <path d="M20 122 V134 M180 122 V134" />
      </g>

      <g stroke={stroke} strokeWidth="1.4" strokeLinejoin="round">
        {kind === 'sofa' && (
          <>
            <path d="M40 112 V66 a8 8 0 0 1 8-8 h104 a8 8 0 0 1 8 8 v46" />
            <path d="M40 86 h120" />
            <rect x="52" y="86" width="44" height="26" rx="3" />
            <rect x="104" y="86" width="44" height="26" rx="3" />
            <path d="M48 112 V120 M152 112 V120" />
          </>
        )}
        {kind === 'table' && (
          <>
            <rect x="46" y="70" width="108" height="10" rx="3" />
            <path d="M58 80 V116 M142 80 V116" />
            <path d="M58 100 H142" strokeDasharray="4 5" />
            <ellipse cx="100" cy="64" rx="16" ry="5" />
            <path d="M100 59 V50" />
          </>
        )}
        {kind === 'shelf' && (
          <>
            <rect x="56" y="40" width="88" height="80" rx="2" />
            <path d="M56 66 H144 M56 92 H144" />
            <path d="M100 40 V120" opacity="0.5" />
            <rect x="64" y="48" width="12" height="16" />
            <circle cx="126" cy="80" r="6" />
          </>
        )}
        {kind === 'lamp' && (
          <>
            <path d="M78 52 h44 l8 26 h-60 z" />
            <path d="M100 78 V114" />
            <ellipse cx="100" cy="118" rx="24" ry="6" />
            <path d="M84 40 a16 16 0 0 1 32 0" strokeDasharray="2 4" />
          </>
        )}
        {kind === 'rug' && (
          <>
            <ellipse cx="100" cy="86" rx="66" ry="30" />
            <ellipse cx="100" cy="86" rx="52" ry="22" strokeDasharray="5 6" />
            <ellipse cx="100" cy="86" rx="30" ry="12" />
            <path d="M34 86 h-8 M166 86 h8" />
          </>
        )}
        {kind === 'chair' && (
          <>
            <path d="M70 108 V50 a6 6 0 0 1 6-6 h20 a6 6 0 0 1 6 6 v58" />
            <rect x="66" y="86" width="64" height="12" rx="3" />
            <path d="M74 98 V118 M124 98 V118" />
            <path d="M74 110 H124" strokeDasharray="4 5" />
          </>
        )}
      </g>
    </svg>
  )
}

/* -------------------------------------------------------------------- CSS */

const CSS = `
.fss-grid { display: grid; gap: var(--s4); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 768px) {
  .fss-grid { grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: var(--s5); }
  /* Every fifth pin takes two columns, so the wall is not a spreadsheet. */
  .fss-grid > .fss-pin--feature { grid-column: span 2; }
}
.fss-grid > * { display: flex; min-width: 0; }

.fss-pin { position: relative; width: 100%; height: 100%; }
.fss-pin .fsd-bezel { height: 100%; transition: transform var(--d-base) var(--ease); }
@media (hover: hover) and (pointer: fine) {
  .fss-pin:hover .fsd-bezel { transform: translateY(-3px); }
  .fss-pin__link:hover { color: var(--accent-ink); }
}
.fss-pin .fsd-core { display: flex; flex-direction: column; height: 100%; }
.fss-pin__frame {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--bg-sunken);
  border-bottom: 1px solid var(--hairline);
  padding: var(--s4);
}
.fss-pin--feature .fss-pin__frame { aspect-ratio: 16 / 7; }
.fss-pin__canvas { position: absolute; inset: 0; }
.fss-pin__link { color: inherit; text-decoration: none; }
.fss-pin__link:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 2px; }
.fss-pin__title { font-family: var(--font-display); line-height: var(--lh-tight); overflow-wrap: anywhere; }
.fss-pin__body { display: flex; flex-direction: column; gap: var(--s2); padding: var(--s4) var(--s5) var(--s5); flex: 1; }
.fss-pin__price {
  margin-top: auto;
  padding-top: var(--s3);
  border-top: 1px solid var(--hairline);
  font-family: var(--font-ui);
  font-weight: 600;
  font-size: var(--step-0);
  color: var(--text-strong);
  font-variant-numeric: tabular-nums lining-nums;
}
.fss-pin__tools {
  position: absolute;
  top: var(--s3);
  right: var(--s3);
  opacity: 0;
  transform: translateY(-6px);
  transition: opacity var(--d-base) var(--ease), transform var(--d-base) var(--ease);
}
.fss-pin:hover .fss-pin__tools,
.fss-pin:focus-within .fss-pin__tools { opacity: 1; transform: translateY(0); }
@media (hover: none) { .fss-pin__tools { opacity: 1; transform: none; } }

.fss-head { row-gap: var(--s8); align-items: end; }
.fss-head__text { grid-column: 1 / -1; }
.fss-head__count { grid-column: 1 / -1; }
@media (min-width: 900px) {
  .fss-head__text { grid-column: 1 / span 7; }
  .fss-head__count { grid-column: 10 / span 3; justify-self: end; }
}

.fss-suggest { display: grid; gap: var(--s5); }
@media (min-width: 768px) { .fss-suggest { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
`

const IconMinus = () => (
  <svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M4.5 9 H13.5" strokeLinecap="round" />
  </svg>
)

const IconCheck = () => (
  <svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M4 9.5 L7.5 13 L14 5.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconPlus = () => (
  <svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M9 4.5 V13.5 M4.5 9 H13.5" strokeLinecap="round" />
  </svg>
)

/* ------------------------------------------------------------------- page */

export function Saved() {
  const { t } = useTranslation()
  const money = useMoneyIn('UZS')
  const items = useSaved((s) => s.items)
  const save = useSaved((s) => s.save)
  const remove = useSaved((s) => s.remove)

  const [category, setCategory] = useState<string>('all')

  const visible = useMemo(
    () => (category === 'all' ? items : items.filter((i) => i.category === category)),
    [items, category]
  )

  const present = useMemo(() => new Set(items.map((i) => i.id)), [items])

  function pin(product: Product) {
    if (present.has(product.id)) {
      remove(product.id)
      return
    }
    save({
      id: product.id,
      name: t(`catalog.products.${product.nameKey}.name`),
      category: product.category,
      style: product.style,
      price: product.priceUzs,
      currency: 'UZS',
    })
  }

  return (
    <>
      <AppStyles />
      <style href="fs-app-saved" precedence="medium">
        {CSS}
      </style>
      <Seo
        title={`${t('app.saved.eyebrow')} — ${t('brand.name')}`}
        description={t('app.saved.lead')}
        path="/app/saved"
      />

      <section className="fsd-page">
        <div className="fs-container">
          <div className="fs-grid fss-head">
            <RevealBlur className="fss-head__text">
              <Eyebrow>{t('app.saved.eyebrow')}</Eyebrow>
              <TextReveal
                as="h1"
                text={t('app.saved.title')}
                delay={0.06}
                duration={0.6}
                stagger={0.035}
                className="fs-display"
                style={{ marginTop: 'var(--s6)', maxWidth: '13ch', fontSize: 'var(--step-4)' }}
              />
              <p className="fs-lead" style={{ marginTop: 'var(--s6)', maxWidth: '44ch' }}>
                {t('app.saved.lead')}
              </p>
            </RevealBlur>

            <RevealBlur className="fss-head__count" delay={0.08}>
              <span className="fs-label">{t('app.saved.count', { count: items.length })}</span>
            </RevealBlur>
          </div>

          {items.length > 0 && (
            <RevealBlur delay={0.04}>
              <hr className="fs-rule-strong" style={{ marginBlock: 'var(--s16) var(--s8)' }} />
              <div className="fsd-chips">
                <button
                  type="button"
                  className="fs-chip"
                  aria-pressed={category === 'all'}
                  onClick={() => setCategory('all')}
                >
                  {t('app.saved.all')}
                </button>
                {CATEGORIES.filter((c) => items.some((i) => i.category === c)).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="fs-chip"
                    aria-pressed={category === value}
                    onClick={() => setCategory(value)}
                  >
                    {t(`app.saved.categories.${value}`)}
                  </button>
                ))}
              </div>
            </RevealBlur>
          )}

          <div style={{ marginTop: 'var(--s10)' }}>
            {items.length === 0 ? (
              <RevealBlur>
                <Bezel>
                  <Eyebrow>{t('app.saved.suggest.eyebrow')}</Eyebrow>
                  <h2 style={{ marginTop: 'var(--s5)', fontSize: 'var(--step-3)', maxWidth: '16ch' }}>
                    {t('app.saved.empty.title')}
                  </h2>
                  <p style={{ marginTop: 'var(--s5)', color: 'var(--text-muted)', maxWidth: '48ch' }}>
                    {t('app.saved.empty.body')}
                  </p>

                  <hr className="fs-rule" style={{ marginBlock: 'var(--s10)' }} />

                  <span className="fs-label">{t('app.saved.suggest.title')}</span>
                  <div className="fss-suggest" style={{ marginTop: 'var(--s6)' }}>
                    {SUGGESTIONS.map((product) => {
                      const name = t(`catalog.products.${product.nameKey}.name`)
                      return (
                        <div className="fss-pin" key={product.id}>
                          <Bezel flush tone="sunken">
                            <Tilt className="fss-pin__frame" max={5}>
                              <PinFigure
                                product={product}
                                kind={CATEGORY_KIND[product.category] || 'chair'}
                                label={name}
                              />
                              <div className="fss-pin__tools">
                                <IconButton
                                  label={present.has(product.id) ? t('app.saved.added') : t('app.saved.add')}
                                  onClick={() => pin(product)}
                                >
                                  {present.has(product.id) ? <IconCheck /> : <IconPlus />}
                                </IconButton>
                              </div>
                            </Tilt>
                            <div className="fss-pin__body">
                              <span className="fsd-badge">{t(`app.saved.categories.${product.category}`)}</span>
                              <h3 className="fss-pin__title" style={{ fontSize: 'var(--step-1)' }}>
                                <Link className="fss-pin__link" to={`/catalog/${product.slug}`}>
                                  {name}
                                </Link>
                              </h3>
                              <span className="fss-pin__price">{money.format(product.priceUzs)}</span>
                            </div>
                          </Bezel>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ marginTop: 'var(--s8)' }}>
                    <ArrowCta variant="quiet" to="/catalog">
                      {t('nav.catalog')}
                    </ArrowCta>
                  </div>
                </Bezel>
              </RevealBlur>
            ) : (
              <div className="fss-grid">
                <AnimatePresence mode="popLayout" initial={false}>
                  {visible.map((item, i) => (
                    <RevealBlur
                      key={item.id}
                      layout
                      className={cn(i % 5 === 0 && 'fss-pin--feature')}
                      delay={Math.min(i, 6) * 0.04}
                    >
                      <Pin item={item} feature={i % 5 === 0} onRemove={() => remove(item.id)} />
                    </RevealBlur>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

/** Catalog pieces are priced in soʻm; a pin from a brief keeps its own currency. */
function product0Currency(item: SavedItem): string {
  return BY_ID.has(item.id) ? 'UZS' : item.currency || 'UZS'
}

function Pin({
  item,
  feature,
  onRemove,
}: {
  item: SavedItem
  feature: boolean
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const money = useMoneyIn(product0Currency(item))
  const product = BY_ID.get(item.id)
  const name = product ? t(`catalog.products.${product.nameKey}.name`) : item.name
  const styleLabel = product
    ? t(`catalog.styles.${product.style}`)
    : item.style
      ? t(`styles.${item.style}`, { defaultValue: item.style })
      : ''
  const priceLabel = product
    ? money.format(product.priceUzs)
    : money.format(item.price)
  return (
    <div className={cn('fss-pin', feature && 'fss-pin--feature')}>
      <Bezel flush>
        <Tilt className="fss-pin__frame" max={5}>
          <PinFigure product={product} kind={CATEGORY_KIND[item.category] || 'chair'} label={name} />
          <div className="fss-pin__tools">
            <IconButton label={t('app.saved.remove')} danger onClick={onRemove}>
              <IconMinus />
            </IconButton>
          </div>
        </Tilt>
        <div className="fss-pin__body">
          <span className="fsd-badge">
            {t(`app.saved.categories.${item.category}`, { defaultValue: item.category })}
          </span>
          <h3 className="fss-pin__title" style={{ fontSize: feature ? 'var(--step-2)' : 'var(--step-1)' }}>
            {product ? (
              <Link className="fss-pin__link" to={`/catalog/${product.slug}`}>
                {name}
              </Link>
            ) : (
              name
            )}
          </h3>
          {styleLabel && (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step--1)' }}>{styleLabel}</p>
          )}
          <span className="fss-pin__price">{priceLabel}</span>
        </div>
      </Bezel>
    </div>
  )
}

export default Saved
