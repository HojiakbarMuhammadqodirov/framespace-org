import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { entryFor } from '../catalog'
import { UZS_PER_USD, useMoneyFormat } from '../format'
import { BUDGET_PRESETS, useBuilder } from '../store'

/**
 * The running total, parked in the corner of the viewport.
 *
 * It floats, so it is the one place `backdrop-filter` is allowed. Over budget
 * the whole readout moves to --warn rather than growing a red badge: the number
 * itself is the alarm.
 */

const CSS = `
.rb-budget {
  position: absolute;
  z-index: 3;
  background: color-mix(in srgb, var(--bg-sunken) 78%, transparent);
  backdrop-filter: blur(14px) saturate(1.1);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-2xl);
  padding: var(--bezel-pad);
  box-shadow: var(--shadow-float);
}
.rb-budget__core {
  display: grid;
  gap: var(--s3);
  padding: var(--s4);
  border-radius: var(--radius-inner-2xl);
  background: color-mix(in srgb, var(--bg-raised) 82%, transparent);
  box-shadow: var(--inset-hi), var(--inset-lo);
}
.rb-budget__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s3);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.rb-budget__sum {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-strong);
}
.rb-budget__spent { font-size: var(--step-2); letter-spacing: -0.01em; }
.rb-budget__limit { font-size: var(--step--1); color: var(--text-muted); }
.rb-budget--over .rb-budget__spent,
.rb-budget--over .rb-budget__state { color: var(--warn-ink); }
.rb-budget__meter {
  position: relative;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--bezel-shell);
  overflow: hidden;
}
.rb-budget__fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 100%;
  border-radius: inherit;
  background: var(--accent);
  transform-origin: left center;
  transition: transform var(--d-slow) var(--ease), background-color var(--d-base) var(--ease);
}
.rb-budget--over .rb-budget__fill { background: var(--warn); }
.rb-budget__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.rb-budget__edit {
  min-height: 28px;
  padding-inline: var(--s3);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  cursor: pointer;
  transition: color var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease),
    transform var(--d-fast) var(--ease);
}
.rb-budget__edit:hover { color: var(--text-strong); border-color: var(--border-strong); }
.rb-budget__edit:active { transform: scale(0.98); }
.rb-budget__presets { display: flex; flex-wrap: wrap; gap: var(--s2); }
.rb-budget__preset {
  min-height: 34px;
  padding-inline: var(--s3);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  cursor: pointer;
  transition: transform var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease);
}
.rb-budget__preset[aria-pressed='true'] { border-color: var(--accent); color: var(--text-strong); }
.rb-budget__preset:active { transform: scale(0.98); }
.rb-budget__preset[disabled] { opacity: 0.5; cursor: default; }
.rb-budget__custom { display: flex; gap: var(--s2); }
.rb-budget__input {
  flex: 1;
  min-width: 0;
  min-height: 34px;
  padding-inline: var(--s3);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  color: var(--text-strong);
  font-family: var(--font-mono);
  font-size: 16px;
}
.rb-budget__input:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.rb-budget__note { margin: 0; font-size: 10px; color: var(--text-muted); }

/* ---- slim corner bar: bottom-left, never over the centre of the room ---- */
.rb-budget {
  left: var(--s3);
  right: auto;
  bottom: var(--s3);
  width: min(300px, calc(58% - var(--s3)));
  padding: 3px;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-ambient);
}
.rb-budget__core {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px var(--s3);
  padding: var(--s2) var(--s3);
  border-radius: calc(var(--radius-xl) - 3px);
}
.rb-budget__top { grid-column: 1 / -1; font-size: 10px; }
.rb-budget__sum { grid-column: 1; min-width: 0; white-space: nowrap; overflow: hidden; }
.rb-budget__spent { font-size: var(--step-0); }
.rb-budget__limit { font-size: 11px; }
.rb-budget__meter { grid-column: 1 / -1; height: 3px; }
.rb-budget__foot { display: contents; }
.rb-budget__foot > span { grid-column: 1 / -1; grid-row: 4; font-size: 10px; letter-spacing: 0.04em; }
.rb-budget__edit { grid-column: 2; grid-row: 2; align-self: center; }
.rb-budget__presets, .rb-budget__custom, .rb-budget__note { grid-column: 1 / -1; }
@media (max-width: 767px) {
  .rb-budget__foot > span { display: none; }
}
`

