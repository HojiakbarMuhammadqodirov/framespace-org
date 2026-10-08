import { useTranslation } from 'react-i18next'

import { Cluster, GlyphBack, IconButton, Readout } from './Chrome'
import type { LiveModeId } from './types'

/**
 * The fixed top bar: leave, switch mode, and the two status lines that tell
 * you whether the phone is actually cooperating.
 *
 * The mode switch never hides a mode that exists on this device and never
 * offers one that does not. A mode that cannot run is shown with its reason
 * rather than removed — "no WebXR here" is information; a missing button is
 * not.
 */

const CSS = `
.fsl-top {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  z-index: 20;
  padding: calc(var(--s3) + env(safe-area-inset-top, 0px)) var(--s4) var(--s3);
  display: grid;
  gap: var(--s2);
  pointer-events: none;
}
.fsl-top > * { pointer-events: auto; }
.fsl-top__bar {
  display: flex;
  align-items: center;
  gap: var(--s3);
  padding: var(--s2);
}
.fsl-top__meta { display: grid; gap: 1px; min-width: 0; flex: 1; }
.fsl-top__style {
  font-family: var(--font-display);
  font-size: var(--step-1);
  line-height: 1.1;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fsl-top__sub {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.fsl-modes { display: flex; gap: var(--s1); padding: var(--s1); }
.fsl-mode {
  flex: 1;
  min-height: var(--tap);
  padding: var(--s2) var(--s3);
  border: 0;
  border-radius: calc(var(--radius-inner-xl) - 2px);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  cursor: pointer;
  transition: transform var(--d-fast) var(--ease), background-color var(--d-base) var(--ease),
    color var(--d-base) var(--ease);
}
.fsl-mode:active { transform: scale(0.98); }
.fsl-mode[aria-pressed='true'] {
  background: color-mix(in srgb, var(--paper) 14%, transparent);
  box-shadow: var(--inset-hi);
  color: var(--text-strong);
}
.fsl-mode[data-available='false'] { opacity: 0.42; }
.fsl-status {
  display: flex;
  gap: var(--s5);
  justify-content: flex-end;
  padding: var(--s2) var(--s3);
}
@media (min-width: 768px) {
  .fsl-top { left: auto; right: var(--s6); width: min(420px, 42vw); }
}
@media (prefers-reduced-motion: reduce) {
  .fsl-mode { transition: none; }
}
`

export interface ModeOption {
  id: LiveModeId
  label: string
  available: boolean
}

export interface LiveTopBarProps {
  title: string
  subtitle: string
  modes: ModeOption[]
  mode: LiveModeId
  onMode: (id: LiveModeId) => void
  onExit: () => void
  status?: Array<{ label: string; value: string; tone?: 'ok' | 'warn' | 'err' | 'default' }>
}

export function LiveTopBar({
  title,
  subtitle,
  modes,
  mode,
  onMode,
  onExit,
  status = [],
}: LiveTopBarProps) {
  const { t } = useTranslation()

  return (
    <div className="fsl-top">
      <style href="fs-live-top" precedence="medium">
        {CSS}
      </style>

      <Cluster small>
        <div className="fsl-top__bar">
          <IconButton label={t('live.action.back')} onClick={onExit}>
            <GlyphBack />
          </IconButton>
          <span className="fsl-top__meta">
            <span className="fsl-top__style">{title}</span>
            <span className="fsl-top__sub">{subtitle}</span>
          </span>
        </div>
      </Cluster>

      <Cluster small quiet>
        <div className="fsl-modes" role="group" aria-label={t('live.mode.label')}>
          {modes.map((option) => (
            <button
              key={option.id}
              type="button"
              className="fsl-mode"
              aria-pressed={option.id === mode}
              data-available={option.available}
              onClick={() => onMode(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Cluster>

      {status.length ? (
        <Cluster small quiet>
          <div className="fsl-status">
            {status.map((item) => (
              <Readout
                key={item.label}
                label={item.label}
                value={item.value}
                tone={item.tone}
                align="end"
              />
            ))}
          </div>
        </Cluster>
      ) : null}
    </div>
  )
}
