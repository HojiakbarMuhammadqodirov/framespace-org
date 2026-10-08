import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/ui/Button'
import type { LiveModeId } from './types'

/**
 * The door. One tap, which is also the gesture iOS requires before it will
 * even ask about motion, and the only moment we get to request the wake lock
 * and the portrait lock.
 *
 * It is also the last quiet screen before a full-bleed live view, so it is
 * where the editorial voice lives: paper, a serif line at display size, a
 * ruled list of the three modes and what each one actually needs. Not three
 * identical cards — a ruled list with its index in mono down the left, the
 * same drafting language as §02 of the landing page.
 *
 * The list is a radio group: the person picks the mode Start enters (C unless
 * they choose otherwise). A mode that cannot run here is still listed, disabled,
 * with the reason in place of its tag. A mode that does not exist yet (A) is
 * one muted "soon" line rather than a full row competing for attention.
 */

const CSS = `
.fsl-intro {
  min-height: 100dvh;
  display: grid;
  align-content: center;
  gap: var(--s10);
  padding: var(--s16) var(--gutter) calc(var(--s12) + env(safe-area-inset-bottom, 0px));
  max-width: 52rem;
  margin-inline: auto;
}
.fsl-intro__label {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: var(--s3);
}
.fsl-intro__label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--hairline);
}
.fsl-intro__title {
  font-family: var(--font-display);
  font-size: var(--step-4);
  line-height: var(--lh-display);
  letter-spacing: var(--tracking-display);
  color: var(--text-strong);
  max-width: 14ch;
  margin: 0;
}
.fsl-intro__lead {
  font-size: var(--step-1);
  line-height: var(--lh-body);
  color: var(--text-muted);
  max-width: 44ch;
  margin: var(--s5) 0 0;
}
.fsl-intro__modes { display: grid; margin: 0; padding: 0; }
.fsl-intro__mode {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--s4);
  align-items: baseline;
  width: 100%;
  min-height: 44px;
  margin: 0;
  border: 0;
  border-top: 1px solid var(--border-strong);
  padding: var(--s5) var(--s4) var(--s5) var(--s3);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color var(--d-fast) var(--ease);
}
.fsl-intro__mode:last-child { border-bottom: 1px solid var(--border-strong); }
.fsl-intro__mode:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
.fsl-intro__mode[aria-checked='true'] {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  box-shadow: inset 2px 0 0 var(--accent);
}
.fsl-intro__mode:disabled { cursor: not-allowed; }
@media (hover: hover) and (pointer: fine) {
  .fsl-intro__mode:not(:disabled):not([aria-checked='true']):hover {
    background: color-mix(in srgb, var(--text) 4%, transparent);
  }
}
.fsl-intro__soon {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s2) var(--s4);
  margin: var(--s4) 0 0;
  padding-inline: var(--s3);
  font-size: var(--step--1);
  color: var(--text-muted);
}
.fsl-intro__n {
  font-family: var(--font-mono);
  font-size: var(--step--1);
  letter-spacing: 0.1em;
  color: var(--accent);
}
.fsl-intro__name {
  font-family: var(--font-display);
  font-size: var(--step-2);
  line-height: var(--lh-tight);
  color: var(--text-strong);
  margin: 0;
}
.fsl-intro__body { color: var(--text-muted); margin: var(--s2) 0 0; max-width: 46ch; }
.fsl-intro__tag {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}
@media (min-width: 480px) { .fsl-intro__mode[data-available='true'] .fsl-intro__tag { white-space: nowrap; } }
.fsl-intro__mode[data-available='false'] .fsl-intro__tag { color: var(--warn-ink); }
.fsl-intro__mode[data-available='false'] .fsl-intro__name { color: var(--text-muted); }
@media (max-width: 479px) {
  .fsl-intro { padding-top: var(--s10); gap: var(--s8); }
  .fsl-intro__mode { grid-template-columns: auto minmax(0, 1fr); padding-inline: var(--s2); }
  .fsl-intro__tag { grid-column: 2; }
  .fsl-intro__cta > * { width: 100%; }
}
.fsl-intro__title em { font-style: italic; color: var(--accent-ink); }
@media (min-width: 768px) {
  .fsl-intro__title { font-size: var(--step-5); }
}
`

