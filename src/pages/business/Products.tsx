import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { Seo } from '@/lib/seo'
import { useCount, useMoney } from '@/features/catalog/money'
import {
  BusinessShell,
  EmptyState,
  Icon,
  Panel,
  Pill,
  SaveState,
  Thumb3D,
  formatDate,
  useSegScroll,
  type Tone,
} from '@/features/business/chrome'
import { useLocal } from '@/features/business/local'
import {
  UPLOAD_RULES,
  VENDOR_PRODUCTS,
  productById,
  validateUpload,
  type ListingState,
  type UploadDraft,
  type UploadIssue,
  type VendorProduct,
} from '@/features/business/data'
import { EASE } from '@/design/motion'
import { Reveal } from '@/ui/Reveal'

/**
 * §10 — listings and the "add a piece" form.
 *
 * Every listing carries a live 3D thumbnail (lazy, viewport-gated — only the
 * rows on screen hold a WebGL context) that turns while its row is hovered.
 * Two views over the same filtered, sorted rows: a dense table and a gallery.
 * Below 720px the table stacks into labelled cards.
 *
 * The add form validates against `UPLOAD_RULES` field by field. A valid
 * submission becomes a local draft row (there is no upload endpoint), and the
 * form says exactly that.
 */

const CSS = `
.pr-bar__end { display: flex; gap: var(--s2); align-items: center; flex-wrap: wrap; }
.pr-count { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }

.pr-piece { display: flex; align-items: center; gap: var(--s3); min-width: 220px; }
.pr-thumb { width: 52px; height: 52px; border-radius: 12px; }
.pr-piece__text { display: grid; gap: 2px; min-width: 0; }
.pr-piece__name { color: var(--text-strong); font-weight: 600; text-decoration: none; }
.pr-piece__name:hover { text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--hairline); }
.pr-model { display: grid; gap: 4px; justify-items: start; }
.pr-bar { width: 64px; height: 4px; border-radius: var(--radius-full); background: var(--bg-sunken); overflow: hidden; }
.pr-bar span { display: block; height: 100%; background: var(--accent); border-radius: inherit; transform-origin: left center; }
.pr-place { display: inline-flex; align-items: center; gap: var(--s3); justify-content: flex-end; }
.pr-place b { font-weight: 500; color: var(--text-strong); }
.pr-row--new td { background: color-mix(in srgb, var(--accent) 5%, transparent); }
@media (min-width: 720px) and (max-width: 1279px) { .pr-wide { display: none; } }

@media (max-width: 719px) {
  .pr-piece { min-width: 0; }
  .pr-thumb { width: 64px; height: 64px; }
  .pr-place { justify-content: flex-start; }
}

/* ---- gallery ----------------------------------------------------------- */
.pr-gallery { display: grid; gap: var(--s4); padding: var(--s5); grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); margin: 0; list-style: none; }
@media (max-width: 520px) { .pr-gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s3); padding: var(--s3); } }
.pr-card {
  display: grid; gap: var(--s3); height: 100%;
  padding: 6px 6px var(--s4);
  border-radius: 18px;
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  transition: transform var(--d-base) var(--ease-fluid), box-shadow var(--d-base) var(--ease);
}
.pr-card__plate { position: relative; }
.pr-card__thumb { width: 100%; aspect-ratio: 4 / 3; border-radius: 13px; }
.pr-card__pins { position: absolute; top: 8px; left: 8px; right: 8px; display: flex; justify-content: space-between; gap: var(--s2); pointer-events: none; }
.pr-card__body { display: grid; gap: 4px; padding-inline: var(--s3); min-width: 0; }
.pr-card__name { font-weight: 600; color: var(--text-strong); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pr-card__foot { display: flex; justify-content: space-between; align-items: baseline; gap: var(--s3); padding-inline: var(--s3); font-family: var(--font-mono); font-size: 12px; font-variant-numeric: tabular-nums; }
.pr-card__foot b { font-weight: 500; color: var(--text-strong); }
@media (max-width: 520px) {
  .pr-card__pins .biz-pill:last-child { display: none; }
  .pr-card__foot { flex-direction: column; gap: 2px; }
}
@media (hover: hover) and (pointer: fine) {
  .pr-card:hover { transform: translateY(-3px); box-shadow: inset 0 0 0 1px var(--border-strong); }
}

/* ---- add form ---------------------------------------------------------- */
.pr-form { display: grid; gap: var(--s6); }
.pr-form__grid { display: grid; gap: var(--s5); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 900px) { .pr-form__grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.pr-col { display: grid; gap: var(--s4); align-content: start; }
.pr-drop {
  display: grid; justify-items: center; gap: var(--s2); width: 100%;
  padding: var(--s6) var(--s4);
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius-2xl);
  background: var(--bg-sunken);
  color: inherit; font: inherit; text-align: center;
  cursor: pointer;
  transition: border-color var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease);
}
.pr-drop__icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--hairline); color: var(--accent); }
.pr-drop__title { font-weight: 600; color: var(--text-strong); font-size: var(--step--1); }
.pr-drop--over { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, var(--bg-sunken)); }
.pr-drop--armed { border-style: solid; border-color: color-mix(in srgb, var(--ok) 60%, transparent); }
.pr-drop[aria-invalid='true'] { border-color: var(--err); }
.pr-drop:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.pr-files { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
.pr-files li { display: flex; justify-content: space-between; gap: var(--s3); padding: 6px var(--s3); border-radius: var(--radius); background: var(--bg-sunken); font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); }
.pr-files li span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.pr-dims { display: grid; gap: var(--s2); grid-template-columns: repeat(3, minmax(0, 1fr)); }
.pr-tags { display: flex; flex-wrap: wrap; gap: var(--s2); }
.pr-tag { display: inline-flex; align-items: center; gap: 2px; padding: 2px 2px 2px 10px; border-radius: var(--radius-full); background: var(--bg-sunken); box-shadow: inset 0 0 0 1px var(--hairline); font-size: 12px; color: var(--text); }
.pr-tag button { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 50%; background: none; color: var(--text-muted); cursor: pointer; }
.pr-summary { margin: 0; padding: var(--s4); border-radius: var(--radius-lg); background: color-mix(in srgb, var(--err) 7%, var(--bg-raised)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--err) 30%, transparent); display: grid; gap: var(--s2); font-size: var(--step--1); color: var(--err); }
.pr-summary ul { margin: 0; padding-inline-start: var(--s5); display: grid; gap: 2px; }
.pr-actions { display: flex; flex-wrap: wrap; gap: var(--s3); align-items: center; padding-top: var(--s4); border-top: 1px solid var(--hairline); }
@media (hover: hover) and (pointer: fine) {
  .pr-drop:hover { border-color: var(--clay-300); }
  .pr-tag button:hover { background: var(--bg-hover); color: var(--text-strong); }
}
`

