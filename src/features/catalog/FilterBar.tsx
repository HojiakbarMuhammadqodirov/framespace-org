import { useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useMediaQuery } from '@/lib/useMediaQuery'
import { Mono } from './chrome'
import { useMoney } from './money'
import {
  CATEGORIES,
  PRICE_BOUNDS,
  ROOM_KEYS,
  SORT_KEYS,
  STYLE_KEYS,
  type ProductCategory,
  type ProductStyle,
  type RoomType,
  type SortKey,
} from './data'
import { DEFAULT_QUERY, activeFilterCount, type CatalogQuery } from './filters'

/**
 * The catalog's filter rail: search, category, price range in UZS, style,
 * room type, stock and sort.
 *
 * It sticks under the header (offset by `--hdr-offset`, which the header
 * writes) rather than scrolling away, which is the one place
 * `backdrop-filter` is allowed — a fixed element, never over scrolling body
 * copy. Every control is at least 44px tall.
 *
 * Below 1024px the sticky part shrinks to what a thumb reaches for while
 * scrolling: the category rail, a "Filters (n)" pill and sort. Price, style,
 * room and stock live in a bottom-sheet `<dialog>` — modal, so focus stays
 * inside and Esc closes it — and the search field sits just above the sticky
 * bar, scrolling away with the hero. An active search stays visible in the
 * bar as a removable chip.
 */

