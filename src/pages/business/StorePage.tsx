import { Suspense, lazy, useMemo, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { Seo } from '@/lib/seo'
import { TextReveal } from '@/ui/TextReveal'
import { EASE } from '@/design/motion'
import { CatalogChromeStyles, CtaLink, ViewportGate } from '@/features/catalog/chrome'
import { useCount, useMoney } from '@/features/catalog/money'
import { ProductGrid, ProductGridStyles } from '@/features/catalog/ProductGrid'
import { CATEGORIES, type Product, type ProductCategory } from '@/features/catalog/data'
import { getStore } from '@/features/business/data'
import { useSavedBranding } from '@/features/business/local'

/**
 * §10 — `/store/:slug`, the branded public catalog page.
 *
 * The vendor's palette lands here as **CSS custom property overrides on one
 * wrapper** — `--bg`, `--text-strong`, `--accent` and friends — so every
 * component inside, `ProductCard` included, re-themes itself without a single
 * new rule. Their accent is also pushed into the WebGL palette.
 *
 * Branding saved on `/business/branding` (in this browser) overrides the
 * typed record, so the editor's "Save → open store" loop is real.
 *
 * Data: `getStore(slug)` stands in for `GET /api/store/:slug`.
 */

const ProductViewer = lazy(() => import('@/three/ProductViewer'))

const CSS = `
.st {
  min-height: 100dvh;
  background: var(--bg);
  color: var(--text);
  padding-bottom: var(--s16);
}
.st__top { display: flex; align-items: center; justify-content: space-between; gap: var(--s4); padding-top: var(--s6); }
.st__crumb {
  display: inline-flex; align-items: center; gap: var(--s2);
  min-height: var(--tap);
  color: var(--text-muted); text-decoration: none;
  font-size: var(--step--1); font-weight: 500;
}
.st__badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--radius-full); box-shadow: inset 0 0 0 1px var(--hairline); font-size: 11.5px; color: var(--text-muted); white-space: nowrap; }
.st__badge i { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }

/* ---- hero -------------------------------------------------------------- */
.st__hero { display: grid; gap: var(--s10); grid-template-columns: minmax(0, 1fr); align-items: center; padding-block: var(--s12) var(--s16); }
@media (min-width: 980px) { .st__hero { grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: var(--s12); padding-block: var(--s16) var(--s24); } }
.st__intro { display: grid; gap: var(--s6); min-width: 0; }
.st__eyebrow { display: flex; align-items: center; gap: var(--s3); font-family: var(--font-mono); font-size: 11px; letter-spacing: var(--tracking-mono); text-transform: uppercase; color: var(--accent-ink); }
.st__mono {
  display: grid; place-items: center; flex: 0 0 auto;
  width: 44px; height: 44px;
  background: var(--accent); color: var(--bg);
  font-family: var(--font-mono); font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
}
.st__name {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: clamp(2.8rem, 1.6rem + 5.4vw, 5.8rem);
  line-height: 0.98;
  letter-spacing: -0.035em;
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
.st__tagline { font-size: var(--step-1); line-height: 1.5; color: var(--text-muted); max-width: 38ch; margin: 0; }
.st__ctas { display: flex; flex-wrap: wrap; gap: var(--s3); }
.st__stats { display: flex; flex-wrap: wrap; gap: var(--s4) var(--s10); padding-top: var(--s6); border-top: 1px solid var(--hairline); margin: 0; }
.st__stat { display: grid; gap: 4px; }
.st__stat dt { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: var(--tracking-mono); text-transform: uppercase; color: var(--text-muted); }
.st__stat dd { margin: 0; font-family: var(--font-display); font-size: var(--step-3); line-height: 1; color: var(--text-strong); font-variant-numeric: lining-nums tabular-nums; }

.st__stage { position: relative; }
.st__plate {
  position: relative;
  aspect-ratio: 5 / 4;
  overflow: hidden;
  background: radial-gradient(110% 80% at 50% 25%, color-mix(in srgb, var(--bg) 70%, #fff) 0%, var(--bg-sunken) 75%);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.st__plate > div { position: absolute; inset: 0; }
.st__caption {
  position: absolute; left: var(--s4); right: var(--s4); bottom: var(--s4);
  display: flex; align-items: flex-end; justify-content: space-between; gap: var(--s4);
  padding: var(--s3) var(--s3) var(--s3) var(--s5);
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.st__capLabel { font-family: var(--font-mono); font-size: 10px; letter-spacing: var(--tracking-mono); text-transform: uppercase; color: var(--accent-ink); }
.st__capName { font-family: var(--font-display); font-size: var(--step-1); color: var(--text-strong); line-height: 1.2; }
.st__capPrice { font-family: var(--font-mono); font-size: 12.5px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.st__capGo {
  display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto;
  min-height: var(--tap); padding: 0 var(--s4);
  background: var(--accent); color: var(--bg);
  text-decoration: none; font-size: 13px; font-weight: 600; white-space: nowrap;
}
.st__hint { position: absolute; top: var(--s4); left: var(--s4); padding: 4px 10px; border-radius: 999px; background: color-mix(in srgb, var(--bg) 80%, transparent); font-size: 11.5px; color: var(--text-muted); pointer-events: none; }
@media (max-width: 560px) {
  .st__caption { left: var(--s2); right: var(--s2); bottom: var(--s2); padding-left: var(--s4); }
  .st__capGo span { display: none; }
}

/* ---- collection -------------------------------------------------------- */
.st__section { display: grid; gap: var(--s6); }
.st__secHead { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--s4); flex-wrap: wrap; }
.st__h2 { font-family: var(--font-display); font-weight: 500; font-size: var(--step-3); line-height: 1.05; letter-spacing: -0.02em; color: var(--text-strong); }
.st__tools { display: flex; align-items: center; gap: var(--s3); flex-wrap: wrap; justify-content: space-between; }
.st__rail { display: flex; gap: var(--s2); overflow-x: auto; scrollbar-width: none; margin: 0; padding: 2px; list-style: none; min-width: 0; flex: 1 1 auto; }
.st__rail::-webkit-scrollbar { display: none; }
.st__chip {
  flex: 0 0 auto;
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 40px;
  padding: 0 var(--s4);
  border: 0;
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--border-strong);
  color: var(--text);
  font-family: var(--font-ui); font-size: var(--step--1); font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease), transform var(--d-fast) var(--ease);
}
.st__chip span { font-family: var(--font-mono); font-size: 10.5px; opacity: 0.65; }
.st__chip:active { transform: scale(0.97); }
.st__chip[aria-pressed='true'] { background: var(--accent); color: var(--bg); box-shadow: none; }
.st__sort {
  min-height: 40px; padding: 0 var(--s8) 0 var(--s4);
  border: 0; background: var(--bg-sunken); box-shadow: inset 0 0 0 1px var(--hairline);
  color: var(--text-strong); font: inherit; font-size: 14px;
}

/* ---- how it works ------------------------------------------------------ */
.st__steps { display: grid; gap: var(--s4); grid-template-columns: minmax(0, 1fr); margin: 0; padding: 0; list-style: none; counter-reset: st; }
@media (min-width: 820px) { .st__steps { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.st__step { display: grid; gap: var(--s3); padding: var(--s6); background: var(--bg-sunken); box-shadow: inset 0 0 0 1px var(--hairline); }
.st__step::before { counter-increment: st; content: '0' counter(st); font-family: var(--font-mono); font-size: 11px; letter-spacing: var(--tracking-mono); color: var(--accent-ink); }
.st__stepTitle { font-family: var(--font-display); font-size: var(--step-1); color: var(--text-strong); }
.st__stepBody { font-size: var(--step--1); line-height: 1.55; color: var(--text-muted); margin: 0; }

/* ---- footer ------------------------------------------------------------ */
.st__foot { display: grid; gap: var(--s8); padding: var(--s12) var(--s6); background: var(--text-strong); color: var(--bg); }
@media (min-width: 820px) { .st__foot { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); align-items: end; padding: var(--s16) var(--s12); } }
.st__footName { font-family: var(--font-display); font-size: var(--step-4); line-height: 1; letter-spacing: -0.03em; overflow-wrap: anywhere; }
.st__footMeta { display: grid; gap: var(--s3); justify-items: start; font-size: var(--step--1); opacity: 0.8; }
.st__footCta { display: inline-flex; align-items: center; gap: var(--s2); min-height: var(--tap); padding: 0 var(--s6); background: var(--accent); color: var(--bg); text-decoration: none; font-weight: 600; font-size: var(--step--1); }
.st__fine { margin-top: var(--s6); font-size: 12px; color: var(--text-muted); text-align: center; }

@media (hover: hover) and (pointer: fine) {
  .st__crumb:hover { color: var(--text-strong); }
  .st__chip:hover:not([aria-pressed='true']) { background: var(--bg-sunken); }
  .st__capGo:hover, .st__footCta:hover { filter: brightness(1.06); }
}
@media (prefers-reduced-motion: reduce) { .st__chip { transition: none; } }
`

/** Hex + 0–1 alpha as an 8-digit hex, for the hairline overrides. */
function alpha(hex: string, value: number): string {
  const byte = Math.round(Math.min(Math.max(value, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${byte}`
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 > 140
}

type StoreSort = 'featured' | 'placements' | 'priceAsc' | 'priceDesc' | 'newest'
const SORTS: StoreSort[] = ['featured', 'placements', 'priceAsc', 'priceDesc', 'newest']

function sortProducts(list: Product[], sort: StoreSort): Product[] {
  const out = [...list]
  switch (sort) {
    case 'placements':
      return out.sort((a, b) => b.placements - a.placements)
    case 'priceAsc':
      return out.sort((a, b) => a.priceUzs - b.priceUzs)
    case 'priceDesc':
      return out.sort((a, b) => b.priceUzs - a.priceUzs)
    case 'newest':
      return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    default:
      return out.sort((a, b) => Number(b.featured) - Number(a.featured) || b.placements - a.placements)
  }
}

export function StorePage() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const count = useCount()
  const money = useMoney()
  const reduced = useReducedMotion()
  const [category, setCategory] = useState<ProductCategory | 'all'>('all')
  const [sort, setSort] = useState<StoreSort>('featured')
  const [saved] = useSavedBranding()
  const [stageHover, setStageHover] = useState(false)

  const store = useMemo(() => getStore(slug), [slug])
  const products = store?.products ?? []

  const visible = useMemo(
    () => sortProducts(category === 'all' ? products : products.filter((p) => p.category === category), sort),
    [products, category, sort],
  )

  if (!store) {
    return (
      <div className="fs-container" style={{ paddingBlock: 'var(--s24)', display: 'grid', gap: 'var(--s6)', justifyItems: 'start' }}>
        <span className="fs-label">404</span>
        <h1 className="fs-display">{t('business.store.missing')}</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '48ch', margin: 0 }}>{t('business.store.missingBody')}</p>
        <CtaLink to="/catalog">{t('catalog.detail.back')}</CtaLink>
      </div>
    )
  }

  // The vendor's saved branding (this browser) wins over the typed record.
  const branding = saved.slug === store.branding.slug ? saved : store.branding
  const { profile } = store
  const { colors } = branding
  const soft = branding.corner === 'soft'
  const radius = (px: number) => (soft ? `${px}px` : '3px')
  const light = isLight(colors.paper)

  /* The vendor's palette, injected as token overrides. Everything inside —
     cards, pills, dimension lines — re-themes from these without new rules. */
  const theme = {
    colorScheme: light ? 'light' : 'dark',
    '--bg': colors.paper,
    '--bg-raised': light ? `color-mix(in srgb, ${colors.paper} 55%, #fff)` : colors.paper,
    '--bg-sunken': alpha(colors.ink, 0.05),
    '--bg-hover': alpha(colors.ink, 0.08),
    '--bg-inverse': colors.ink,
    '--text': alpha(colors.ink, 0.86),
    '--text-strong': colors.ink,
    '--text-muted': alpha(colors.ink, 0.62),
    '--text-faint': alpha(colors.ink, 0.42),
    '--text-inverse': colors.paper,
    '--border': alpha(colors.ink, 0.14),
    '--border-strong': alpha(colors.ink, 0.24),
    '--hairline': alpha(colors.ink, 0.12),
    '--accent': colors.accent,
    '--accent-ink': colors.accentInk,
    '--on-accent': colors.paper,
    '--focus': colors.accentInk,
    '--selection': alpha(colors.accent, 0.2),
    '--inset-hi': light ? 'inset 0 1px 0 rgba(255,255,255,0.7)' : `inset 0 1px 0 ${alpha(colors.ink, 0.08)}`,
    // A self-reference here would be a cycle (and void the font), so the
    // serif choice simply inherits the global display face.
    ...(branding.typeface === 'sans' ? { '--font-display': 'var(--font-ui)' } : {}),
  } as CSSProperties

  const available = CATEGORIES.filter((item) => products.some((product) => product.category === item))
  const placements = products.reduce((total, product) => total + product.placements, 0)
  const hero = [...products].sort((a, b) => b.placements - a.placements)[0]
  const heroName = hero ? t(`catalog.products.${hero.nameKey}.name`) : ''
  const heroPalette = hero ? { ...hero.palette, accent: colors.accent } : null

  const rise = (delay = 0) => ({
    initial: reduced ? false : ({ opacity: 0, y: 16 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.7, ease: EASE, delay: reduced ? 0 : delay },
  })

  return (
    <div className="st" style={theme}>
      <style href="fs-biz-store" precedence="medium">
        {CSS}
      </style>
      <CatalogChromeStyles />
      <ProductGridStyles />

      <Seo
        title={`${branding.displayName} — ${t('business.store.metaSuffix')}`}
        description={branding.tagline}
        path={`/store/${branding.slug}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'FurnitureStore',
          name: branding.displayName,
          description: branding.tagline,
          address: { '@type': 'PostalAddress', addressLocality: profile.city, addressCountry: 'UZ' },
        }}
      />

      <div className="fs-container">
        <div className="st__top">
          <Link className="st__crumb" to="/catalog">
            <span aria-hidden="true">←</span>
            {t('business.store.allMakers')}
          </Link>
          <span className="st__badge" style={{ borderRadius: radius(999) }}>
            <i aria-hidden="true" />
            {t('business.store.verified')}
          </span>
        </div>

        <section className="st__hero" aria-label={branding.displayName}>
          <div className="st__intro">
            <motion.div className="st__eyebrow" {...rise(0)}>
              <span className="st__mono" aria-hidden="true" style={{ borderRadius: radius(13) }}>
                {branding.monogram}
              </span>
              <span>
                {t('business.store.eyebrow')} · {profile.city}
              </span>
            </motion.div>
            <TextReveal
              as="h1"
              text={branding.displayName}
              className="st__name"
              delay={0.05}
              duration={0.6}
              stagger={0.045}
            />
            <motion.p className="st__tagline" {...rise(0.12)}>
              {branding.tagline}
            </motion.p>
            <motion.div className="st__ctas" {...rise(0.18)}>
              <CtaLink to={`/contact?store=${encodeURIComponent(branding.slug)}`} glyph="→">
                {t('business.store.contact')}
              </CtaLink>
              <CtaLink to="/app/capture" quiet glyph="◎">
                {t('business.store.placeCta')}
              </CtaLink>
            </motion.div>
            <motion.dl className="st__stats" {...rise(0.24)}>
              <div className="st__stat">
                <dt>{t('business.store.facts.pieces')}</dt>
                <dd>{count(products.length)}</dd>
              </div>
              <div className="st__stat">
                <dt>{t('business.store.facts.placements')}</dt>
                <dd>{count(placements)}</dd>
              </div>
              <div className="st__stat">
                <dt>{t('business.store.since')}</dt>
                <dd>{profile.memberSince.slice(0, 4)}</dd>
              </div>
            </motion.dl>
          </div>

          {hero && heroPalette && (
            <motion.figure
              className="st__stage"
              style={{ margin: 0 }}
              initial={reduced ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: reduced ? 0 : 0.9, ease: EASE, delay: reduced ? 0 : 0.1 }}
              onMouseEnter={() => setStageHover(true)}
              onMouseLeave={() => setStageHover(false)}
            >
              <div className="st__plate" style={{ borderRadius: radius(28) }}>
                <ViewportGate>
                  <Suspense fallback={null}>
                    <ProductViewer
                      model={hero.model}
                      palette={heroPalette}
                      spin={!stageHover}
                      spinSpeed={0.22}
                      interactive
                      shadows
                      style={{ width: '100%', height: '100%' }}
                      label={heroName}
                    />
                  </Suspense>
                </ViewportGate>
                <span className="st__hint" aria-hidden="true">
                  {t('catalog.detail.rotateHint')}
                </span>
              </div>
              <figcaption className="st__caption" style={{ borderRadius: radius(18) }}>
                <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <span className="st__capLabel">{t('business.store.mostPlaced')}</span>
                  <span className="st__capName">{heroName}</span>
                  <span className="st__capPrice">{money.price(hero.priceUzs)}</span>
                </span>
                <Link className="st__capGo" to={`/catalog/${hero.slug}`} style={{ borderRadius: radius(999) }}>
                  <span>{t('business.store.open')}</span>→
                </Link>
              </figcaption>
            </motion.figure>
          )}
        </section>

        <section className="st__section" aria-labelledby="st-collection">
          <div className="st__secHead">
            <h2 className="st__h2" id="st-collection">
              {t('business.store.collection')}
            </h2>
            <span className="st__badge" style={{ borderRadius: radius(999) }} aria-live="polite">
              {t('business.store.showing', { n: visible.length, total: products.length })}
            </span>
          </div>

          <div className="st__tools">
            <ul className="st__rail" aria-label={t('catalog.filters.category')}>
              <li>
                <button
                  type="button"
                  className="st__chip"
                  style={{ borderRadius: radius(999) }}
                  aria-pressed={category === 'all'}
                  onClick={() => setCategory('all')}
                >
                  {t('catalog.filters.all')} <span>{products.length}</span>
                </button>
              </li>
              {available.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    className="st__chip"
                    style={{ borderRadius: radius(999) }}
                    aria-pressed={category === item}
                    onClick={() => setCategory(item)}
                  >
                    {t(`catalog.categories.${item}`)}{' '}
                    <span>{products.filter((p) => p.category === item).length}</span>
                  </button>
                </li>
              ))}
            </ul>
            <select
              className="st__sort"
              style={{ borderRadius: radius(12) }}
              aria-label={t('catalog.filters.sort')}
              value={sort}
              onChange={(event) => setSort(event.target.value as StoreSort)}
            >
              {SORTS.map((option) => (
                <option key={option} value={option}>
                  {t(`catalog.sort.${option}`)}
                </option>
              ))}
            </select>
          </div>

          <ProductGrid
            products={visible}
            accentOverride={colors.accent}
            animated
            onReset={() => setCategory('all')}
          />
        </section>

        <section className="st__section" style={{ marginTop: 'var(--s24)' }} aria-labelledby="st-how">
          <h2 className="st__h2" id="st-how">
            {t('business.store.how.title')}
          </h2>
          <ol className="st__steps">
            {(['pick', 'place', 'talk'] as const).map((step) => (
              <li className="st__step" key={step} style={{ borderRadius: radius(22) }}>
                <span className="st__stepTitle">{t(`business.store.how.${step}.title`)}</span>
                <p className="st__stepBody">{t(`business.store.how.${step}.body`, { name: branding.displayName })}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer style={{ marginTop: 'var(--s16)' }}>
          <div className="st__foot" style={{ borderRadius: radius(28) }}>
            <div style={{ display: 'grid', gap: 'var(--s4)' }}>
              <span className="st__mono" aria-hidden="true" style={{ borderRadius: radius(13), color: colors.paper }}>
                {branding.monogram}
              </span>
              <p className="st__footName" style={{ margin: 0 }}>
                {branding.displayName}
              </p>
            </div>
            <div className="st__footMeta">
              <span>
                {profile.city} · {t('business.store.since')} {profile.memberSince.slice(0, 4)}
              </span>
              <Link
                className="st__footCta"
                to={`/contact?store=${encodeURIComponent(branding.slug)}`}
                style={{ borderRadius: radius(999) }}
              >
                {t('business.store.contact')} →
              </Link>
            </div>
          </div>
          <p className="st__fine">{t('business.store.demoData')}</p>
        </footer>
      </div>
    </div>
  )
}

export default StorePage
