import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { Seo } from '@/lib/seo'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useCount, useMoney } from '@/features/catalog/money'
import {
  Avatar,
  BusinessShell,
  EmptyState,
  Icon,
  Panel,
  Pill,
  SaveState,
  Thumb3D,
  formatDate,
  relativeTime,
  useSegScroll,
  type Tone,
} from '@/features/business/chrome'
import { readLocal, writeLocal } from '@/features/business/local'
import { LEADS, productById, type Lead, type LeadStatus } from '@/features/business/data'
import { EASE } from '@/design/motion'
import { Reveal } from '@/ui/Reveal'

/**
 * §10 — the leads inbox.
 *
 * Two panes: the list on the left, the selected enquiry on the right. The
 * mark that earns its place is `placedFirst` — whether the customer had
 * already stood the piece in their own room before writing. Those close.
 *
 * Status changes live in component state and a private note per lead is kept
 * in this browser (there is no `PATCH /api/business/leads/:id`); the panel
 * says which is which. Below 960px the panes stack and picking a lead scrolls
 * its detail into view, with a way back to the list.
 */

const CSS = `
.ld-split { display: grid; gap: var(--s5); grid-template-columns: minmax(0, 1fr); align-items: start; }
@media (min-width: 1040px) { .ld-split { grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.15fr); } }
@media (min-width: 1040px) { .ld-detailWrap { position: sticky; top: calc(var(--hdr-offset) + var(--s4)); } }

.ld-list { margin: 0; padding: 0; list-style: none; }
@media (min-width: 1040px) { .ld-list { max-height: 70dvh; overflow: auto; overscroll-behavior: contain; } }
.ld-anchor { scroll-margin-top: calc(var(--hdr-offset) + 64px + var(--s4)); }
.ld-back { margin-bottom: var(--s3); }
@media (min-width: 1040px) { .ld-back { display: none; } }

.ld-item {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--s3);
  width: 100%;
  padding: var(--s4) var(--s5);
  border: 0;
  border-top: 1px solid var(--hairline);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color var(--d-fast) var(--ease);
}
.ld-list li:first-child .ld-item { border-top: 0; }
.ld-item[aria-current='true'] { background: color-mix(in srgb, var(--accent) 6%, var(--bg-raised)); }
.ld-item[aria-current='true']::before { content: ''; position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 0 3px 3px 0; background: var(--accent); }
.ld-item__main { display: grid; gap: 6px; min-width: 0; }
.ld-item__top { display: flex; align-items: baseline; justify-content: space-between; gap: var(--s3); }
.ld-item__name { color: var(--text-strong); font-weight: 600; font-size: var(--step--1); display: inline-flex; align-items: center; gap: 6px; }
.ld-item__unread { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
.ld-item__when { font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted); white-space: nowrap; }
.ld-item__msg {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.45;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.ld-item__meta { display: flex; gap: 6px; flex-wrap: wrap; }

.ld-detail { display: grid; gap: var(--s5); }
.ld-who { display: flex; align-items: center; gap: var(--s4); padding: var(--s5) var(--s5) 0; }
.ld-who__name { font-family: var(--font-display); font-weight: 500; font-size: var(--step-2); line-height: 1.1; color: var(--text-strong); }
.ld-who__sub { font-size: var(--step--1); color: var(--text-muted); }
.ld-quote {
  position: relative;
  margin: 0;
  padding: var(--s5) var(--s5) var(--s5) var(--s8);
  border-radius: var(--radius-2xl);
  background: var(--bg-sunken);
  font-family: var(--font-display);
  font-size: var(--step-1);
  line-height: 1.45;
  color: var(--text-strong);
}
.ld-quote::before { content: '“'; position: absolute; left: var(--s4); top: var(--s2); font-size: 2.6em; line-height: 1; color: var(--accent); opacity: 0.6; }
.ld-piece { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: var(--s4); align-items: center; padding: var(--s3); border-radius: var(--radius-2xl); box-shadow: inset 0 0 0 1px var(--hairline); color: inherit; text-decoration: none; transition: box-shadow var(--d-fast) var(--ease); }
.ld-piece__thumb { width: 84px; height: 84px; border-radius: 14px; }
.ld-piece__name { font-weight: 600; color: var(--text-strong); }
.ld-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--s5); margin: 0; }
@media (max-width: 480px) { .ld-facts { grid-template-columns: minmax(0, 1fr); } }
.ld-fact { display: grid; gap: 2px; padding-block: var(--s3); border-top: 1px solid var(--hairline); min-width: 0; }
.ld-fact dt { font-family: var(--font-mono); font-size: 10px; letter-spacing: var(--tracking-mono); text-transform: uppercase; color: var(--text-muted); }
.ld-fact dd { margin: 0; color: var(--text-strong); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.ld-reach { display: flex; flex-wrap: wrap; gap: var(--s2); align-items: center; }

@media (hover: hover) and (pointer: fine) {
  .ld-item:hover:not([aria-current='true']) { background: color-mix(in srgb, var(--bg-sunken) 60%, transparent); }
  .ld-piece:hover { box-shadow: inset 0 0 0 1px var(--border-strong); }
}
`

