/**
 * Step 1 — what the phone is about to be asked for, and why.
 *
 * The single tap does two things at once: `getUserMedia` for the preview and
 * `DeviceOrientationEvent.requestPermission()` for the compass. iOS only honours
 * the second one when it is called inside the gesture, so the handler passed in
 * here calls it before its first `await` and nothing may be inserted in front.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useMediaQuery } from '@/lib/useMediaQuery'
import { QrHandoff } from '@/pages/landing/QrHandoff'

import { ArrowButton, Bezel, Eyebrow, Notice, Rise } from '../Chrome'
import type { CaptureFlow } from '../useCaptureFlow'

/** A computer with a mouse: upload-first. Touch laptops still count. */
const DESKTOP_POINTER = '(min-width: 900px) and (pointer: fine)'

const CSS = `
.cap-perm { display: grid; gap: var(--s8); }
.cap-perm__head { display: grid; gap: var(--s5); justify-items: start; }
.cap-perm__title { font-size: var(--step-3); max-width: 15ch; }
.cap-perm__lead { color: var(--text-muted); max-width: 42ch; }
.cap-perm__rows { display: grid; gap: var(--s5); }
.cap-perm__row { display: grid; grid-template-columns: 44px 1fr; gap: var(--s4); align-items: start; }
.cap-perm__glyph {
  width: 44px; height: 44px;
  display: grid; place-items: center;
  border: 1px solid var(--hairline);
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  color: var(--clay-300);
}
.cap-perm__rowTitle { display: block; font-size: var(--step-0); color: var(--text-strong); font-weight: 500; }
.cap-perm__rowBody { display: block; font-size: var(--step--1); color: var(--text-muted); margin-top: 2px; line-height: var(--lh-body); }
.cap-perm__rule { border: 0; border-top: 1px solid var(--hairline); margin: 0; }
.cap-perm__fine {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.08em;
  color: var(--text-muted);
  line-height: 1.7;
}
.cap-perm__actions { display: grid; gap: var(--s3); }
.cap-perm__skip {
  justify-self: start;
  min-height: var(--tap);
  padding: 0 var(--s3);
  background: none;
  border: 0;
  color: var(--text-muted);
  font-size: var(--step--1);
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
  transition: color var(--d-fast) var(--ease);
}
.cap-perm__skip:hover { color: var(--text-strong); }
.cap-perm__art { display: none; }
@media (min-width: 900px) {
  .cap-perm { grid-template-columns: minmax(0, 1fr) minmax(0, 0.85fr); align-items: start; gap: var(--s16); }
  .cap-perm__art { display: block; align-self: stretch; }
  .cap-perm__title { font-size: var(--step-4); }
}
`

function GlyphCamera() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5h3.2l1.6-2.2h8.4l1.6 2.2H21v10H3z" />
      <circle cx="12" cy="13.2" r="3.6" />
    </svg>
  )
}

function GlyphCompass() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.2 8.8 10.6 10.6 8.8 15.2l4.6-1.8z" />
    </svg>
  )
}

/** A stroke drawing of the four walls and the turn between them. */
function PlanArt() {
  return (
    <Bezel surface="sunken" coreStyle={{ padding: 'var(--s8)' }}>
      <svg viewBox="0 0 220 220" width="100%" style={{ display: 'block', height: 'auto' }} fill="none" aria-hidden="true">
        <rect x="34" y="34" width="152" height="152" stroke="var(--hairline)" />
        <g stroke="var(--clay-300)" strokeWidth="1.3">
          <path d="M34 34h152M186 34v152M186 186H34M34 186V34" strokeDasharray="0" opacity="0.5" />
          <circle cx="110" cy="110" r="9" />
          <path d="M110 101V70M119 110h31M110 119v31M101 110H70" strokeDasharray="3 5" />
        </g>
        <g fill="var(--accent)">
          <circle cx="110" cy="62" r="4" />
          <circle cx="158" cy="110" r="4" />
          <circle cx="110" cy="158" r="4" />
          <circle cx="62" cy="110" r="4" />
        </g>
        <path d="M76 76a48 48 0 0 1 68 0" stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="2 5" />
        <text x="110" y="208" textAnchor="middle" fill="var(--text-muted)" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em' }}>
          360°
        </text>
      </svg>
    </Bezel>
  )
}

/**
 * A computer: no rear camera, no compass. Uploading photos is the real path,
 * the webcam is an afterthought, and the phone is one QR code away.
 */
