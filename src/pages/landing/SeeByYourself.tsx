import { Suspense, lazy, useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { Button, ButtonLink } from '@/ui/Button'
import { Reveal, RevealGroup, RevealItem } from '@/ui/Reveal'
import { Accent } from '@/ui/Accent'
import { EASE_FLUID, useSectionProgress } from '@/design/scroll'
import { useMediaQuery } from '@/lib/useMediaQuery'

// qrcode is only needed behind a click on a desktop pointer.
const QrHandoff = lazy(() => import('./QrHandoff').then((m) => ({ default: m.QrHandoff })))

/**
 * §05 — "see it by yourself". The flagship: stand where you took the photo,
 * line the phone up with the on-screen guide, press Start, and the restyled
 * room is there in front of you.
 *
 * This is the centrepiece of the lower page, so it gets the most vertical
 * space and sits on `--bg-sunken` to lift it off the paper. The phone is a
 * stroke-only SVG at the real 9:19.5 aspect, carrying the two overlays that
 * make the feature believable: a heading tape along the top and a bubble
 * level along the bottom, both drifting very slightly like a live sensor
 * read-out. As the section scrolls to centre, `useSectionProgress` trips a
 * "lock": the tape and bubble settle to dead centre and the restyled room
 * cross-fades from a dim, searching pass into a fully inked one — as if the
 * phone had just found its alignment. Everything holds at that settled,
 * fully-inked state under `prefers-reduced-motion`.
 */

type Step = { title: string; body: string }

const CSS = `
.sbs { background: var(--bg-sunken); padding-block: var(--section-y); }
.sbs-layout { row-gap: var(--s6); align-items: center; margin-top: var(--section-gap); }
.sbs-layout > * { grid-column: 1 / -1; }
.sbs-phone { display: flex; justify-content: center; }
.sbs-phone svg { width: clamp(150px, 42vw, 300px); height: auto; filter: drop-shadow(0 24px 32px rgba(74, 53, 41, 0.12)); }
.sbs-steps__list { list-style: none; margin: 0; padding: 0; }
.sbs-step { display: flex; gap: var(--s4); padding-block: var(--s4); align-items: baseline; }
.sbs-step__num {
  font-family: var(--font-display);
  font-style: italic;
  font-size: var(--step-2);
  line-height: 1;
  color: var(--accent-ink);
  flex: 0 0 1.6em;
  font-variant-numeric: lining-nums;
}
.sbs-step h3 { font-size: 1.1875rem; max-width: 22ch; }
.sbs-step p { margin-top: var(--s2); color: var(--text-muted); max-width: 42ch; font-size: 0.9375rem; line-height: 1.55; }
.sbs-note {
  display: flex;
  align-items: flex-start;
  gap: var(--s3);
  padding-block: var(--s4) var(--s5);
  color: var(--text-muted);
  font-size: var(--step--1);
  max-width: 44ch;
}
@media (min-width: 768px) {
  .sbs-layout { row-gap: var(--s16); }
  .sbs-phone { grid-column: 1 / span 5; justify-content: flex-start; }
  .sbs-steps { grid-column: 7 / span 6; }
  .sbs-step { gap: var(--s5); padding-block: var(--s6); }
  .sbs-step h3 { font-size: var(--step-2); }
  .sbs-step p { margin-top: var(--s3); font-size: var(--step-0); line-height: 1.6; }
  .sbs-note { padding-block: var(--s6); }
}
`

const STROKE = 'var(--clay-300)'
const HAIR = 'var(--hairline)'

/* --------------------------------------------------------------- the phone */

/** 270 × 585 ≈ 9 : 19.5. */
function PhoneMock({ locked }: { locked: boolean }) {
  const reduced = useReducedMotion()
  const settled = reduced || locked
  const drift = settled
    ? undefined
    : { duration: 7, ease: 'easeInOut' as const, repeat: Infinity, repeatType: 'mirror' as const }
  const settle = { duration: 0.6, ease: EASE_FLUID }

  return (
    <svg viewBox="0 0 270 585" fill="none" aria-hidden="true">
      {/* body + screen */}
      <rect
        x="6"
        y="6"
        width="258"
        height="573"
        rx="38"
        stroke="var(--text-strong)"
        strokeWidth="1.5"
      />
      <rect x="18" y="18" width="234" height="549" rx="28" stroke={HAIR} strokeWidth="1" />
      <rect x="18" y="18" width="234" height="549" rx="28" fill="var(--bg)" opacity="0.6" />
      <path d="M110 30 L160 30" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />

      <g clipPath="url(#sbs-screen)">
        {/* the restyled room, seen through the camera — dim and searching
            until the lock trips, then it cross-fades into full focus. */}
        <motion.g
          animate={{ opacity: settled ? 1 : 0.4, scale: settled ? 1 : 0.985 }}
          transition={settle}
          style={{ transformOrigin: '135px 315px' }}
        >
          <g stroke={STROKE} strokeWidth="1.25" strokeLinejoin="round">
            <path d="M40 200 L40 430 L230 430 L230 200" />
            <path d="M40 200 L230 200" />
            <path d="M40 430 L74 470 M230 430 L196 470" strokeDasharray="4 5" />
            {/* window */}
            <rect x="62" y="228" width="58" height="72" />
            <path d="M91 228 L91 300 M62 264 L120 264" />
            {/* sofa */}
            <rect x="56" y="336" width="98" height="52" />
            <path d="M56 356 L154 356" />
            <path d="M80 356 L80 388 M130 356 L130 388" />
            {/* side table + pendant */}
            <rect x="170" y="358" width="44" height="14" rx="2" />
            <path d="M176 372 L176 400 M208 372 L208 400" />
            <path d="M192 200 L192 256" />
            <path d="M176 256 L208 256 L202 272 L182 272 Z" />
            {/* rug */}
            <path d="M62 404 L212 404 L224 424 L52 424 Z" strokeDasharray="3 5" />
          </g>
        </motion.g>
        <motion.rect
          x="40"
          y="200"
          width="190"
          height="230"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1"
          strokeDasharray="3 6"
          animate={{ opacity: settled ? 0 : 0.6 }}
          transition={settle}
        />
      </g>

      {/* heading tape — reads like a compass strip across the top of the view */}
      <g>
        <path d="M18 132 L252 132" stroke={HAIR} strokeWidth="1" />
        <motion.g
          animate={settled ? { x: 0 } : { x: [-9, 9] }}
          transition={settled ? settle : drift}
          clipPath="url(#sbs-tape)"
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
            const x = 10 + i * 32
            const major = i % 2 === 0
            return (
              <path
                key={i}
                d={'M' + x + ' ' + (major ? 118 : 124) + ' L' + x + ' 132'}
                stroke={STROKE}
                strokeWidth="1"
                opacity={major ? 1 : 0.5}
              />
            )
          })}
        </motion.g>
        {/* the fixed centre caret you line the room up with — it settles with
            a small pulse once the lock trips. */}
        <motion.g
          animate={{ scale: settled && !reduced ? [1, 1.22, 1] : 1 }}
          transition={{ duration: 0.5, ease: EASE_FLUID }}
          style={{ transformOrigin: '135px 123px' }}
        >
          <path d="M135 108 L141 118 L129 118 Z" fill="var(--accent)" />
          <path d="M135 118 L135 138" stroke="var(--accent)" strokeWidth="1.5" />
        </motion.g>
      </g>

      {/* bubble level — the "hold it straight" overlay */}
      <g>
        <rect x="70" y="482" width="130" height="26" rx="13" stroke={HAIR} strokeWidth="1" />
        <path d="M124 482 L124 508 M146 482 L146 508" stroke={STROKE} strokeWidth="1" />
        <motion.circle
          cx="135"
          cy="495"
          r="9"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          animate={settled ? { x: 0 } : { x: [-13, 13] }}
          transition={settled ? settle : { ...drift, duration: 5.5 }}
        />
      </g>

      {/* the Start control: a shape, not a word, so nothing here needs translating */}
      <g>
        <circle cx="135" cy="540" r="17" stroke="var(--text-strong)" strokeWidth="1.5" />
        <circle cx="135" cy="540" r="10" fill="var(--accent)" />
      </g>

      {/* measurement as decoration */}
      <g stroke={HAIR} strokeWidth="1">
        <path d="M40 452 L230 452" />
        <path d="M40 447 L40 457 M230 447 L230 457" />
      </g>
      <text
        x="135"
        y="468"
        textAnchor="middle"
        fill="var(--text-muted)"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em' }}
      >
        3.40 m
      </text>

      <defs>
        <clipPath id="sbs-screen">
          <rect x="18" y="18" width="234" height="549" rx="28" />
        </clipPath>
        <clipPath id="sbs-tape">
          <rect x="18" y="104" width="234" height="32" />
        </clipPath>
      </defs>
    </svg>
  )
}

