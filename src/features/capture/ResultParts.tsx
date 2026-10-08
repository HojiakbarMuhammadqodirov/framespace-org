/**
 * The panels the result page is assembled from.
 *
 * Two rules run through all of them. First, every number that describes money
 * is the server's: `budget.estimatedTotal` is recomputed from the line items in
 * `server/index.js` and the model's own total is thrown away, so the client
 * only ever prints it. Second, every panel is a double bezel — the shell, then
 * the core — because that is the language of the rest of the product.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { BeforeAfter } from '@/ui/BeforeAfter'
import { formatMoney } from '@/lib/styles.js'

import { Bezel, Eyebrow, Notice, Rise } from './Chrome'
import { UZS_PER_USD, useMoneyIn } from './money'
import type { CaptureRecord, DesignBrief, FurnitureItem, RenderImage } from './types'

const CSS = `
.cap-res__panel { display: grid; gap: var(--s5); }
.cap-res__panelHead { display: grid; gap: var(--s3); justify-items: start; }
.cap-res__h { font-size: var(--step-2); max-width: 18ch; }
.cap-res__muted { color: var(--text-muted); font-size: var(--step--1); line-height: var(--lh-body); }

.cap-res__stageFrame { border-radius: 1.25rem; overflow: hidden; }
.cap-res__img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cap-res__tag {
  position: absolute;
  bottom: var(--s3);
  padding: 4px var(--s3);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--clay-900) 62%, transparent);
  backdrop-filter: blur(6px);
  color: var(--paper);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  pointer-events: none;
}
.cap-res__tag--l { left: var(--s3); }
.cap-res__tag--r { right: var(--s3); }

.cap-res__gallery { display: grid; gap: var(--s3); }
.cap-res__galleryHero {
  position: relative; aspect-ratio: 4 / 3; border-radius: 1.25rem; overflow: hidden;
  background: var(--clay-900); outline: none;
}
.cap-res__galleryHero:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
.cap-res__galleryImg {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  opacity: 0; transform: scale(1.04);
  transition: opacity 600ms var(--ease), transform 1200ms var(--ease);
}
.cap-res__galleryImg[data-on='true'] { opacity: 1; transform: scale(1); }
.cap-res__galleryShade {
  position: absolute; inset: auto 0 0 0; height: 40%; pointer-events: none;
  background: linear-gradient(to top, color-mix(in srgb, var(--clay-900) 70%, transparent), transparent);
}
.cap-res__galleryCap {
  position: absolute; left: var(--s4); right: var(--s4); bottom: var(--s4);
  display: flex; justify-content: space-between; gap: var(--s3);
  color: var(--paper); font-family: var(--font-mono); font-size: var(--step--2);
  letter-spacing: 0.16em; text-transform: uppercase; pointer-events: none;
}
.cap-res__galleryFlag {
  position: absolute; top: var(--s3); left: var(--s3);
  padding: 4px var(--s3); border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--clay-900) 55%, transparent); backdrop-filter: blur(6px);
  color: color-mix(in srgb, var(--paper) 80%, transparent);
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase;
}
.cap-res__galleryNav {
  position: absolute; top: 50%; translate: 0 -50%;
  width: 40px; height: 40px; border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--paper) 30%, transparent);
  background: color-mix(in srgb, var(--clay-900) 45%, transparent); backdrop-filter: blur(8px);
  color: var(--paper); font-size: 22px; line-height: 1; cursor: pointer;
  transition: background-color var(--d-fast) var(--ease), transform var(--d-fast) var(--ease);
}
@media (hover: hover) and (pointer: fine) {
  .cap-res__galleryNav:hover { background: color-mix(in srgb, var(--clay-900) 70%, transparent); }
}
.cap-res__galleryNav:focus-visible { outline: 2px solid var(--paper); outline-offset: 2px; }
.cap-res__galleryNav:active { transform: scale(0.94); }
.cap-res__galleryNav--l { left: var(--s3); }
.cap-res__galleryNav--r { right: var(--s3); }
.cap-res__galleryGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: var(--s2); }
@media (min-width: 720px) { .cap-res__galleryHero { aspect-ratio: 16 / 10; } }
@media (max-width: 479px) { .cap-res__galleryNav { width: 36px; height: 36px; } .cap-res__dims { gap: var(--s5); } }
.cap-res__galleryTile {
  position: relative; padding: 0; border: 1px solid var(--border); border-radius: var(--radius-lg);
  overflow: hidden; background: var(--bg-sunken); cursor: pointer; opacity: 0.62;
  transition: opacity var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease), transform var(--d-fast) var(--ease);
}
.cap-res__galleryTile:hover { opacity: 1; transform: translateY(-2px); }
.cap-res__galleryTile[aria-pressed='true'] { opacity: 1; border-color: var(--accent); }
.cap-res__galleryTile img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; }
.cap-res__galleryTile span {
  display: block; padding: var(--s2); text-align: left;
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cap-res__note { font-size: var(--step--2); color: var(--text-muted); font-family: var(--font-mono); letter-spacing: 0.04em; line-height: 1.6; }
@media (prefers-reduced-motion: reduce) {
  .cap-res__galleryImg { transition: opacity 0ms; transform: none; }
}
.cap-res__thumbs { display: flex; gap: var(--s2); overflow-x: auto; scrollbar-width: none; }
.cap-res__thumbs::-webkit-scrollbar { display: none; }
.cap-res__thumb {
  flex: none;
  width: 84px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--bg-sunken);
  cursor: pointer;
  transition: transform var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease),
    opacity var(--d-fast) var(--ease);
  opacity: 0.6;
}
.cap-res__thumb:hover { opacity: 1; transform: translateY(-2px); }
.cap-res__thumb[aria-pressed='true'] { opacity: 1; border-color: var(--accent); }
.cap-res__thumbImg { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; }
.cap-res__thumbLabel {
  display: block;
  padding: var(--s2) var(--s2) var(--s3);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: left;
}

.cap-res__list { counter-reset: fsrow; }
.cap-res__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--s3);
  align-items: baseline;
  padding: var(--s5) 0;
  border-bottom: 1px solid var(--hairline);
  counter-increment: fsrow;
}
.cap-res__rowBody { display: grid; gap: var(--s1); min-width: 0; justify-items: start; }
.cap-res__rowBody::before {
  content: counter(fsrow, decimal-leading-zero);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
.cap-res__row:last-child { border-bottom: 0; }
.cap-res__rowName {
  font-family: var(--font-display);
  font-size: var(--step-1);
  line-height: var(--lh-tight);
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
.cap-res__rowMeta {
  display: block;
  margin-top: var(--s1);
  font-size: var(--step--1);
  color: var(--text-muted);
  max-width: 48ch;
}
.cap-res__rowCat {
  display: inline-block;
  margin-top: var(--s2);
  padding: 3px var(--s3);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-full);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.cap-res__price {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s1) var(--s3);
  font-variant-numeric: tabular-nums lining-nums;
}
.cap-res__priceMain {
  font-family: var(--font-ui);
  font-weight: 600;
  font-size: var(--step-0);
  color: var(--text-strong);
  white-space: nowrap;
  font-variant-numeric: tabular-nums lining-nums;
}
.cap-res__priceSub {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
@media (min-width: 640px) {
  .cap-res__row { grid-template-columns: minmax(0, 1fr) auto; gap: var(--s6); }
  .cap-res__price { display: grid; justify-items: end; text-align: right; gap: 2px; }
  .cap-res__priceSub { white-space: nowrap; }
}

.cap-res__total { display: grid; gap: var(--s4); }
.cap-res__total { padding-top: var(--s5); border-top: 1px solid var(--border-strong); }
.cap-res__totalTop { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: var(--s3) var(--s5); }
.cap-res__totalFig {
  font-family: var(--font-display);
  font-size: var(--step-3);
  line-height: 1.05;
  letter-spacing: -0.01em;
  color: var(--text-strong);
  font-variant-numeric: lining-nums tabular-nums;
  overflow-wrap: anywhere;
}
.cap-res__track { height: 6px; border-radius: var(--radius-full); background: var(--bg-sunken); overflow: hidden; }
.cap-res__fill {
  height: 100%;
  border-radius: var(--radius-full);
  transform-origin: left center;
  transition: transform var(--d-slow) var(--ease);
}
.cap-res__badge {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  padding: 4px var(--s3);
  border-radius: var(--radius-full);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.cap-res__badge--ok { background: color-mix(in srgb, var(--ok) 16%, transparent); color: var(--ok); }
.cap-res__badge--over { background: color-mix(in srgb, var(--err) 14%, transparent); color: var(--err); }

.cap-res__swatches { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--s4); }
@media (min-width: 420px) { .cap-res__swatches { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.cap-res__swatch { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: var(--s3); align-items: center; min-width: 0; }
.cap-res__swatchName { display: block; font-size: var(--step--1); font-weight: 600; color: var(--text-strong); overflow-wrap: anywhere; }
.cap-res__usage { display: block; margin-top: 2px; font-size: var(--step--2); line-height: 1.45; color: var(--text-muted); }
.cap-res__chipColour {
  width: 44px;
  height: 44px;
  border-radius: var(--radius);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.cap-res__hex {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.cap-res__tags { display: flex; flex-wrap: wrap; gap: var(--s2); }
.cap-res__tagPill {
  padding: 6px var(--s4);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-full);
  font-size: var(--step--1);
  color: var(--text-muted);
}
.cap-res__dims { display: flex; flex-wrap: wrap; gap: var(--s6); }
.cap-res__dim { display: grid; gap: var(--s1); }
.cap-res__dimVal {
  font-family: var(--font-display);
  font-size: var(--step-2);
  line-height: 1;
  color: var(--text-strong);
  font-variant-numeric: lining-nums tabular-nums;
}
.cap-res__dimKey {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
}
@media (min-width: 720px) {
  .cap-res__swatches { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  .cap-res__thumb:hover { transform: none; }
}
`

/** Translated wall name; the server's English `angleLabel` is only a fallback. */
function useAngleName() {
  const { t } = useTranslation()
  return (render: Pick<RenderImage, 'angleId' | 'angleLabel'>) =>
    t(`capture.angles.${render.angleId}.label`, {
      defaultValue: render.angleLabel || render.angleId,
    })
}

