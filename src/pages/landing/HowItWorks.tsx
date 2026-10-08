import { useTranslation } from 'react-i18next'

import { Accent } from '@/ui/Accent'
import { Reveal, RevealGroup, RevealItem } from '@/ui/Reveal'

/**
 * §02 — how it works. Three steps: photograph the room, choose a style and a
 * budget, see it live in the room.
 *
 * Three plates side by side on desktop, stacked on phones. This used to be a
 * 220vh scroll-pinned sequence; on most screens it left a tall empty band
 * under the heading while the panels waited for scroll progress, and on a
 * trackpad it read as the page getting stuck. A row of plates tells the same
 * story at a glance and costs no scroll at all.
 */

type Step = { index: string; title: string; body: string }

const CSS = `
.hiw { padding-block: var(--section-y); }
.hiw__list {
  list-style: none;
  margin: var(--s8) 0 0;
  padding: 0;
  display: grid;
  gap: var(--s3);
}
.hiw__list > li > div { height: 100%; }
.hiw__card {
  position: relative;
  height: 100%;
  display: grid;
  border-radius: 22px;
  padding: 5px;
  background: var(--bezel-shell);
  box-shadow: inset 0 0 0 1px var(--bezel-ring);
  transition: transform var(--d-lux) var(--ease-fluid), box-shadow var(--d-lux) var(--ease-fluid);
}
@media (hover: hover) and (pointer: fine) {
  .hiw__card:hover { transform: translateY(-4px); box-shadow: inset 0 0 0 1px var(--bezel-ring), var(--shadow-raised); }
}
.hiw__fig {
  position: relative;
  border-radius: 17px;
  background:
    radial-gradient(90% 80% at 50% 0%, color-mix(in srgb, var(--accent) 7%, transparent), transparent 70%),
    var(--bg-raised);
  box-shadow: var(--inset-hi), var(--shadow-ambient);
}
.hiw__fig svg { width: 100%; height: auto; margin-inline: auto; }
.hiw__num {
  position: absolute;
  font-family: var(--font-mono);
  font-size: var(--step--2);
  font-weight: 500;
  letter-spacing: var(--tracking-mono);
  color: var(--accent-ink);
}
.hiw__body { display: grid; gap: var(--s2); align-content: center; }
.hiw__body h3, .hiw__body h4 { font-size: var(--step-2); font-weight: 500; letter-spacing: var(--tracking-heading); line-height: 1.2; }
.hiw__body p { color: var(--text-muted); font-size: var(--step-0); line-height: 1.6; max-width: 40ch; }

/* Phones: a compact row — the drawing as a thumbnail beside the copy —
   instead of three full-height plates stacked into ~1,400px of scroll. */
@media (max-width: 767.98px) {
  .hiw__card { grid-template-columns: 104px minmax(0, 1fr); gap: var(--s4); align-items: center; padding-right: var(--s4); }
  .hiw__fig { align-self: stretch; display: grid; place-items: center; padding: var(--s5) var(--s2) var(--s2); }
  .hiw__num { top: var(--s2); left: var(--s3); }
  .hiw__body { padding-block: var(--s4); }
  .hiw__body h3, .hiw__body h4 { font-size: 1.1875rem; }
  .hiw__body p { font-size: 0.9375rem; line-height: 1.55; }
}
@media (min-width: 768px) {
  .hiw__card { grid-template-rows: auto 1fr; border-radius: 28px; padding: 6px; }
  .hiw__fig { border-radius: 22px; padding: var(--s8) var(--s5) var(--s4); }
  .hiw__fig svg { max-height: 190px; }
  .hiw__num { top: var(--s4); left: var(--s5); }
  .hiw__body { padding: var(--s6) var(--s5) var(--s5); gap: var(--s3); align-content: start; }
  .hiw__list { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s5); margin-top: var(--s16); }
  .hiw__list > li:nth-child(2) { transform: translateY(var(--s8)); }
}
@media (min-width: 768px) and (max-width: 1023px) {
  .hiw__list { grid-template-columns: 1fr; }
  .hiw__list > li:nth-child(2) { transform: none; }
}
`

/* ------------------------------------------------------------- blueprints */

const STROKE = 'var(--clay-300)'
const HAIR = 'var(--hairline)'

/** 01 — a phone held up to the room, with a compass arc over it. */
function SketchPhone() {
  return (
    <svg viewBox="0 0 200 150" width="100%" fill="none" aria-hidden="true">
      <g stroke={HAIR} strokeWidth="1">
        <path d="M8 128 L192 128" />
        <path d="M8 122 L8 134 M192 122 L192 134" />
      </g>
      <g stroke={STROKE} strokeWidth="1.25" strokeLinejoin="round">
        {/* compass arc + bearing ticks */}
        <path d="M46 44 A 54 54 0 0 1 154 44" strokeDasharray="2 5" />
        <path d="M100 18 L100 28 M60 30 L66 37 M140 30 L134 37" />
        {/* the phone itself */}
        <rect x="76" y="40" width="48" height="84" rx="7" />
        <path d="M92 47 L108 47" />
        {/* what the screen sees: a wall corner and a seat */}
        <path d="M82 60 L82 112 L118 112 L118 60" />
        <path d="M82 96 L118 96" />
        <rect x="88" y="80" width="24" height="16" />
        <path d="M88 86 L112 86" />
      </g>
      <circle cx="100" cy="18" r="2.5" fill="var(--accent)" />
    </svg>
  )
}

