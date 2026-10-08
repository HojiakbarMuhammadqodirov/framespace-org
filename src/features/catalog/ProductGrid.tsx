import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { EASE } from '@/design/motion'
import { Tilt } from '@/ui/Interactive'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { CtaButton } from './chrome'
import { ProductCard, ProductCardStyles } from './ProductCard'
import { bentoSpan, type BentoSpan } from './filters'
import type { Product } from './data'

/**
 * The bento. Six columns on wide screens; a cycle of nine cards fills four
 * rows exactly — hero+narrow / narrow×3 / wide+wide / narrow+hero — so the eye
 * never lands on three identical cards side by side. `grid-auto-flow: dense`
 * back-fills any hole a filtered set leaves behind.
 *
 * Below 1100px the spans are dropped: two even columns, and below 768px those
 * two columns hold compact cards (square plate, name and price) so a phone
 * shows two pieces per row instead of one tall card per screen.
 *
 * `layout="uniform"` keeps every cell the same size at every width — used for
 * short rows such as "similar pieces", where a hero cell would look stranded.
 */

const CSS = `
.cgrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.cgrid > li { min-width: 0; }
@media (min-width: 768px) {
  .cgrid { gap: var(--s6); }
}
@media (min-width: 1100px) {
  .cgrid { grid-template-columns: repeat(6, minmax(0, 1fr)); grid-auto-flow: dense; gap: var(--s8) var(--s6); }
  .cgrid__cell--narrow { grid-column: span 2; }
  .cgrid__cell--wide { grid-column: span 3; }
  .cgrid__cell--hero { grid-column: span 4; }
  .cgrid--uniform { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

.cgrid-empty {
  display: grid;
  gap: var(--s4);
  justify-items: center;
  text-align: center;
  padding: var(--s16) var(--s8);
  border-radius: 2rem;
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
@media (max-width: 767px) {
  .cgrid-empty { padding: var(--s10) var(--s5); }
}
.cgrid-empty__art { width: 132px; height: auto; color: var(--clay-300); margin-bottom: var(--s2); }
.cgrid-empty__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--step-2);
  font-weight: 500;
  letter-spacing: -0.012em;
  line-height: 1.15;
  color: var(--text-strong);
  text-wrap: balance;
}
.cgrid-empty__body { margin: 0 0 var(--s2); color: var(--text-muted); max-width: 46ch; }
`

export function ProductGridStyles() {
  return (
    <>
      <style href="fs-cat-grid" precedence="medium">
        {CSS}
      </style>
      <ProductCardStyles />
    </>
  )
}

const COMPACT = '(max-width: 767px)'

export function ProductGrid({
  products,
  accentOverride,
  onReset,
  layout = 'bento',
  animated = false,
}: {
  products: Product[]
  accentOverride?: string | null
  onReset?: () => void
  /** `bento` varies cell spans on wide screens; `uniform` never does. */
  layout?: 'bento' | 'uniform'
  /**
   * Reflow and cross-fade cells when the set changes (the filtered catalog).
   * `initial={false}` means first render never plays it — each card's own
   * scroll reveal covers first view, so only a filter change triggers this.
   */
  animated?: boolean
}) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const compact = useMediaQuery(COMPACT)

  if (products.length === 0) {
    return (
      <div className="cgrid-empty">
        <svg className="cgrid-empty__art" viewBox="0 0 132 84" fill="none" aria-hidden="true">
          <path d="M8 70 40 52h76L84 70z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M40 52V10h76v42M8 70V28l32-18" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.55" />
          <path d="M56 62h20" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 4" />
          <circle cx="66" cy="38" r="9" stroke="currentColor" strokeWidth="1.2" />
          <path d="m72.5 44.5 7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <h3 className="cgrid-empty__title">{t('catalog.empty.title')}</h3>
        <p className="cgrid-empty__body">{t('catalog.empty.body')}</p>
        {onReset && (
          <CtaButton quiet onClick={onReset} glyph="↺">
            {t('catalog.empty.action')}
          </CtaButton>
        )}
      </div>
    )
  }

  const uniform = layout === 'uniform'
  const spanFor = (index: number): BentoSpan => (uniform ? 'narrow' : bentoSpan(index))
  const cellClass = (span: BentoSpan) => (uniform ? undefined : `cgrid__cell--${span}`)

  const card = (product: Product, index: number, span: BentoSpan) => (
    <ProductCard
      product={product}
      index={index}
      span={span}
      compact={compact}
      accentOverride={accentOverride}
    />
  )

  if (animated) {
    return (
      <ul className={uniform ? 'cgrid cgrid--uniform' : 'cgrid'}>
        <AnimatePresence mode="popLayout" initial={false}>
          {products.map((product, index) => {
            const span = spanFor(index)
            return (
              <motion.li
                key={product.id}
                className={cellClass(span)}
                layout={reduced ? false : true}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: reduced ? 0 : 0.35, ease: EASE }}
              >
                {/* Tilt is a no-op on coarse pointers. */}
                <Tilt style={{ height: '100%' }} max={6}>
                  {card(product, index, span)}
                </Tilt>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    )
  }

  return (
    <ul className={uniform ? 'cgrid cgrid--uniform' : 'cgrid'}>
      {products.map((product, index) => {
        const span = spanFor(index)
        return (
          <li key={product.id} className={cellClass(span)}>
            {card(product, index, span)}
          </li>
        )
      })}
    </ul>
  )
}
