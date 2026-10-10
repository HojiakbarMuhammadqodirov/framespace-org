/**
 * Step 6 — the wait, and the ways it can end badly.
 *
 * `/api/render` is one synchronous request: the photos go up, roughly thirty
 * seconds pass, a brief and four images come back. There is no job id, no
 * status endpoint and nothing to resume, so this screen does not promise to
 * notify anyone. It says plainly that leaving loses the result, shows which
 * stage the work is at from elapsed time, and counts the seconds honestly.
 *
 * The placeholder underneath is shaped like the result page it becomes: one
 * wide frame, four angle thumbnails, a furniture column and a palette row.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { getHealth } from '../contract'

import { ArrowButton, Bezel, Eyebrow, Notice } from '../Chrome'
import { useElapsedSeconds } from '../hooks'
import type { CaptureFlow } from '../useCaptureFlow'

const CSS = `
.cap-gen { display: grid; gap: var(--s10); }
.cap-gen__head { display: grid; gap: var(--s5); justify-items: start; }
.cap-gen__title { font-size: var(--step-3); max-width: 17ch; }
.cap-gen__stages { display: grid; gap: var(--s1); margin: 0; padding: 0; list-style: none; }
.cap-gen__stage {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  align-items: center;
  gap: var(--s3);
  padding: var(--s3) 0;
  border-bottom: 1px solid var(--hairline);
  color: var(--text-muted);
  font-size: var(--step--1);
  transition: color var(--d-base) var(--ease), opacity var(--d-base) var(--ease);
}
.cap-gen__stage:last-child { border-bottom: 0; }
.cap-gen__stage[data-state='pending'] { opacity: 0.4; }
.cap-gen__stage[data-state='live'] { color: var(--text-strong); }
.cap-gen__stage[data-state='done'] { color: var(--text); }
.cap-gen__num {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--text-muted);
}
.cap-gen__dot {
  justify-self: end;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-strong);
  background: transparent;
  transition: background-color var(--d-base) var(--ease), border-color var(--d-base) var(--ease);
}
.cap-gen__stage[data-state='live'] .cap-gen__dot {
  background: var(--accent);
  border-color: var(--accent);
  animation: cap-breathe 1800ms var(--ease) infinite;
}
.cap-gen__stage[data-state='done'] .cap-gen__dot { background: var(--ok); border-color: var(--ok); }
@keyframes cap-breathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.72); opacity: 0.55; }
}
.cap-gen__clock {
  display: flex;
  align-items: baseline;
  gap: var(--s3);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.cap-gen__seconds { font-size: var(--step-2); letter-spacing: 0.02em; color: var(--text-strong); }
.cap-gen__ghost { display: grid; gap: var(--s5); }
.cap-gen__ghostFrame {
  aspect-ratio: 16 / 10;
  border-radius: 1.25rem;
  overflow: hidden;
  background: var(--bg-sunken);
}
.cap-gen__ghostThumbs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--s2); }
.cap-gen__ghostThumb { aspect-ratio: 1 / 1; border-radius: var(--radius); overflow: hidden; }
.cap-gen__ghostRows { display: grid; gap: var(--s3); }
.cap-gen__ghostRow { display: grid; grid-template-columns: 1fr auto; gap: var(--s4); align-items: center; }
.cap-gen__ghostDots { display: flex; gap: var(--s2); }
.cap-gen__ghostDot { width: 34px; height: 34px; border-radius: var(--radius-full); overflow: hidden; }
.cap-gen__actions { display: grid; gap: var(--s3); }
.cap-gen__scan {
  position: relative;
  aspect-ratio: 16 / 10;
  border-radius: 1.25rem;
  overflow: hidden;
  background: var(--clay-900);
  isolation: isolate;
}
.cap-gen__scanImg {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  filter: saturate(0.85) contrast(1.02);
  animation: cap-gen-drift 18s var(--ease) infinite alternate;
}
.cap-gen__scanTint {
  position: absolute; inset: 0;
  background: linear-gradient(115deg, color-mix(in srgb, var(--accent) 34%, transparent), transparent 55%),
    linear-gradient(to top, color-mix(in srgb, var(--clay-900) 70%, transparent), transparent 55%);
  mix-blend-mode: multiply;
}
.cap-gen__scanGrid {
  position: absolute; inset: 0; opacity: 0.22;
  background-image: linear-gradient(to right, var(--paper) 1px, transparent 1px),
    linear-gradient(to bottom, var(--paper) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at center, #000 30%, transparent 78%);
}
.cap-gen__beam {
  position: absolute; top: 0; bottom: 0; width: 38%;
  left: -40%;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--paper) 22%, transparent) 70%, color-mix(in srgb, var(--accent) 85%, var(--paper)) 99%, transparent);
  mix-blend-mode: screen;
  animation: cap-gen-beam 3.2s cubic-bezier(.6,.05,.3,1) infinite;
}
.cap-gen__badge {
  position: absolute; left: var(--s4); bottom: var(--s4); right: var(--s4);
  display: flex; align-items: center; justify-content: space-between; gap: var(--s3);
  color: var(--paper);
  font-family: var(--font-mono); font-size: var(--step--2); letter-spacing: 0.14em; text-transform: uppercase;
}
.cap-gen__pulse {
  display: inline-flex; align-items: center; gap: var(--s2);
  padding: 6px var(--s3); border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--clay-900) 55%, transparent);
  backdrop-filter: blur(8px);
  border: 1px solid color-mix(in srgb, var(--paper) 22%, transparent);
}
.cap-gen__pulse::before {
  content: ''; width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent); animation: cap-breathe 1400ms var(--ease) infinite;
}
.cap-gen__shots { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--s2); }
.cap-gen__shot {
  position: relative; aspect-ratio: 1 / 1; border-radius: var(--radius); overflow: hidden;
  background: var(--bg-sunken);
}
.cap-gen__shot img { width: 100%; height: 100%; object-fit: cover; display: block; filter: grayscale(0.4); opacity: 0.85; }
.cap-gen__shot::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(100deg, transparent 30%, color-mix(in srgb, var(--paper) 45%, transparent) 50%, transparent 70%);
  background-size: 250% 100%;
  animation: cap-gen-shimmer 2.4s linear infinite;
  animation-delay: var(--delay, 0s);
}
.cap-gen__demo { font-size: var(--step--2); color: var(--text-muted); font-family: var(--font-mono); letter-spacing: 0.04em; line-height: 1.6; }
@keyframes cap-gen-beam { 0% { left: -40%; } 100% { left: 110%; } }
@keyframes cap-gen-drift { from { transform: scale(1.04) translate3d(-1%, 0, 0); } to { transform: scale(1.1) translate3d(1%, -1%, 0); } }
@keyframes cap-gen-shimmer { from { background-position: 150% 0; } to { background-position: -100% 0; } }
@media (prefers-reduced-motion: reduce) {
  .cap-gen__beam, .cap-gen__scanImg, .cap-gen__shot::after, .cap-gen__pulse::before { animation: none; }
}
@media (min-width: 1080px) {
  .cap-gen { grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: var(--s16); align-items: start; }
  .cap-gen__title { font-size: var(--step-4); }
}
@media (prefers-reduced-motion: reduce) {
  .cap-gen__stage[data-state='live'] .cap-gen__dot { animation: none; }
}
`

/** Visually hidden but read — inline so it does not depend on a global class. */
const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