type SortColumn = 'name' | 'placements' | 'views' | 'price' | 'updated' | 'contacts'
type Row = VendorProduct & { title?: string; fresh?: boolean }

const SORTS: SortColumn[] = ['placements', 'views', 'contacts', 'price', 'updated', 'name']
const STATES: Array<ListingState | 'all'> = ['all', 'published', 'draft', 'archived']
const STATE_TONE: Record<ListingState, Tone> = { published: 'ok', draft: 'warn', archived: 'muted' }
const MODEL_TONE: Record<VendorProduct['modelStatus'], Tone> = { ready: 'ok', processing: 'warn', missing: 'err' }

const stockColor = (stock: number) => (stock === 0 ? 'var(--err)' : stock <= 5 ? 'var(--warn-ink)' : undefined)

function bytes(value: number): string {
  if (value === 0) return '—'
  if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(1)} MB`
  return `${Math.round(value / 1024)} KB`
}

export function Products() {
  const { t, i18n } = useTranslation()
  const count = useCount()
  const money = useMoney()
  const reduced = useReducedMotion()
  const location = useLocation()

  const [drafts, setDrafts] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [state, setState] = useState<ListingState | 'all'>('all')
  const [sort, setSort] = useState<{ column: SortColumn; desc: boolean }>({ column: 'placements', desc: true })
  const [view, setView] = useLocal<'table' | 'gallery'>('productsView', 'table')
  const [hovered, setHovered] = useState<string | null>(null)

  const all: Row[] = useMemo(() => [...drafts, ...VENDOR_PRODUCTS], [drafts])

  // `/business/products#add` (the overview's "Upload" button) lands on the form.
  useEffect(() => {
    if (location.hash !== '#add') return
    const id = window.setTimeout(() => {
      document.getElementById('add')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(id)
  }, [location.hash, reduced])

  const names = useMemo(() => {
    const out: Record<string, string> = {}
    for (const row of all) {
      const product = productById(row.productId)
      out[row.sku] = row.title ?? (product ? t(`catalog.products.${product.nameKey}.name`) : row.sku)
    }
    return out
  }, [t, all])

  const stateCounts = useMemo(() => {
    const out: Record<string, number> = { all: all.length }
    for (const option of STATES) if (option !== 'all') out[option] = all.filter((r) => r.state === option).length
    return out
  }, [all])

  const rows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    const filtered = all.filter((row) => {
      if (state !== 'all' && row.state !== state) return false
      if (!needle) return true
      return `${names[row.sku]} ${row.sku}`.toLocaleLowerCase().includes(needle)
    })
    const direction = sort.desc ? -1 : 1
    const value = (row: Row): number | string => {
      switch (sort.column) {
        case 'name':
          return names[row.sku] ?? row.sku
        case 'views':
          return row.views30d
        case 'contacts':
          return row.contacts30d
        case 'price':
          return row.priceUzs
        case 'updated':
          return row.updatedAt
        default:
          return row.placements30d
      }
    }
    return [...filtered].sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av).localeCompare(String(bv), i18n.language) * direction
      }
      return (av - bv) * direction
    })
  }, [search, state, sort, names, all, i18n.language])

  const stateSeg = useSegScroll(state)
  const maxPlacements = useMemo(() => Math.max(...all.map((row) => row.placements30d), 1), [all])

  const totals = useMemo(() => {
    const published = all.filter((r) => r.state === 'published').length
    const ready = all.filter((r) => r.modelStatus === 'ready').length
    return {
      published,
      ready,
      placements: all.reduce((sum, r) => sum + r.placements30d, 0),
      contacts: all.reduce((sum, r) => sum + r.contacts30d, 0),
    }
  }, [all])

  const sortLabel = (column: SortColumn) => t(`business.products.columns.${column}`)

  const header = (column: SortColumn, numeric = false, extra?: string) => {
    const active = sort.column === column
    return (
      <th
        scope="col"
        className={[numeric ? 'biz-num' : '', extra ?? ''].join(' ').trim() || undefined}
        aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}
      >
        <button
          type="button"
          className="biz-table__sortable"
          data-active={active}
          onClick={() =>
            setSort((prev) => (prev.column === column ? { column, desc: !prev.desc } : { column, desc: column !== 'name' }))
          }
        >
          {sortLabel(column)}
          <span className="biz-table__arrow" aria-hidden="true">
            {active ? (sort.desc ? '↓' : '↑') : ''}
          </span>
        </button>
      </th>
    )
  }

  const reset = () => {
    setSearch('')
    setState('all')
  }

  const hoverProps = (sku: string) => ({
    onMouseEnter: () => setHovered(sku),
    onMouseLeave: () => setHovered((prev) => (prev === sku ? null : prev)),
    onFocus: () => setHovered(sku),
    onBlur: () => setHovered((prev) => (prev === sku ? null : prev)),
  })

  const modelLine = (row: Row) =>
    row.triangles
      ? `${t('business.products.tris', { n: count(row.triangles) })} · ${bytes(row.modelBytes)}`
      : '—'

  return (
    <>
      <style href="fs-biz-products" precedence="medium">
        {CSS}
      </style>
      <Seo
        title={`${t('business.products.title')} — ${t('business.meta.title')}`}
        description={t('business.products.lead')}
        path="/business/products"
      />

      <BusinessShell
        title={t('business.products.title')}
        lead={t('business.products.lead')}
        badges={<Pill>{t('business.products.rowCount', { n: all.length })}</Pill>}
        actions={
          <a
            className="biz-btn biz-btn--primary"
            href="#add"
            onClick={(event) => {
              event.preventDefault()
              document.getElementById('add')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
              window.setTimeout(() => document.getElementById('pr-title')?.focus({ preventScroll: true }), reduced ? 0 : 500)
            }}
          >
            <Icon name="plus" size={16} />
            {t('business.products.add')}
          </a>
        }
      >
        <Reveal className="biz-kpis" blur={false}>
          <Panel flush>
            <div className="biz-metric">
              <span className="biz-metric__key">{t('business.products.kpi.published')}</span>
              <span className="biz-metric__value">
                {totals.published}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.6em' }}> / {all.length}</span>
              </span>
            </div>
          </Panel>
          <Panel flush>
            <div className="biz-metric">
              <span className="biz-metric__key">{t('business.products.kpi.ready3d')}</span>
              <span className="biz-metric__value">
                {totals.ready}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.6em' }}> / {all.length}</span>
              </span>
              <div className="biz-meter" aria-hidden="true">
                <span style={{ transform: `scaleX(${totals.ready / Math.max(all.length, 1)})`, background: 'var(--ok)' }} />
              </div>
            </div>
          </Panel>
          <Panel flush>
            <div className="biz-metric">
              <span className="biz-metric__key">{t('business.products.kpi.placements')}</span>
              <span className="biz-metric__value">{count(totals.placements)}</span>
            </div>
          </Panel>
          <Panel flush>
            <div className="biz-metric">
              <span className="biz-metric__key">{t('business.products.kpi.contacts')}</span>
              <span className="biz-metric__value">{count(totals.contacts)}</span>
            </div>
          </Panel>
        </Reveal>

        <Reveal blur={false} delay={reduced ? 0 : 0.05}>
          <Panel flush>
            <div className="biz-bar">
              <div className="biz-search">
                <Icon name="search" size={16} />
                <input
                  className="biz-input"
                  type="search"
                  value={search}
                  placeholder={t('business.products.searchPlaceholder')}
                  aria-label={t('business.products.searchLabel')}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setSearch('')
                  }}
                />
                {search && (
                  <button
                    type="button"
                    className="biz-search__clear"
                    aria-label={t('catalog.filters.clearSearch')}
                    onClick={() => setSearch('')}
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
              <div ref={stateSeg} className="biz-seg" role="group" aria-label={t('business.products.stateFilter')}>
                {STATES.map((option) => (
                  <button key={option} type="button" aria-pressed={state === option} onClick={() => setState(option)}>
                    {option === 'all' ? t('catalog.filters.all') : t(`business.products.state.${option}`)}
                    <span className="biz-seg__n">{stateCounts[option] ?? 0}</span>
                  </button>
                ))}
              </div>
              <span className="biz-bar__spacer" />
              <div className="pr-bar__end">
                <select
                  className="biz-input"
                  aria-label={t('catalog.filters.sort')}
                  value={`${sort.column}:${sort.desc ? 'desc' : 'asc'}`}
                  onChange={(event) => {
                    const [column, direction] = event.target.value.split(':')
                    setSort({ column: column as SortColumn, desc: direction === 'desc' })
                  }}
                  style={{ fontSize: 14 }}
                >
                  {SORTS.flatMap((column) =>
                    (['desc', 'asc'] as const).map((direction) => (
                      <option key={`${column}:${direction}`} value={`${column}:${direction}`}>
                        {sortLabel(column)} {direction === 'desc' ? '↓' : '↑'}
                      </option>
                    )),
                  )}
                </select>
                <div className="biz-seg" role="group" aria-label={t('business.products.viewLabel')}>
                  <button
                    type="button"
                    aria-pressed={view === 'table'}
                    onClick={() => setView('table')}
                    aria-label={t('business.products.viewTable')}
                    title={t('business.products.viewTable')}
                  >
                    <Icon name="rows" size={16} />
                  </button>
                  <button
                    type="button"
                    aria-pressed={view === 'gallery'}
                    onClick={() => setView('gallery')}
                    aria-label={t('business.products.viewGallery')}
                    title={t('business.products.viewGallery')}
                  >
                    <Icon name="grid" size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div
              className="biz-bar"
              style={{ paddingBlock: 'var(--s2)', borderBottom: rows.length ? undefined : 0 }}
              aria-live="polite"
            >
              <span className="pr-count">{t('business.products.showing', { n: rows.length, total: all.length })}</span>
            </div>

            {rows.length === 0 ? (
              <EmptyState
                title={t('business.products.emptyTitle')}
                body={t('business.products.empty')}
                action={
                  <button type="button" className="biz-btn" onClick={reset}>
                    {t('catalog.filters.reset')}
                  </button>
                }
              />
            ) : view === 'table' ? (
              <div className="biz-table__scroll">
                <table className="biz-table biz-table--stack">
                  <caption className="biz-sr">{t('business.products.tableCaption')}</caption>
                  <thead>
                    <tr>
                      {header('name')}
                      <th scope="col">{t('business.products.columns.state')}</th>
                      {header('price', true)}
                      {header('views', true)}
                      {header('placements', true)}
                      {header('contacts', true)}
                      {header('updated', false, 'pr-wide')}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {rows.map((row, index) => {
                        const product = productById(row.productId)
                        const name = names[row.sku]
                        const label = (key: string) => t(`business.products.columns.${key}`)
                        return (
                          <motion.tr
                            key={row.sku}
                            layout={reduced ? false : 'position'}
                            className={row.fresh ? 'pr-row--new' : undefined}
                            initial={reduced ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={reduced ? undefined : { opacity: 0 }}
                            transition={{ duration: reduced ? 0 : 0.25, ease: EASE }}
                            {...hoverProps(row.sku)}
                          >
                            <td>
                              <span className="pr-piece">
                                <Thumb3D
                                  product={product}
                                  className="pr-thumb"
                                  spin={hovered === row.sku}
                                  offset={(index % 5) * 0.5}
                                  label={name}
                                />
                                <span className="pr-piece__text">
                                  {product && !row.fresh ? (
                                    <Link className="pr-piece__name" to={`/catalog/${product.slug}`}>
                                      {name}
                                    </Link>
                                  ) : (
                                    <span className="pr-piece__name">{name}</span>
                                  )}
                                  <span className="biz-table__sub">{row.sku}</span>
                                </span>
                              </span>
                            </td>
                            <td data-label={label('state')}>
                              <span className="pr-model">
                                <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  <Pill tone={STATE_TONE[row.state]}>{t(`business.products.state.${row.state}`)}</Pill>
                                  <Pill tone={MODEL_TONE[row.modelStatus]}>
                                    {t(`business.products.model3d.${row.modelStatus}`)}
                                  </Pill>
                                </span>
                                <span className="biz-table__sub">{modelLine(row)}</span>
                              </span>
                            </td>
                            <td className="biz-num" data-label={label('price')}>
                              <span style={{ display: 'grid', gap: 2, justifyItems: 'inherit' }}>
                                <span style={{ color: 'var(--text-strong)' }}>{money.compact(row.priceUzs)}</span>
                                <span className="biz-table__sub" style={{ color: stockColor(row.stock) }}>
                                  {row.stock > 0
                                    ? t('business.products.inStock', { n: row.stock })
                                    : t('business.products.outOfStock')}
                                </span>
                              </span>
                            </td>
                            <td className="biz-num" data-label={label('views')}>
                              {count(row.views30d)}
                            </td>
                            <td className="biz-num" data-label={label('placements')}>
                              <span className="pr-place">
                                <span className="pr-bar" aria-hidden="true">
                                  <span style={{ transform: `scaleX(${row.placements30d / maxPlacements})` }} />
                                </span>
                                <b>{count(row.placements30d)}</b>
                              </span>
                            </td>
                            <td className="biz-num" data-label={label('contacts')}>
                              {count(row.contacts30d)}
                            </td>
                            <td className="biz-table__sub pr-wide" data-label={label('updated')}>
                              <time dateTime={row.updatedAt}>{formatDate(row.updatedAt, i18n.language)}</time>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="pr-gallery">
                {rows.map((row, index) => {
                  const product = productById(row.productId)
                  const name = names[row.sku]
                  return (
                    <li key={row.sku} {...hoverProps(row.sku)}>
                      <article className="pr-card">
                        <div className="pr-card__plate">
                          <Thumb3D
                            product={product}
                            className="pr-card__thumb"
                            spin={hovered === row.sku}
                            offset={(index % 5) * 0.5}
                            label={name}
                          />
                          <span className="pr-card__pins">
                            <Pill tone={STATE_TONE[row.state]}>{t(`business.products.state.${row.state}`)}</Pill>
                            <Pill tone={MODEL_TONE[row.modelStatus]}>{t(`business.products.model3d.${row.modelStatus}`)}</Pill>
                          </span>
                        </div>
                        <div className="pr-card__body">
                          {product && !row.fresh ? (
                            <Link className="pr-card__name" to={`/catalog/${product.slug}`}>
                              {name}
                            </Link>
                          ) : (
                            <span className="pr-card__name">{name}</span>
                          )}
                          <span className="biz-table__sub">{row.sku}</span>
                        </div>
                        <div className="pr-card__foot">
                          <b>{money.compact(row.priceUzs)}</b>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {t('business.products.placedShort', { n: count(row.placements30d) })}
                          </span>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </Reveal>

        <AddPiece
          onAdd={(row) => {
            setDrafts((prev) => [row, ...prev])
            setState('all')
            setSearch('')
          }}
        />
      </BusinessShell>
    </>
  )
}

/* ---------------------------------------------------------------- add form */

const EMPTY: UploadDraft = {
  title: '',
  model: null,
  images: [],
  priceUzs: null,
  widthCm: null,
  depthCm: null,
  heightCm: null,
  tags: [],
}

const dimOk = (value: number | null) =>
  value !== null && value >= UPLOAD_RULES.dimensions.minCm && value <= UPLOAD_RULES.dimensions.maxCm

function AddPiece({ onAdd }: { onAdd: (row: Row) => void }) {
  const { t } = useTranslation()
  const money = useMoney()
  const uid = useId()
  const modelInput = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)

  const [draft, setDraft] = useState<UploadDraft>(EMPTY)
  const [tagDraft, setTagDraft] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [over, setOver] = useState<'model' | 'images' | null>(null)
  const timer = useRef(0)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const issues = useMemo(() => (attempted ? validateUpload(draft) : []), [attempted, draft])
  const issuesFor = (field: UploadIssue['field']) => issues.filter((issue) => issue.field === field)
  const message = (issue: UploadIssue) =>
    t(`business.products.upload.issues.${issue.code}`, {
      file: issue.file ?? '',
      min: money.price(UPLOAD_RULES.price.minUzs),
      max: money.price(UPLOAD_RULES.price.maxUzs),
      minCm: UPLOAD_RULES.dimensions.minCm,
      maxCm: UPLOAD_RULES.dimensions.maxCm,
    })

  const update = (patch: Partial<UploadDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    if (status === 'saved') setStatus('idle')
  }

  const addTag = () => {
    const value = tagDraft.trim().slice(0, UPLOAD_RULES.tags.maxLength)
    if (!value || draft.tags.includes(value) || draft.tags.length >= UPLOAD_RULES.tags.max) return
    update({ tags: [...draft.tags, value] })
    setTagDraft('')
  }

  const drop = (kind: 'model' | 'images') => ({
    onDragOver: (event: DragEvent) => {
      event.preventDefault()
      setOver(kind)
    },
    onDragLeave: () => setOver(null),
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      setOver(null)
      const files = Array.from(event.dataTransfer.files)
      if (!files.length) return
      if (kind === 'model') update({ model: files[0] })
      else update({ images: files })
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setAttempted(true)
    const found = validateUpload(draft)
    if (found.length) {
      const first = found[0].field
      const target = first === 'dimensions' ? `${uid}-w` : `${uid}-${first}`
      window.requestAnimationFrame(() => document.getElementById(first === 'title' ? 'pr-title' : target)?.focus())
      return
    }
    setStatus('saving')
    timer.current = window.setTimeout(() => {
      const sku = `NEW-${String(Date.now()).slice(-4)}`
      onAdd({
        sku,
        productId: '',
        title: draft.title.trim(),
        fresh: true,
        state: 'draft',
        modelStatus: 'processing',
        modelBytes: draft.model?.size ?? 0,
        triangles: 0,
        priceUzs: draft.priceUzs ?? 0,
        stock: 0,
        updatedAt: new Date().toISOString(),
        views30d: 0,
        rotations30d: 0,
        placements30d: 0,
        contacts30d: 0,
      })
      setDraft(EMPTY)
      setTagDraft('')
      setAttempted(false)
      setStatus('saved')
      if (modelInput.current) modelInput.current.value = ''
      if (imageInput.current) imageInput.current.value = ''
    }, 700)
  }

  const numberField = (key: 'widthCm' | 'depthCm' | 'heightCm', labelKey: string, id: string) => (
    <label className="biz-field" htmlFor={id}>
      <span className="biz-hint">{t(labelKey)}</span>
      <input
        id={id}
        className="biz-input"
        type="number"
        inputMode="numeric"
        min={UPLOAD_RULES.dimensions.minCm}
        max={UPLOAD_RULES.dimensions.maxCm}
        value={draft[key] ?? ''}
        aria-invalid={issuesFor('dimensions').length && !dimOk(draft[key]) ? true : undefined}
        aria-describedby={issuesFor('dimensions').length ? `${uid}-dims-err` : undefined}
        onChange={(event) => update({ [key]: event.target.value === '' ? null : Number(event.target.value) })}
      />
    </label>
  )

  const errorsOf = (field: UploadIssue['field'], id: string) => {
    const list = issuesFor(field)
    if (!list.length) return null
    return (
      <span className="biz-error" id={id}>
        <Icon name="alert" size={13} />
        <span>{list.map(message).join(' · ')}</span>
      </span>
    )
  }

  return (
    <Reveal blur={false}>
      <div id="add" style={{ scrollMarginTop: 'calc(var(--hdr-offset) + var(--s16))' }}>
        <Panel
          title={t('business.products.upload.title')}
          sub={t('business.products.upload.sub')}
          aside={<Pill tone="warn">{t('business.products.upload.noEndpointBadge')}</Pill>}
        >
          <form className="pr-form" noValidate onSubmit={submit}>
            {attempted && issues.length > 0 && (
              <div className="pr-summary" role="alert">
                <strong>{t('business.products.upload.fixCount', { n: issues.length })}</strong>
                <ul>
                  {issues.map((issue, index) => (
                    <li key={`${issue.code}-${index}`}>{message(issue)}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pr-form__grid">
              <div className="pr-col">
                <label className="biz-field" htmlFor="pr-title">
                  <span className="biz-label">{t('business.products.upload.name')}</span>
                  <input
                    id="pr-title"
                    className="biz-input"
                    value={draft.title}
                    maxLength={80}
                    placeholder={t('business.products.upload.namePlaceholder')}
                    aria-invalid={issuesFor('title').length ? true : undefined}
                    aria-describedby={issuesFor('title').length ? `${uid}-title-err` : undefined}
                    onChange={(event) => update({ title: event.target.value })}
                  />
                  {errorsOf('title', `${uid}-title-err`)}
                </label>

                <div className="biz-field">
                  <span className="biz-label">{t('business.products.upload.modelLabel')}</span>
                  <button
                    id={`${uid}-model`}
                    type="button"
                    className={`pr-drop${over === 'model' ? ' pr-drop--over' : ''}${draft.model ? ' pr-drop--armed' : ''}`}
                    onClick={() => modelInput.current?.click()}
                    aria-invalid={issuesFor('model').length ? true : undefined}
                    aria-describedby={`${uid}-model-hint${issuesFor('model').length ? ` ${uid}-model-err` : ''}`}
                    {...drop('model')}
                  >
                    <span className="pr-drop__icon">
                      <Icon name={draft.model ? 'check' : 'cube'} size={20} />
                    </span>
                    <span className="pr-drop__title">
                      {draft.model ? draft.model.name : t('business.products.upload.modelEmpty')}
                    </span>
                    <span className="biz-hint" id={`${uid}-model-hint`}>
                      {t('business.products.upload.modelHint', {
                        exts: UPLOAD_RULES.model.extensions.join(' · '),
                        mb: UPLOAD_RULES.model.maxBytes / 1_048_576,
                      })}
                    </span>
                  </button>
                  <input
                    ref={modelInput}
                    type="file"
                    accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                    hidden
                    onChange={(event) => update({ model: event.target.files?.[0] ?? null })}
                  />
                  {errorsOf('model', `${uid}-model-err`)}
                </div>

                <div className="biz-field">
                  <span className="biz-label">{t('business.products.upload.imagesLabel')}</span>
                  <button
                    id={`${uid}-images`}
                    type="button"
                    className={`pr-drop${over === 'images' ? ' pr-drop--over' : ''}${draft.images.length ? ' pr-drop--armed' : ''}`}
                    onClick={() => imageInput.current?.click()}
                    aria-invalid={issuesFor('images').length ? true : undefined}
                    aria-describedby={`${uid}-images-hint${issuesFor('images').length ? ` ${uid}-images-err` : ''}`}
                    {...drop('images')}
                  >
                    <span className="pr-drop__icon">
                      <Icon name={draft.images.length ? 'check' : 'upload'} size={20} />
                    </span>
                    <span className="pr-drop__title">
                      {draft.images.length
                        ? t('business.products.upload.imagesChosen', { n: draft.images.length })
                        : t('business.products.upload.imagesEmpty')}
                    </span>
                    <span className="biz-hint" id={`${uid}-images-hint`}>
                      {t('business.products.upload.imagesHint', {
                        n: UPLOAD_RULES.images.maxCount,
                        mb: UPLOAD_RULES.images.maxBytes / 1_048_576,
                      })}
                    </span>
                  </button>
                  <input
                    ref={imageInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    hidden
                    onChange={(event) => update({ images: event.target.files ? Array.from(event.target.files) : [] })}
                  />
                  {errorsOf('images', `${uid}-images-err`)}
                  {(draft.model || draft.images.length > 0) && (
                    <ul className="pr-files">
                      {draft.model && (
                        <li>
                          <span>{draft.model.name}</span>
                          <span>{bytes(draft.model.size)}</span>
                        </li>
                      )}
                      {draft.images.map((image, index) => (
                        <li key={`${image.name}-${index}`}>
                          <span>{image.name}</span>
                          <span>{bytes(image.size)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="pr-col">
                <label className="biz-field" htmlFor={`${uid}-priceUzs`}>
                  <span className="biz-label">{t('business.products.upload.price')}</span>
                  <input
                    id={`${uid}-priceUzs`}
                    className="biz-input"
                    type="number"
                    inputMode="numeric"
                    min={UPLOAD_RULES.price.minUzs}
                    max={UPLOAD_RULES.price.maxUzs}
                    step={1000}
                    value={draft.priceUzs ?? ''}
                    aria-invalid={issuesFor('priceUzs').length ? true : undefined}
                    aria-describedby={`${uid}-price-hint${issuesFor('priceUzs').length ? ` ${uid}-price-err` : ''}`}
                    onChange={(event) =>
                      update({ priceUzs: event.target.value === '' ? null : Number(event.target.value) })
                    }
                  />
                  <span className="biz-hint" id={`${uid}-price-hint`}>
                    {draft.priceUzs
                      ? t('business.products.upload.pricePreview', { value: money.price(draft.priceUzs) })
                      : t('business.products.upload.priceHint', {
                          min: money.compact(UPLOAD_RULES.price.minUzs),
                          max: money.compact(UPLOAD_RULES.price.maxUzs),
                        })}
                  </span>
                  {errorsOf('priceUzs', `${uid}-price-err`)}
                </label>

                <fieldset className="biz-field" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="biz-label" style={{ marginBottom: 6 }}>
                    {t('business.products.upload.dimensions')}
                  </legend>
                  <div className="pr-dims">
                    {numberField('widthCm', 'catalog.detail.width', `${uid}-w`)}
                    {numberField('depthCm', 'catalog.detail.depth', `${uid}-d`)}
                    {numberField('heightCm', 'catalog.detail.height', `${uid}-h`)}
                  </div>
                  {errorsOf('dimensions', `${uid}-dims-err`)}
                </fieldset>

                <div className="biz-field">
                  <label className="biz-label" htmlFor={`${uid}-tag`}>
                    {t('business.products.upload.tags')}
                  </label>
                  <div style={{ display: 'flex', gap: 'var(--s2)' }}>
                    <input
                      id={`${uid}-tag`}
                      className="biz-input"
                      value={tagDraft}
                      maxLength={UPLOAD_RULES.tags.maxLength}
                      placeholder={t('business.products.upload.tagPlaceholder')}
                      onChange={(event) => setTagDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ',') {
                          event.preventDefault()
                          addTag()
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="biz-btn"
                      onClick={addTag}
                      disabled={!tagDraft.trim() || draft.tags.length >= UPLOAD_RULES.tags.max}
                    >
                      <Icon name="plus" size={15} />
                      {t('business.products.upload.addTag')}
                    </button>
                  </div>
                  <span className="biz-hint">
                    {t('business.products.upload.tagsHint', { n: draft.tags.length, max: UPLOAD_RULES.tags.max })}
                  </span>
                  {draft.tags.length > 0 && (
                    <div className="pr-tags">
                      {draft.tags.map((tag) => (
                        <span className="pr-tag" key={tag}>
                          {tag}
                          <button
                            type="button"
                            aria-label={t('business.products.upload.removeTag', { tag })}
                            onClick={() => update({ tags: draft.tags.filter((item) => item !== tag) })}
                          >
                            <Icon name="close" size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pr-actions">
              <button type="submit" className="biz-btn biz-btn--primary" disabled={status === 'saving'}>
                <Icon name="check" size={15} />
                {t('business.products.upload.submit')}
              </button>
              <button
                type="button"
                className="biz-btn biz-btn--ghost"
                onClick={() => {
                  setDraft(EMPTY)
                  setAttempted(false)
                  setStatus('idle')
                  setTagDraft('')
                }}
              >
                {t('business.products.upload.clear')}
              </button>
              <SaveState state={status === 'idle' ? 'idle' : status}>
                {status === 'saving'
                  ? t('business.products.upload.saving')
                  : status === 'saved'
                    ? t('business.products.upload.saved')
                    : null}
              </SaveState>
            </div>
          </form>
        </Panel>
      </div>
    </Reveal>
  )
}

export default Products
