import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { Seo } from '@/lib/seo'
import { DimensionLine } from '@/ui/DimensionLine'
import { TextReveal } from '@/ui/TextReveal'
import { EASE } from '@/design/motion'
import { CatalogChromeStyles, Eyebrow } from '@/features/catalog/chrome'
import { PRODUCTS, categoryCounts } from '@/features/catalog/data'
import { FilterBar, FilterBarStyles } from '@/features/catalog/FilterBar'
import { ProductGrid, ProductGridStyles } from '@/features/catalog/ProductGrid'
import {
  DEFAULT_QUERY,
  fromSearchParams,
  runQuery,
  toQueryString,
  type CatalogQuery,
} from '@/features/catalog/filters'
import { useCount } from '@/features/catalog/money'

/**
 * §9 — the public 3D catalog.
 *
 * Every card carries a live per-product viewer; `ViewportGate` inside the card
 * keeps the number of WebGL contexts to roughly a screen and a half, so a grid
 * of thirty pieces never tries to hold thirty canvases open at once.
 *
 * The data is local (`src/features/catalog/data.ts`) because the server has no
 * catalog route. The page says so, in the visitor's language, instead of
 * implying it is live.
 *
 * The query lives in the URL (`?category=…&q=…`, written with `replace` so the
 * back button is not a filter history), so a refreshed or shared link lands on
 * the same grid. Results are computed from a deferred copy of the query, which
 * keeps the search field responsive while the grid catches up.
 */

const CSS = `
.cat-page { padding-bottom: var(--s32); }

.cat-hero {
  padding-block: var(--s10) var(--s6);
}
@media (min-width: 768px) { .cat-hero { padding-block: var(--s12) var(--s8); } }
.cat-hero__grid { align-items: end; row-gap: var(--s8); }
.cat-hero__head { grid-column: 1 / -1; }
.cat-hero__aside { grid-column: 1 / -1; }
@media (min-width: 768px) {
  .cat-hero__head { grid-column: 1 / span 7; }
  .cat-hero__aside { grid-column: 9 / span 4; }
}
.cat-hero__title {
  font-family: var(--font-display);
  font-size: clamp(2.25rem, 4.2vw, 4rem);
  font-weight: 450;
  line-height: 1.06;
  letter-spacing: -0.018em;
  color: var(--text-strong);
  max-width: 20ch;
  text-wrap: balance;
  margin-top: var(--s4);
}
/* The one word that is allowed to shout. */
.cat-hero__title-accent {
  font-style: italic;
  font-weight: 400;
  color: var(--accent-ink);
}
.cat-hero__lead { margin-top: var(--s4); max-width: 52ch; }
.cat-hero__stats {
  display: grid;
  gap: var(--s1);
  padding: var(--s3) var(--s5);
  border-radius: 1.5rem;
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.cat-hero__stat {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s4);
  padding-block: var(--s2);
}
.cat-hero__stat + .cat-hero__stat { border-top: 1px solid var(--hairline); }
.cat-hero__stat b {
  font-family: var(--font-display);
  font-size: var(--step-2);
  font-weight: 500;
  font-variant-numeric: lining-nums tabular-nums;
  color: var(--text-strong);
  letter-spacing: -0.01em;
  line-height: 1;
}

.cat-body { padding-top: var(--s6); scroll-margin-top: var(--hdr-offset); }
@media (min-width: 1024px) { .cat-body { padding-top: var(--s6); } }
.cat-foot { padding-top: var(--s24); display: grid; gap: var(--s6); }
.cat-fineprint { font-family: var(--font-mono); font-size: var(--step--2); letter-spacing: 0.08em; color: var(--text-muted); }
`