/** 02 — a fan of style swatches over a budget scale. */
function SketchSwatches() {
  const leaves = [-34, -17, 0, 17, 34]
  const ticks = [0, 1, 2, 3, 4, 5, 6]
  return (
    <svg viewBox="0 0 200 150" width="100%" fill="none" aria-hidden="true">
      <rect x="92" y="26" width="16" height="62" rx="3" fill="var(--accent)" opacity="0.12" />
      <g stroke={STROKE} strokeWidth="1.25">
        {leaves.map((angle, i) => (
          <rect
            key={angle}
            x="92"
            y="26"
            width="16"
            height="62"
            rx="3"
            transform={'rotate(' + angle + ' 100 96)'}
            opacity={i === 2 ? 1 : 0.6}
          />
        ))}
        <circle cx="100" cy="96" r="4" />
      </g>
      <g stroke={HAIR} strokeWidth="1">
        <path d="M24 124 L176 124" />
        {ticks.map((i) => (
          <path key={i} d={'M' + (24 + i * 25.33) + ' 119 L' + (24 + i * 25.33) + ' 129'} />
        ))}
      </g>
      {/* the budget handle, set a little past halfway */}
      <path d="M24 124 L125 124" stroke="var(--accent)" strokeWidth="2" />
      <circle
        cx="125"
        cy="124"
        r="4"
        fill="var(--bg-sunken)"
        stroke="var(--accent)"
        strokeWidth="2"
      />
    </svg>
  )
}

/** 03 — the finished room, measured. */
function SketchRoom() {
  return (
    <svg viewBox="0 0 200 150" width="100%" fill="none" aria-hidden="true">
      <g stroke={STROKE} strokeWidth="1.25" strokeLinejoin="round">
        <path d="M18 112 L18 30 L182 30 L182 112" />
        <path d="M18 112 L182 112" />
        <path d="M18 88 L182 88" strokeDasharray="3 4" />
        {/* sofa */}
        <rect x="34" y="60" width="56" height="28" />
        <path d="M34 70 L90 70" />
        <path d="M48 60 L48 88 M76 60 L76 88" />
        {/* table + pendant lamp */}
        <rect x="108" y="72" width="44" height="16" rx="2" />
        <path d="M130 44 L130 72" />
        <path d="M118 44 L142 44 L136 56 L124 56 Z" />
      </g>
      <g stroke={HAIR} strokeWidth="1">
        <path d="M18 128 L182 128" />
        <path d="M18 122 L18 134 M182 122 L182 134" />
      </g>
      <text
        x="100"
        y="144"
        textAnchor="middle"
        fill="var(--text-muted)"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.12em',
        }}
      >
        4.20 m
      </text>
    </svg>
  )
}

const SKETCHES = [SketchPhone, SketchSwatches, SketchRoom]

export function HowItWorks({ headingLevel = 2 }: { headingLevel?: 2 | 3 } = {}) {
  const { t } = useTranslation()
  const raw = t('landing.steps.items', { returnObjects: true }) as unknown
  const steps: Step[] = Array.isArray(raw) ? (raw as Step[]) : []
  const Title = `h${headingLevel}` as 'h2' | 'h3'
  const StepTitle = `h${headingLevel + 1}` as 'h3' | 'h4'

  return (
    <section id="how-it-works" className="hiw" aria-labelledby="hiw-title">
      <style href="fs-landing-hiw" precedence="medium">
        {CSS}
      </style>

      <div className="fs-container">
        <Reveal className="fs-sec-head">
          <div className="fs-sec-head__main">
            <span className="fs-eyebrow">
              <span className="fs-eyebrow__dot" aria-hidden="true" />
              {t('landing.steps.label')}
            </span>
            <Title id="hiw-title" className="fs-h2">
              <Accent text={t('landing.steps.title')} />
            </Title>
          </div>
          <p className="fs-lead" style={{ maxWidth: '40ch' }}>
            {t('landing.steps.lead')}
          </p>
        </Reveal>

        <RevealGroup>
          <ol className="hiw__list">
            {steps.map((step, i) => {
              const Sketch = SKETCHES[i % SKETCHES.length]
              return (
                <li key={step.index || i}>
                  <RevealItem>
                    <div className="hiw__card">
                      <div className="hiw__fig">
                        <span className="hiw__num" aria-hidden="true">
                          {step.index || String(i + 1).padStart(2, '0')}
                        </span>
                        <Sketch />
                      </div>
                      <div className="hiw__body">
                        <StepTitle>{step.title}</StepTitle>
                        <p>{step.body}</p>
                      </div>
                    </div>
                  </RevealItem>
                </li>
              )
            })}
          </ol>
        </RevealGroup>
      </div>
    </section>
  )
}
