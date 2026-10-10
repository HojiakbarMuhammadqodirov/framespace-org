/**
 * Step 5 — style and budget.
 *
 * The style name is part of the API contract: it is sent to the model verbatim
 * in English and also keys the demo palettes, so only the *label* is
 * translated. The budget is a `{ limit, currency }` pair or `null`; the server
 * decides what fits, and the total that comes back is its arithmetic, not ours.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Chip } from '@/ui/Chip'
import { STYLES, formatMoney } from '@/lib/styles.js'
import { usePrefs } from '@/store/prefs'
import { useSession } from '@/store/session'
import { useRenderAllowance } from '@/lib/useRenderAllowance'

import { ArrowButton, Bezel, Eyebrow, Notice, Rise } from '../Chrome'
import { getHealth } from '../contract'
import type { BudgetTier } from '../types'
import type { CaptureFlow } from '../useCaptureFlow'

const CSS = `
.cap-plan { display: grid; gap: var(--s8); }
.cap-plan__head { display: grid; gap: var(--s5); justify-items: start; }
.cap-plan__title { font-size: var(--step-3); max-width: 16ch; }
.cap-plan__lead { color: var(--text-muted); max-width: 46ch; }
.cap-plan__stack { display: grid; gap: var(--s8); }
.cap-plan__label {
  display: block;
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: var(--s4);
}
.cap-plan__chips { display: flex; flex-wrap: wrap; gap: var(--s2); }
.cap-plan__blurb {
  margin-top: var(--s3);
  font-size: var(--step--1);
  color: var(--text-muted);
  max-width: 40ch;
}
.cap-plan__amount {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--s2) var(--s4);
  margin-bottom: var(--s3);
}
.cap-plan__figure {
  font-family: var(--font-display);
  font-size: var(--step-3);
  line-height: 1.05;
  letter-spacing: -0.01em;
  color: var(--text-strong);
  font-variant-numeric: lining-nums tabular-nums;
  overflow-wrap: anywhere;
}
.cap-plan__tier {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent-ink);
}
.cap-plan__exactWrap { position: relative; margin-top: var(--s4); }
.cap-plan__suffix {
  position: absolute;
  right: var(--s4);
  top: 50%;
  transform: translateY(-50%);
  font-family: var(--font-mono);
  font-size: var(--step--1);
  letter-spacing: 0.06em;
  color: var(--text-muted);
  pointer-events: none;
}
.cap-plan__warn { margin-top: var(--s3); font-size: var(--step--1); color: var(--warn); max-width: 40ch; }
.cap-plan__cost {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.08em;
  color: var(--text-muted);
  text-align: center;
}
.cap-plan__exact {
  width: 100%;
  min-height: var(--tap);
  padding: var(--s3) calc(var(--s4) + 5ch) var(--s3) var(--s4);
  background: var(--bg-sunken);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 16px;
  letter-spacing: 0.06em;
  transition: border-color var(--d-fast) var(--ease);
}
.cap-plan__exact:focus { outline: none; border-color: var(--accent); }
.cap-plan__notes {
  width: 100%;
  min-height: 110px;
  padding: var(--s4);
  background: var(--bg-sunken);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-family: inherit;
  font-size: 16px;
  resize: vertical;
  transition: border-color var(--d-fast) var(--ease);
}
.cap-plan__notes:focus { outline: none; border-color: var(--accent); }
.cap-plan__actions { display: grid; gap: var(--s3); margin-top: var(--s6); }
@media (min-width: 1080px) {
  .cap-plan { grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: var(--s16); align-items: start; }
  .cap-plan__title { font-size: var(--step-4); }
}
`

type Preset = { tier: BudgetTier; value: number }

/** Sensible ranges per currency. UZS is the default currency of the product. */
const SCALES: Record<string, { min: number; max: number; step: number; presets: Preset[] }> = {
  UZS: {
    min: 3_000_000,
    max: 300_000_000,
    step: 1_000_000,
    presets: [
      { tier: 'economy', value: 15_000_000 },
      { tier: 'optimal', value: 45_000_000 },
      { tier: 'premium', value: 120_000_000 },
    ],
  },
  USD: {
    min: 300,
    max: 25_000,
    step: 100,
    presets: [
      { tier: 'economy', value: 1_200 },
      { tier: 'optimal', value: 3_500 },
      { tier: 'premium', value: 9_000 },
    ],
  },
}

/** Intl tag for the UI language. Uzbek asks for the Latin script explicitly. */
function localeTag(lang: string) {
  return lang === 'uz' ? 'uz-Latn-UZ' : lang
}

