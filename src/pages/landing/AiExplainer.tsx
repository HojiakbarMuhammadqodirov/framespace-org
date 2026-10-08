import { useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { useSectionProgress } from '@/design/scroll'
import { Reveal, RevealGroup, RevealItem } from '@/ui/Reveal'
import { Skeleton } from '@/ui/Skeleton'
import { Accent } from '@/ui/Accent'

/**
 * §04 — what the AI actually does. Photos go in; a costed, buildable
 * suggestion comes out.
 *
 * The four pipeline stages used to advance on a bare `setInterval`. They now
 * advance with `useSectionProgress` as the block passes through the
 * viewport — the reader drives the story by scrolling, and each stage's
 * progress rail fills as a direct function of scroll position rather than a
 * timed animation. The connector line between the input frames and the
 * output cards draws in the same way (`strokeDashoffset` tied to scroll),
 * and the input frames visibly "resolve" — their skeleton bars settle and a
 * small ready-tick fills — as the pipeline nears its costed result.
 *
 * None of this runs under `prefers-reduced-motion`: the pipeline is simply
 * shown already finished, so the copy reads correctly with no movement.
 */

type Output = { title: string; body: string }

const CSS = `
.ai-flow { row-gap: var(--s5); align-items: start; }
.ai-flow > * { grid-column: 1 / -1; }
.ai-frames { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s2); }
.ai-frame {
  position: relative;
  border-radius: 12px;
  background: var(--bg-raised);
  box-shadow: inset 0 0 0 1px var(--bezel-ring), var(--inset-hi);
  padding: var(--s2);
  overflow: hidden;
  transition: box-shadow var(--d-base) var(--ease);
}
.ai-frame[data-on='true'] { box-shadow: inset 0 0 0 1px var(--accent), var(--inset-hi), var(--shadow-ambient); }
.ai-frame__ready {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: var(--accent);
  transform-origin: left center;
}
.ai-arrow { display: none; }
.ai-stages__list { list-style: none; margin: var(--s3) 0 0; padding: 0; display: grid; gap: 0; }
.ai-out { row-gap: 0; }
.ai-out > * { grid-column: 1 / -1; }
.ai-out__item { padding-block: var(--s5); border-top: 1px solid var(--hairline); }
.ai-out__item h3 { font-size: var(--step-2); margin-top: var(--s2); max-width: 22ch; }
.ai-out__item p { margin-top: var(--s2); color: var(--text-muted); max-width: 46ch; }
@media (max-width: 767.98px) {
  .ai-out__item { display: grid; grid-template-columns: 2.25rem minmax(0, 1fr); column-gap: var(--s2); }
  .ai-out__item .fs-label { padding-top: 0.45em; }
  .ai-out__item h3 { margin-top: 0; font-size: 1.1875rem; }
  .ai-out__item p { grid-column: 2; font-size: 0.9375rem; line-height: 1.55; }
}
@media (min-width: 768px) {
  .ai-flow { row-gap: var(--s10); }
  .ai-in { grid-column: 1 / span 4; }
  .ai-frames { gap: var(--s3); margin-top: var(--s5); }
  .ai-arrow { display: flex; justify-content: center; grid-column: 5 / span 1; padding-top: var(--s10); }
  .ai-stages { grid-column: 7 / span 6; }
  .ai-stages__list { margin-top: var(--s5); gap: var(--s1); }
  .ai-out { row-gap: var(--s10); }
  .ai-out__item { padding-block: var(--s5) 0; }
  .ai-out__item h3 { margin-top: var(--s3); }
  .ai-out__item p { margin-top: var(--s3); }
  .ai-out--0 { grid-column: 1 / span 5; }
  .ai-out--1 { grid-column: 7 / span 6; }
  .ai-out--2 { grid-column: 3 / span 7; }
}
`

const STROKE = 'var(--clay-300)'

/** A tiny stroke-only stand-in for "a photo of your room" — never a photo. */
function FrameMark({ n }: { n: number }) {
  return (
    <svg viewBox="0 0 60 44" width="100%" fill="none" style={{ height: 'auto' }} aria-hidden="true">
      <g stroke={STROKE} strokeWidth="1">
        <path d="M2 10 L2 2 L10 2 M50 2 L58 2 L58 10" />
        <path d="M2 34 L2 42 L10 42 M50 42 L58 42 L58 34" />
        <path d="M12 34 L12 16 L30 16 L30 34" />
        <path d="M30 34 L48 34 L48 22" strokeDasharray="3 3" />
      </g>
      <text
        x="30"
        y="12"
        textAnchor="middle"
        fill="var(--text-muted)"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.14em' }}
      >
        {'IMG ' + String(n).padStart(2, '0')}
      </text>
    </svg>
  )
}

/** One input frame. Its skeleton settles and a ready-tick fills along the
 *  bottom edge as the overall pipeline progress nears completion. */
function InputFrame({
  n,
  on,
  progress,
  reduced,
}: {
  n: number
  on: boolean
  progress: MotionValue<number>
  reduced: boolean
}) {
  const resolved = useTransform(progress, [0.62, 0.94], [0, 1], { clamp: true })
  const skeletonFade = useTransform(progress, [0.62, 0.8], [1, 0.35], { clamp: true })

  return (
    <div className="ai-frame" data-on={String(on)}>
      <FrameMark n={n} />
      <motion.div
        style={{
          marginTop: 'var(--s2)',
          display: 'grid',
          gap: 'var(--s1)',
          opacity: reduced ? 0.35 : skeletonFade,
        }}
      >
        <Skeleton height={6} />
        <Skeleton width="60%" height={6} />
      </motion.div>
      <motion.span
        className="ai-frame__ready"
        aria-hidden="true"
        style={{ scaleX: reduced ? 1 : resolved }}
      />
    </div>
  )
}

/** One pipeline stage row. Its rail fills as a direct function of scroll
 *  position across the slice of overall progress it owns. */
function StageRow({
  stage,
  index,
  count,
  progress,
  on,
  done,
  reduced,
}: {
  stage: string
  index: number
  count: number
  progress: MotionValue<number>
  on: boolean
  done: boolean
  reduced: boolean
}) {
  const liveFill = useTransform(progress, [index / count, (index + 1) / count], [0, 1], { clamp: true })
  const fill = reduced ? 1 : liveFill

  return (
    <li style={{ borderTop: '1px solid var(--hairline)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)', minHeight: 'var(--tap)' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--step--2)',
            fontWeight: 500,
            letterSpacing: 'var(--tracking-mono)',
            color: 'var(--text-muted)',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 'var(--radius-full)',
            flex: '0 0 auto',
            background: on || done ? 'var(--accent)' : 'transparent',
            boxShadow: on || done ? 'none' : 'inset 0 0 0 1px var(--border-strong)',
            opacity: done && !on ? 0.45 : 1,
            transition: 'background-color var(--d-base) var(--ease)',
          }}
        />
        <span
          style={{
            fontSize: 'var(--step-0)',
            fontWeight: on ? 600 : 500,
            color: on ? 'var(--text-strong)' : 'var(--text-muted)',
            transition: 'color var(--d-base) var(--ease)',
          }}
        >
          {stage}
        </span>
      </div>
      <div aria-hidden="true" style={{ height: 2, background: 'var(--hairline)', overflow: 'hidden' }}>
        <motion.div
          style={{
            height: '100%',
            background: 'var(--accent)',
            transformOrigin: 'left center',
            scaleX: fill,
          }}
        />
      </div>
    </li>
  )
}