const CSS = `
.cfl {
  position: sticky;
  top: var(--hdr-offset);
  z-index: 20;
  padding-block: var(--s2);
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
@media (min-width: 1024px) { .cfl { padding-block: var(--s3); } }
.cfl__tray {
  --cfl-tray: var(--s1);
  padding: var(--cfl-tray);
  border-radius: 1.5rem;
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.cfl__core {
  border-radius: calc(1.5rem - var(--cfl-tray));
  background: var(--bg-raised);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--white) 55%, transparent),
    inset 0 0 0 1px var(--hairline);
  padding: var(--s3);
  display: grid;
  gap: var(--s3);
}
@media (min-width: 1024px) {
  .cfl__tray { --cfl-tray: var(--s2); border-radius: 1.75rem; }
  .cfl__core { border-radius: calc(1.75rem - var(--cfl-tray)); padding: var(--s2) var(--s2) var(--s2) var(--s4); gap: var(--s2); }
}
/* Desktop: everything on one line — rail scrolls, tools stay put. */
.cfl__line { display: flex; align-items: center; gap: var(--s3); min-width: 0; }
.cfl__line .cfl__rail { flex: 1 1 auto; min-width: 0; mask-image: linear-gradient(90deg, #000 92%, transparent); }
.cfl__tools { flex: 0 0 auto; display: flex; align-items: center; gap: var(--s2); }
.cfl__tools .cfl__search { width: 15rem; }
.cfl__tools .cfl__select { width: auto; max-width: 13rem; }
.cfl__badge {
  display: inline-grid; place-items: center;
  min-width: 20px; height: 20px; padding: 0 6px;
  border-radius: var(--radius-full);
  background: var(--accent-ink); color: var(--paper);
  font-size: 11px; letter-spacing: 0;
}
.cfl__pill[data-active='true'] .cfl__badge { background: var(--bg); color: var(--text-strong); }

/* ---- search ------------------------------------------------------------ */
.cfl-find { padding-bottom: var(--s3); }
.cfl__search {
  width: 100%;
  min-height: var(--tap);
  padding: 0 var(--s5);
  border: 0;
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  color: var(--text-strong);
  font-family: var(--font-ui);
  font-size: 16px;
  transition: box-shadow var(--d-fast) var(--ease);
}
.cfl__search::placeholder { color: var(--text-muted); }
.cfl__search:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

/* ---- category rail ----------------------------------------------------- */
.cfl__rail {
  display: flex;
  gap: var(--s2);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  margin: 0;
  padding: 0;
  list-style: none;
}
.cfl__rail::-webkit-scrollbar { display: none; }
.cfl__cat {
  flex: 0 0 auto;
  min-height: var(--tap);
  padding: 0 var(--s4);
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--hairline);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease),
    transform var(--d-fast) var(--ease), box-shadow var(--d-fast) var(--ease);
}
.cfl__cat:active { transform: scale(0.98); }
.cfl__cat[aria-pressed='true'] {
  background: var(--text-strong);
  color: var(--bg);
  box-shadow: inset 0 0 0 1px var(--text-strong);
}
.cfl__cat:disabled { opacity: 0.4; cursor: not-allowed; }
.cfl__count { margin-inline-start: var(--s2); opacity: 0.6; }

/* ---- compact bar (below 1024px) ---------------------------------------- */
.cfl__bar { display: flex; align-items: center; gap: var(--s2); }
.cfl__pill {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  min-height: var(--tap);
  padding: 0 var(--s4);
  border: 0;
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--border-strong);
  color: var(--text-strong);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  cursor: pointer;
}
.cfl__pill[data-active='true'] { background: var(--text-strong); color: var(--bg); box-shadow: none; }
.cfl__pill:active { transform: scale(0.98); }
.cfl__bar .cfl__select { flex: 1 1 auto; width: auto; min-width: 0; max-width: 240px; margin-inline-start: auto; }

/* ---- control rows (1024px and up) -------------------------------------- */
.cfl__row {
  display: grid;
  gap: var(--s4);
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  align-items: end;
  padding-top: var(--s4);
  border-top: 1px solid var(--hairline);
}
.cfl__row--find { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); }
.cfl__group { display: grid; gap: var(--s2); min-width: 0; }
.cfl__legend {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.cfl__select {
  min-height: var(--tap);
  width: 100%;
  padding: 0 var(--s4);
  border: 0;
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  color: var(--text-strong);
  font-family: var(--font-ui);
  font-size: 16px;
  transition: box-shadow var(--d-fast) var(--ease);
  /* A drawn caret instead of each OS's own arrow, so the pill reads as one piece. */
  -webkit-appearance: none;
  appearance: none;
  padding-inline-end: var(--s10);
  background-image:
    linear-gradient(45deg, transparent 50%, var(--text-muted) 50%),
    linear-gradient(135deg, var(--text-muted) 50%, transparent 50%);
  background-position: calc(100% - 21px) 52%, calc(100% - 16px) 52%;
  background-size: 5px 5px;
  background-repeat: no-repeat;
  text-overflow: ellipsis;
  cursor: pointer;
}
.cfl__select:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

/* ---- dual price range -------------------------------------------------- */
.cfl__range { position: relative; height: var(--tap); }
.cfl__track {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  transform: translateY(-50%);
  background: var(--border-strong);
  border-radius: var(--radius-full);
}
.cfl__fill {
  position: absolute;
  top: 50%;
  height: 2px;
  transform: translateY(-50%);
  background: var(--accent);
  border-radius: var(--radius-full);
}
.cfl__range input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: var(--tap);
  margin: 0;
  background: transparent;
  pointer-events: none;
  -webkit-appearance: none;
  appearance: none;
}
.cfl__range input::-webkit-slider-thumb {
  -webkit-appearance: none;
  pointer-events: auto;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  background: var(--accent-ink);
  border: 2px solid var(--bg-raised);
  cursor: ew-resize;
  transition: transform var(--d-fast) var(--ease);
}
.cfl__range input::-moz-range-thumb {
  pointer-events: auto;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  background: var(--accent-ink);
  border: 2px solid var(--bg-raised);
  cursor: ew-resize;
}
.cfl__range input:active::-webkit-slider-thumb { transform: scale(1.12); }
.cfl__range input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: var(--radius-full); }
.cfl__readout { display: flex; justify-content: space-between; gap: var(--s3); }

/* ---- reset / toggle ---------------------------------------------------- */
.cfl__reset {
  min-height: var(--tap);
  padding: 0 var(--s5);
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--border-strong);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  cursor: pointer;
  transition: transform var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease),
    color var(--d-fast) var(--ease);
}
.cfl__reset:active { transform: scale(0.98); }
.cfl__reset[disabled] { opacity: 0.4; pointer-events: none; }

.cfl__toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--s3);
  min-height: var(--tap);
  cursor: pointer;
  font-size: var(--step--1);
  color: var(--text-muted);
}
.cfl__toggle input { width: 20px; height: 20px; accent-color: var(--accent-ink); }

/* ---- status line: search chip + result count --------------------------- */
.cfl__status {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  min-width: 0;
}
.cfl__status:empty { display: none; }
.cfl__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--s1);
  min-width: 0;
  max-width: 70%;
  min-height: 32px;
  padding: 0 var(--s1) 0 var(--s3);
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  font-size: var(--step--1);
  color: var(--text-strong);
}
.cfl__chipText { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cfl__chip button {
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  /* A full tap target; negative margins keep the chip itself 32px tall. */
  width: var(--tap);
  height: var(--tap);
  margin: calc((32px - var(--tap)) / 2);
  margin-left: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--step-0);
  line-height: 1;
  cursor: pointer;
}

/* ---- bottom sheet ------------------------------------------------------ */
.cfl-sheet {
  position: fixed;
  inset: auto 0 0 0;
  width: 100%;
  max-width: 100%;
  max-height: min(88dvh, 760px);
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 1.5rem 1.5rem 0 0;
  background: var(--bg-raised);
  color: var(--text);
  box-shadow: inset 0 1px 0 var(--hairline), var(--shadow-float);
  overflow: hidden;
}
.cfl-sheet[open] { display: flex; flex-direction: column; animation: cfl-sheet-in var(--d-slow) var(--ease-fluid); }
.cfl-sheet::backdrop { background: color-mix(in srgb, var(--bg-inverse) 45%, transparent); }
@media (min-width: 1024px) {
  .cfl-sheet {
    inset: 0 0 0 auto;
    width: min(28rem, 92vw);
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 1.75rem 0 0 1.75rem;
  }
  .cfl-sheet[open] { animation-name: cfl-panel-in; }
}
@keyframes cfl-panel-in { from { transform: translateX(32px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes cfl-sheet-in { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
.cfl-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  padding: var(--s4) var(--s5) var(--s3);
  border-bottom: 1px solid var(--hairline);
}
.cfl-sheet__title { font-family: var(--font-display); font-size: var(--step-2); font-weight: 500; letter-spacing: -0.012em; line-height: 1.1; color: var(--text-strong); margin: 0; }
.cfl-sheet__body {
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--s5);
  display: grid;
  gap: var(--s6);
  align-content: start;
}
.cfl-sheet__foot {
  position: sticky;
  bottom: 0;
  display: flex;
  gap: var(--s3);
  padding: var(--s4) var(--s5) calc(var(--s4) + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--hairline);
  background: var(--bg-raised);
}
.cfl-sheet__show {
  flex: 1 1 auto;
  min-height: var(--tap);
  padding: 0 var(--s5);
  border: 0;
  border-radius: var(--radius-full);
  background: var(--accent-ink);
  color: var(--paper);
  font-family: var(--font-ui);
  font-size: var(--step-0);
  font-weight: 500;
  cursor: pointer;
}
.cfl-sheet__show:active { transform: scale(0.98); }

@media (hover: hover) and (pointer: fine) {
  .cfl__cat:hover:not(:disabled) { color: var(--text-strong); box-shadow: inset 0 0 0 1px var(--border-strong); }
  .cfl__cat[aria-pressed='true']:hover { color: var(--bg); box-shadow: inset 0 0 0 1px var(--text-strong); }
  .cfl__select:hover, .cfl__search:hover { box-shadow: inset 0 0 0 1px var(--border-strong); }
  .cfl__reset:hover { background: var(--text-strong); color: var(--bg); }
  .cfl__chip button:hover { color: var(--text-strong); }
}

@media (prefers-reduced-motion: reduce) {
  .cfl { backdrop-filter: none; background: var(--bg); }
  .cfl__cat, .cfl__reset, .cfl__select, .cfl__search { transition: none; }
  .cfl-sheet[open] { animation: none; }
}
`

