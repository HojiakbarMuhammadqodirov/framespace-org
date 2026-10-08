import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'framer-motion'

import { Seo } from '@/lib/seo'
import { useCount, useMoney } from '@/features/catalog/money'
import {
  BusinessShell,
  Delta,
  Icon,
  Panel,
  Pill,
  Sparkline,
  Thumb3D,
  formatPercent,
  localeFor,
  relativeTime,
  type IconName,
} from '@/features/business/chrome'
import {
  ACTIVITY,
  BUSINESS,
  LEADS,
  OVERVIEW_METRICS,
  TEAM,
  VENDOR_PRODUCTS,
  productById,
  type ActivityEvent,
  type OverviewMetric,
} from '@/features/business/data'
import { useSavedBranding } from '@/features/business/local'
import { EASE, reveal, staggerParent, useMotionSafe } from '@/design/motion'
import { Reveal } from '@/ui/Reveal'
import { CountUp } from '@/ui/CountUp'

/**
 * §10 — the vendor's front page.
 *
 * The hierarchy is the argument: **placements** takes the display face and the
 * widest panel, because a view is a glance and a placement is somebody
 * standing a 12-million-soʻm sofa in their actual living room. Beside it sits
 * what needs doing today; below, the supporting KPIs, the pieces doing the
 * work (live 3D) and the activity feed.
 */

const CSS = `
.ov-hero { display: grid; gap: var(--s5); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 1000px) { .ov-hero { grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); } }
.ov-primary { display: grid; gap: var(--s5); padding: var(--s6); height: 100%; align-content: space-between; }
.ov-primary__top { display: flex; justify-content: space-between; gap: var(--s4); align-items: flex-start; flex-wrap: wrap; }
.ov-primary__value {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: var(--step-5);
  line-height: 0.95;
  letter-spacing: -0.03em;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums lining-nums;
}
.ov-primary__chart svg { width: 100%; height: auto; display: block; }
.ov-primary__why { margin: 0; color: var(--text-muted); font-size: var(--step--1); max-width: 56ch; line-height: 1.55; }
.ov-primary__stats { display: flex; flex-wrap: wrap; gap: var(--s3) var(--s8); padding-top: var(--s4); border-top: 1px solid var(--hairline); }
.ov-stat { display: grid; gap: 2px; }
.ov-stat b { font-family: var(--font-mono); font-weight: 500; font-size: var(--step-1); font-variant-numeric: tabular-nums; color: var(--text-strong); }

.ov-todo { margin: 0; padding: 0; list-style: none; display: grid; }
.ov-todo a {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: var(--s3); align-items: center;
  padding: var(--s4) var(--s5);
  border-top: 1px solid var(--hairline);
  color: inherit; text-decoration: none;
  transition: background-color var(--d-fast) var(--ease);
}
.ov-todo li:first-child a { border-top: 0; }
.ov-todo__icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--bg-sunken); box-shadow: inset 0 0 0 1px var(--hairline); color: var(--text-muted); }
.ov-todo__icon--accent { color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--bg-raised)); }
.ov-todo__icon--warn { color: var(--warn-ink); background: color-mix(in srgb, var(--warn) 12%, var(--bg-raised)); }
.ov-todo__text { display: grid; gap: 2px; min-width: 0; }
.ov-todo__title { font-size: var(--step--1); font-weight: 600; color: var(--text-strong); }
.ov-todo__body { font-size: 12.5px; color: var(--text-muted); }
.ov-todo__go { color: var(--text-muted); }
.ov-quota { display: grid; gap: var(--s2); padding: var(--s4) var(--s5) var(--s5); border-top: 1px solid var(--hairline); }

.ov-kpis { display: grid; gap: var(--s4); grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (min-width: 1000px) { .ov-kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (max-width: 380px) { .ov-kpis { grid-template-columns: minmax(0, 1fr); } }

.ov-split { display: grid; gap: var(--s5); grid-template-columns: minmax(0, 1fr); align-items: start; }
@media (min-width: 1000px) { .ov-split { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); } }

.ov-top { margin: 0; padding: 0; list-style: none; display: grid; }
.ov-top a {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: var(--s4); align-items: center;
  padding: var(--s3) var(--s5);
  border-top: 1px solid var(--hairline);
  color: inherit; text-decoration: none;
  transition: background-color var(--d-fast) var(--ease);
}
.ov-top li:first-child a { border-top: 0; }
.ov-top__thumb { width: 64px; height: 64px; }
.ov-top__body { display: grid; gap: 6px; min-width: 0; }
.ov-top__name { font-weight: 600; color: var(--text-strong); font-size: var(--step--1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ov-top__bar { height: 4px; border-radius: var(--radius-full); background: var(--bg-sunken); overflow: hidden; }
.ov-top__bar span { display: block; height: 100%; background: var(--accent); border-radius: inherit; transform-origin: left center; }
.ov-top__num { display: grid; justify-items: end; gap: 2px; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.ov-top__num b { font-weight: 500; color: var(--text-strong); font-size: var(--step-0); }
.ov-top__num span { font-size: 10.5px; color: var(--text-muted); }

.ov-feed { display: grid; margin: 0; padding: 0; list-style: none; }
.ov-feed li {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--s3);
  padding: var(--s3) var(--s5);
}
.ov-feed__icon { position: relative; z-index: 1; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--hairline); color: var(--text-muted); }
.ov-feed li:not(:last-child)::after { content: ''; position: absolute; left: calc(var(--s5) + 15px); top: 42px; bottom: -6px; width: 1px; background: var(--hairline); }
.ov-feed__text { display: grid; gap: 2px; padding-top: 4px; font-size: var(--step--1); color: var(--text); }
.ov-feed__when { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.04em; color: var(--text-muted); }
.ov-feed__icon--ok { color: var(--ok); }
.ov-feed__icon--err { color: var(--err); }
.ov-feed__icon--accent { color: var(--accent); }

@media (hover: hover) and (pointer: fine) {
  .ov-todo a:hover, .ov-top a:hover { background: color-mix(in srgb, var(--bg-sunken) 55%, transparent); }
  .ov-todo a:hover .ov-todo__go { color: var(--text-strong); }
}
`