export interface IntroMode {
  id: LiveModeId
  available: boolean
  /** Shown instead of the usual tag when the mode cannot run here. */
  reason?: string
}

export interface LiveIntroProps {
  modes: IntroMode[]
  onEnter: (mode: LiveModeId) => void
  primary: LiveModeId
  busy?: boolean
}

export function LiveIntro({ modes, onEnter, primary, busy }: LiveIntroProps) {
  const { t } = useTranslation()
  // Mode A has no implementation yet; it is announced, not offered.
  const choices = modes.filter((mode) => mode.id !== 'a')
  const soon = modes.find((mode) => mode.id === 'a')
  const firstAvailable = choices.find((mode) => mode.available)?.id ?? primary
  const [selected, setSelected] = useState<LiveModeId>(() =>
    choices.some((mode) => mode.id === primary && mode.available) ? primary : firstAvailable
  )
  const refs = useRef(new Map<LiveModeId, HTMLButtonElement>())

  // Standard radio-group keys: arrows move and select among the enabled rows.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const enabled = choices.filter((mode) => mode.available)
    if (!enabled.length) return
    const at = enabled.findIndex((mode) => mode.id === selected)
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
    const next = enabled[(at + step + enabled.length) % enabled.length]
    setSelected(next.id)
    refs.current.get(next.id)?.focus()
  }

  return (
    <div className="fsl-intro">
      <style href="fs-live-intro" precedence="medium">
        {CSS}
      </style>

      <div>
        <span className="fsl-intro__label">{t('live.label')}</span>
        <h1 className="fsl-intro__title" style={{ marginTop: 'var(--s6)' }}>
          {t('live.title')}
        </h1>
        <p className="fsl-intro__lead">{t('live.lead')}</p>
      </div>

      <div>
        <div
          className="fsl-intro__modes"
          role="radiogroup"
          aria-label={t('live.label')}
          onKeyDown={onKeyDown}
        >
          {choices.map((mode, i) => {
            const checked = mode.id === selected
            return (
              <button
                key={mode.id}
                ref={(node) => {
                  if (node) refs.current.set(mode.id, node)
                  else refs.current.delete(mode.id)
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                // Roving tabindex: the group is one Tab stop.
                tabIndex={checked ? 0 : -1}
                disabled={!mode.available}
                className="fsl-intro__mode"
                data-available={mode.available}
                onClick={() => setSelected(mode.id)}
              >
                <span className="fsl-intro__n">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <span className="fsl-intro__name" style={{ display: 'block' }}>
                    {t(`live.mode.${mode.id}.name`)}
                  </span>
                  <span className="fsl-intro__body" style={{ display: 'block' }}>
                    {t(`live.mode.${mode.id}.body`)}
                  </span>
                </span>
                <span className="fsl-intro__tag">
                  {mode.available ? t(`live.mode.${mode.id}.tag`) : mode.reason}
                </span>
              </button>
            )
          })}
        </div>

        {soon && (
          <p className="fsl-intro__soon">
            <span className="fsl-intro__n">{String(choices.length + 1).padStart(2, '0')}</span>
            <span>{t('live.mode.a.name')}</span>
            <span className="fsl-intro__tag">
              {t('live.intro.soon', { defaultValue: 'Tez orada' })}
            </span>
          </p>
        )}
      </div>

      <div className="fsl-intro__cta">
        {/* The tap that matters: iOS only honours DeviceOrientationEvent
            .requestPermission() when the call starts inside this handler. */}
        <Button
          variant="primary"
          size="lg"
          arrow
          disabled={busy || !choices.some((mode) => mode.id === selected && mode.available)}
          onClick={() => onEnter(selected)}
        >
          {t('live.action.start')}
        </Button>
      </div>
    </div>
  )
}
