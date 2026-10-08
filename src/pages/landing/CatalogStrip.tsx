import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PRODUCTS, type Product } from '@/features/catalog/data'
import { ProductCard, ProductCardStyles } from '@/features/catalog/ProductCard'
import { ButtonLink } from '@/ui/Button'
import { Reveal } from '@/ui/Reveal'
import { Accent, plainText } from '@/ui/Accent'

/**
 * §03 — the catalog, as real 3D pieces.
 *
 * The strip used to be five stroke drawings of furniture inside a 160vh
 * pinned wrapper that spent a full screen of scroll moving them ~200px —
 * most of that scroll was a frozen page. It now shows actual catalog items,
 * each a live `ProductViewer` (lazy, viewport-gated, still until hovered),
 * in a native horizontal scroller with snap points and arrow buttons. No
 * pinning, so nothing here can trap or stall the page scroll.
 */

/** One piece per model kind, featured first, so the row never shows clones. */
function pickShowcase(limit = 8): Product[] {
  const sorted = [...PRODUCTS].sort((a, b) => Number(b.featured) - Number(a.featured))
  const seen = new Set<string>()
  const out: Product[] = []
  for (const p of sorted) {
    if (seen.has(p.model)) continue
    seen.add(p.model)
    out.push(p)
    if (out.length === limit) break
  }
  return out
}

const SHOWCASE = pickShowcase()

const CSS = `
.cs { padding-block: var(--section-y); }
.cs__viewport { position: relative; margin-top: var(--s8); }
@media (min-width: 768px) {
  .cs__viewport { margin-top: var(--s12); }
}
.cs__track {
  display: flex;
  gap: var(--s4);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: var(--gutter);
  padding: var(--s2) var(--gutter) var(--s6);
  margin: 0;
  list-style: none;
  scrollbar-width: none;
}
.cs__track::-webkit-scrollbar { display: none; }
@media (min-width: 1240px) {
  .cs__track {
    padding-inline: calc((100% - var(--container)) / 2 + var(--gutter));
    scroll-padding-inline: calc((100% - var(--container)) / 2 + var(--gutter));
  }
}
.cs__item {
  flex: 0 0 auto;
  width: clamp(250px, 76vw, 340px);
  scroll-snap-align: start;
}
.cs__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
  margin-top: var(--s4);
}
.cs__hint {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  font-weight: 500;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.cs__nav { display: flex; gap: var(--s2); }
.cs__arrow {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 0;
  background: var(--bg-raised);
  color: var(--text-strong);
  cursor: pointer;
  box-shadow: inset 0 0 0 1px var(--bezel-ring), var(--shadow-ambient);
  transition: transform var(--d-base) var(--ease-fluid), opacity var(--d-base) var(--ease-fluid), box-shadow var(--d-base) var(--ease-fluid);
}
.cs__arrow:disabled { opacity: 0.35; cursor: default; }
@media (hover: hover) and (pointer: fine) {
  .cs__arrow:not(:disabled):hover { transform: translateY(-2px); box-shadow: inset 0 0 0 1px var(--bezel-ring), var(--shadow-raised); }
}
@media (pointer: coarse) {
  .cs__nav { display: none; }
}
`

export function CatalogStrip() {
  const { t } = useTranslation()
  const title = t('landing.catalog.title')
  const trackRef = useRef<HTMLUListElement | null>(null)
  const [edge, setEdge] = useState({ start: true, end: false })

  const sync = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft >= max - 4 })
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', sync)
      ro.disconnect()
    }
  }, [sync])

  const page = (dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('.cs__item')
    const step = card ? card.offsetWidth + 16 : 320
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * step * 2, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <section id="catalog" className="cs" aria-labelledby="cs-title">
      <style href="fs-landing-catalog" precedence="medium">
        {CSS}
      </style>
      <ProductCardStyles />

      <div className="fs-container">
        <Reveal className="fs-sec-head">
          <div className="fs-sec-head__main">
            <span className="fs-eyebrow">
              <span className="fs-eyebrow__dot" aria-hidden="true" />
              {t('landing.catalog.label')}
            </span>
            <h2 id="cs-title" className="fs-h2">
              <Accent text={title} />
            </h2>
          </div>
          <p className="fs-lead" style={{ maxWidth: '42ch' }}>
            {t('landing.catalog.lead')}
          </p>
        </Reveal>
      </div>

      <div className="cs__viewport">
        <ul
          ref={trackRef}
          className="cs__track"
          role="region"
          aria-label={plainText(title)}
          // Data Saver / weak GPUs: ProductCard itself falls back to drawings.
          tabIndex={0}
        >
          {SHOWCASE.map((product, i) => (
            <li key={product.id} className="cs__item">
              <ProductCard product={product} index={i} span="narrow" />
            </li>
          ))}
        </ul>
      </div>

      <div className="fs-container">
        <div className="cs__bar">
          <span className="cs__hint">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z M3 7.5V16.5L12 21l9-4.5V7.5 M12 12v9"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
            {t('landing.catalog.hint')}
          </span>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)', flexWrap: 'wrap' }}
          >
            <div className="cs__nav">
              <button
                type="button"
                className="cs__arrow"
                onClick={() => page(-1)}
                disabled={edge.start}
                aria-label={t('landing.catalog.prev')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M15 5 8 12l7 7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="cs__arrow"
                onClick={() => page(1)}
                disabled={edge.end}
                aria-label={t('landing.catalog.next')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="m9 5 7 7-7 7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <ButtonLink to="/catalog" variant="secondary" arrow>
              {t('landing.catalog.cta')}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  )
}