/** Elapsed-time thresholds, from the measured ~30 s wall time of the call. */
const STAGES = [
  { key: 'upload', at: 0 },
  { key: 'read', at: 4 },
  { key: 'design', at: 11 },
  { key: 'render', at: 21 },
] as const

export function GeneratingStep({ flow }: { flow: CaptureFlow }) {
  const { t } = useTranslation()
  const seconds = useElapsedSeconds(flow.step === 'generating')
  const liveIndex = STAGES.reduce((acc, stage, i) => (seconds >= stage.at ? i : acc), 0)
  const slow = seconds > 45
  const shots = Object.values(flow.shots)
  const hero = flow.shots.front || shots[0]
  const rest = shots.filter((shot) => shot !== hero).slice(0, 4)
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

  return (
    <div className="cap-gen">
      <style href="fs-cap-generating" precedence="medium">
        {CSS}
      </style>

      <div className="cap-gen__head">
        <Eyebrow>{t('capture.generating.eyebrow')}</Eyebrow>
        <h1 className="cap-gen__title" tabIndex={-1}>{t('capture.generating.title')}</h1>

        <div className="cap-gen__clock">
          <span className="cap-gen__seconds">{String(seconds).padStart(2, '0')}s</span>
          <span>{t('capture.generating.typical')}</span>
        </div>

        {/* The list below is visual; this is the line a screen reader hears. */}
        <p aria-live="polite" style={SR_ONLY}>
          {t('capture.generating.srStage', {
            n: liveIndex + 1,
            total: STAGES.length,
            stage: t(`capture.generating.stages.${STAGES[liveIndex].key}`),
            defaultValue: '{{n}}/{{total}}-bosqich: {{stage}}',
          })}
        </p>

        <Bezel style={{ width: '100%' }}>
          <ul className="cap-gen__stages" aria-hidden="true">
            {STAGES.map((stage, i) => (
              <li
                key={stage.key}
                className="cap-gen__stage"
                data-state={i < liveIndex ? 'done' : i === liveIndex ? 'live' : 'pending'}
              >
                <span className="cap-gen__num">{String(i + 1).padStart(2, '0')}</span>
                <span>{t(`capture.generating.stages.${stage.key}`)}</span>
                <span className="cap-gen__dot" aria-hidden="true" />
              </li>
            ))}
          </ul>
        </Bezel>

        <Notice tone="warn" title={t('capture.generating.stayTitle')}>
          {t('capture.generating.stayBody')}
        </Notice>

        {slow && (
          <Notice title={t('capture.generating.slowTitle')}>
            {t('capture.generating.slowBody')}
          </Notice>
        )}

        {demo && <p className="cap-gen__demo">{t('capture.ux.demoNote')}</p>}

        <div className="cap-gen__actions" style={{ width: '100%' }}>
          <ArrowButton quiet glyph="back" onClick={flow.cancel}>
            {t('capture.ux.cancel')}
          </ArrowButton>
        </div>
      </div>

      <Bezel snug>
        <div className="cap-gen__ghost" aria-hidden="true">
          <div className="cap-gen__scan">
            {hero ? (
              <img className="cap-gen__scanImg" src={hero.dataUrl} alt="" />
            ) : (
              <div className="fs-skeleton" style={{ position: 'absolute', inset: 0 }} />
            )}
            <span className="cap-gen__scanTint" />
            <span className="cap-gen__scanGrid" />
            <span className="cap-gen__beam" />
            <span className="cap-gen__badge">
              <span className="cap-gen__pulse">
                {t('capture.ux.restyling', {
                  style: t(`styles.${flow.style}`, { defaultValue: flow.style }),
                })}
              </span>
              <span>{String(liveIndex + 1).padStart(2, '0')}/{String(STAGES.length).padStart(2, '0')}</span>
            </span>
          </div>
          {rest.length > 0 && (
            <div className="cap-gen__shots">
              {rest.map((shot, i) => (
                <div
                  className="cap-gen__shot"
                  key={shot.angleId}
                  style={{ ['--delay' as string]: `${i * 0.35}s` } as React.CSSProperties}
                >
                  <img src={shot.dataUrl} alt="" />
                </div>
              ))}
            </div>
          )}
        </div>
      </Bezel>
    </div>
  )
}

