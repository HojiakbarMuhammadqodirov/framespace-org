import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/ui/Button'
import { QrHandoff } from '@/pages/landing/QrHandoff'
import { Cluster } from './Chrome'

/**
 * Desktop: the whole live mode is hidden and this stands in its place.
 *
 * Not a disabled button and not a "your browser is unsupported" banner —
 * a desktop genuinely cannot do this, and the honest response is to hand the
 * session to the device that can. The QR dialog is `QrHandoff`, reused
 * verbatim from the landing page.
 *
 * The drawing is a phone standing in a room, measured. Stroke only, same
 * drafting language as §02 and §05 of the landing page.
 *
 * `compact` is the secondary panel shown beside the desktop panorama: the room
 * is already on screen, so this only says the phone is better and offers the
 * QR. The QR always opens this exact page, so the phone lands on this project.
 */

const CSS = `
.fsl-handoff {
  min-height: 100dvh;
  display: grid;
  align-content: center;
  padding-block: var(--s24);
}
.fsl-handoff__grid { align-items: center; row-gap: var(--s16); }
.fsl-handoff__grid > * { grid-column: 1 / -1; }
.fsl-handoff__code {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.fsl-handoff__title {
  font-family: var(--font-display);
  font-size: var(--step-4);
  line-height: var(--lh-display);
  letter-spacing: var(--tracking-display);
  color: var(--text-strong);
  max-width: 13ch;
  margin: var(--s5) 0 0;
}
.fsl-handoff__body {
  font-size: var(--step-1);
  line-height: var(--lh-body);
  color: var(--text-muted);
  max-width: 46ch;
  margin: var(--s6) 0 0;
}
.fsl-handoff__note {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-top: var(--s5);
}
.fsl-handoff__fig {
  display: flex;
  justify-content: center;
  padding: var(--s8);
}
.fsl-handoff__fig svg { width: clamp(180px, 26vw, 260px); height: auto; }
@media (min-width: 768px) {
  .fsl-handoff__copy { grid-column: 1 / span 6; }
  .fsl-handoff__fig  { grid-column: 8 / span 5; justify-content: flex-end; }
}
.fsl-handoff-panel {
  position: absolute;
  right: var(--s6);
  bottom: var(--s6);
  z-index: 21;
  width: min(320px, calc(100% - var(--s12)));
}
.fsl-handoff-panel__core {
  display: grid;
  gap: var(--s4);
  padding: var(--s5);
}
.fsl-handoff-panel__body {
  margin: 0;
  font-size: var(--step--1);
  line-height: var(--lh-body);
  color: var(--text-muted);
}
`

function PhoneInRoom() {
  const stroke = 'var(--clay-300)'
  const hair = 'var(--hairline)'
  return (
    <svg viewBox="0 0 240 300" fill="none" aria-hidden="true">
      <g stroke={stroke} strokeWidth="1.25" strokeLinejoin="round">
        {/* the room, in plan */}
        <path d="M24 54 L24 232 L216 232 L216 54 Z" />
        <path d="M24 54 L216 54" />
        <rect x="52" y="86" width="52" height="34" />
        <rect x="150" y="96" width="40" height="70" />
        {/* the person, standing at the anchor */}
        <circle cx="120" cy="188" r="11" />
        {/* the cone of view toward the front wall */}
        <path d="M120 177 L86 60 M120 177 L154 60" strokeDasharray="4 6" />
      </g>
      <g stroke={hair} strokeWidth="1">
        <path d="M24 254 L216 254" />
        <path d="M24 248 L24 260 M216 248 L216 260" />
      </g>
      <text
        x="120"
        y="274"
        textAnchor="middle"
        fill="var(--text-muted)"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em' }}
      >
        360°
      </text>
      <circle cx="120" cy="188" r="3" fill="var(--accent)" />
    </svg>
  )
}

export function DesktopHandoff({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const url = typeof window !== 'undefined' ? window.location.href : undefined

  if (compact) {
    return (
      <>
        <style href="fs-live-handoff" precedence="medium">
          {CSS}
        </style>
        <Cluster className="fsl-handoff-panel">
          <div className="fsl-handoff-panel__core">
            <span className="fsl-handoff__code">{t('live.desktop.label')}</span>
            <p className="fsl-handoff-panel__body">
              {t('live.desktop.betterOnPhone', {
                defaultValue:
                  'Telefonda yaxshiroq ishlaydi — xonada turib, telefonni aylantirib koʻrasiz.',
              })}
            </p>
            <Button variant="secondary" size="sm" arrow onClick={() => setOpen(true)}>
              {t('live.desktop.cta')}
            </Button>
          </div>
        </Cluster>
        <QrHandoff open={open} onClose={() => setOpen(false)} url={url} />
      </>
    )
  }

  return (
    <div className="fsl-handoff">
      <style href="fs-live-handoff" precedence="medium">
        {CSS}
      </style>

      <div className="fs-container">
        <hr className="fs-rule-strong" />
        <div className="fs-grid fsl-handoff__grid" style={{ paddingTop: 'var(--s10)' }}>
          <div className="fsl-handoff__copy">
            <span className="fsl-handoff__code">{t('live.desktop.label')}</span>
            <h1 className="fsl-handoff__title">{t('live.desktop.title')}</h1>
            <p className="fsl-handoff__body">{t('live.desktop.body')}</p>
            <div style={{ marginTop: 'var(--s8)' }}>
              <Button variant="primary" size="lg" arrow onClick={() => setOpen(true)}>
                {t('live.desktop.cta')}
              </Button>
            </div>
            <p className="fsl-handoff__note">{t('live.desktop.note')}</p>
          </div>

          <div className="fsl-handoff__fig">
            <PhoneInRoom />
          </div>
        </div>
      </div>

      <QrHandoff open={open} onClose={() => setOpen(false)} url={url} />
    </div>
  )
}