/* ---------------------------------------------------------------- section */

export function SeeByYourself() {
  const { t } = useTranslation()
  const raw = t('landing.live.steps', { returnObjects: true }) as unknown
  const steps: Step[] = Array.isArray(raw) ? (raw as Step[]) : []

  const { ref, progress } = useSectionProgress()
  const [locked, setLocked] = useState(false)
  /* The live view needs the phone's camera. A visitor holding the phone goes
     straight to capture; one at a desk gets the QR code to hand it over. */
  const finePointer = useMediaQuery('(pointer: fine)')
  const [qrOpen, setQrOpen] = useState(false)

  useMotionValueEvent(progress, 'change', (v) => {
    const shouldLock = v > 0.42
    if (shouldLock !== locked) setLocked(shouldLock)
  })

  return (
    <section id="see-by-yourself" ref={ref} className="sbs" aria-labelledby="sbs-title">
      <style href="fs-landing-sbs" precedence="medium">{CSS}</style>

      <div className="fs-container">
        <Reveal className="fs-sec-head">
          <div className="fs-sec-head__main">
            <span className="fs-eyebrow"><span className="fs-eyebrow__dot" aria-hidden="true" />{t('landing.live.label')}</span>
            <h2 id="sbs-title" className="fs-h2" style={{ maxWidth: '15ch' }}>
              <Accent text={t('landing.live.title')} />
            </h2>
          </div>
          <p className="fs-lead" style={{ maxWidth: '44ch' }}>
            {t('landing.live.lead')}
          </p>
        </Reveal>

        <div className="fs-grid sbs-layout">
          <Reveal className="sbs-phone">
            <PhoneMock locked={locked} />
          </Reveal>

          <div className="sbs-steps">
            <RevealGroup>
              <ol className="sbs-steps__list">
                {steps.map((step, i) => (
                  <li key={step.title || i} style={{ borderTop: '1px solid var(--border-strong)' }}>
                    <RevealItem>
                      <div className="sbs-step">
                        <span className="sbs-step__num" aria-hidden="true">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <h3>{step.title}</h3>
                          <p>{step.body}</p>
                        </div>
                      </div>
                    </RevealItem>
                  </li>
                ))}
              </ol>
            </RevealGroup>

            <hr className="fs-rule" />

            <Reveal>
              <aside className="sbs-note">
                <svg
                  viewBox="0 0 12 20"
                  width="12"
                  height="20"
                  fill="none"
                  aria-hidden="true"
                  style={{ flex: '0 0 auto', marginTop: 2 }}
                >
                  <rect
                    x="0.6"
                    y="0.6"
                    width="10.8"
                    height="18.8"
                    rx="2.4"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <path d="M4.5 3 L7.5 3" stroke="currentColor" strokeWidth="1" />
                </svg>
                <span>{t('landing.live.mobileOnly')}</span>
              </aside>

              {finePointer ? (
                <Button size="lg" arrow aria-haspopup="dialog" onClick={() => setQrOpen(true)}>
                  {t('landing.live.cta')}
                </Button>
              ) : (
                <ButtonLink to="/app/capture" size="lg" arrow>
                  {t('landing.live.cta')}
                </ButtonLink>
              )}
            </Reveal>
          </div>
        </div>
      </div>

      {qrOpen && (
        <Suspense fallback={null}>
          <QrHandoff open onClose={() => setQrOpen(false)} />
        </Suspense>
      )}
    </section>
  )
}
