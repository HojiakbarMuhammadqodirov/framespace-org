import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/ui/Button'
import { Cluster, GlyphPlay, GlyphStop, GlyphTarget, Readout } from './Chrome'
import { BubbleLevel } from './BubbleLevel'
import { HeadingTape } from './HeadingTape'
import { NudgeDial } from './NudgeDial'
import { formatHeading, formatSigned } from './orientation'
import { HEADING_TOLERANCE, PITCH_TOLERANCE, type Alignment } from './useAlignment'
import type { LiveOrientation, LiveReadout } from './useLiveOrientation'

/**
 * The bottom deck: everything you touch while standing in the room.
 *
 * One double bezel, fixed to the bottom of the viewport, `backdrop-filter` on
 * the shell only. Inside, in the order you need them:
 *
 *   heading tape → bubble level → read-outs → nudge → recalibrate → Start
 *
 * Start is gated. It does not grey out politely — it says which way to turn,
 * in words, and the tape and the level both show the same thing at the same
 * time. Within ±10° of heading and ±10° of pitch, it unlocks.
 */

const CSS = `
.fsl-deck {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  padding: var(--s3) var(--s4) calc(var(--s4) + env(safe-area-inset-bottom, 0px));
  display: grid;
  gap: var(--s3);
  pointer-events: none;
}
.fsl-deck > * { pointer-events: auto; }
.fsl-deck__body { display: grid; gap: var(--s3); padding: var(--s3) var(--s4) var(--s4); }
.fsl-deck__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3) var(--s4);
}
/* Running: the deck is down to a bar. Everything that was there to help you
   aim has done its job, and the room is the only thing worth the screen. */
.fsl-deck__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
  padding: var(--s2) var(--s2) var(--s2) var(--s5);
}
.fsl-deck__guide {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: center;
  min-height: 1.1em;
  transition: color var(--d-base) var(--ease);
}
.fsl-deck[data-aligned='true'] .fsl-deck__guide { color: var(--ok); }
.fsl-deck__hint {
  font-size: var(--step--1);
  line-height: var(--lh-body);
  color: var(--text-muted);
  max-width: 42ch;
  margin: 0 auto;
  text-align: center;
}
.fsl-deck__cta { display: grid; gap: var(--s2); }
.fsl-deck__tools {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--s3);
}
@media (min-width: 480px) {
  .fsl-deck { padding-inline: var(--s6); }
  .fsl-deck__tools { grid-template-columns: 1fr auto; align-items: end; }
}
@media (min-width: 768px) {
  .fsl-deck { left: auto; right: var(--s6); width: min(420px, 42vw); }
}
@media (prefers-reduced-motion: reduce) {
  .fsl-deck__guide { transition: none; }
}
`

export interface AlignmentDeckProps {
  orientation: LiveOrientation
  readout: LiveReadout
  alignment: Alignment
  running: boolean
  onStart: () => void
  onStop: () => void
  /** Extra controls (ghost toggle, mode-specific bits) shown on the tool row. */
  extras?: React.ReactNode
}

export function AlignmentDeck({
  orientation,
  readout,
  alignment,
  running,
  onStart,
  onStop,
  extras,
}: AlignmentDeckProps) {
  const { t } = useTranslation()

  const guide = useMemo(() => {
    if (!readout.live) return t('live.align.notCalibrated')
    if (!alignment.calibrated) return t('live.align.calibrateHint')
    if (alignment.aligned) return t('live.align.hold')
    if (Math.abs(alignment.headingDelta) > HEADING_TOLERANCE) {
      return alignment.headingDelta > 0 ? t('live.align.turnLeft') : t('live.align.turnRight')
    }
    return alignment.pitchDelta > 0 ? t('live.align.lower') : t('live.align.raise')
  }, [t, readout.live, alignment.calibrated, alignment.aligned, alignment.headingDelta, alignment.pitchDelta])

  const sourceKey = readout.headingSource
  const headingTone = !alignment.calibrated
    ? 'default'
    : Math.abs(alignment.headingDelta) <= HEADING_TOLERANCE
      ? 'ok'
      : 'warn'
  const pitchTone =
    Math.abs(alignment.pitchDelta) <= PITCH_TOLERANCE ? ('ok' as const) : ('warn' as const)

  return (
    <div className="fsl-deck" data-aligned={alignment.aligned}>
      <style href="fs-live-deck" precedence="medium">
        {CSS}
      </style>

      {running ? (
        <Cluster aria-label={t('live.status.live')}>
          <div className="fsl-deck__bar">
            <Readout
              label={t('live.align.heading')}
              value={readout.live ? formatHeading(readout.heading) : '———'}
              tone={headingTone}
            />
            <Readout
              label={t('live.align.pitch')}
              value={readout.live ? formatSigned(readout.pitch) : '———'}
              tone={pitchTone}
              align="center"
            />
            <Button variant="secondary" size="sm" icon={<GlyphStop />} onClick={onStop}>
              {t('live.action.stop')}
            </Button>
          </div>
        </Cluster>
      ) : (
      <Cluster aria-label={t('live.align.label')}>
        <div className="fsl-deck__body">
          <HeadingTape
            orientation={orientation}
            target={alignment.target}
            calibrated={alignment.calibrated}
            tolerance={HEADING_TOLERANCE}
            aligned={alignment.aligned}
          />

          <BubbleLevel
            orientation={orientation}
            tolerance={PITCH_TOLERANCE}
            aligned={Math.abs(alignment.pitchDelta) <= PITCH_TOLERANCE}
          />

          <hr className="fsl-rule" />

          <div className="fsl-deck__row">
            <Readout
              label={t('live.align.heading')}
              value={readout.live ? formatHeading(readout.heading) : '———'}
              tone={headingTone}
            />
            <Readout
              label={t('live.align.pitch')}
              value={readout.live ? formatSigned(readout.pitch) : '———'}
              tone={pitchTone}
              align="center"
            />
            <Readout
              label={t('live.align.target')}
              value={alignment.calibrated ? formatHeading(alignment.targetHeading) : '———'}
              align="center"
            />
            <Readout
              label={t('live.align.mode')}
              value={t(`live.align.source.${sourceKey}`)}
              tone={sourceKey === 'relative' ? 'warn' : 'default'}
              align="end"
            />
          </div>

          <p className="fsl-deck__guide" aria-live="polite">
            {guide}
          </p>

          <hr className="fsl-rule" />

          <div className="fsl-deck__tools">
            <div>
              <NudgeDial
                value={alignment.nudge}
                onChange={alignment.setNudge}
                onStep={alignment.nudgeBy}
                label={t('live.align.nudge')}
              />
            </div>
            <div style={{ display: 'grid', gap: 'var(--s2)' }}>
              <Button
                variant="secondary"
                size="sm"
                icon={<GlyphTarget />}
                onClick={alignment.calibrate}
                disabled={!readout.live}
              >
                {alignment.calibrated
                  ? t('live.align.recalibrate')
                  : t('live.align.calibrate')}
              </Button>
              {extras}
            </div>
          </div>

          <p className="fsl-deck__hint">{t('live.align.nudgeHint')}</p>

          <div className="fsl-deck__cta">
            <Button
              variant="primary"
              size="lg"
              block
              icon={<GlyphPlay />}
              onClick={onStart}
              disabled={!alignment.aligned}
              aria-disabled={!alignment.aligned}
              title={alignment.aligned ? undefined : t('live.align.locked')}
            >
              {alignment.aligned ? t('live.action.start') : t('live.align.locked')}
            </Button>
          </div>
        </div>
      </Cluster>
      )}
    </div>
  )
}
