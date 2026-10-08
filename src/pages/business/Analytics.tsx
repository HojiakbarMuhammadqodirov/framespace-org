import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'framer-motion'

import { Seo } from '@/lib/seo'
import { useCount } from '@/features/catalog/money'
import {
  BusinessShell,
  Delta,
  Panel,
  Pill,
  Sparkline,
  Thumb3D,
  formatDate,
  formatPercent,
  localeFor,
  useSegScroll,
} from '@/features/business/chrome'
import {
  ANALYTICS,
  LEADS,
  productById,
  type AnalyticsMetric,
  type AnalyticsPoint,
  type LeadChannel,
} from '@/features/business/data'
import { EASE } from '@/design/motion'
import { CountUp } from '@/ui/CountUp'
import { Reveal } from '@/ui/Reveal'

/**
 * §10 — analytics, ordered by what the number is worth.
 *
 * Four metrics, not peers: **placements** opens selected and owns the accent.
 * The range control really slices the series (7/14/30 days) and each tile's
 * delta compares against the previous window of the same length where the
 * data allows it. The chart is plain SVG drawn at its box's pixel width, with
 * a crosshair readout on pointer and on arrow keys; screen readers get the
 * same series as a hidden table.
 */

const CSS = `
.an-kpis { display: grid; gap: var(--s4); grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (min-width: 1000px) { .an-kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.an-kpi {
  display: grid; gap: var(--s3); width: 100%; height: 100%;
  padding: var(--s5);
  border: 0; border-radius: inherit;
  background: transparent; color: inherit; font: inherit; text-align: start;
  cursor: pointer;
  transition: background-color var(--d-fast) var(--ease);
}
.an-kpi .biz-metric__foot svg { max-width: 50%; }
.an-kpiWrap[data-active='true'] .biz-panel__core { box-shadow: var(--inset-hi), inset 0 0 0 1.5px var(--accent); }
.an-kpiWrap[data-active='true'] .biz-metric__key { color: var(--accent-ink); }
.an-kpi--key .biz-metric__value { font-family: var(--font-display); font-size: clamp(1.6rem, 1.2rem + 1.6vw, 2.4rem); }

.an-chart { padding: var(--s2) var(--s5) var(--s5); display: grid; gap: var(--s3); }
.an-chart__box { position: relative; touch-action: pan-y; }
.an-chart__box svg { display: block; overflow: visible; }
.an-chart__box svg:focus-visible { outline: 2px solid var(--focus); outline-offset: 4px; border-radius: 8px; }
.an-tip {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: grid; gap: 2px;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--bg-inverse);
  color: var(--text-inverse);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: var(--shadow-raised);
}
.an-tip b { font-size: 13px; font-weight: 500; }
.an-summary { display: flex; flex-wrap: wrap; gap: var(--s2) var(--s6); font-size: var(--step--1); color: var(--text-muted); }
.an-summary b { font-family: var(--font-mono); font-weight: 500; color: var(--text-strong); font-variant-numeric: tabular-nums; }

.an-funnel { display: grid; gap: var(--s4); padding: var(--s2) var(--s5) var(--s5); }
.an-step { display: grid; gap: 6px; }
.an-step__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--s4); }
.an-step__label { font-size: var(--step--1); font-weight: 600; color: var(--text); }
.an-step__value { font-family: var(--font-mono); font-variant-numeric: tabular-nums; color: var(--text-strong); }
.an-step__bar { height: 12px; border-radius: 6px; background: var(--bg-sunken); overflow: hidden; }
.an-step__fill { height: 100%; background: color-mix(in srgb, var(--clay-300) 70%, var(--bg-raised)); border-radius: inherit; transform-origin: left center; }
.an-step--key .an-step__label { color: var(--accent-ink); }
.an-step--key .an-step__fill { background: var(--accent); }
.an-step__drop { font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted); }

.an-channels { display: grid; gap: var(--s3); padding: var(--s2) var(--s5) var(--s5); margin: 0; list-style: none; }
.an-channel { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px var(--s4); align-items: baseline; }
.an-channel__bar { grid-column: 1 / -1; height: 8px; border-radius: 4px; background: var(--bg-sunken); overflow: hidden; display: flex; }
.an-channel__bar span { height: 100%; }

.an-thumb { width: 44px; height: 44px; border-radius: 10px; }
.an-piece { display: flex; align-items: center; gap: var(--s3); min-width: 0; }
.an-rate { display: inline-flex; align-items: center; gap: var(--s2); justify-content: flex-end; }
.an-rate i { display: block; width: 48px; height: 4px; border-radius: 2px; background: var(--bg-sunken); overflow: hidden; }
.an-rate i span { display: block; height: 100%; background: var(--accent); }
@media (max-width: 719px) { .an-rate { justify-content: flex-start; } }

@media (hover: hover) and (pointer: fine) {
  .an-kpi:hover { background: color-mix(in srgb, var(--bg-sunken) 45%, transparent); }
}
`