function DesktopPermission({ flow }: { flow: CaptureFlow }) {
  const { t } = useTranslation()
  const [qr, setQr] = useState(false)
  const failed = flow.camera.status === 'error'

  return (
    <div className="cap-perm">
      <style href="fs-cap-permission" precedence="medium">
        {CSS}
      </style>

      <Rise className="cap-perm__head">
        <Eyebrow>{t('capture.permission.eyebrow')}</Eyebrow>
        <h1 className="cap-perm__title" tabIndex={-1}>{t('capture.ux.desktopTitle')}</h1>
        <p className="cap-perm__lead">{t('capture.ux.desktopLead')}</p>

        <Bezel style={{ width: '100%' }}>
          <div className="cap-perm__rows">
            <div className="cap-perm__row">
              <span className="cap-perm__glyph">
                <GlyphCamera />
              </span>
              <span>
                <span className="cap-perm__rowTitle">{t('capture.ux.browse')}</span>
                <span className="cap-perm__rowBody">{t('capture.ux.dropBody')}</span>
              </span>
            </div>
            <hr className="cap-perm__rule" />
            <div className="cap-perm__row">
              <span className="cap-perm__glyph">
                <GlyphCompass />
              </span>
              <span>
                <span className="cap-perm__rowTitle">{t('capture.permission.motion.title')}</span>
                <span className="cap-perm__rowBody">{t('capture.ux.onPhone')}</span>
              </span>
            </div>
            <hr className="cap-perm__rule" />
            <p className="cap-perm__fine">{t('capture.permission.privacy')}</p>
          </div>
        </Bezel>

        {failed && (
          <Notice
            tone="warn"
            title={t(
              flow.camera.fault === 'denied'
                ? 'capture.errors.cameraDenied.title'
                : 'capture.errors.cameraMissing.title'
            )}
          >
            {t(
              flow.camera.fault === 'denied'
                ? 'capture.errors.cameraDenied.body'
                : 'capture.errors.cameraMissing.body'
            )}
          </Notice>
        )}

        <div className="cap-perm__actions" style={{ width: '100%' }}>
          <ArrowButton glyph="plus" onClick={flow.skipCamera}>
            {t('capture.ux.browse')}
          </ArrowButton>
          <ArrowButton quiet onClick={() => setQr(true)}>
            {t('result.actions.seeByYourselfDesktop', { defaultValue: 'Telefonda davom etish' })}
          </ArrowButton>
          <button
            type="button"
            className="cap-perm__skip"
            onClick={() => void flow.grantAndStart()}
            disabled={flow.camera.status === 'starting'}
          >
            {flow.camera.status === 'starting' ? t('capture.permission.starting') : t('capture.ux.useWebcam')}
          </button>
        </div>
      </Rise>

      <Rise className="cap-perm__art" delay={0.08}>
        <PlanArt />
      </Rise>
      <QrHandoff open={qr} onClose={() => setQr(false)} />
    </div>
  )
}

export function PermissionStep({ flow }: { flow: CaptureFlow }) {
  const desktop = useMediaQuery(DESKTOP_POINTER)
  if (desktop) return <DesktopPermission flow={flow} />
  return <PhonePermission flow={flow} />
}

function PhonePermission({ flow }: { flow: CaptureFlow }) {
  const { t } = useTranslation()
  const denied = flow.camera.fault === 'denied'
  const missing = flow.camera.fault === 'missing' || flow.camera.fault === 'unsupported'

  return (
    <div className="cap-perm">
      <style href="fs-cap-permission" precedence="medium">
        {CSS}
      </style>

      <Rise className="cap-perm__head">
        <Eyebrow>{t('capture.permission.eyebrow')}</Eyebrow>
        <h1 className="cap-perm__title" tabIndex={-1}>{t('capture.permission.title')}</h1>
        <p className="cap-perm__lead">{t('capture.permission.lead')}</p>

        <Bezel style={{ width: '100%' }}>
          <div className="cap-perm__rows">
            <div className="cap-perm__row">
              <span className="cap-perm__glyph">
                <GlyphCamera />
              </span>
              <span>
                <span className="cap-perm__rowTitle">{t('capture.permission.camera.title')}</span>
                <span className="cap-perm__rowBody">{t('capture.permission.camera.body')}</span>
              </span>
            </div>
            <hr className="cap-perm__rule" />
            <div className="cap-perm__row">
              <span className="cap-perm__glyph">
                <GlyphCompass />
              </span>
              <span>
                <span className="cap-perm__rowTitle">{t('capture.permission.motion.title')}</span>
                <span className="cap-perm__rowBody">{t('capture.permission.motion.body')}</span>
              </span>
            </div>
            <hr className="cap-perm__rule" />
            <p className="cap-perm__fine">{t('capture.permission.privacy')}</p>
          </div>
        </Bezel>

        {denied && (
          <Notice tone="err" title={t('capture.errors.cameraDenied.title')}>
            {t('capture.errors.cameraDenied.body')}
          </Notice>
        )}
        {missing && (
          <Notice tone="warn" title={t('capture.errors.cameraMissing.title')}>
            {t('capture.errors.cameraMissing.body')}
          </Notice>
        )}
        {!flow.online && (
          <Notice tone="warn" title={t('capture.errors.offline.title')}>
            {t('capture.errors.offline.shootAnyway')}
          </Notice>
        )}

        <div className="cap-perm__actions" style={{ width: '100%' }}>
          <ArrowButton
            onClick={() => {
              // Straight from the tap. Nothing awaits before the two requests.
              void flow.grantAndStart()
            }}
            disabled={flow.camera.status === 'starting'}
          >
            {flow.camera.status === 'starting'
              ? t('capture.permission.starting')
              : t('capture.permission.cta')}
          </ArrowButton>
          <button type="button" className="cap-perm__skip" onClick={flow.skipCamera}>
            {t('capture.permission.skip')}
          </button>
        </div>
      </Rise>

      <Rise className="cap-perm__art" delay={0.08}>
        <PlanArt />
      </Rise>
    </div>
  )
}