export function BudgetStyles() {
  return (
    <style href="fs-builder-budget" precedence="medium">
      {CSS}
    </style>
  )
}

export function BudgetCounter() {
  const { t } = useTranslation()
  const fmt = useMoneyFormat()
  const items = useBuilder((s) => s.scene.items)
  const budget = useBuilder((s) => s.scene.budget)
  const setBudget = useBuilder((s) => s.setBudget)
  const [editing, setEditing] = useState(false)
  const [custom, setCustom] = useState('')

  const spent = useMemo(
    () => items.reduce((sum, item) => sum + entryFor(item.catalogId).price, 0),
    [items]
  )
  const over = spent > budget
  const ratio = budget > 0 ? Math.min(1, spent / budget) : spent > 0 ? 1 : 0

  function applyCustom() {
    const mln = Number(custom.replace(',', '.'))
    if (!Number.isFinite(mln) || mln <= 0) return
    setBudget(Math.round(Math.min(mln, 10_000) * 1_000_000))
    setCustom('')
    setEditing(false)
  }

  return (
    <aside
      className={over ? 'rb-budget rb-budget--over' : 'rb-budget'}
      aria-label={t('builder.budget.title')}
    >
      <div className="rb-budget__core">
        <div className="rb-budget__top">
          <span>{t('builder.budget.title')}</span>
          <span className="rb-budget__state" aria-live="polite">
            {over ? t('builder.budget.over') : t('builder.budget.spent')}
          </span>
        </div>

        <div className="rb-budget__sum">
          <span className="rb-budget__spent">{fmt.short(spent)}</span>
          <span className="rb-budget__limit">/ {fmt.short(budget)}</span>
        </div>

        <div
          className="rb-budget__meter"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
          aria-label={t('builder.budget.spent')}
        >
          <span className="rb-budget__fill" style={{ transform: `scaleX(${ratio})` }} />
        </div>

        <div className="rb-budget__foot">
          <span>
            {over
              ? `+ ${fmt.full(spent - budget)}`
              : `${t('builder.budget.left')} ${fmt.full(budget - spent)}`}
          </span>
          <button
            type="button"
            className="rb-budget__edit"
            aria-expanded={editing}
            onClick={() => setEditing((value) => !value)}
          >
            {t('builder.budget.limit')}
          </button>
        </div>

        {editing && (
          <>
            <div className="rb-budget__presets">
              {BUDGET_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="rb-budget__preset"
                  aria-pressed={preset === budget}
                  onClick={() => {
                    setBudget(preset)
                    setEditing(false)
                  }}
                >
                  {fmt.short(preset)}
                </button>
              ))}
            </div>
            <form
              className="rb-budget__custom"
              onSubmit={(event) => {
                event.preventDefault()
                applyCustom()
              }}
            >
              <input
                className="rb-budget__input"
                inputMode="decimal"
                value={custom}
                placeholder={t('builder.editor.customBudget')}
                aria-label={t('builder.editor.customBudget')}
                onChange={(event) => setCustom(event.target.value.replace(/[^0-9.,]/g, ''))}
              />
              <button type="submit" className="rb-budget__preset" disabled={!custom}>
                {t('builder.editor.apply')}
              </button>
            </form>
            {fmt.currency === 'USD' && (
              <p className="rb-budget__note">
                {t('builder.editor.rateNote', { rate: UZS_PER_USD.toLocaleString() })}
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