export function Catalog() {
  const { t } = useTranslation()
  const count = useCount()
  const reduced = useReducedMotion()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState<CatalogQuery>(() => fromSearchParams(params))
  const deferred = useDeferredValue(query)

  // query -> URL. `replace` so typing does not stack history entries, and no
  // scroll reset, because the visitor is mid-page with the bar stuck.
  // `written` remembers the URLs this page wrote itself, so a write that
  // lands a keystroke late is not mistaken for back/forward and rolled back.
  const written = useRef(new Set<string>())
  const queryString = toQueryString(query)
  useEffect(() => {
    if (queryString !== params.toString()) {
      written.current.add(queryString)
      setParams(queryString, { replace: true, preventScrollReset: true })
    }
    // `params` is deliberately left out: the effect below owns URL -> state.
  }, [queryString])

  // URL -> query, for back/forward and links into a filtered view.
  const urlString = params.toString()
  useEffect(() => {
    if (written.current.delete(urlString)) return
    setQuery((current) =>
      toQueryString(current) === urlString ? current : fromSearchParams(new URLSearchParams(urlString)),
    )
  }, [urlString])

  // Names live in the locale bundle, so search has to be given the resolved
  // strings; a real `GET /api/catalog/products?q=` searches server-side.
  const names = useMemo(() => {
    const out: Record<string, string> = {}
    for (const product of PRODUCTS) out[product.id] = t(`catalog.products.${product.nameKey}.name`)
    return out
  }, [t])

  const counts = useMemo(() => categoryCounts(), [])
  const results = useMemo(() => runQuery(deferred, names), [deferred, names])

  const totalPlacements = useMemo(
    () => PRODUCTS.reduce((sum, product) => sum + product.placements, 0),
    [],
  )
  const vendors = useMemo(() => new Set(PRODUCTS.map((p) => p.vendorSlug)).size, [])

  const rise = {
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-10% 0px' },
    transition: { duration: reduced ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] as const },
  }

  // Fast entry choreography for the hero: eyebrow, then the headline's own
  // word-cascade, then the lead paragraph and stats — this is a browsing page,
  // not a landing page, so it stays under ~600ms end to end.
  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 10 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-10% 0px' },
    transition: { duration: reduced ? 0 : 0.32, ease: EASE, delay: reduced ? 0 : delay },
  })

  const titleLead = t('catalog.hero.titleLead')
  const titleAccent = t('catalog.hero.titleAccent')
  const titleTail = t('catalog.hero.titleTail')
  const leadWordCount = titleLead.split(' ').length
  const accentWordCount = titleAccent.split(' ').length
  const accentDelay = 0.05 + leadWordCount * 0.03
  const tailDelay = accentDelay + accentWordCount * 0.03

  return (
    <div className="cat-page">
      <style href="fs-cat-page" precedence="medium">
        {CSS}
      </style>
      <CatalogChromeStyles />
      <FilterBarStyles />
      <ProductGridStyles />

      <Seo
        title={`${t('catalog.meta.title')} — ${t('brand.name')}`}
        description={t('catalog.meta.description')}
        path="/catalog"
      />

      <section className="cat-hero">
        <div className="fs-container">
          <div className="fs-grid cat-hero__grid">
            <div className="cat-hero__head">
              <motion.div {...fadeUp(0)} style={{ display: 'inline-block' }}>
                <Eyebrow>{t('catalog.hero.eyebrow')}</Eyebrow>
              </motion.div>
              <h1 className="cat-hero__title">
                <TextReveal as="span" text={titleLead} duration={0.45} stagger={0.03} delay={0.05} />{' '}
                <TextReveal
                  as="span"
                  text={titleAccent}
                  className="cat-hero__title-accent"
                  duration={0.45}
                  stagger={0.03}
                  delay={accentDelay}
                />
                {/^[,.;:!?]/.test(titleTail) ? '' : ' '}
                <TextReveal as="span" text={titleTail} duration={0.45} stagger={0.03} delay={tailDelay} />
              </h1>
              <motion.p className="fs-lead cat-hero__lead" {...fadeUp(0.22)}>
                {t('catalog.hero.lead')}
              </motion.p>
            </div>

            <motion.div className="cat-hero__aside" {...fadeUp(0.28)}>
              <div className="cat-hero__stats">
                {[
                  { key: 'statPieces', value: PRODUCTS.length },
                  { key: 'statPlacements', value: totalPlacements },
                  { key: 'statVendors', value: vendors },
                ].map((stat) => (
                  <div className="cat-hero__stat" key={stat.key}>
                    <span className="fs-label">{t(`catalog.hero.${stat.key}`)}</span>
                    <b>{count(stat.value)}</b>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <FilterBar
        query={query}
        onChange={setQuery}
        counts={counts}
        total={PRODUCTS.length}
        resultCount={results.length}
      />

      <section className="cat-body">
        <div className="fs-container">
          <ProductGrid animated products={results} onReset={() => setQuery(DEFAULT_QUERY)} />

          <div className="cat-foot">
            <hr className="fs-rule" />
            <DimensionLine
              value={String(results.length).padStart(2, '0')}
              unit={`— ${t('catalog.filters.results')}`}
            />
            <motion.p className="cat-fineprint" {...rise}>
              {t('catalog.notice.demoData')}
            </motion.p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Catalog
