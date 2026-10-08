/**
 * Step 3, the gallery path. Used on a computer, and on any phone where the
 * person chose to upload photos they already have.
 *
 * The camera screen takes over the whole viewport. This one doesn't: it sits in
 * the page column with a large drop zone and a grid of slots, one per direction
 * in the room. Several photos dropped at once fill the missing walls in order.
 * A photo dropped on a slot, or picked after clicking it, goes into that slot.
 */
import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { EASE } from '@/design/motion'
import { useAngleCopy } from '../angleCopy'
import { ArrowButton, Bezel, Eyebrow, Notice, Rise } from '../Chrome'
import type { AngleId } from '../types'
import type { CaptureFlow } from '../useCaptureFlow'

const CSS = `
.cap-up { display: grid; gap: var(--s10); }
.cap-up__head { display: grid; gap: var(--s5); justify-items: start; }
.cap-up__title { font-size: var(--step-3); max-width: 16ch; }
.cap-up__lead { color: var(--text-muted); max-width: 52ch; }
.cap-up__tally {
  display: inline-flex; align-items: center; gap: var(--s3);
  font-family: var(--font-mono); font-size: var(--step--2);
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted);
}
.cap-up__meter { display: flex; gap: 4px; }
.cap-up__meter i {
  width: 18px; height: 4px; border-radius: 2px; background: var(--hairline);
  transition: background-color var(--d-base) var(--ease);
}
.cap-up__meter i[data-on='true'] { background: var(--accent); }
.cap-up__drop {
  position: relative;
  display: grid;
  justify-items: center;
  gap: var(--s4);
  padding: var(--s12) var(--s6);
  border: 1.5px dashed var(--border-strong);
  border-radius: 1.25rem;
  background:
    radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--accent) 7%, transparent), transparent 60%),
    var(--bg-raised);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--d-base) var(--ease), background-color var(--d-base) var(--ease),
    transform var(--d-base) var(--ease);
}
.cap-up__drop:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.cap-up__drop[data-over='true'] {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 9%, var(--bg-raised));
  transform: scale(1.01);
}
.cap-up__dropIcon {
  width: 64px; height: 64px; border-radius: var(--radius-full);
  display: grid; place-items: center;
  background: var(--bg-sunken); color: var(--accent-ink);
  border: 1px solid var(--hairline);
  box-shadow: 0 10px 30px -14px color-mix(in srgb, var(--accent) 60%, transparent);
}
.cap-up__dropTitle { font-family: var(--font-display); font-size: var(--step-1); color: var(--text-strong); }
.cap-up__dropBody { font-size: var(--step--1); color: var(--text-muted); }
.cap-up__busy {
  position: absolute; inset: 0; border-radius: inherit;
  display: grid; place-items: center;
  background: color-mix(in srgb, var(--bg-raised) 82%, transparent);
  backdrop-filter: blur(3px);
  font-family: var(--font-mono); font-size: var(--step--2);
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-strong);
}
.cap-up__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s3); }
.cap-up__slot { display: grid; gap: var(--s2); min-width: 0; }
.cap-up__frame {
  position: relative; aspect-ratio: 4 / 3; overflow: hidden;
  border-radius: 1rem; background: var(--bg-sunken);
  transition: box-shadow var(--d-base) var(--ease), transform var(--d-base) var(--ease);
}
.cap-up__frame[data-over='true'] { box-shadow: 0 0 0 2px var(--accent); transform: scale(1.02); }
.cap-up__img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cap-up__empty {
  width: 100%; height: 100%;
  display: grid; place-items: center; align-content: center; gap: var(--s2);
  border: 1px dashed var(--border-strong); border-radius: 1rem;
  background: transparent; color: var(--text-muted);
  font-size: var(--step--2); cursor: pointer;
  transition: color var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease);
}
.cap-up__empty[data-required='true'] { border-color: color-mix(in srgb, var(--accent) 55%, var(--border-strong)); }
@media (hover: hover) and (pointer: fine) {
  .cap-up__empty:hover { color: var(--text-strong); border-color: var(--accent); background: color-mix(in srgb, var(--accent) 5%, transparent); }
}
.cap-up__plus {
  width: 30px; height: 30px; border-radius: var(--radius-full);
  display: grid; place-items: center; border: 1px solid currentColor;
}
.cap-up__tools {
  position: absolute; inset: auto var(--s2) var(--s2) var(--s2);
  display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--s1) var(--s2);
}
.cap-up__tool {
  min-height: 32px; padding: 0 var(--s3);
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--paper) 30%, transparent);
  background: color-mix(in srgb, var(--clay-900) 58%, transparent);
  backdrop-filter: blur(6px);
  color: var(--paper); font-size: var(--step--2); cursor: pointer;
  transition: background-color var(--d-fast) var(--ease), transform var(--d-fast) var(--ease);
}
.cap-up__tool:focus-visible { outline: 2px solid var(--paper); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) {
  .cap-up__tool:hover { background: color-mix(in srgb, var(--clay-900) 80%, transparent); }
  .cap-up__quiet:hover { color: var(--text-strong); }
}
.cap-up__tool:active { transform: scale(0.96); }
.cap-up__flag {
  position: absolute; top: var(--s2); left: var(--s2);
  padding: 3px var(--s2); border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--warn) 88%, transparent); color: var(--clay-900);
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase;
}
.cap-up__cap { display: flex; justify-content: space-between; gap: var(--s2); align-items: baseline; padding-inline: 2px; }
.cap-up__name { font-size: var(--step--1); color: var(--text-strong); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cap-up__key {
  flex: none; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--text-muted);
}
.cap-up__key[data-required='true'] { color: var(--accent-ink); }
.cap-up__actions { display: grid; gap: var(--s3); }
.cap-up__quiet {
  justify-self: start; min-height: var(--tap); padding: 0 var(--s2);
  background: none; border: 0; color: var(--text-muted); font-size: var(--step--1);
  text-decoration: underline; text-underline-offset: 4px; cursor: pointer;
}
.cap-up__file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
@media (min-width: 720px) {
  .cap-up__grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s4); }
  .cap-up__actions { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
}
@media (min-width: 1080px) {
  .cap-up { grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: var(--s16); align-items: start; }
  .cap-up__head { position: sticky; top: var(--s16); }
  .cap-up__title { font-size: var(--step-4); }
  .cap-up__grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (max-width: 479px) {
  .cap-up__drop { padding: var(--s8) var(--s5); }
  .cap-up__tool { min-height: 30px; padding: 0 var(--s2); }
}
@media (prefers-reduced-motion: reduce) {
  .cap-up__drop[data-over='true'], .cap-up__frame[data-over='true'] { transform: none; }
}
`

function hasFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types || []).includes('Files')
}

export function UploadStep({ flow }: { flow: CaptureFlow }) {
  const { t } = useTranslation()
  const copy = useAngleCopy()
  const reduced = useReducedMotion()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const targetRef = useRef<AngleId | undefined>(undefined)
  const [overZone, setOverZone] = useState(false)
  const [overSlot, setOverSlot] = useState<AngleId | null>(null)

  const angles = flow.plan.concat(flow.extras)
  const required = flow.plan.filter((a) => a.required)
  const requiredDone = required.filter((a) => flow.shots[a.id]).length
  const report = flow.uploadReport
  const problems = report ? report.heic + report.unreadable + report.overflow : 0

  const pick = (target?: AngleId) => {
    if (flow.busy) return
    targetRef.current = target
    inputRef.current?.click()
  }

  const ingest = (files: FileList | File[] | null | undefined, target?: AngleId) => {
    const list = files ? Array.from(files) : []
    if (!list.length || flow.busy) return
    void flow.shootFromFiles(list, target)
  }

  return (
    <div className="cap-up">
      <style href="fs-cap-upload" precedence="medium">
        {CSS}
      </style>

      <Rise className="cap-up__head">
        <Eyebrow>{t('capture.shoot.addPhotos', { defaultValue: 'Suratlarni qoʻshing' })}</Eyebrow>
        <h1 className="cap-up__title" tabIndex={-1}>
          {t('capture.ux.uploadTitle')}
        </h1>
        <p className="cap-up__lead">{t('capture.ux.uploadLead')}</p>
        <span className="cap-up__tally" role="status">
          <span className="cap-up__meter" aria-hidden="true">
            {required.map((a) => (
              <i key={a.id} data-on={Boolean(flow.shots[a.id])} />
            ))}
          </span>
          {t('capture.review.required')} · {requiredDone}/{required.length}
        </span>

        {report && problems > 0 && (
          <Notice
            tone="warn"
            title={t('capture.errors.shotFailed.title', { defaultValue: 'Suratni oʻqib boʻlmadi' })}
            onDismiss={flow.dismissUploadReport}
            dismissLabel={t('nav.close', { defaultValue: 'Yopish' })}
          >
            {[
              report.heic ? t('capture.ux.heic') : '',
              report.unreadable ? t('capture.ux.unreadable', { count: report.unreadable }) : '',
              report.overflow ? t('capture.ux.tooMany', { count: report.overflow }) : '',
            ]
              .filter(Boolean)
              .join(' ')}
          </Notice>
        )}

        <div className="cap-up__actions" style={{ width: '100%' }}>
          <ArrowButton onClick={() => flow.setStep('plan')} disabled={!flow.canContinue || flow.busy}>
            {t('capture.review.cta')}
          </ArrowButton>
        </div>
        <button type="button" className="cap-up__quiet" onClick={() => void flow.switchToCamera()}>
          {t('capture.shoot.useCamera', { defaultValue: 'Kameradan foydalanish' })}
        </button>
      </Rise>

      <Rise delay={0.06} style={{ display: 'grid', gap: 'var(--s8)' }}>
        <div
          className="cap-up__drop"
          role="button"
          tabIndex={0}
          data-over={overZone}
          aria-busy={flow.busy}
          aria-label={t('capture.ux.browse')}
          onClick={() => pick()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              pick()
            }
          }}
          onDragEnter={(event) => {
            if (!hasFiles(event)) return
            event.preventDefault()
            setOverZone(true)
          }}
          onDragOver={(event) => {
            if (!hasFiles(event)) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
            setOverZone(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setOverZone(false)
            ingest(event.dataTransfer?.files)
          }}
        >
          <span className="cap-up__dropIcon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
              <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
            </svg>
          </span>
          <span className="cap-up__dropTitle">
            {overZone ? t('capture.ux.dragActive') : t('capture.ux.dropTitle')}
          </span>
          <span className="cap-up__dropBody">{t('capture.ux.dropBody')}</span>
          {flow.busy && (
            <span className="cap-up__busy" aria-live="polite">
              {t('capture.ux.processing')}
            </span>
          )}
        </div>

        <Bezel snug>
          <div className="cap-up__grid">
            {angles.map((angle) => {
              const shot = flow.shots[angle.id]
              const label = copy(angle).label
              return (
                <div className="cap-up__slot" key={angle.id}>
                  <div
                    className="cap-up__frame"
                    data-over={overSlot === angle.id}
                    onDragOver={(event) => {
                      if (!hasFiles(event)) return
                      event.preventDefault()
                      event.stopPropagation()
                      if (overSlot !== angle.id) setOverSlot(angle.id)
                    }}
                    onDragLeave={() => setOverSlot((cur) => (cur === angle.id ? null : cur))}
                    onDrop={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setOverSlot(null)
                      ingest(event.dataTransfer?.files, angle.id)
                    }}
                  >
                    <AnimatePresence initial={false} mode="wait">
                      {shot ? (
                        <motion.div
                          key={`${angle.id}:${shot.takenAt}`}
                          style={{ position: 'absolute', inset: 0 }}
                          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: reduced ? 0 : 0.36, ease: EASE }}
                        >
                          <img className="cap-up__img" src={shot.dataUrl} alt={label} />
                          {shot.flags.length > 0 && (
                            <span className="cap-up__flag">{t(`capture.quality.${shot.flags[0]}.tag`)}</span>
                          )}
                          <span className="cap-up__tools">
                            <button type="button" className="cap-up__tool" onClick={() => pick(angle.id)} disabled={flow.busy}>
                              {t('capture.ux.replace')}
                            </button>
                            <button
                              type="button"
                              className="cap-up__tool"
                              onClick={() => flow.removeShot(angle.id)}
                              disabled={flow.busy}
                              aria-label={`${t('capture.ux.remove')} — ${label}`}
                            >
                              ✕
                            </button>
                          </span>
                        </motion.div>
                      ) : (
                        <motion.button
                          key={`${angle.id}:empty`}
                          type="button"
                          className="cap-up__empty"
                          data-required={angle.required}
                          onClick={() => pick(angle.id)}
                          disabled={flow.busy}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: reduced ? 0 : 0.2 }}
                        >
                          <span className="cap-up__plus" aria-hidden="true">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                              <path d="M8 3v10M3 8h10" />
                            </svg>
                          </span>
                          {t('capture.ux.slotEmpty')}
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="cap-up__cap">
                    <span className="cap-up__name">{label}</span>
                    <span className="cap-up__key" data-required={angle.required && !shot}>
                      {shot
                        ? t('capture.shoot.done', { defaultValue: 'olindi' })
                        : angle.required
                          ? t('capture.review.required')
                          : t('capture.review.optional')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </Bezel>
      </Rise>

      <input
        ref={inputRef}
        className="cap-up__file"
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = event.target.files ? Array.from(event.target.files) : []
          const target = targetRef.current
          targetRef.current = undefined
          event.target.value = ''
          ingest(files, target)
        }}
      />
    </div>
  )
}
