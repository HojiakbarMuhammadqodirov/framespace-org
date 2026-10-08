/**
 * Step 3 — the guided shoot.
 *
 * Full-bleed preview inside the same double bezel as every other surface: the
 * screen itself is the outer shell, the rounded video is the core. The compass
 * ring sits over it and turns with the room; the shutter is bottom-centre where
 * a thumb already is.
 *
 * Heading, pitch, roll and timestamp are recorded with every frame. The render
 * endpoint ignores all of it — it is kept on the device for the panorama step.
 */
import { useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { EASE } from '@/design/motion'
import { useAngleCopy } from '../angleCopy'
import { ArrowButton, Bezel, Notice } from '../Chrome'
import { CompassRing } from '../CompassRing'
import type { CaptureFlow } from '../useCaptureFlow'

const CSS = `
.cap-shoot {
  position: fixed;
  inset: 0;
  z-index: 70;
  height: 100dvh;
  padding: var(--s2);
  background: var(--bg-sunken);
  display: grid;
}
.cap-shoot__frame {
  --cap-sheen: color-mix(in srgb, var(--white) 40%, transparent);
  position: relative;
  overflow: hidden;
  border-radius: 1.625rem;
  background: var(--clay-900);
  box-shadow: inset 0 1px 0 var(--cap-sheen);
  display: grid;
}
.cap-shoot__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cap-shoot__guides { position: absolute; inset: 0; pointer-events: none; opacity: 0.5; }
.cap-shoot__scrim {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
}
.cap-shoot__scrim--top {
  top: 0;
  height: 34%;
  background: linear-gradient(to bottom, color-mix(in srgb, var(--clay-900) 72%, transparent), transparent);
}
.cap-shoot__scrim--bottom {
  bottom: 0;
  height: 46%;
  background: linear-gradient(to top, color-mix(in srgb, var(--clay-900) 86%, transparent), transparent);
}
.cap-shoot__ui {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding: max(var(--s4), env(safe-area-inset-top)) var(--s4) max(var(--s4), env(safe-area-inset-bottom));
  color: var(--paper);
}
.cap-shoot__bar { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); }
.cap-shoot__icon {
  width: var(--tap);
  height: var(--tap);
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--paper) 28%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--clay-900) 45%, transparent);
  backdrop-filter: blur(8px);
  color: var(--paper);
  cursor: pointer;
  transition: transform var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease);
}
.cap-shoot__tally {
  min-width: var(--tap);
  height: var(--tap);
  padding: 0 var(--s3);
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--paper) 28%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--clay-900) 45%, transparent);
  backdrop-filter: blur(8px);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.08em;
  color: var(--paper);
}
.cap-shoot__tally[data-done='true'] { background: var(--accent-ink); border-color: var(--accent-ink); }
@media (hover: hover) and (pointer: fine) {
  .cap-shoot__icon:hover { background: color-mix(in srgb, var(--clay-900) 65%, transparent); }
}
.cap-shoot__icon:active { transform: scale(0.94); }
.cap-shoot__title { text-align: center; display: grid; gap: 2px; }
.cap-shoot__angle { margin: 0; font-family: var(--font-display); font-size: var(--step-1); font-weight: inherit; line-height: 1.1; color: inherit; }
.cap-shoot__angle:focus { outline: none; }
.cap-shoot__count {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.72;
}
.cap-shoot__stage { display: grid; place-items: center; align-content: center; gap: var(--s5); }
.cap-shoot__hint {
  max-width: 28ch;
  text-align: center;
  font-size: var(--step--1);
  line-height: 1.5;
  color: color-mix(in srgb, var(--paper) 86%, transparent);
  padding: var(--s2) var(--s4);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--clay-900) 42%, transparent);
  backdrop-filter: blur(6px);
}
.cap-shoot__foot { display: grid; gap: var(--s4); }
.cap-shoot__strip {
  display: flex;
  gap: var(--s2);
  overflow-x: auto;
  padding-bottom: var(--s1);
  scrollbar-width: none;
}
.cap-shoot__strip::-webkit-scrollbar { display: none; }
.cap-shoot__pill {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  min-height: var(--tap);
  padding: 0 var(--s4);
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--paper) 26%, transparent);
  background: color-mix(in srgb, var(--clay-900) 40%, transparent);
  backdrop-filter: blur(6px);
  color: color-mix(in srgb, var(--paper) 82%, transparent);
  font-size: var(--step--2);
  white-space: nowrap;
  cursor: pointer;
  transition: transform var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease),
    color var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease);
}
.cap-shoot__pill[data-state='done'] {
  background: var(--accent-ink);
  border-color: var(--accent-ink);
  color: var(--paper);
}
.cap-shoot__pill[data-state='active'] {
  background: var(--paper);
  border-color: var(--paper);
  color: var(--clay-900);
}
.cap-shoot__pill:active { transform: scale(0.96); }
.cap-shoot__opt {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.66;
}
.cap-shoot__controls {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--s4);
}
.cap-shoot__shutter {
  justify-self: center;
  width: 72px;
  height: 72px;
  border-radius: var(--radius-full);
  border: 2px solid color-mix(in srgb, var(--paper) 88%, transparent);
  background: transparent;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform var(--d-fast) var(--ease);
}
.cap-shoot__shutter:active { transform: scale(0.92); }
.cap-shoot__shutter[disabled] { opacity: 0.45; pointer-events: none; }
.cap-shoot__shutterCore {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--paper);
  transition: transform var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease);
}
.cap-shoot__shutter[data-aligned='true'] .cap-shoot__shutterCore { background: var(--ok); }
.cap-shoot__shutter[aria-busy='true'] { opacity: 1; }
.cap-shoot__shutter[aria-busy='true'] .cap-shoot__shutterCore {
  transform: scale(0.62);
  opacity: 0.7;
  animation: cap-shutter-busy 900ms var(--ease) infinite alternate;
}
@keyframes cap-shutter-busy {
  from { transform: scale(0.62); }
  to { transform: scale(0.48); }
}
.cap-shoot__side { display: grid; justify-items: start; gap: 2px; }
.cap-shoot__side--right { justify-items: end; }
.cap-shoot__link {
  min-height: var(--tap);
  display: inline-flex;
  align-items: center;
  padding: 0 var(--s2);
  background: none;
  border: 0;
  color: var(--paper);
  font-size: var(--step--1);
  cursor: pointer;
  opacity: 0.85;
  transition: opacity var(--d-fast) var(--ease);
}
@media (hover: hover) and (pointer: fine) {
  .cap-shoot__link:hover { opacity: 1; }
}
.cap-shoot__link[disabled] { opacity: 0.35; pointer-events: none; }
.cap-shoot__file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

.cap-shoot__sheet {
  position: absolute;
  inset: auto var(--s2) var(--s2);
  z-index: 6;
  background: color-mix(in srgb, var(--bg-sunken) 92%, transparent);
  backdrop-filter: blur(14px);
  border: 1px solid var(--hairline);
  border-radius: 1.5rem;
  padding: var(--s2);
}
.cap-shoot__sheetCore {
  background: var(--bg-raised);
  border-radius: 1.25rem;
  padding: var(--s5);
  display: grid;
  gap: var(--s4);
  color: var(--text);
}
.cap-shoot__preview {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: var(--s4);
  align-items: start;
}
.cap-shoot__previewImg {
  width: 84px;
  height: 84px;
  object-fit: cover;
  border-radius: var(--radius);
  border: 1px solid var(--hairline);
}
.cap-shoot__sheetActions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); }
.cap-shoot__fault {
  position: absolute;
  inset: var(--s4);
  z-index: 4;
  display: grid;
  align-content: center;
  gap: var(--s4);
  padding: var(--s6);
  border-radius: 1.25rem;
  background: var(--bg-raised);
  color: var(--text);
  overflow-y: auto;
}
.cap-shoot__panel {
  position: absolute;
  inset: max(var(--s3), env(safe-area-inset-top)) var(--s3) max(var(--s3), env(safe-area-inset-bottom));
  z-index: 4;
  display: grid;
  align-content: center;
  overflow-y: auto;
  color: var(--text);
  /* Taps around the card fall through to the bar beneath (its Back button). */
  pointer-events: none;
}
.cap-shoot__panel > * { pointer-events: auto; }
.cap-shoot__panelBody { display: grid; gap: var(--s5); }
.cap-shoot__panelTitle { font-size: var(--step-2); max-width: 16ch; }
.cap-shoot__panelTitle:focus { outline: none; }
.cap-shoot__checks { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.cap-shoot__check {
  display: grid;
  grid-template-columns: 22px 1fr auto;
  align-items: center;
  gap: var(--s3);
  min-height: var(--tap);
  border-bottom: 1px solid var(--hairline);
  font-size: var(--step--1);
  color: var(--text-muted);
}
.cap-shoot__check:last-child { border-bottom: 0; }
.cap-shoot__check[data-done='true'] { color: var(--text-strong); }
.cap-shoot__checkMark {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-full);
  color: var(--paper);
}
.cap-shoot__check[data-done='true'] .cap-shoot__checkMark { background: var(--ok); border-color: var(--ok); }
.cap-shoot__checkKey {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.cap-shoot__quiet {
  justify-self: start;
  min-height: var(--tap);
  padding: 0 var(--s2);
  background: none;
  border: 0;
  color: var(--text-muted);
  font-size: var(--step--1);
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
}
.cap-shoot__quiet:focus-visible { color: var(--text-strong); }
@media (hover: hover) and (pointer: fine) {
  .cap-shoot__quiet:hover { color: var(--text-strong); }
}
.cap-shoot__toast { position: relative; z-index: 5; }
.cap-shoot__toast .cap-note { background: var(--bg-raised); color: var(--text); }
@media (min-width: 900px) {
  .cap-shoot { padding: var(--s4); }
  .cap-shoot__frame { max-width: 720px; margin-inline: auto; width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .cap-shoot__icon:active,
  .cap-shoot__shutter:active,
  .cap-shoot__pill:active { transform: none; }
  .cap-shoot__shutter[aria-busy='true'] .cap-shoot__shutterCore { animation: none; }
}
`

function Guides() {
  return (
    <svg className="cap-shoot__guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <g stroke="var(--paper)" strokeWidth="0.15" opacity="0.5">
        <path d="M33.3 6 V94 M66.6 6 V94 M6 33.3 H94 M6 66.6 H94" />
      </g>
      <g stroke="var(--paper)" strokeWidth="0.35" opacity="0.8" fill="none">
        <path d="M6 14 V6 H14 M86 6 H94 V14 M94 86 V94 H86 M14 94 H6 V86" />
      </g>
    </svg>
  )
}

export function ShootStep({ flow }: { flow: CaptureFlow }) {
  const { t } = useTranslation()
  const copy = useAngleCopy()
  const reduced = useReducedMotion()
  /** `capture="environment"` — opens the camera app: "Take photo". */
  const cameraFileRef = useRef<HTMLInputElement | null>(null)
  /** No `capture`, `multiple` — the gallery, several photos at once. */
  const galleryRef = useRef<HTMLInputElement | null>(null)

  const active =
    flow.plan.concat(flow.extras).find((a) => a.id === flow.activeId) || flow.plan[0]
  const activeCopy = copy(active)
  const doneCount = flow.captured.length
  const total = flow.plan.length
  const required = flow.plan.filter((a) => a.required)
  const requiredDone = required.filter((a) => flow.shots[a.id]).length
  const aligned =
    flow.relativeHeading != null && Math.abs(((active.yaw - flow.relativeHeading + 540) % 360) - 180) <= 12
  const cameraDown = flow.camera.status !== 'live'
  const upload = flow.mode === 'upload'
  // In camera mode an idle camera is not a fault — it is a reload, or a return
  // from the review grid after the request stopped it. Offer to turn it on.
  const cameraOff = !upload && flow.camera.status === 'idle'
  const cameraFault = !upload && flow.camera.status === 'error'
  const shotError = flow.error?.kind === 'shot-failed' ? flow.error : null
  /** The neutral panel covers the preview; its title is then the page's h1. */
  const panel = upload || cameraOff

  const openGallery = () => galleryRef.current?.click()
  const dismissError = () => flow.setError(null)

  const stateLabel = (angleId: string, isRequired: boolean) =>
    flow.shots[angleId]
      ? t('capture.shoot.done', { defaultValue: 'olindi' })
      : isRequired
        ? t('capture.review.required')
        : t('capture.review.optional')

  const shotErrorNotice = shotError && (
    <div className="cap-shoot__toast">
      <Notice
        tone="err"
        title={t('capture.errors.shotFailed.title', { defaultValue: 'Suratni oʻqib boʻlmadi' })}
        onDismiss={dismissError}
        dismissLabel={t('nav.close', { defaultValue: 'Yopish' })}
      >
        {t('capture.errors.shotFailed.body', {
          defaultValue: 'Qaytadan suratga oling yoki boshqa fayl tanlang.',
        })}
      </Notice>
    </div>
  )

  return (
    <div className="cap-shoot">
      <style href="fs-cap-shoot" precedence="medium">
        {CSS}
      </style>

      <div className="cap-shoot__frame">
        <video
          ref={flow.camera.videoRef}
          className="cap-shoot__video"
          playsInline
          muted
          autoPlay
          aria-label={t('capture.shoot.preview')}
        />
        <Guides />
        <span className="cap-shoot__scrim cap-shoot__scrim--top" aria-hidden="true" />
        <span className="cap-shoot__scrim cap-shoot__scrim--bottom" aria-hidden="true" />

        <div className="cap-shoot__ui">
          <div className="cap-shoot__bar">
            <button
              type="button"
              className="cap-shoot__icon"
              onClick={() => flow.setStep('room')}
              aria-label={t('common.back')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 3 L5 8 L10 13" />
              </svg>
            </button>

            <div className="cap-shoot__title">
              {panel ? (
                <span className="cap-shoot__angle">{activeCopy.label}</span>
              ) : (
                <h1 className="cap-shoot__angle" tabIndex={-1}>
                  {activeCopy.label}
                </h1>
              )}
              <span className="cap-shoot__count">
                {t('capture.shoot.counter', { done: doneCount, total })}
              </span>
            </div>

            {/* Required walls done / required — the one number that decides
                whether the render can start. */}
            <span
              className="cap-shoot__tally"
              data-done={requiredDone === required.length}
              role="status"
              aria-label={`${t('capture.review.required')}: ${requiredDone}/${required.length}`}
            >
              {requiredDone}/{required.length}
            </span>
          </div>

          {/* Covered by the panel: out of reach for taps, tab and screen readers. */}
          <div className="cap-shoot__stage" inert={panel}>
            {!upload && (
              <CompassRing
                plan={flow.plan}
                captured={flow.captured}
                activeId={flow.activeId}
                relativeHeading={flow.relativeHeading}
                cameraPitch={flow.cameraPitch}
                source={flow.orientation.source}
                size={200}
                labels={{
                  align: t('capture.shoot.compass.align'),
                  left: t('capture.shoot.compass.left'),
                  right: t('capture.shoot.compass.right'),
                  noCompass: t('capture.shoot.compass.none'),
                }}
              />
            )}
            <p className="cap-shoot__hint">{activeCopy.hint}</p>
            {!upload && shotErrorNotice}
          </div>

          <div className="cap-shoot__foot" inert={panel}>
            <div className="cap-shoot__strip">
              {flow.plan.concat(flow.extras).map((angle) => {
                const done = Boolean(flow.shots[angle.id])
                const isActive = angle.id === flow.activeId
                const state = done ? 'done' : isActive ? 'active' : 'idle'
                const label = copy(angle).label
                return (
                  <button
                    key={angle.id}
                    type="button"
                    className="cap-shoot__pill"
                    data-state={state}
                    aria-pressed={isActive}
                    aria-label={`${label} — ${stateLabel(angle.id, angle.required)}`}
                    onClick={() => flow.setActiveId(angle.id)}
                  >
                    {label}
                    {!angle.required && !done && (
                      <span className="cap-shoot__opt" aria-hidden="true">
                        {t('capture.shoot.optional', { defaultValue: 'ixtiyoriy' })}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="cap-shoot__controls">
              <span className="cap-shoot__side">
                <button type="button" className="cap-shoot__link" onClick={openGallery} disabled={flow.busy}>
                  {t('capture.shoot.fromGallery', { defaultValue: 'Galereyadan' })}
                </button>
              </span>

              <button
                type="button"
                className="cap-shoot__shutter"
                data-aligned={aligned}
                onClick={flow.shoot}
                disabled={flow.busy || cameraDown}
                aria-busy={flow.busy}
                aria-label={t('capture.shoot.shutter')}
              >
                <span className="cap-shoot__shutterCore" />
              </button>

              <span className="cap-shoot__side cap-shoot__side--right">
                <button
                  type="button"
                  className="cap-shoot__link"
                  onClick={() => flow.setStep('review')}
                  disabled={doneCount === 0}
                >
                  {t('capture.shoot.review')}
                </button>
              </span>
            </div>
          </div>
        </div>

        <input
          ref={cameraFileRef}
          className="cap-shoot__file"
          type="file"
          accept="image/*"
          capture="environment"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void flow.shootFromFile(file)
            event.target.value = ''
          }}
        />
        <input
          ref={galleryRef}
          className="cap-shoot__file"
          type="file"
          accept="image/*"
          multiple
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const files = event.target.files ? Array.from(event.target.files) : []
            if (files.length) void flow.shootFromFiles(files)
            event.target.value = ''
          }}
        />

        {/* The gallery path, or a camera that is simply switched off. Neutral,
            not an error: nothing has gone wrong. */}
        {panel && (
          <div className="cap-shoot__panel">
            <Bezel>
              <div className="cap-shoot__panelBody">
                <h1 className="cap-shoot__panelTitle" tabIndex={-1}>
                  {upload
                    ? t('capture.shoot.addPhotos', { defaultValue: 'Suratlarni qoʻshing' })
                    : t('capture.permission.camera.title')}
                </h1>
                <p style={{ fontSize: 'var(--step--1)', color: 'var(--text-muted)' }}>
                  {upload ? t('capture.review.moreBody') : t('capture.permission.camera.body')}
                </p>

                <ul className="cap-shoot__checks" aria-label={t('capture.review.required')}>
                  {flow.plan.map((angle) => {
                    const done = Boolean(flow.shots[angle.id])
                    return (
                      <li key={angle.id} className="cap-shoot__check" data-done={done}>
                        <span className="cap-shoot__checkMark" aria-hidden="true">
                          {done && (
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />
                            </svg>
                          )}
                        </span>
                        <span>{copy(angle).label}</span>
                        <span className="cap-shoot__checkKey">{stateLabel(angle.id, angle.required)}</span>
                      </li>
                    )
                  })}
                </ul>

                {shotErrorNotice}

                {upload ? (
                  <>
                    <ArrowButton glyph="plus" onClick={openGallery} disabled={flow.busy} aria-busy={flow.busy}>
                      {t('capture.shoot.addPhotos', { defaultValue: 'Suratlarni qoʻshing' })}
                    </ArrowButton>
                    {doneCount > 0 && (
                      <ArrowButton quiet onClick={() => flow.setStep('review')} disabled={flow.busy}>
                        {t('capture.shoot.review')} · {requiredDone}/{required.length}
                      </ArrowButton>
                    )}
                    <button type="button" className="cap-shoot__quiet" onClick={() => void flow.switchToCamera()}>
                      {t('capture.shoot.useCamera', { defaultValue: 'Kameradan foydalanish' })}
                    </button>
                  </>
                ) : (
                  <>
                    <ArrowButton
                      onClick={() => void flow.switchToCamera()}
                      disabled={flow.camera.status === 'starting'}
                    >
                      {flow.camera.status === 'starting'
                        ? t('capture.permission.starting')
                        : t('capture.permission.cta')}
                    </ArrowButton>
                    <ArrowButton quiet glyph="plus" onClick={openGallery} disabled={flow.busy}>
                      {t('capture.shoot.fromGallery', { defaultValue: 'Galereyadan' })}
                    </ArrowButton>
                  </>
                )}
              </div>
            </Bezel>
          </div>
        )}

        {/* The camera was refused or is not there — the camera app and the
            gallery keep the flow alive either way. */}
        {cameraFault && (
          <div className="cap-shoot__fault">
            <Notice
              tone="err"
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
            {shotErrorNotice}
            <ArrowButton
              glyph="plus"
              onClick={() => {
                flow.camera.stop()
                flow.setMode('upload')
              }}
              disabled={flow.busy}
            >
              {t('capture.shoot.fromGallery', { defaultValue: 'Galereyadan' })}
            </ArrowButton>
            <ArrowButton quiet glyph="plus" onClick={() => cameraFileRef.current?.click()} disabled={flow.busy}>
              {t('capture.shoot.fromFile')}
            </ArrowButton>
            <ArrowButton quiet glyph="back" onClick={() => void flow.camera.start()}>
              {t('common.retry')}
            </ArrowButton>
          </div>
        )}

        {/* Quality gate: warn, offer a retake, never decide for the user. */}
        <AnimatePresence>
          {flow.pending && (
            <motion.div
              className="cap-shoot__sheet"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: reduced ? 0 : 0.28, ease: EASE }}
            >
              <div className="cap-shoot__sheetCore">
                <div className="cap-shoot__preview">
                  <img
                    className="cap-shoot__previewImg"
                    src={flow.pending.dataUrl}
                    alt={copy(active).label}
                  />
                  <span>
                    <strong style={{ display: 'block', fontSize: 'var(--step-0)', color: 'var(--text-strong)' }}>
                      {t(`capture.quality.${flow.pending.flags[0]}.title`)}
                    </strong>
                    <span style={{ display: 'block', marginTop: 'var(--s1)', fontSize: 'var(--step--1)', color: 'var(--text-muted)' }}>
                      {t(`capture.quality.${flow.pending.flags[0]}.body`)}
                    </span>
                  </span>
                </div>
                <div className="cap-shoot__sheetActions">
                  <ArrowButton quiet glyph="back" onClick={flow.discardPending}>
                    {t('capture.quality.retake')}
                  </ArrowButton>
                  <ArrowButton glyph="check" onClick={flow.keepPending}>
                    {t('capture.quality.keep')}
                  </ArrowButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