export function ResultStyles() {
  return (
    <style href="fs-cap-result" precedence="medium">
      {CSS}
    </style>
  )
}

/* ----------------------------------------------------------- before/after */

export function AngleStage({
  render,
  before,
  labels,
}: {
  render: RenderImage
  before?: string
  labels: { before: string; after: string }
}) {
  const angleName = useAngleName()
  return (
    <Bezel tight bare>
      <div className="cap-res__stageFrame">
        {before ? (
          <BeforeAfter
            labelBefore={labels.before}
            labelAfter={labels.after}
            before={
              <>
                <img className="cap-res__img" src={before} alt={labels.before} />
                <span className="cap-res__tag cap-res__tag--l">{labels.before}</span>
              </>
            }
            after={
              <>
                <img className="cap-res__img" src={render.image} alt={angleName(render)} />
                <span className="cap-res__tag cap-res__tag--r">{labels.after}</span>
              </>
            }
          />
        ) : (
          <img className="cap-res__img" src={render.image} alt={angleName(render)} />
        )}
      </div>
    </Bezel>
  )
}

/**
 * No photos behind the renders (a room-builder project): there is nothing to
 * wipe against, so the renders get the whole stage — a large hero that
 * crossfades between angles, with a filmstrip of tiles under it.
 */
export function RenderGallery({
  renders,
  activeId,
  onSelect,
  fallbackLabel,
}: {
  renders: RenderImage[]
  activeId: string
  onSelect: (id: string) => void
  fallbackLabel: string
}) {
  const { t } = useTranslation()
  const angleName = useAngleName()
  const active = renders.find((r) => r.angleId === activeId) || renders[0]
  if (!active) return null
  const index = renders.indexOf(active)
  const step = (delta: number) => {
    const next = renders[(index + delta + renders.length) % renders.length]
    if (next) onSelect(next.angleId)
  }
  return (
    <div className="cap-res__gallery">
      <Bezel tight bare>
        <div
          className="cap-res__galleryHero"
          tabIndex={0}
          role="group"
          aria-roledescription="carousel"
          aria-label={angleName(active)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') step(1)
            else if (event.key === 'ArrowLeft') step(-1)
          }}
        >
          {renders.map((render) => (
            <img
              key={render.angleId}
              className="cap-res__galleryImg"
              data-on={render.angleId === active.angleId}
              src={render.image}
              alt={angleName(render)}
              loading="lazy"
            />
          ))}
          <span className="cap-res__galleryShade" aria-hidden="true" />
          <span className="cap-res__galleryCap">
            <span>{angleName(active)}</span>
            <span>
              {String(index + 1).padStart(2, '0')} / {String(renders.length).padStart(2, '0')}
            </span>
          </span>
          {active.fallback && <span className="cap-res__galleryFlag">{fallbackLabel}</span>}
          {renders.length > 1 && (
            <>
              <button type="button" className="cap-res__galleryNav cap-res__galleryNav--l" onClick={() => step(-1)} aria-label={t('result.gallery.prev')}>
                ‹
              </button>
              <button type="button" className="cap-res__galleryNav cap-res__galleryNav--r" onClick={() => step(1)} aria-label={t('result.gallery.next')}>
                ›
              </button>
            </>
          )}
        </div>
      </Bezel>
      {renders.length > 1 && (
        <div className="cap-res__galleryGrid">
          {renders.map((render) => (
            <button
              key={render.angleId}
              type="button"
              className="cap-res__galleryTile"
              aria-pressed={render.angleId === active.angleId}
              onClick={() => onSelect(render.angleId)}
            >
              <img src={render.image} alt="" loading="lazy" />
              <span>{angleName(render)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AngleThumbs({
  renders,
  activeId,
  onSelect,
}: {
  renders: RenderImage[]
  activeId: string
  onSelect: (id: string) => void
}) {
  const angleName = useAngleName()
  return (
    <div className="cap-res__thumbs">
      {renders.map((render) => (
        <button
          key={render.angleId}
          type="button"
          className="cap-res__thumb"
          aria-pressed={render.angleId === activeId}
          onClick={() => onSelect(render.angleId)}
        >
          <img className="cap-res__thumbImg" src={render.image} alt={angleName(render)} />
          <span className="cap-res__thumbLabel">{angleName(render)}</span>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------ panel shell */

export function Panel({
  eyebrow,
  title,
  lead,
  children,
  delay,
}: {
  eyebrow: string
  title: string
  lead?: ReactNode
  children: ReactNode
  delay?: number
}) {
  return (
    <Rise delay={delay}>
      <Bezel>
        <div className="cap-res__panel">
          <div className="cap-res__panelHead">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className="cap-res__h">{title}</h2>
            {lead && <p className="cap-res__muted">{lead}</p>}
          </div>
          {children}
        </div>
      </Bezel>
    </Rise>
  )
}

/* -------------------------------------------------------------- furniture */

export function FurnitureList({ items, currency }: { items: FurnitureItem[]; currency: string }) {
  const { t } = useTranslation()
  const { format } = useMoneyIn(currency)
  if (!items.length) return <p className="cap-res__muted">{t('result.furniture.empty')}</p>

  return (
    <div className="cap-res__list" role="list">
      {items.map((item, i) => (
        <div className="cap-res__row" role="listitem" key={`${item.name}-${i}`}>
          <span className="cap-res__rowBody">
            <span className="cap-res__rowName">{item.name}</span>
            {item.description && <span className="cap-res__rowMeta">{item.description}</span>}
            {item.placement && (
              <span className="cap-res__rowMeta">
                {t('result.furniture.placement')}: {item.placement}
              </span>
            )}
            <span className="cap-res__rowCat">
              {t(`result.categories.${item.category}`, { defaultValue: item.category })}
            </span>
          </span>
          <span className="cap-res__price">
            <span className="cap-res__priceMain">
              {format(
                item.averagePrice ||
                  ((item.typicalPriceLow || 0) + (item.typicalPriceHigh || item.typicalPriceLow || 0)) / 2
              )}
            </span>
            <span className="cap-res__priceSub">
              {t('result.furniture.qty', { count: item.quantity || 1 })}
            </span>
            {item.typicalPriceLow != null &&
              item.typicalPriceHigh != null &&
              item.typicalPriceHigh > item.typicalPriceLow && (
                <span className="cap-res__priceSub">
                  {format(item.typicalPriceLow)} – {format(item.typicalPriceHigh)}
                </span>
              )}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ----------------------------------------------------------------- budget */

export function BudgetPanel({ brief }: { brief: DesignBrief }) {
  const { t } = useTranslation()
  const budget = brief.budget || {}
  const { format, converted, tag } = useMoneyIn(budget.currency || 'UZS')
  const total = Number(budget.estimatedTotal || 0)
  const limit = Number(budget.limit || 0)
  const within = budget.withinBudget !== false
  // Bar width only — the numbers themselves are untouched server output.
  const ratio = limit > 0 ? Math.min(1, total / limit) : 1

  return (
    <div className="cap-res__total">
      <div className="cap-res__totalTop">
        <span>
          <span className="cap-res__dimKey">{t('result.budget.total')}</span>
          <span className="cap-res__totalFig" style={{ display: 'block', marginTop: 'var(--s2)' }}>
            {format(total)}
          </span>
        </span>
        <span className={`cap-res__badge ${within ? 'cap-res__badge--ok' : 'cap-res__badge--over'}`}>
          {limit > 0 ? (within ? t('result.budget.within') : t('result.budget.over')) : t('result.budget.noLimit')}
        </span>
      </div>

      <div className="cap-res__track">
        <div
          className="cap-res__fill"
          style={{
            width: '100%',
            transform: `scaleX(${ratio})`,
            background: within ? 'var(--ok)' : 'var(--err)',
          }}
        />
      </div>

      <p className="cap-res__muted">
        {limit > 0
          ? t('result.budget.against', { limit: format(limit) })
          : t('result.budget.noLimitBody')}
      </p>
      {budget.notes && <p className="cap-res__muted">{budget.notes}</p>}
      <p className="cap-res__muted" style={{ opacity: 0.75 }}>
        {t('result.budget.serverNote')}
        {converted
          ? ` ${t('result.budget.converted', { rate: formatMoney(UZS_PER_USD, 'UZS', tag) })}`
          : ''}
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- palette */

export function PaletteGrid({ palette }: { palette: Array<{ name: string; hex: string; usage?: string }> }) {
  return (
    <div className="cap-res__swatches">
      {palette.map((entry) => (
        <div className="cap-res__swatch" key={`${entry.hex}-${entry.name}`}>
          <span className="cap-res__chipColour" style={{ background: entry.hex }} aria-hidden="true" />
          <span>
            <span className="cap-res__swatchName">{entry.name}</span>
            <span className="cap-res__hex">{entry.hex}</span>
            {entry.usage && <span className="cap-res__usage">{entry.usage}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

export function TagRow({ items }: { items: string[] }) {
  return (
    <div className="cap-res__tags">
      {items.map((item) => (
        <span className="cap-res__tagPill" key={item}>
          {item}
        </span>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ room */

export function RoomDims({ brief }: { brief: DesignBrief }) {
  const { t, i18n } = useTranslation()
  const room = brief.room || {}
  const dims: Array<[string, number | undefined]> = [
    [t('result.room.width'), room.estimatedWidthM],
    [t('result.room.depth'), room.estimatedDepthM],
    [t('result.room.height'), room.estimatedHeightM],
  ]
  return (
    <div className="cap-res__dims">
      {dims.map(([key, value]) => (
        <span className="cap-res__dim" key={key}>
          <span className="cap-res__dimVal">
            {value
              ? `${Number(value).toLocaleString(i18n.language, { maximumFractionDigits: 1 })} ${t('common.metres')}`
              : '—'}
          </span>
          <span className="cap-res__dimKey">{key}</span>
        </span>
      ))}
      {room.confidence && (
        <span className="cap-res__dim">
          <span className="cap-res__dimVal" style={{ fontSize: 'var(--step-0)' }}>
            {t(`result.room.confidence.${room.confidence}`)}
          </span>
          <span className="cap-res__dimKey">{t('result.room.confidenceLabel')}</span>
        </span>
      )}
    </div>
  )
}

/* -------------------------------------------------------------- failures */

export function FailuresNotice({ record }: { record: CaptureRecord }) {
  const { t } = useTranslation()
  const angleName = useAngleName()
  const failures = record.result.failures || []
  if (!failures.length) return null
  return (
    <Notice tone="warn" title={t('result.failures.title')}>
      {t('result.failures.body', { angles: failures.map((f) => angleName({ angleId: f.angleId, angleLabel: '' })).join(', ') })}
    </Notice>
  )
}

/** Kept for callers that imported it from here. */
export { useMoneyIn as useResultMoney }