export function FilterBarStyles() {
  return (
    <style href="fs-cat-filters" precedence="medium">
      {CSS}
    </style>
  )
}

/** Slider steps of 100 000 soʻm — finer than that is noise at these prices. */
const STEP = 100_000

const DESKTOP = '(min-width: 1024px)'

export interface FilterBarProps {
  query: CatalogQuery
  onChange: (next: CatalogQuery) => void
  counts: Record<ProductCategory, number>
  total: number
  resultCount: number
}

export function FilterBar({ query, onChange, counts, total, resultCount }: FilterBarProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const id = useId()
  const desktop = useMediaQuery(DESKTOP)
  const sheet = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof CatalogQuery>(key: K, value: CatalogQuery[K]) =>
    onChange({ ...query, [key]: value })

  const span = PRICE_BOUNDS.maxUzs - PRICE_BOUNDS.minUzs || 1
  const left = ((query.minUzs - PRICE_BOUNDS.minUzs) / span) * 100
  const right = ((query.maxUzs - PRICE_BOUNDS.minUzs) / span) * 100
  const active = activeFilterCount(query)
  // What the sheet holds: price, style, room and stock.
  const sheetCount =
    Number(query.style !== 'all') +
    Number(query.room !== 'all') +
    Number(query.minUzs > PRICE_BOUNDS.minUzs || query.maxUzs < PRICE_BOUNDS.maxUzs) +
    Number(query.inStockOnly)
  const term = query.search.trim()

  const searchField = (
    <input
      ref={searchRef}
      className="cfl__search"
      type="search"
      inputMode="search"
      enterKeyHint="search"
      autoComplete="off"
      value={query.search}
      placeholder={t('catalog.filters.search', { defaultValue: 'Nomi yoki ishlab chiqaruvchi' })}
      aria-label={t('catalog.filters.search', { defaultValue: 'Nomi yoki ishlab chiqaruvchi' })}
      onChange={(event) => set('search', event.target.value)}
      onKeyDown={(event) => {
        // Enter on a phone keyboard: put the keyboard away, keep the results.
        if (event.key === 'Enter' && !desktop) event.currentTarget.blur()
      }}
    />
  )

  const priceGroup = (
    <div className="cfl__group" role="group" aria-labelledby={`${id}-price`}>
      <span className="cfl__legend" id={`${id}-price`}>
        {t('catalog.filters.price')}
      </span>
      <div className="cfl__range">
        <span className="cfl__track" aria-hidden="true" />
        <span
          className="cfl__fill"
          aria-hidden="true"
          style={{ left: `${left}%`, right: `${100 - right}%` }}
        />
        <input
          type="range"
          min={PRICE_BOUNDS.minUzs}
          max={PRICE_BOUNDS.maxUzs}
          step={STEP}
          value={query.minUzs}
          aria-label={t('catalog.filters.min')}
          aria-valuetext={money.price(query.minUzs)}
          // When both thumbs sit at the top end the max thumb would cover the
          // min one for good; past the midpoint the min thumb goes on top.
          style={{ zIndex: left > 50 ? 3 : 1 }}
          onChange={(event) =>
            set('minUzs', Math.min(Number(event.target.value), query.maxUzs - STEP))
          }
        />
        <input
          type="range"
          min={PRICE_BOUNDS.minUzs}
          max={PRICE_BOUNDS.maxUzs}
          step={STEP}
          value={query.maxUzs}
          aria-label={t('catalog.filters.max')}
          aria-valuetext={money.price(query.maxUzs)}
          style={{ zIndex: 2 }}
          onChange={(event) =>
            set('maxUzs', Math.max(Number(event.target.value), query.minUzs + STEP))
          }
        />
      </div>
      <span className="cfl__readout">
        <Mono label={t('catalog.filters.min')} value={money.compact(query.minUzs)} />
        <Mono label={t('catalog.filters.max')} value={money.compact(query.maxUzs)} />
      </span>
    </div>
  )

  const select = <V extends string>(
    labelKey: string,
    value: V,
    onPick: (value: V) => void,
    options: ReactNode,
    compact = false,
  ) =>
    compact ? (
      <select
        className="cfl__select"
        value={value}
        aria-label={t(labelKey)}
        onChange={(event) => onPick(event.target.value as V)}
      >
        {options}
      </select>
    ) : (
      <label className="cfl__group">
        <span className="cfl__legend">{t(labelKey)}</span>
        <select
          className="cfl__select"
          value={value}
          onChange={(event) => onPick(event.target.value as V)}
        >
          {options}
        </select>
      </label>
    )

  const styleSelect = select<ProductStyle | 'all'>(
    'catalog.filters.style',
    query.style,
    (value) => set('style', value),
    <>
      <option value="all">{t('catalog.filters.all')}</option>
      {STYLE_KEYS.map((style) => (
        <option key={style} value={style}>
          {t(`catalog.styles.${style}`)}
        </option>
      ))}
    </>,
  )

  const roomSelect = select<RoomType | 'all'>(
    'catalog.filters.room',
    query.room,
    (value) => set('room', value),
    <>
      <option value="all">{t('catalog.filters.all')}</option>
      {ROOM_KEYS.map((room) => (
        <option key={room} value={room}>
          {t(`catalog.rooms.${room}`)}
        </option>
      ))}
    </>,
  )

  const sortOptions = SORT_KEYS.map((sort) => (
    <option key={sort} value={sort}>
      {t(`catalog.sort.${sort}`)}
    </option>
  ))

  const stockToggle = (
    <label className="cfl__toggle">
      <input
        type="checkbox"
        checked={query.inStockOnly}
        onChange={(event) => set('inStockOnly', event.target.checked)}
      />
      {t('catalog.filters.inStockOnly')}
    </label>
  )

  const resetButton = (
    <button
      type="button"
      className="cfl__reset"
      disabled={active === 0}
      onClick={() => onChange(DEFAULT_QUERY)}
    >
      {t('catalog.filters.reset')}
      {active > 0 && <span className="cfl__count">{active}</span>}
    </button>
  )

  const openSheet = () => {
    const dialog = sheet.current
    if (dialog && !dialog.open) dialog.showModal()
  }

  const filtersPill = (
    <button
      type="button"
      className="cfl__pill"
      aria-haspopup="dialog"
      data-active={sheetCount > 0}
      onClick={openSheet}
    >
      {t('catalog.filters.more')}
      {sheetCount > 0 && <span className="cfl__badge">{sheetCount}</span>}
    </button>
  )
  const closeSheet = () => sheet.current?.close()

  return (
    <>
      {!desktop && <div className="fs-container cfl-find">{searchField}</div>}

      <div className="cfl">
        <div className="fs-container">
          <div className="cfl__tray">
            <div className="cfl__core">
              {desktop ? (
                <div className="cfl__line">
                <ul className="cfl__rail" aria-label={t('catalog.filters.category')}>
                  <li>
                    <button
                      type="button"
                      className="cfl__cat"
                      aria-pressed={query.category === 'all'}
                      onClick={() => set('category', 'all')}
                    >
                      {t('catalog.filters.all')}
                      <span className="cfl__count">{total}</span>
                    </button>
                  </li>
                  {CATEGORIES.map((category) => (
                    <li key={category}>
                      <button
                        type="button"
                        className="cfl__cat"
                        aria-pressed={query.category === category}
                        onClick={() => set('category', category)}
                        disabled={counts[category] === 0}
                      >
                        {t(`catalog.categories.${category}`)}
                        <span className="cfl__count">{counts[category]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                  <div className="cfl__tools">
                    {searchField}
                    {filtersPill}
                    {select<SortKey>(
                      'catalog.filters.sort',
                      query.sort,
                      (value) => set('sort', value),
                      sortOptions,
                      true,
                    )}
                  </div>
                </div>
              ) : (
                <>
              <ul className="cfl__rail" aria-label={t('catalog.filters.category')}>
                <li>
                  <button
                    type="button"
                    className="cfl__cat"
                    aria-pressed={query.category === 'all'}
                    onClick={() => set('category', 'all')}
                  >
                    {t('catalog.filters.all')}
                    <span className="cfl__count">{total}</span>
                  </button>
                </li>
                {CATEGORIES.map((category) => (
                  <li key={category}>
                    <button
                      type="button"
                      className="cfl__cat"
                      aria-pressed={query.category === category}
                      onClick={() => set('category', category)}
                      disabled={counts[category] === 0}
                    >
                      {t(`catalog.categories.${category}`)}
                      <span className="cfl__count">{counts[category]}</span>
                    </button>
                  </li>
                ))}
              </ul>

                <div className="cfl__bar">
                  {filtersPill}
                  {select<SortKey>(
                    'catalog.filters.sort',
                    query.sort,
                    (value) => set('sort', value),
                    sortOptions,
                    true,
                  )}
                </div>
                </>
              )}

              {(!desktop || term || active > 0) && (
              <div className="cfl__status">
                {term ? (
                  <span className="cfl__chip">
                    <span className="cfl__chipText">“{term}”</span>
                    <button
                      type="button"
                      aria-label={t('catalog.filters.clearSearch', { defaultValue: 'Qidiruvni tozalash' })}
                      onClick={() => {
                        set('search', '')
                        // The chip unmounts with the term; keep focus on the search.
                        searchRef.current?.focus({ preventScroll: true })
                      }}
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <span />
                )}
                <span aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s3)' }}>
                  {desktop && active > 0 && resetButton}
                  <Mono
                    label={t('catalog.filters.results')}
                    value={`${resultCount} / ${total}`}
                  />
                </span>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {(
        <dialog
          ref={sheet}
          className="cfl-sheet"
          aria-labelledby={`${id}-sheet`}
          data-lenis-prevent
          // A tap on the backdrop lands on the dialog element itself.
          onClick={(event) => {
            if (event.target === event.currentTarget) closeSheet()
          }}
        >
          <div className="cfl-sheet__head">
            <h2 className="cfl-sheet__title" id={`${id}-sheet`}>
              {t('catalog.filters.more')}
            </h2>
            <button type="button" className="cfl__reset" onClick={closeSheet}>
              {t('catalog.detail.done', { defaultValue: 'Tayyor' })}
            </button>
          </div>
          <div className="cfl-sheet__body">
            {priceGroup}
            {styleSelect}
            {roomSelect}
            {stockToggle}
          </div>
          <div className="cfl-sheet__foot">
            {resetButton}
            <button type="button" className="cfl-sheet__show" onClick={closeSheet}>
              {t('catalog.filters.showResults', {
                count: resultCount,
                defaultValue: '{{count}} ta natijani koʻrsatish',
              })}
            </button>
          </div>
        </dialog>
      )}
    </>
  )
}
