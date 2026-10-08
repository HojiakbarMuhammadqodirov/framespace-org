/**
 * Step 4 — look at what you shot.
 *
 * Four walls are not a recommendation, they are the endpoint's 400: `front`,
 * `right`, `back` and `left` all have to be there. The grid says which of them
 * is still missing in plain words rather than leaving the user to discover it
 * from a server error thirty seconds later.
 */
import { useTranslation } from 'react-i18next'

import { useAngleCopy } from '../angleCopy'
import { ArrowButton, Bezel, Eyebrow, Notice, Rise, StepRail } from '../Chrome'
import { RECOMMENDED_ANGLE_IDS } from '../contract'
import type { CaptureFlow } from '../useCaptureFlow'

const CSS = `
.cap-rev { display: grid; gap: var(--s8); }
.cap-rev__head { display: grid; gap: var(--s5); justify-items: start; }
.cap-rev__title { font-size: var(--step-3); max-width: 16ch; }
.cap-rev__lead { color: var(--text-muted); max-width: 46ch; }
.cap-rev__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s4); }
.cap-rev__tile { position: relative; }
.cap-rev__frame {
  position: relative;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  border-radius: 1.25rem;
  background: var(--bg-sunken);
}
.cap-rev__img { width: 100%; height: 100%; object-fit: cover; }
.cap-rev__empty {
  display: grid;
  place-items: center;
  height: 100%;
  border: 1px dashed var(--border-strong);
  border-radius: 1.25rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.cap-rev__cap {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s2);
  padding: var(--s3) var(--s1) 0;
}
.cap-rev__name { font-size: var(--step--1); color: var(--text-strong); }
.cap-rev__deg {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--text-muted);
}
.cap-rev__flag {
  position: absolute;
  top: var(--s3);
  left: var(--s3);
  padding: 3px var(--s2);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--warn) 88%, transparent);
  color: var(--clay-900);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.cap-rev__retake {
  position: absolute;
  right: var(--s3);
  bottom: var(--s3);
  min-height: 34px;
  padding: 0 var(--s4);
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--paper) 34%, transparent);
  background: color-mix(in srgb, var(--clay-900) 55%, transparent);
  backdrop-filter: blur(6px);
  color: var(--paper);
  font-size: var(--step--2);
  cursor: pointer;
  transition: transform var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease);
}
.cap-rev__retake:hover { background: color-mix(in srgb, var(--clay-900) 78%, transparent); }
.cap-rev__retake:active { transform: scale(0.96); }
.cap-rev__actions { display: grid; gap: var(--s3); }
@media (min-width: 720px) {
  .cap-rev__grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 1080px) {
  .cap-rev { grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: var(--s16); align-items: start; }
  .cap-rev__title { font-size: var(--step-4); }
}
@media (prefers-reduced-motion: reduce) {
  .cap-rev__retake:active { transform: none; }
}
`

export function ReviewStep({ flow }: { flow: CaptureFlow }) {
  const { t } = useTranslation()
  const copy = useAngleCopy()

  const missing = flow.missingRequired
  const shotCount = flow.captured.length
  const recommended = RECOMMENDED_ANGLE_IDS.length
  const shortOfRecommended = Math.max(0, recommended - shotCount)

  return (
    <div className="cap-rev">
      <style href="fs-cap-review" precedence="medium">
        {CSS}
      </style>

      <Rise className="cap-rev__head">
        <Eyebrow>{t('capture.review.eyebrow')}</Eyebrow>
        <h1 className="cap-rev__title" tabIndex={-1}>{t('capture.review.title')}</h1>
        <p className="cap-rev__lead">{t('capture.review.lead')}</p>
        <StepRail
          total={recommended}
          current={shotCount}
          label={t('capture.shoot.counter', { done: shotCount, total: recommended })}
        />

        {missing.length > 0 && (
          <Notice tone="warn" title={t('capture.review.missingTitle')}>
            {t('capture.review.missingBody', {
              angles: missing
                .map((id) => {
                  const angle = flow.plan.find((a) => a.id === id)
                  return angle ? copy(angle).label : id
                })
                .join(', '),
            })}
          </Notice>
        )}
        {missing.length === 0 && shortOfRecommended > 0 && (
          <Notice title={t('capture.review.moreTitle', { count: shortOfRecommended })}>
            {t('capture.review.moreBody')}
          </Notice>
        )}
      </Rise>

      <Rise delay={0.06}>
        <Bezel snug>
          <div className="cap-rev__grid">
            {flow.plan.concat(flow.extras).map((angle) => {
              const shot = flow.shots[angle.id]
              const label = copy(angle).label
              return (
                <div className="cap-rev__tile" key={angle.id}>
                  <div className="cap-rev__frame">
                    {shot ? (
                      <>
                        <img className="cap-rev__img" src={shot.dataUrl} alt={label} />
                        {shot.flags.length > 0 && (
                          <span className="cap-rev__flag">
                            {t(`capture.quality.${shot.flags[0]}.tag`)}
                          </span>
                        )}
                        <button
                          type="button"
                          className="cap-rev__retake"
                          onClick={() => flow.retake(angle.id)}
                        >
                          {t('capture.review.retake')}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="cap-rev__empty"
                        style={{ width: '100%', background: 'transparent', cursor: 'pointer' }}
                        onClick={() => {
                          flow.setActiveId(angle.id)
                          flow.setStep('shoot')
                        }}
                      >
                        {angle.required ? t('capture.review.required') : t('capture.review.optional')}
                      </button>
                    )}
                  </div>
                  <div className="cap-rev__cap">
                    <span className="cap-rev__name">{label}</span>
                    <span className="cap-rev__deg">
                      {shot?.relativeHeading != null
                        ? `${Math.round(shot.relativeHeading)}°`
                        : `·${angle.yaw}°`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </Bezel>

        <div className="cap-rev__actions" style={{ marginTop: 'var(--s6)' }}>
          <ArrowButton onClick={() => flow.setStep('plan')} disabled={!flow.canContinue}>
            {t('capture.review.cta')}
          </ArrowButton>
          <ArrowButton quiet glyph="back" onClick={() => flow.setStep('shoot')}>
            {t('capture.review.keepShooting')}
          </ArrowButton>
        </div>
      </Rise>
    </div>
  )
}