const FEED_ICON: Record<ActivityEvent['kind'], { icon: IconName; tone?: 'ok' | 'err' | 'accent' }> = {
  modelReady: { icon: 'cube', tone: 'ok' },
  lead: { icon: 'leads', tone: 'accent' },
  placementSpike: { icon: 'analytics', tone: 'accent' },
  priceChange: { icon: 'products' },
  teamJoined: { icon: 'team' },
  modelFailed: { icon: 'alert', tone: 'err' },
}

function countProps(metric: OverviewMetric, million: string, unit: string) {
  if (metric.format === 'uzs') {
    const inMillions = metric.value / 1_000_000
    return metric.value >= 1_000_000
      ? { to: inMillions, decimals: inMillions >= 100 ? 0 : 1, suffix: ` ${million}` }
      : { to: metric.value, suffix: ` ${unit}` }
  }
  if (metric.format === 'percent') return { to: metric.value, decimals: 2, suffix: '%' }
  return { to: metric.value }
}

export function Overview() {
  const { t, i18n } = useTranslation()
  const reduced = useReducedMotion()
  const count = useCount()
  const money = useMoney()
  const locale = localeFor(i18n.language)
  const [hovered, setHovered] = useState<string | null>(null)
  const [branding] = useSavedBranding()

  const parentVariants = useMotionSafe(staggerParent)
  const itemVariants = useMotionSafe(reveal)

  const primary = OVERVIEW_METRICS.find((metric) => metric.tone === 'primary')
  const rate = OVERVIEW_METRICS.find((metric) => metric.id === 'placementRate')
  const kpis = OVERVIEW_METRICS.filter((metric) => metric.tone !== 'primary' && metric.id !== 'placementRate')

  const pending = useMemo(() => VENDOR_PRODUCTS.filter((row) => row.modelStatus !== 'ready'), [])
  const newLeads = useMemo(() => LEADS.filter((lead) => lead.status === 'new'), [])
  const noTwoFactor = useMemo(() => TEAM.filter((m) => m.status === 'active' && !m.twoFactor), [])
  const published = useMemo(() => VENDOR_PRODUCTS.filter((row) => row.state === 'published').length, [])
  const top = useMemo(
    () => [...VENDOR_PRODUCTS].sort((a, b) => b.placements30d - a.placements30d).slice(0, 4),
    [],
  )
  const maxTop = top[0]?.placements30d || 1

  const million = t('catalog.currency.million')
  const unit = t('catalog.currency.uzs')

  const todos: Array<{ to: string; icon: IconName; tone?: 'accent' | 'warn'; title: string; body: string }> = []
  if (newLeads.length) {
    todos.push({
      to: '/business/orders-leads',
      icon: 'leads',
      tone: 'accent',
      title: t('business.overview.todo.leads', { n: newLeads.length }),
      body: newLeads.map((lead) => lead.name).join(', '),
    })
  }
  if (pending.length) {
    todos.push({
      to: '/business/products',
      icon: 'cube',
      tone: 'warn',
      title: t('business.overview.modelsPending', { n: pending.length }),
      body: pending
        .map((row) => {
          const product = productById(row.productId)
          return product ? t(`catalog.products.${product.nameKey}.name`) : row.sku
        })
        .join(', '),
    })
  }
  if (noTwoFactor.length) {
    todos.push({
      to: '/business/team',
      icon: 'team',
      title: t('business.overview.todo.twoFactor', { n: noTwoFactor.length }),
      body: noTwoFactor.map((m) => m.name).join(', '),
    })
  }

  return (
    <>
      <style href="fs-biz-overview" precedence="medium">
        {CSS}
      </style>
      <Seo
        title={`${t('business.overview.title')} — ${t('business.meta.title')}`}
        description={t('business.meta.description')}
        path="/business"
      />

      <BusinessShell
        title={t('business.overview.greeting', { name: branding.displayName })}
        lead={t('business.overview.lead')}
        badges={<Pill tone="accent">{t('business.overview.range')}</Pill>}
        actions={
          <>
            <Link className="biz-btn" to={`/store/${BUSINESS.slug}`}>
              <Icon name="external" size={16} />
              {t('business.overview.actions.viewStore')}
            </Link>
            <Link className="biz-btn biz-btn--primary" to="/business/products#add">
              <Icon name="plus" size={16} />
              {t('business.overview.actions.upload')}
            </Link>
          </>
        }
      >
        <Reveal className="ov-hero" blur={false}>
          {primary && (
            <Panel flush>
              <div className="ov-primary">
                <div className="ov-primary__top">
                  <div style={{ display: 'grid', gap: 'var(--s3)' }}>
                    <span className="biz-metric__key" style={{ color: 'var(--accent-ink)' }}>
                      <Icon name="cube" size={14} />
                      {t('business.overview.metrics.placements')}
                    </span>
                    <span className="ov-primary__value">
                      <CountUp to={primary.value} locale={locale} duration={1600} />
                    </span>
                  </div>
                  <span style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
                    <Delta value={primary.deltaPct} />
                    <span className="biz-metric__note">{t('business.analytics.vsPrevious', { days: 30 })}</span>
                  </span>
                </div>
                <div className="ov-primary__chart">
                  <Sparkline points={primary.trend} tone="accent" width={600} height={110} animate />
                </div>
                <p className="ov-primary__why">{t('business.overview.placementsWhy')}</p>
                <div className="ov-primary__stats">
                  {rate && (
                    <span className="ov-stat">
                      <span className="biz-metric__key">{t('business.overview.metrics.placementRate')}</span>
                      <b>{formatPercent(rate.value / 100, i18n.language, 2)}</b>
                    </span>
                  )}
                  <span className="ov-stat">
                    <span className="biz-metric__key">{t('business.overview.stats.published')}</span>
                    <b>
                      {published}/{VENDOR_PRODUCTS.length}
                    </b>
                  </span>
                  <span className="ov-stat">
                    <span className="biz-metric__key">{t('business.overview.stats.leads')}</span>
                    <b>{LEADS.length}</b>
                  </span>
                </div>
              </div>
            </Panel>
          )}

          <Panel
            title={t('business.overview.todo.title')}
            sub={todos.length ? t('business.overview.todo.sub', { n: todos.length }) : undefined}
            flush
          >
            {todos.length ? (
              <ul className="ov-todo">
                {todos.map((todo) => (
                  <li key={todo.to}>
                    <Link to={todo.to}>
                      <span className={`ov-todo__icon${todo.tone ? ` ov-todo__icon--${todo.tone}` : ''}`}>
                        <Icon name={todo.icon} size={17} />
                      </span>
                      <span className="ov-todo__text">
                        <span className="ov-todo__title">{todo.title}</span>
                        <span className="ov-todo__body">{todo.body}</span>
                      </span>
                      <span className="ov-todo__go" aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="biz-panel__pad biz-metric__note" style={{ margin: 0 }}>
                {t('business.overview.todo.clear')}
              </p>
            )}
            <div className="ov-quota">
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--s3)' }}>
                <span className="biz-metric__key">{t('business.overview.quota.title')}</span>
                <span className="biz-table__sub">
                  {BUSINESS.modelQuotaUsed}/{BUSINESS.modelQuotaTotal}
                </span>
              </span>
              <div className="biz-meter" aria-hidden="true">
                <motion.span
                  initial={reduced ? false : { scaleX: 0 }}
                  whileInView={{ scaleX: BUSINESS.modelQuotaUsed / BUSINESS.modelQuotaTotal }}
                  viewport={{ once: true }}
                  transition={{ duration: reduced ? 0 : 0.9, ease: EASE }}
                  style={reduced ? { transform: `scaleX(${BUSINESS.modelQuotaUsed / BUSINESS.modelQuotaTotal})` } : undefined}
                />
              </div>
              <span className="biz-metric__note">
                {t('business.overview.quota.used', {
                  used: BUSINESS.modelQuotaUsed,
                  total: BUSINESS.modelQuotaTotal,
                })}
              </span>
            </div>
          </Panel>
        </Reveal>

        <Reveal className="ov-kpis" blur={false} delay={reduced ? 0 : 0.06}>
          {kpis.map((metric) => {
            const props = countProps(metric, million, unit)
            return (
              <Panel flush lift key={metric.id}>
                <div className="biz-metric">
                  <span className="biz-metric__key">{t(`business.overview.metrics.${metric.id}`)}</span>
                  <span className="biz-metric__value">
                    <CountUp {...props} locale={locale} duration={1100} />
                    {metric.format === 'uzs' && (
                      <span style={{ fontSize: '0.55em', color: 'var(--text-muted)', marginInlineStart: 4 }}>
                        {unit}
                      </span>
                    )}
                  </span>
                  <div className="biz-metric__foot">
                    <Delta value={metric.deltaPct} />
                    <Sparkline points={metric.trend} width={96} height={32} animate />
                  </div>
                </div>
              </Panel>
            )
          })}
        </Reveal>

        <Reveal className="ov-split" blur={false} delay={reduced ? 0 : 0.1}>
          <Panel
            title={t('business.overview.top.title')}
            sub={t('business.overview.top.sub')}
            aside={
              <Link className="biz-btn biz-btn--ghost" to="/business/products">
                {t('business.overview.top.all')} →
              </Link>
            }
            flush
          >
            <ul className="ov-top">
              {top.map((row, index) => {
                const product = productById(row.productId)
                const name = product ? t(`catalog.products.${product.nameKey}.name`) : row.sku
                return (
                  <li key={row.sku}>
                    <Link
                      to={product ? `/catalog/${product.slug}` : '/business/products'}
                      onMouseEnter={() => setHovered(row.sku)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(row.sku)}
                      onBlur={() => setHovered(null)}
                    >
                      <Thumb3D
                        product={product}
                        className="ov-top__thumb"
                        spin={hovered === row.sku}
                        offset={index * 0.6}
                        label={name}
                      />
                      <span className="ov-top__body">
                        <span className="ov-top__name">{name}</span>
                        <span className="biz-table__sub">
                          {row.sku} · {money.compact(row.priceUzs)}
                        </span>
                        <span className="ov-top__bar" aria-hidden="true">
                          <motion.span
                            initial={reduced ? false : { scaleX: 0 }}
                            whileInView={{ scaleX: row.placements30d / maxTop }}
                            viewport={{ once: true }}
                            transition={{ duration: reduced ? 0 : 0.8, ease: EASE, delay: index * 0.05 }}
                            style={reduced ? { transform: `scaleX(${row.placements30d / maxTop})` } : undefined}
                          />
                        </span>
                      </span>
                      <span className="ov-top__num">
                        <b>{count(row.placements30d)}</b>
                        <span>{formatPercent(row.placements30d / row.views30d, i18n.language, 1)}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <Panel title={t('business.overview.activity.title')} flush>
            <motion.ul
              className="ov-feed"
              variants={parentVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-8% 0px' }}
              style={{ paddingBottom: 'var(--s4)' }}
            >
              {ACTIVITY.map((event) => {
                const meta = FEED_ICON[event.kind]
                return (
                  <motion.li key={event.id} variants={itemVariants}>
                    <span className={`ov-feed__icon${meta.tone ? ` ov-feed__icon--${meta.tone}` : ''}`}>
                      <Icon name={meta.icon} size={14} />
                    </span>
                    <span className="ov-feed__text">
                      <span>
                        {t(`business.overview.activity.${event.kind}`, {
                          subject: event.subject,
                          n: event.count ?? 0,
                        })}
                      </span>
                      <time className="ov-feed__when" dateTime={event.at}>
                        {relativeTime(event.at, i18n.language)}
                      </time>
                    </span>
                  </motion.li>
                )
              })}
            </motion.ul>
          </Panel>
        </Reveal>
      </BusinessShell>
    </>
  )
}

export default Overview
