import { Suspense, lazy, useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { detectSceneTier } from '@/three/effects/quality'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { CatalogChromeStyles, Mono, StatusPip, ViewportGate } from './chrome'
import { useCount, useMoney } from './money'
import type { BentoSpan } from './filters'
import type { Product } from './data'

/**
 * One product in the bento grid: a glass plate seated in a machined tray.
 *
 * The plate is a live `ProductViewer`, loaded lazily so three.js is its own
 * chunk and never rides along with pages that only borrow catalog chrome. It
 * idles perfectly still and only starts its slow yaw while the card is hovered
 * or keyboard-focused — or, on a touch screen, while at least 60% of it is on
 * screen, because a phone has no hover. `ViewportGate` decides whether the
 * canvas exists at all.
 *
 * On a weak GPU or with Data Saver on, the plate stays a static drawing and the
 * viewer only mounts when the visitor asks for it with the "3D" button.
 *
 * The card is a stretched link: the `<Link>` wraps the label strip and its
 * `::after` covers the whole tray, so the 3D button can sit above it without
 * nesting a button inside an anchor.
 */

const ProductViewer = lazy(() => import('@/three/ProductViewer'))

const CSS = `
.cat-card {
  --cat-tray: var(--s2);
  --cat-radius: 2rem;
  --cat-plate: 4 / 3;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--cat-tray);
  border-radius: var(--cat-radius);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  color: inherit;
  transition: box-shadow var(--d-base) var(--ease), transform var(--d-base) var(--ease);
}
@media (hover: hover) and (pointer: fine) {
  .cat-card:hover {
    box-shadow: inset 0 0 0 1px var(--border-strong), var(--shadow-card);
    transform: translateY(-2px);
  }
  .cat-card:hover .cat-card__name { transform: translateX(3px); }
}
.cat-card:has(.cat-card__link:focus-visible) {
  box-shadow: inset 0 0 0 1px var(--border-strong), var(--shadow-card);
  outline: 2px solid var(--focus);
  outline-offset: 3px;
}
.cat-card:active { transform: scale(0.995); }

/* the stretched link: its ::after is the whole card's hit area */
.cat-card__link {
  display: flex;
  flex-direction: column;
  flex: 1;
  color: inherit;
  text-decoration: none;
  outline: none;
}
.cat-card__link::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
}

/* the plate */
.cat-card__plate {
  position: relative;
  aspect-ratio: var(--cat-plate);
  border-radius: calc(var(--cat-radius) - var(--cat-tray));
  background: var(--bg-raised);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--white) 60%, transparent),
    inset 0 0 0 1px var(--hairline);
  overflow: hidden;
}
/* A single soft sheen across the glass. No glassmorphism: it is opaque, it
   does not blur anything behind it, and it never sits over scrolling text. */
.cat-card__plate::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    120% 80% at 18% 0%,
    color-mix(in srgb, var(--white) 34%, transparent) 0%,
    transparent 62%
  );
  pointer-events: none;
}
.cat-card__canvas { position: absolute; inset: 0; }
.cat-card__fill { position: absolute; inset: var(--s4); border-radius: var(--radius); }
.cat-card__static {
  position: absolute;
  inset: 12% 14%;
  width: auto;
  height: auto;
}

/* the corner readouts on the plate — read-only, clicks fall through */
.cat-card__pin {
  position: absolute;
  z-index: 2;
  padding: var(--s1) var(--s3);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-raised) 88%, transparent);
  box-shadow: inset 0 0 0 1px var(--hairline);
  pointer-events: none;
}
.cat-card__pin--tl { top: var(--s3); left: var(--s3); }
.cat-card__pin--tr { top: var(--s3); right: var(--s3); }
.cat-card__pin--bl { bottom: var(--s3); left: var(--s3); }

/* "show in 3D" — only on low-tier / Data Saver plates. Sits above the link. */
.cat-card__arm {
  position: absolute;
  z-index: 3;
  right: var(--s2);
  bottom: var(--s2);
  display: inline-grid;
  place-items: center;
  min-width: var(--tap);
  min-height: var(--tap);
  padding: 0 var(--s3);
  border: 0;
  border-radius: var(--radius-full);
  background: var(--bg-raised);
  box-shadow: inset 0 0 0 1px var(--border-strong);
  color: var(--text-strong);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  cursor: pointer;
}
.cat-card__arm:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

/* the label strip inside the tray */
.cat-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  flex: 1;
  padding: var(--s5) var(--s4) var(--s3);
}
.cat-card__brand {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.cat-card__name {
  font-family: var(--font-display);
  font-size: var(--step-2);
  font-weight: 500;
  line-height: 1.12;
  /* Playfair's high contrast wants air, not the sans-era -0.03em. */
  letter-spacing: -0.012em;
  color: var(--text-strong);
  text-wrap: balance;
  transition: transform var(--d-base) var(--ease);
}
.cat-card__blurb {
  font-size: var(--step--1);
  color: var(--text-muted);
  margin: 0;
  max-width: 44ch;
}
.cat-card__foot {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--s4);
  margin-top: auto;
  padding-top: var(--s4);
  border-top: 1px solid var(--hairline);
}
.cat-card__price {
  font-family: var(--font-ui);
  font-size: var(--step-0);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong);
  letter-spacing: -0.01em;
}
.cat-card__was {
  font-family: var(--font-ui);
  font-size: var(--step--1);
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--text-muted) 60%, transparent);
}
.cat-card__specs { display: flex; flex-wrap: wrap; gap: var(--s2) var(--s4); }

/* hero and wide cells earn a wider plate and a two-column label strip */
.cat-card--hero { --cat-plate: 16 / 9; }
.cat-card--wide { --cat-plate: 3 / 2; }
@media (min-width: 1024px) {
  .cat-card--hero .cat-card__name { font-size: var(--step-3); }
  .cat-card--hero .cat-card__body { padding-inline: var(--s6); }
}

/* compact: the two-up phone grid. Square plate, name and price only. */
.cat-card--compact { --cat-tray: var(--s1); --cat-radius: 1.25rem; --cat-plate: 1 / 1; }
.cat-card--compact .cat-card__body { gap: var(--s1); padding: var(--s3) var(--s2) var(--s2); }
.cat-card--compact .cat-card__name { font-size: var(--step-0); }
.cat-card--compact .cat-card__foot {
  flex-direction: column;
  align-items: flex-start;
  gap: var(--s1);
  padding-top: var(--s2);
}
.cat-card--compact .cat-card__price { font-size: var(--step--1); }
.cat-card--compact .cat-card__pin { padding: 2px var(--s2); }
.cat-card--compact .cat-card__pin--tl { top: var(--s2); left: var(--s2); }
.cat-card--compact .cat-card__pin--tr { top: var(--s2); right: var(--s2); }

@media (prefers-reduced-motion: reduce) {
  .cat-card, .cat-card__name { transition: none; }
  .cat-card:hover { transform: none; }
}
`

export function ProductCardStyles() {
  // The card is built from the chrome primitives (Mono, StatusPip), so it
  // carries their styles too — outside /catalog (landing strip, saved, 404)
  // nothing else hoists them. React dedupes the block by `href`.
  return (
    <>
      <CatalogChromeStyles />
      <style href="fs-cat-card" precedence="medium">
        {CSS}
      </style>
    </>
  )
}

/**
 * The plate's still state: a stroke elevation of a seat, not a spinner. Used
 * while the viewer chunk loads, before the gate opens, and as the whole plate
 * on low-tier devices until the visitor asks for 3D.
 */
function StaticPlate() {
  return (
    <svg
      className="cat-card__static"
      viewBox="0 0 200 150"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <g stroke="var(--clay-300)" strokeWidth="1.25" strokeLinejoin="round">
        <path d="M44 108 L44 62 Q44 54 54 54 L146 54 Q156 54 156 62 L156 108" />
        <path d="M44 86 L156 86" />
        <path d="M54 108 L54 118 M146 108 L146 118" />
      </g>
      <path d="M24 130 L176 130" stroke="var(--hairline)" strokeWidth="1" />
    </svg>
  )
}

/** Weak GPU, few cores or Data Saver: start every plate as a drawing. */
function prefersStatic(): boolean {
  if (typeof navigator === 'undefined') return false
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (connection?.saveData) return true
  return detectSceneTier() === 'low'
}

const COARSE = '(pointer: coarse)'

export interface ProductCardProps {
  product: Product
  index: number
  span: BentoSpan
  /** Square plate, name and price only — the two-up phone grid. */
  compact?: boolean
  /** Overrides the product's own accent — the branded `/store/:slug` page. */
  accentOverride?: string | null
}

export function ProductCard({ product, index, span, compact, accentOverride }: ProductCardProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const count = useCount()
  const reduced = useReducedMotion()
  const coarse = useMediaQuery(COARSE)
  const uid = useId()
  const host = useRef<HTMLElement>(null)

  const [hover, setHover] = useState(false)
  const [visible, setVisible] = useState(false)
  const [armed, setArmed] = useState(() => !prefersStatic())

  const start = useCallback(() => setHover(true), [])
  const stop = useCallback(() => setHover(false), [])

  // Touch screens have no hover, so the piece turns while most of it is in
  // view instead. One observer per card, only on coarse pointers.
  useEffect(() => {
    const el = host.current
    if (!coarse || !el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.intersectionRatio >= 0.6), {
      threshold: [0, 0.6, 1],
    })
    io.observe(el)
    return () => io.disconnect()
  }, [coarse])

  const spin = hover || (coarse && visible)

  const name = t(`catalog.products.${product.nameKey}.name`)
  const blurb = t(`catalog.products.${product.nameKey}.blurb`)
  const palette = accentOverride
    ? { ...product.palette, accent: accentOverride }
    : product.palette

  const discount =
    product.compareAtUzs && product.compareAtUzs > product.priceUzs
      ? Math.round((1 - product.priceUzs / product.compareAtUzs) * 100)
      : 0

  const nameId = `${uid}-name`
  const priceId = `${uid}-price`

  return (
    <motion.article
      ref={host}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8% 0px' }}
      transition={{ duration: reduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1], delay: reduced ? 0 : Math.min(index, 4) * 0.04 }}
      style={{ height: '100%' }}
    >
      <div
        className={cn(
          'cat-card',
          !compact && span === 'hero' && 'cat-card--hero',
          !compact && span === 'wide' && 'cat-card--wide',
          compact && 'cat-card--compact',
        )}
        onMouseEnter={start}
        onMouseLeave={stop}
        onFocus={start}
        onBlur={stop}
      >
        <div className="cat-card__plate">
          <span className="cat-card__pin cat-card__pin--tl">
            <StatusPip status={product.modelStatus}>
              {t(`catalog.card.model.${product.modelStatus}`)}
            </StatusPip>
          </span>

          {discount > 0 && (
            <span className="cat-card__pin cat-card__pin--tr">
              <Mono value={`−${discount}%`} />
            </span>
          )}

          {!compact && (
            <span className="cat-card__pin cat-card__pin--bl">
              <Mono
                label={t('catalog.card.placedLabel')}
                value={count(product.placements)}
              />
            </span>
          )}

          {armed ? (
            <ViewportGate className="cat-card__canvas" placeholder={<StaticPlate />}>
              <Suspense fallback={<StaticPlate />}>
                <ProductViewer
                  model={product.model}
                  palette={palette}
                  spin={spin}
                  spinSpeed={0.32}
                  offset={(index % 5) * 0.42}
                  style={{ width: '100%', height: '100%' }}
                  label={name}
                />
              </Suspense>
            </ViewportGate>
          ) : (
            <>
              <div className="cat-card__canvas">
                <StaticPlate />
              </div>
              <button
                type="button"
                className="cat-card__arm"
                onClick={() => setArmed(true)}
                aria-label={`${t('catalog.card.rotate')}: ${name}`}
              >
                3D
              </button>
            </>
          )}
        </div>

        <Link
          to={`/catalog/${product.slug}`}
          className="cat-card__link"
          aria-labelledby={nameId}
          aria-describedby={priceId}
          data-cursor={t('catalog.card.rotate')}
        >
          <div className="cat-card__body">
            <span className="cat-card__brand">{product.brand}</span>
            <h3 className="cat-card__name" id={nameId}>{name}</h3>
            {!compact && <p className="cat-card__blurb">{blurb}</p>}

            {!compact && (
              <div className="cat-card__specs">
                <Mono label={t('catalog.detail.width')} value={`${product.dimensions.widthCm} cm`} />
                <Mono label={t('catalog.detail.depth')} value={`${product.dimensions.depthCm} cm`} />
                <Mono label={t('catalog.detail.height')} value={`${product.dimensions.heightCm} cm`} />
              </div>
            )}

            <div className="cat-card__foot">
              <span style={{ display: 'grid', gap: 'var(--s1)' }} id={priceId}>
                <span className="cat-card__price">{money.price(product.priceUzs)}</span>
                {product.compareAtUzs && (
                  <span className="cat-card__was">{money.price(product.compareAtUzs)}</span>
                )}
              </span>
              <StatusPip status={product.inStock ? 'ready' : 'processing'}>
                {product.inStock
                  ? t('catalog.card.inStock')
                  : t('catalog.card.leadTime', { days: product.leadTimeDays })}
              </StatusPip>
            </div>
          </div>
        </Link>
      </div>
    </motion.article>
  )
}