const STATUSES: LeadStatus[] = ['new', 'open', 'won', 'lost']
const STATUS_TONE: Record<LeadStatus, Tone> = { new: 'accent', open: 'warn', won: 'ok', lost: 'err' }

export function Leads() {
  const { t, i18n } = useTranslation()
  const money = useMoney()
  const count = useCount()
  const reduced = useReducedMotion()
  const narrow = useMediaQuery('(max-width: 1039px)')
  const listRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  const [statuses, setStatuses] = useState<Record<string, LeadStatus>>(() =>
    Object.fromEntries(LEADS.map((lead) => [lead.id, lead.status])),
  )
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string>(LEADS[0]?.id ?? '')
  const [hoverPiece, setHoverPiece] = useState(false)

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: LEADS.length }
    for (const status of STATUSES) out[status] = LEADS.filter((lead) => statuses[lead.id] === status).length
    return out
  }, [statuses])

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return LEADS.filter((lead) => filter === 'all' || statuses[lead.id] === filter)
      .filter((lead) => {
        if (!needle) return true
        const product = lead.productId ? productById(lead.productId) : undefined
        const pieceName = product ? t(`catalog.products.${product.nameKey}.name`) : ''
        return `${lead.name} ${lead.city} ${lead.message} ${pieceName}`.toLocaleLowerCase().includes(needle)
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [filter, statuses, query, t])

  const lead: Lead | undefined = visible.find((item) => item.id === selected) ?? visible[0]
  const product = lead?.productId ? productById(lead.productId) : undefined
  const placedCount = LEADS.filter((item) => item.placedFirst).length
  const pipeline = LEADS.filter((l) => statuses[l.id] === 'new' || statuses[l.id] === 'open').reduce(
    (sum, l) => sum + (l.budgetUzs ?? 0),
    0,
  )
  const decided = counts.won + counts.lost
  const winRate = decided ? counts.won / decided : 0

  const filterSeg = useSegScroll(filter)
  const statusSeg = useSegScroll(lead ? statuses[lead.id] : null)
  const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth'

  const pick = (id: string) => {
    setSelected(id)
    if (narrow) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior, block: 'start' }))
  }

  const backToList = () => {
    const list = listRef.current
    if (!list) return
    list.scrollIntoView({ behavior, block: 'start' })
    list.querySelector<HTMLElement>('[aria-current="true"]')?.focus({ preventScroll: true })
  }

  const masked = lead ? /[•*]/.test(lead.phone) : false
  const dial = lead && !masked ? lead.phone.replace(/[^\d+]/g, '') : ''

  return (
    <>
      <style href="fs-biz-leads" precedence="medium">
        {CSS}
      </style>
      <Seo
        title={`${t('business.leads.title')} — ${t('business.meta.title')}`}
        description={t('business.leads.lead')}
        path="/business/orders-leads"
      />

      <BusinessShell
        title={t('business.leads.title')}
        lead={t('business.leads.lead')}
        badges={
          <Pill tone="ok">{t('business.leads.placedFirstCount', { n: placedCount, total: LEADS.length })}</Pill>
        }
      >
        <Reveal className="biz-kpis" blur={false}>
          <Panel flush>
            <div className="biz-metric">
              <span className="biz-metric__key">{t('business.leads.kpi.new')}</span>
              <span className="biz-metric__value" style={{ color: counts.new ? 'var(--accent-ink)' : undefined }}>
                {counts.new}
              </span>
            </div>
          </Panel>
          <Panel flush>
            <div className="biz-metric">
              <span className="biz-metric__key">{t('business.leads.kpi.open')}</span>
              <span className="biz-metric__value">{counts.open}</span>
            </div>
          </Panel>
          <Panel flush>
            <div className="biz-metric">
              <span className="biz-metric__key">{t('business.leads.kpi.winRate')}</span>
              <span className="biz-metric__value">{Math.round(winRate * 100)}%</span>
              <span className="biz-metric__note">
                {t('business.leads.kpi.decided', { won: counts.won, n: decided })}
              </span>
            </div>
          </Panel>
          <Panel flush>
            <div className="biz-metric">
              <span className="biz-metric__key">{t('business.leads.kpi.pipeline')}</span>
              <span className="biz-metric__value">{money.compact(pipeline)}</span>
            </div>
          </Panel>
        </Reveal>

        <div className="ld-split">
          <Reveal blur={false}>
            <div ref={listRef} className="ld-anchor">
              <Panel flush>
                <div className="biz-bar" style={{ display: 'grid', gap: 'var(--s3)' }}>
                  <div className="biz-search">
                    <Icon name="search" size={16} />
                    <input
                      className="biz-input"
                      type="search"
                      value={query}
                      placeholder={t('business.leads.searchPlaceholder')}
                      aria-label={t('business.leads.searchPlaceholder')}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setQuery('')
                      }}
                    />
                    {query && (
                      <button
                        type="button"
                        className="biz-search__clear"
                        aria-label={t('catalog.filters.clearSearch')}
                        onClick={() => setQuery('')}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    )}
                  </div>
                  <div ref={filterSeg} className="biz-seg" role="group" aria-label={t('business.leads.filter')}>
                    <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
                      {t('catalog.filters.all')}
                      <span className="biz-seg__n">{counts.all}</span>
                    </button>
                    {STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        aria-pressed={filter === status}
                        onClick={() => setFilter(status)}
                      >
                        {t(`business.leads.status.${status}`)}
                        <span className="biz-seg__n">{counts[status] ?? 0}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {visible.length === 0 ? (
                  <EmptyState
                    title={t('business.leads.empty')}
                    body={query ? t('business.leads.emptySearch') : undefined}
                    action={
                      <button
                        type="button"
                        className="biz-btn"
                        onClick={() => {
                          setFilter('all')
                          setQuery('')
                        }}
                      >
                        {t('catalog.filters.reset')}
                      </button>
                    }
                  />
                ) : (
                  <ul className="ld-list" aria-label={t('business.leads.title')}>
                    <AnimatePresence initial={false}>
                      {visible.map((item) => {
                        const itemProduct = item.productId ? productById(item.productId) : undefined
                        const status = statuses[item.id]
                        return (
                          <motion.li
                            key={item.id}
                            layout={reduced ? false : 'position'}
                            initial={reduced ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={reduced ? undefined : { opacity: 0 }}
                            transition={{ duration: reduced ? 0 : 0.22, ease: EASE }}
                          >
                            <button
                              type="button"
                              className="ld-item"
                              aria-current={item.id === lead?.id}
                              onClick={() => pick(item.id)}
                            >
                              <Avatar name={item.name} />
                              <span className="ld-item__main">
                                <span className="ld-item__top">
                                  <span className="ld-item__name">
                                    {status === 'new' && <span className="ld-item__unread" aria-hidden="true" />}
                                    {item.name}
                                  </span>
                                  <span className="ld-item__when">{relativeTime(item.createdAt, i18n.language)}</span>
                                </span>
                                <span className="ld-item__msg">{item.message}</span>
                                <span className="ld-item__meta">
                                  <Pill tone={STATUS_TONE[status]}>{t(`business.leads.status.${status}`)}</Pill>
                                  {item.placedFirst && <Pill tone="ok">{t('business.leads.placedFirst')}</Pill>}
                                  {itemProduct && <Pill>{t(`catalog.products.${itemProduct.nameKey}.name`)}</Pill>}
                                </span>
                              </span>
                            </button>
                          </motion.li>
                        )
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </Panel>
            </div>
          </Reveal>

          {lead && (
            <Reveal blur={false} delay={reduced ? 0 : 0.06} className="ld-detailWrap">
              <div ref={detailRef} className="ld-anchor">
                {narrow && (
                  <button type="button" className="biz-btn ld-back" onClick={backToList}>
                    <span aria-hidden="true">←</span>
                    {t('business.leads.backToList')}
                  </button>
                )}
                <Panel flush>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={lead.id}
                      initial={reduced ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0, y: -6 }}
                      transition={{ duration: reduced ? 0 : 0.22, ease: EASE }}
                    >
                      <div className="ld-who">
                        <Avatar name={lead.name} large />
                        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                          <h2 className="ld-who__name">{lead.name}</h2>
                          <span className="ld-who__sub">
                            {lead.city} · {t(`business.leads.channel.${lead.channel}`)} ·{' '}
                            <time dateTime={lead.createdAt}>{relativeTime(lead.createdAt, i18n.language)}</time>
                          </span>
                        </div>
                      </div>

                      <div className="ld-detail biz-panel__pad">
                        <div style={{ display: 'grid', gap: 'var(--s2)' }}>
                          <div
                            ref={statusSeg}
                            className="biz-seg"
                            role="group"
                            aria-label={t('business.leads.statusLabel')}
                          >
                            {STATUSES.map((status) => (
                              <button
                                key={status}
                                type="button"
                                aria-pressed={statuses[lead.id] === status}
                                onClick={() => setStatuses((prev) => ({ ...prev, [lead.id]: status }))}
                              >
                                <span
                                  className="biz-pill__dot"
                                  aria-hidden="true"
                                  style={{
                                    background:
                                      status === 'new'
                                        ? 'var(--accent)'
                                        : status === 'open'
                                          ? 'var(--warn)'
                                          : status === 'won'
                                            ? 'var(--ok)'
                                            : 'var(--err)',
                                  }}
                                />
                                {t(`business.leads.status.${status}`)}
                              </button>
                            ))}
                          </div>
                          <span className="biz-hint">{t('business.leads.statusLocalOnly')}</span>
                        </div>

                        <blockquote className="ld-quote">{lead.message}</blockquote>

                        {product && (
                          <Link
                            className="ld-piece"
                            to={`/catalog/${product.slug}`}
                            onMouseEnter={() => setHoverPiece(true)}
                            onMouseLeave={() => setHoverPiece(false)}
                            onFocus={() => setHoverPiece(true)}
                            onBlur={() => setHoverPiece(false)}
                          >
                            <Thumb3D
                              product={product}
                              className="ld-piece__thumb"
                              spin={hoverPiece}
                              label={t(`catalog.products.${product.nameKey}.name`)}
                            />
                            <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                              <span className="biz-metric__key">{t('business.leads.fields.piece')}</span>
                              <span className="ld-piece__name">{t(`catalog.products.${product.nameKey}.name`)}</span>
                              <span className="biz-table__sub">
                                {money.price(product.priceUzs)} · {t('business.leads.placedTimes', { n: count(product.placements) })}
                              </span>
                            </span>
                            <Icon name="external" size={16} />
                          </Link>
                        )}

                        <dl className="ld-facts">
                          <div className="ld-fact">
                            <dt>{t('business.leads.fields.phone')}</dt>
                            <dd>
                              {masked ? (
                                <span title={t('business.leads.phoneMasked')}>{lead.phone}</span>
                              ) : (
                                <a href={`tel:${dial}`}>{lead.phone}</a>
                              )}
                            </dd>
                          </div>
                          <div className="ld-fact">
                            <dt>{t('business.leads.fields.budget')}</dt>
                            <dd>{lead.budgetUzs ? money.price(lead.budgetUzs) : '—'}</dd>
                          </div>
                          <div className="ld-fact">
                            <dt>{t('business.leads.fields.photos')}</dt>
                            <dd>{lead.photos || '—'}</dd>
                          </div>
                          <div className="ld-fact">
                            <dt>{t('business.leads.fields.placedFirst')}</dt>
                            <dd>{lead.placedFirst ? t('business.yes') : t('business.no')}</dd>
                          </div>
                          <div className="ld-fact">
                            <dt>{t('business.leads.fields.channel')}</dt>
                            <dd>{t(`business.leads.channel.${lead.channel}`)}</dd>
                          </div>
                          <div className="ld-fact">
                            <dt>{t('business.leads.fields.received')}</dt>
                            <dd>{formatDate(lead.createdAt, i18n.language, true)}</dd>
                          </div>
                        </dl>

                        <div className="ld-reach">
                          {masked ? (
                            <>
                              <button type="button" className="biz-btn biz-btn--primary" disabled aria-describedby="ld-masked">
                                <Icon name="phone" size={15} />
                                {t('business.leads.call')}
                              </button>
                              <button type="button" className="biz-btn" disabled aria-describedby="ld-masked">
                                <Icon name="send" size={15} />
                                {t('business.leads.telegram')}
                              </button>
                              <span className="biz-hint" id="ld-masked">
                                {t('business.leads.phoneMasked')}
                              </span>
                            </>
                          ) : (
                            <>
                              <a className="biz-btn biz-btn--primary" href={`tel:${dial}`}>
                                <Icon name="phone" size={15} />
                                {t('business.leads.call')}
                              </a>
                              <a className="biz-btn" href={`https://t.me/${dial}`} target="_blank" rel="noopener noreferrer">
                                <Icon name="send" size={15} />
                                {t('business.leads.telegram')}
                              </a>
                            </>
                          )}
                        </div>

                        <LeadNote id={lead.id} />
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </Panel>
              </div>
            </Reveal>
          )}
        </div>
      </BusinessShell>
    </>
  )
}

/** A private note per lead, kept in this browser with an explicit save. */
function LeadNote({ id }: { id: string }) {
  const { t } = useTranslation()
  const key = `leadNote.${id}`
  const [saved, setSaved] = useState(() => readLocal(key, ''))
  const [value, setValue] = useState(saved)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef(0)

  useEffect(() => {
    const stored = readLocal(key, '')
    setSaved(stored)
    setValue(stored)
    setState('idle')
  }, [key])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const dirty = value.trim() !== saved.trim()

  return (
    <form
      className="biz-field"
      onSubmit={(event) => {
        event.preventDefault()
        if (!dirty) return
        setState('saving')
        timer.current = window.setTimeout(() => {
          const ok = writeLocal(key, value.trim() || null)
          if (ok) setSaved(value.trim())
          setState(ok ? 'saved' : 'error')
        }, 350)
      }}
    >
      <label className="biz-label" htmlFor={`note-${id}`}>
        {t('business.leads.note.label')}
      </label>
      <textarea
        id={`note-${id}`}
        className="biz-input"
        rows={3}
        maxLength={500}
        value={value}
        placeholder={t('business.leads.note.placeholder')}
        onChange={(event) => {
          setValue(event.target.value)
          if (state !== 'saving') setState('idle')
        }}
      />
      <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" className="biz-btn" disabled={!dirty || state === 'saving'}>
          {t('business.leads.note.save')}
        </button>
        <SaveState state={state === 'idle' && dirty ? 'dirty' : state}>
          {state === 'saving'
            ? t('business.leads.note.saving')
            : state === 'saved'
              ? t('business.leads.note.saved')
              : state === 'error'
                ? t('business.leads.note.error')
                : dirty
                  ? t('business.leads.note.unsaved')
                  : t('business.leads.note.local')}
        </SaveState>
      </div>
    </form>
  )
}

export default Leads