/* -------------------------------------------------------------- failure */

const FAILURE_KEY: Record<string, string> = {
  offline: 'offline',
  quota: 'quota',
  'render-failed': 'renderFailed',
  'storage-full': 'storageFull',
  'camera-denied': 'cameraDenied',
  'camera-missing': 'cameraMissing',
  'shot-failed': 'shotFailed',
  timeout: 'timeout',
  signin: 'signin',
  'daily-quota': 'dailyQuota',
  capacity: 'capacity',
}

/** Copy for kinds newer than the translation files. */
const FAILURE_FALLBACK: Record<string, { title: string; body: string }> = {
  timeout: {
    title: 'Server javob bermadi',
    body: 'Ikki daqiqa kutdik, lekin javob kelmadi. Aloqani tekshirib, qaytadan urinib koʻring — suratlar joyida.',
  },
  shotFailed: {
    title: 'Suratni oʻqib boʻlmadi',
    body: 'Qaytadan suratga oling yoki boshqa fayl tanlang.',
  },
}

export function FailedStep({ flow }: { flow: CaptureFlow }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const kind = flow.error?.kind || 'render-failed'
  const key = FAILURE_KEY[kind] || 'renderFailed'
  // Retrying cannot help until tomorrow; signing in is the only way forward.
  const canRetry = kind !== 'daily-quota' && kind !== 'capacity' && kind !== 'signin'

  return (
    <div className="cap-gen">
      <style href="fs-cap-generating" precedence="medium">
        {CSS}
      </style>

      <div className="cap-gen__head">
        <Eyebrow>{t('capture.errors.eyebrow')}</Eyebrow>
        <h1 className="cap-gen__title" tabIndex={-1}>
          {t(`capture.errors.${key}.title`, { defaultValue: FAILURE_FALLBACK[key]?.title })}
        </h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '44ch' }}>
          {t(`capture.errors.${key}.body`, { defaultValue: FAILURE_FALLBACK[key]?.body })}
        </p>

        {/* Nothing was lost: the photos are still in memory on this screen. */}
        <Notice title={t('capture.errors.keptTitle')}>{t('capture.errors.keptBody')}</Notice>

        {flow.error?.detail && (
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--step--2)',
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
            }}
          >
            {flow.error.detail}
          </p>
        )}

        <div className="cap-gen__actions" style={{ width: '100%' }}>
          {kind === 'signin' && (
            <>
              {/* The draft keeps the photos across the sign-in round trip. */}
              <ArrowButton onClick={() => navigate('/signup?next=/app/capture')}>{t('nav.signup')}</ArrowButton>
              <ArrowButton quiet onClick={() => navigate('/login?next=/app/capture')}>
                {t('limits.login')}
              </ArrowButton>
            </>
          )}
          {canRetry && (
            <ArrowButton onClick={() => void flow.generate()} disabled={!flow.online}>
              {t('common.retry')}
            </ArrowButton>
          )}
          <ArrowButton quiet glyph="back" onClick={() => flow.setStep('review')}>
            {t('capture.errors.backToShots')}
          </ArrowButton>
        </div>
      </div>
    </div>
  )
}