const METRICS: AnalyticsMetric[] = ['placements', 'contacts', 'rotations', 'views']
const RANGES = [7, 14, 30] as const
type Range = (typeof RANGES)[number]
const CHANNELS: LeadChannel[] = ['room', 'catalog', 'store', 'qr']
const CHANNEL_COLOR: Record<LeadChannel, string> = {
  room: 'var(--accent)',
  catalog: 'var(--clay-500)',
  store: 'var(--clay-300)',
  qr: 'var(--sand-200)',
}

const sum = (points: AnalyticsPoint[]) => points.reduce((total, point) => total + point.value, 0)

/** Window total and change vs the window before it (where the data has one). */
function windowOf(metric: AnalyticsMetric, days: Range) {
  const series = ANALYTICS.series[metric]
  const points = series.points.slice(-days)
  const total = days === series.points.length ? series.total : sum(points)
  let delta = series.deltaPct
  if (days * 2 <= series.points.length) {
    const before = sum(series.points.slice(-days * 2, -days))
    delta = before ? ((total - before) / before) * 100 : 0
  }
  return { points, total, delta }
}

/* ------------------------------------------------------------------- chart */

function SeriesChart({
  points,
  lang,
  reduced,
  label,
  metricLabel,
}: {
  points: AnalyticsPoint[]
  lang: string
  reduced: boolean
  label: string
  metricLabel: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = host.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width)
      if (next > 0) setWidth(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => setActive(null), [points])

  const height = width < 480 ? 200 : 260
  const format = useMemo(() => new Intl.NumberFormat(localeFor(lang)), [lang])
  const compact = useMemo(
    () => new Intl.NumberFormat(localeFor(lang), { notation: 'compact', maximumFractionDigits: 1 }),
    [lang],
  )
  const pad = { l: 44, r: 12, t: 16, b: 28 }

  const geo = useMemo(() => {
    const values = points.map((point) => point.value)
    const rawMax = Math.max(...values, 1)
    // A "nice" ceiling so gridlines land on round numbers.
    const magnitude = 10 ** Math.floor(Math.log10(rawMax))
    const ceiling = Math.ceil(rawMax / (magnitude / 2)) * (magnitude / 2)
    const innerW = width - pad.l - pad.r
    const innerH = height - pad.t - pad.b
    const step = innerW / Math.max(points.length - 1, 1)
    const x = (i: number) => pad.l + i * step
    const y = (value: number) => pad.t + innerH - (value / ceiling) * innerH
    const xy = points.map((point, i) => [x(i), y(point.value)] as const)
    let d = ''
    xy.forEach(([px, py], i) => {
      if (i === 0) d = `M${px.toFixed(1)} ${py.toFixed(1)}`
      else {
        const [qx, qy] = xy[i - 1]
        const mx = (qx + px) / 2
        d += ` C${mx.toFixed(1)} ${qy.toFixed(1)} ${mx.toFixed(1)} ${py.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}`
      }
    })
    const last = xy[xy.length - 1] ?? [pad.l, pad.t + innerH]
    const area = `${d} L${last[0].toFixed(1)} ${pad.t + innerH} L${pad.l} ${pad.t + innerH} Z`
    const grid = [0, 0.5, 1].map((f) => ({ y: y(ceiling * f), label: compact.format(ceiling * f) }))
    const every = Math.ceil(points.length / Math.max(2, Math.floor(innerW / 76)))
    // Count back from the newest day so "today" always carries a label.
    const ticks: Array<{ x: number; label: string }> = []
    for (let i = points.length - 1; i >= 0; i -= every) {
      ticks.unshift({ x: x(i), label: formatDate(points[i].date, lang) })
    }
    return { d, area, xy, grid, ticks, step, base: pad.t + innerH }
  }, [points, width, height, compact, lang, pad.l, pad.r, pad.t, pad.b])

  const locate = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const i = Math.round((event.clientX - rect.left - pad.l) / geo.step)
    setActive(Math.min(points.length - 1, Math.max(0, i)))
  }

  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      setActive((prev) => {
        const start = prev ?? (event.key === 'ArrowRight' ? -1 : points.length)
        return Math.min(points.length - 1, Math.max(0, start + (event.key === 'ArrowRight' ? 1 : -1)))
      })
    } else if (event.key === 'Home') setActive(0)
    else if (event.key === 'End') setActive(points.length - 1)
    else if (event.key === 'Escape') setActive(null)
  }

  const point = active !== null ? points[active] : null
  const at = active !== null ? geo.xy[active] : null
  const tipLeft = at ? Math.min(Math.max(at[0], 70), width - 70) : 0

  return (
    <div ref={host} className="an-chart__box">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        tabIndex={0}
        fill="none"
        onPointerMove={locate}
        onPointerDown={locate}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <defs>
          <linearGradient id="an-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {geo.grid.map((line) => (
          <g key={line.y}>
            <path
              d={`M${pad.l} ${line.y} L${width - pad.r} ${line.y}`}
              stroke="var(--hairline)"
              strokeDasharray={line.y === geo.base ? undefined : '3 5'}
            />
            <text
              x={pad.l - 8}
              y={line.y + 4}
              textAnchor="end"
              fill="var(--text-muted)"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}
            >
              {line.label}
            </text>
          </g>
        ))}
        <path d={geo.area} fill="url(#an-area)" />
        {reduced ? (
          <path d={geo.d} stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <motion.path
            key={geo.d.length + points[0]?.date}
            d={geo.d}
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: EASE }}
          />
        )}
        {geo.ticks.map((tick) => (
          <text
            key={tick.x}
            x={tick.x}
            y={height - 6}
            textAnchor="middle"
            fill="var(--text-muted)"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}
          >
            {tick.label}
          </text>
        ))}
        {at && (
          <g aria-hidden="true">
            <path d={`M${at[0]} ${pad.t} L${at[0]} ${geo.base}`} stroke="var(--border-strong)" />
            <circle cx={at[0]} cy={at[1]} r="9" fill="var(--accent)" opacity="0.15" />
            <circle cx={at[0]} cy={at[1]} r="4" fill="var(--bg-raised)" stroke="var(--accent)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {point && (
        <div className="an-tip" style={{ left: tipLeft }} aria-live="polite">
          <span>{formatDate(point.date, lang)}</span>
          <b>
            {format.format(point.value)} <span style={{ opacity: 0.7, fontWeight: 400 }}>{metricLabel}</span>
          </b>
        </div>
      )}
      <table className="biz-sr">
        <caption>{label}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <th scope="row">{p.date}</th>
              <td>{format.format(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* -------------------------------------------------------------------- page */

export function Analytics() {
  const { t, i18n } = useTranslation()
  const count = useCount()
  const reduced = useReducedMotion()
  const locale = localeFor(i18n.language)
  const [metric, setMetric] = useState<AnalyticsMetric>('placements')
  const [range, setRange] = useState<Range>(30)
  const [hovered, setHovered] = useState<string | null>(null)
  const rangeSeg = useSegScroll(range)

  const windows = useMemo(
    () => Object.fromEntries(METRICS.map((key) => [key, windowOf(key, range)])) as Record<
      AnalyticsMetric,
      ReturnType<typeof windowOf>
    >,
    [range],
  )
  const current = windows[metric]
  const metricLabel = (key: string) => t(`business.overview.metrics.${key}`)

  const funnel = [
    { metric: 'views' as const, value: windows.views.total },
    { metric: 'rotations' as const, value: windows.rotations.total },
    { metric: 'placements' as const, value: windows.placements.total },
    { metric: 'contacts' as const, value: windows.contacts.total },
  ]
  const top = funnel[0].value || 1

  const channels = useMemo(() => {
    const total = LEADS.length || 1
    return CHANNELS.map((channel) => {
      const items = LEADS.filter((lead) => lead.channel === channel)
      const won = items.filter((lead) => lead.status === 'won').length
      return { channel, n: items.length, share: items.length / total, won }
    }).sort((a, b) => b.n - a.n)
  }, [])

  const peak = current.points.reduce((best, p) => (p.value > best.value ? p : best), current.points[0])
  const avg = current.total / Math.max(current.points.length, 1)
  const maxRate = Math.max(...ANALYTICS.byProduct.map((row) => (row.views ? row.placements / row.views : 0)), 0.0001)

  return (
    <>
      <style href="fs-biz-analytics" precedence="medium">
        {CSS}
      </style>
      <Seo
        title={`${t('business.analytics.title')} — ${t('business.meta.title')}`}
        description={t('business.analytics.lead')}
        path="/business/analytics"
      />

      <BusinessShell
        title={t('business.analytics.title')}
        lead={t('business.analytics.lead')}
        actions={
          <div ref={rangeSeg} className="biz-seg" role="group" aria-label={t('business.analytics.rangeLabel')}>
            {RANGES.map((days) => (
              <button key={days} type="button" aria-pressed={range === days} onClick={() => setRange(days)}>
                {t('business.analytics.range', { days })}
              </button>
            ))}
          </div>
        }
      >
        <Reveal className="an-kpis" blur={false}>
          {METRICS.map((key) => {
            const win = windows[key]
            const active = metric === key
            return (
              <div className="an-kpiWrap" data-active={active} key={key}>
                <Panel flush style={{ height: '100%' }}>
                  <button
                    type="button"
                    className={`an-kpi${key === 'placements' ? ' an-kpi--key' : ''}`}
                    aria-pressed={active}
                    onClick={() => setMetric(key)}
                  >
                    <span className="biz-metric__key">{metricLabel(key)}</span>
                    <span className="biz-metric__value">
                      <CountUp key={`${key}-${range}`} to={win.total} locale={locale} duration={900} />
                    </span>
                    <span className="biz-metric__foot">
                      <Delta value={win.delta} />
                      <Sparkline
                        points={win.points.map((p) => p.value)}
                        tone={key === 'placements' ? 'accent' : 'muted'}
                        width={96}
                        height={30}
                      />
                    </span>
                  </button>
                </Panel>
              </div>
            )
          })}
        </Reveal>

        <Reveal blur={false} delay={reduced ? 0 : 0.05}>
          <Panel
            title={t('business.analytics.dailyTitle')}
            sub={t('business.analytics.chartHint')}
            aside={<Pill tone="accent">{metricLabel(metric)}</Pill>}
            flush
          >
            <div className="an-chart">
              <SeriesChart
                points={current.points}
                lang={i18n.language}
                reduced={!!reduced}
                metricLabel={metricLabel(metric).toLocaleLowerCase()}
                label={t('business.analytics.chartLabel', {
                  metric: metricLabel(metric),
                  total: count(current.total),
                })}
              />
              <div className="an-summary">
                <span>
                  {t('business.analytics.total')} <b>{count(current.total)}</b>
                </span>
                <span>
                  {t('business.analytics.avg')} <b>{count(Math.round(avg))}</b>
                </span>
                {peak && (
                  <span>
                    {t('business.analytics.peak')} <b>{count(peak.value)}</b> · {formatDate(peak.date, i18n.language)}
                  </span>
                )}
                <span>{t('business.analytics.vsPrevious', { days: range })}</span>
              </div>
            </div>
          </Panel>
        </Reveal>

        <Reveal className="biz-cols biz-cols--2 biz-cols--stretch" blur={false} delay={reduced ? 0 : 0.08}>
          <Panel
            title={t('business.analytics.funnelTitle')}
            sub={t('business.analytics.funnelNote')}
            flush
          >
            <div className="an-funnel">
              {funnel.map((step, index) => {
                const key = step.metric === 'placements'
                const target = Math.max(step.value / top, 0.012)
                const prev = index > 0 ? funnel[index - 1].value : null
                return (
                  <div className={key ? 'an-step an-step--key' : 'an-step'} key={step.metric}>
                    <div className="an-step__head">
                      <span className="an-step__label">{metricLabel(step.metric)}</span>
                      <span style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'baseline' }}>
                        {prev !== null && (
                          <span className="an-step__drop">
                            {t('business.analytics.ofPrevious', {
                              value: formatPercent(prev ? step.value / prev : 0, i18n.language, 1),
                            })}
                          </span>
                        )}
                        <span className="an-step__value">{count(step.value)}</span>
                      </span>
                    </div>
                    <div className="an-step__bar">
                      <motion.div
                        className="an-step__fill"
                        initial={false}
                        animate={{ scaleX: target }}
                        transition={{ duration: reduced ? 0 : 0.8, ease: EASE }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel
            title={t('business.analytics.channelsTitle')}
            sub={t('business.analytics.channelsSub', { n: LEADS.length })}
            flush
          >
            <ul className="an-channels">
              <li aria-hidden="true">
                <div className="an-channel__bar" style={{ height: 14, borderRadius: 7 }}>
                  {channels.map((row) => (
                    <span key={row.channel} style={{ width: `${row.share * 100}%`, background: CHANNEL_COLOR[row.channel] }} />
                  ))}
                </div>
              </li>
              {channels.map((row) => (
                <li className="an-channel" key={row.channel}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--step--1)' }}>
                    <span
                      aria-hidden="true"
                      style={{ width: 10, height: 10, borderRadius: 3, background: CHANNEL_COLOR[row.channel] }}
                    />
                    {t(`business.leads.channel.${row.channel}`)}
                  </span>
                  <span className="biz-table__sub" style={{ fontSize: 12 }}>
                    {t('business.analytics.channelRow', {
                      n: row.n,
                      share: formatPercent(row.share, i18n.language, 0),
                      won: row.won,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>

        <Reveal blur={false} delay={reduced ? 0 : 0.1}>
          <Panel title={t('business.analytics.byProduct')} sub={t('business.analytics.byProductSub')} flush>
            <div className="biz-table__scroll">
              <table className="biz-table biz-table--stack">
                <caption className="biz-sr">{t('business.analytics.byProduct')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('business.products.columns.name')}</th>
                    <th scope="col" className="biz-num">{metricLabel('placements')}</th>
                    <th scope="col" className="biz-num">{metricLabel('contacts')}</th>
                    <th scope="col" className="biz-num">{metricLabel('views')}</th>
                    <th scope="col" className="biz-num">{t('business.analytics.placementRate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ANALYTICS.byProduct.map((row, index) => {
                    const product = productById(row.productId)
                    const name = product ? t(`catalog.products.${product.nameKey}.name`) : row.productId
                    const rate = row.views ? row.placements / row.views : 0
                    return (
                      <tr
                        key={row.productId}
                        onMouseEnter={() => setHovered(row.productId)}
                        onMouseLeave={() => setHovered(null)}
                      >
                        <td>
                          <span className="an-piece">
                            <Thumb3D
                              product={product}
                              className="an-thumb"
                              spin={hovered === row.productId}
                              offset={index * 0.5}
                              label={name}
                            />
                            <span className="biz-table__name">{name}</span>
                          </span>
                        </td>
                        <td className="biz-num" data-label={metricLabel('placements')} style={{ color: 'var(--text-strong)' }}>
                          {count(row.placements)}
                        </td>
                        <td className="biz-num" data-label={metricLabel('contacts')}>
                          {count(row.contacts)}
                        </td>
                        <td className="biz-num" data-label={metricLabel('views')}>
                          {count(row.views)}
                        </td>
                        <td className="biz-num" data-label={t('business.analytics.placementRate')}>
                          <span className="an-rate">
                            <i aria-hidden="true">
                              <span style={{ width: `${(rate / maxRate) * 100}%` }} />
                            </i>
                            {formatPercent(rate, i18n.language, 2)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </Reveal>
      </BusinessShell>
    </>
  )
}

export default Analytics