/* ---------------------------------------------------------------- section */

export function AiExplainer() {
  const { t } = useTranslation()
  const reduced = useReducedMotion()

  const rawStages = t('landing.ai.stages', { returnObjects: true }) as unknown
  const stages: string[] = Array.isArray(rawStages) ? (rawStages as string[]) : []
  const rawOutputs = t('landing.ai.outputs', { returnObjects: true }) as unknown
  const outputs: Output[] = Array.isArray(rawOutputs) ? (rawOutputs as Output[]) : []

  const { ref, progress } = useSectionProgress(['start end', 'end start'])
  const count = stages.length || 1
  const [tick, setTick] = useState(0)

  useMotionValueEvent(progress, 'change', (v) => {
    if (reduced) return
    const idx = Math.min(count - 1, Math.max(0, Math.floor(v * count)))
    if (idx !== tick) setTick(idx)
  })

  // Under reduced motion the pipeline is shown already finished, so the copy
  // still reads correctly with no movement at all.
  const active = reduced ? count - 1 : tick

  const arrowDraw = useTransform(progress, [0.05, 0.85], [0, 1], { clamp: true })

  return (
    <section id="ai" style={{ paddingBlock: 'var(--section-y)' }} aria-labelledby="ai-title">
      <style href="fs-landing-ai" precedence="medium">{CSS}</style>

      <div className="fs-container">
        <Reveal className="fs-sec-head">
          <div className="fs-sec-head__main">
            <span className="fs-eyebrow"><span className="fs-eyebrow__dot" aria-hidden="true" />{t('landing.ai.label')}</span>
            <h2 id="ai-title" className="fs-h2">
              <Accent text={t('landing.ai.title')} />
            </h2>
          </div>
          <p className="fs-lead" style={{ maxWidth: '44ch' }}>
            {t('landing.ai.lead')}
          </p>
        </Reveal>

        {/* ---------------------------------------------------- the pipeline */}
        <div ref={ref as React.RefObject<HTMLDivElement>} className="fs-grid ai-flow" style={{ marginTop: 'var(--section-gap)' }}>
          <Reveal className="ai-in">
            <div className="ai-frames">
              {[0, 1, 2].map((i) => (
                <InputFrame key={i} n={i + 1} on={!reduced && active % 3 === i} progress={progress} reduced={Boolean(reduced)} />
              ))}
            </div>
          </Reveal>

          <div className="ai-arrow" aria-hidden="true">
            <svg viewBox="0 0 60 12" width="60" height="12" fill="none">
              <path d="M0 6 L50 6" stroke="var(--border-strong)" strokeWidth="1" />
              <motion.path
                d="M0 6 L50 6"
                stroke="var(--accent)"
                strokeWidth="1.5"
                style={{ pathLength: reduced ? 1 : arrowDraw }}
              />
              <path d="M46 2 L52 6 L46 10" stroke="var(--border-strong)" strokeWidth="1" />
            </svg>
          </div>

          <Reveal className="ai-stages">
            <ol className="ai-stages__list">
              {stages.map((stage, i) => (
                <StageRow
                  key={stage || i}
                  stage={stage}
                  index={i}
                  count={count}
                  progress={progress}
                  on={i === active}
                  done={i < active}
                  reduced={Boolean(reduced)}
                />
              ))}
            </ol>
          </Reveal>
        </div>

        {/* ------------------------------------------------------- the output */}
        <RevealGroup>
          <div className="fs-grid ai-out" style={{ marginTop: 'var(--section-gap)' }}>
            {outputs.map((output, i) => (
              <RevealItem key={output.title || i} className={'ai-out__item ai-out--' + i}>
                <span className="fs-label">{String(i + 1).padStart(2, '0')}</span>
                <h3>{output.title}</h3>
                <p>{output.body}</p>
              </RevealItem>
            ))}
          </div>
        </RevealGroup>
      </div>
    </section>
  )
}