export function PlanStep({ flow }: { flow: CaptureFlow }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const currency = usePrefs((state) => state.currency)
  const scale = SCALES[currency] || SCALES.UZS

  // The server's daily allowance when renders cost money; the local counters
  // (store/session.ts) otherwise. `left` follows whichever applies.
  const user = useSession((s) => s.user)
  const { left, quota, needsSignIn, dailyExhausted, resetTime } = useRenderAllowance()

  // Demo mode answers with canned rooms. Say so before the person spends a
  // thirty-second wait expecting their own.
  const [demo, setDemo] = useState(false)
  useEffect(() => {
    let alive = true
    getHealth()
      .then((health) => {
        if (alive) setDemo(Boolean(health?.demoMode))
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  // Follow the global currency switch, and start on "optimal".
  useEffect(() => {
    if (flow.budget.currency === currency && flow.budget.limit > 0) return
    const optimal = scale.presets.find((p) => p.tier === 'optimal') as Preset
    flow.setBudget({ tier: 'optimal', limit: optimal.value, currency })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency])

  const grouping = useMemo(() => {
    try {
      return new Intl.NumberFormat(localeTag(i18n.language), { maximumFractionDigits: 0 })
    } catch {
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
    }
  }, [i18n.language])

  const selected = STYLES.find((s) => s.name === flow.style)
  const unlimited = flow.budget.limit <= 0
  const tooLow = !unlimited && flow.budget.limit < scale.min
  const suffix =
    currency === 'UZS' ? t('capture.plan.currencySuffix', { defaultValue: 'soʻm' }) : currency
  const sliderValue = Math.min(scale.max, Math.max(scale.min, flow.budget.limit || scale.min))

  return (
    <div className="cap-plan">
      <style href="fs-cap-plan" precedence="medium">
        {CSS}
      </style>

      <Rise className="cap-plan__head">
        <Eyebrow>{t('capture.plan.eyebrow')}</Eyebrow>
        <h1 className="cap-plan__title" tabIndex={-1}>{t('capture.plan.title')}</h1>
        <p className="cap-plan__lead">{t('capture.plan.lead')}</p>
        {demo && (
          <Notice tone="warn" title={t('capture.plan.demoTitle', { defaultValue: 'Demo rejim' })}>
            {t('capture.plan.demoBody', {
              defaultValue:
                'Server hozir demo rejimda: natija sizning xonangiz emas, namunaviy xona boʻladi. Generatsiya hisobingizdan yechilmaydi.',
            })}
          </Notice>
        )}
        {flow.featured && (
          <Notice title={t('capture.plan.featuredTitle', { defaultValue: 'Tanlangan mebel dizaynga qoʻshiladi' })}>
            {flow.featured}
          </Notice>
        )}
      </Rise>

      <Rise delay={0.06}>
        <div className="cap-plan__stack">
          <Bezel>
            <span className="cap-plan__label">{t('capture.plan.styleLabel')}</span>
            <div className="cap-plan__chips">
              {STYLES.map((style) => (
                <Chip
                  key={style.name}
                  swatch={style.swatch}
                  selected={flow.style === style.name}
                  onClick={() => flow.setStyle(style.name)}
                >
                  {t(`styles.${style.name}`, { defaultValue: style.name })}
                </Chip>
              ))}
            </div>
            {selected && (
              <p className="cap-plan__blurb">
                {t(`styles.blurb.${selected.name}`, { defaultValue: selected.blurb })}
              </p>
            )}
          </Bezel>

          <Bezel>
            <span className="cap-plan__label">{t('capture.plan.budgetLabel')}</span>

            <div className="cap-plan__amount">
              <span className="cap-plan__figure">
                {unlimited
                  ? t('capture.plan.tiers.none')
                  : formatMoney(flow.budget.limit, flow.budget.currency)}
              </span>
              <span className="cap-plan__tier">
                {t(`capture.plan.tiers.${flow.budget.tier}`)}
              </span>
            </div>

            <input
              className="fs-slider"
              type="range"
              min={scale.min}
              max={scale.max}
              step={scale.step}
              value={sliderValue}
              onChange={(event) =>
                flow.setBudget({
                  tier: 'custom',
                  limit: Number(event.target.value),
                  currency,
                })
              }
              aria-label={t('capture.plan.budgetLabel')}
              aria-valuetext={
                unlimited ? t('capture.plan.tiers.none') : `${grouping.format(sliderValue)} ${suffix}`
              }
            />

            <div className="cap-plan__chips" style={{ marginTop: 'var(--s4)' }}>
              {scale.presets.map((preset) => (
                <Chip
                  key={preset.tier}
                  selected={flow.budget.tier === preset.tier}
                  onClick={() =>
                    flow.setBudget({ tier: preset.tier, limit: preset.value, currency })
                  }
                >
                  {t(`capture.plan.tiers.${preset.tier}`)}
                </Chip>
              ))}
              <Chip
                selected={unlimited}
                onClick={() => flow.setBudget({ tier: 'custom', limit: 0, currency })}
              >
                {t('capture.plan.tiers.none')}
              </Chip>
            </div>

            <label className="cap-plan__label" style={{ marginTop: 'var(--s6)' }} htmlFor="cap-exact">
              {t('capture.plan.exactLabel', { currency })}
            </label>
            <div className="cap-plan__exactWrap">
              {/* Grouped as typed ("45 000 000"): eight zeros are unreadable. */}
              <input
                id="cap-exact"
                className="cap-plan__exact"
                inputMode="numeric"
                autoComplete="off"
                value={flow.budget.limit ? grouping.format(flow.budget.limit) : ''}
                placeholder={grouping.format(Number(t('capture.plan.exactPlaceholder')) || 45_000_000)}
                aria-describedby={tooLow ? 'cap-exact-low' : undefined}
                aria-invalid={tooLow || undefined}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D+/g, '').slice(0, 12)
                  flow.setBudget({ tier: 'custom', limit: Number(digits || 0), currency })
                }}
              />
              <span className="cap-plan__suffix" aria-hidden="true">
                {suffix}
              </span>
            </div>
            {tooLow && (
              <p className="cap-plan__warn" id="cap-exact-low">
                {t('capture.plan.budgetTooLow', {
                  min: `${grouping.format(scale.min)} ${suffix}`,
                  defaultValue: 'Bu summa juda kam — kamida {{min}} tavsiya etiladi.',
                })}
              </p>
            )}
            <p className="cap-plan__blurb">{t('capture.plan.budgetHint')}</p>
          </Bezel>

          <Bezel>
            <label className="cap-plan__label" htmlFor="cap-notes">
              {t('capture.plan.notesLabel')}
            </label>
            <textarea
              id="cap-notes"
              className="cap-plan__notes"
              value={flow.notes}
              onChange={(event) => flow.setNotes(event.target.value)}
              placeholder={t('capture.plan.notesPlaceholder')}
            />
          </Bezel>

          {!flow.online && (
            <Notice tone="err" title={t('capture.errors.offline.title')}>
              {t('capture.errors.offline.body')}
            </Notice>
          )}

          <Notice title={t('capture.plan.waitTitle')}>{t('capture.plan.waitBody')}</Notice>

          <div className="cap-plan__actions">
            {left > 0 ? (
              <>
                <ArrowButton
                  onClick={() => void flow.generate()}
                  disabled={!flow.canContinue || !flow.online}
                >
                  {t('capture.plan.cta')}
                </ArrowButton>
                <p className="cap-plan__cost">
                  {quota
                    ? `${t('limits.left', { remaining: quota.remaining, limit: quota.limit })} · ${t('limits.resets', { time: resetTime })}`
                    : demo
                      ? t('capture.plan.demoTitle', { defaultValue: 'Demo rejim' })
                      : t('capture.plan.costLine', {
                          left,
                          defaultValue: '1 ta generatsiya sarflanadi · qoldi: {{left}}',
                        })}
                </p>
              </>
            ) : needsSignIn ? (
              <>
                <Notice tone="warn" title={t('limits.signinTitle')}>
                  {t('limits.signinBody')}
                </Notice>
                <ArrowButton onClick={() => navigate('/signup?next=/app/capture')}>{t('nav.signup')}</ArrowButton>
                <ArrowButton quiet onClick={() => navigate('/login?next=/app/capture')}>
                  {t('limits.login')}
                </ArrowButton>
              </>
            ) : dailyExhausted && quota ? (
              <Notice tone="warn" title={t('limits.exhaustedTitle')}>
                {t('limits.exhaustedBody', { limit: quota.limit, time: resetTime })}
              </Notice>
            ) : (
              <>
                <Notice
                  tone="warn"
                  title={t('capture.plan.noCredits', { defaultValue: 'Generatsiyalar tugadi' })}
                >
                  {user ? t('app.dash.credits.renew') : t('app.dash.credits.guestBody')}
                </Notice>
                {!user && (
                  <ArrowButton onClick={() => navigate('/signup')}>{t('nav.signup')}</ArrowButton>
                )}
                <ArrowButton quiet={!user} onClick={() => navigate('/pricing')}>
                  {t('app.dash.credits.upgrade')}
                </ArrowButton>
              </>
            )}
            <ArrowButton quiet glyph="back" onClick={() => flow.setStep('review')}>
              {t('common.back')}
            </ArrowButton>
          </div>
        </div>
      </Rise>
    </div>
  )
}
