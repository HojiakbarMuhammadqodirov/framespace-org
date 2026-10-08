import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'

import { ButtonLink } from '@/ui/Button'
import { Reveal, RevealGroup, RevealItem } from '@/ui/Reveal'
import { Accent } from '@/ui/Accent'
import { EASE_FLUID } from '@/design/scroll'

/**
 * §5 — the inverted "for business" block.
 *
 * `data-surface="inverse"` is already wired in tokens.css: it flips every
 * semantic token to the dark palette for this subtree, so nothing below needs
 * a single hard-coded colour.
 *
 * The panel arrives as a distinct surface rather than just fading in: it
 * scales up from 96% with a matching opacity rise as it enters the viewport,
 * transform-origin pinned to the top edge so it reads as a plate settling
 * into place — `.fs-biz` already clips overflow, so the scale never peeks
 * past the section's own edges. The four points then stagger in underneath
 * via the existing `RevealGroup`/`RevealItem` viewport choreography.
 *
 * The four points are an editorial index — numbered rows under hairlines,
 * two columns on a wide screen, one compact list on a phone.
 */

/** The panel's own arrival: a scale + opacity settle, once, on first view. */
function PanelArrive({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.85, ease: EASE_FLUID }}
      
    >
      {children}
    </motion.div>
  )
}

type Point = { title: string; body: string }

const CSS = `
.fs-biz {
  position: relative;
  overflow: hidden;
  padding-block: var(--section-y);
}
.fs-biz::before {
  /* One warm light source in the top corner, so the dark plate has depth
     instead of reading as a flat fill. */
  content: '';
  position: absolute;
  inset: -30% -25% auto auto;
  width: min(70vw, 820px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--accent) 22%, transparent), transparent 62%);
  pointer-events: none;
}
.fs-biz__points {
  list-style: none;
  padding: 0;
  margin: var(--s8) 0 0;
  display: grid;
  gap: 0;
}
.fs-biz__point {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr);
  column-gap: var(--s2);
  row-gap: var(--s2);
  padding-block: var(--s5);
  border-top: 1px solid var(--border-strong);
}
.fs-biz__point h3, .fs-biz__point h4 { font-size: 1.1875rem; }
.fs-biz__point p { grid-column: 2; color: var(--text-muted); font-size: 0.9375rem; line-height: 1.55; }
.fs-biz__index { color: var(--accent-ink); padding-top: 0.45em; }
.fs-biz__foot {
  margin-top: var(--s8);
  display: grid;
  gap: var(--s6);
}
.fs-biz__note {
  font-family: var(--font-display);
  font-style: italic;
  font-size: var(--step-2);
  font-weight: 400;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--text-strong);
  max-width: 26ch;
  padding-left: var(--s5);
  border-left: 2px solid var(--accent);
}
@media (min-width: 768px) {
  .fs-biz__points {
    margin-top: var(--section-gap);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: var(--s10);
  }
  .fs-biz__point { padding-block: var(--s6); grid-template-columns: 3rem minmax(0, 1fr); }
  .fs-biz__point h3, .fs-biz__point h4 { font-size: var(--step-2); }
  .fs-biz__point p { font-size: var(--step-0); line-height: 1.6; max-width: 44ch; }
  .fs-biz__foot {
    margin-top: var(--section-gap);
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: var(--s10);
  }
  .fs-biz__note { font-size: var(--step-3); line-height: 1.2; max-width: 24ch; padding-left: var(--s6); }
}
`

export function ForBusiness({ headingLevel = 2 }: { headingLevel?: 2 | 3 } = {}) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  // On the landing page the CTA leads to the full pitch; on the pitch page
  // itself it is the sign-up.
  const onPitchPage = pathname.replace(/\/+$/, '') === '/for-business'
  const Title = `h${headingLevel}` as 'h2' | 'h3'
  const Point = `h${headingLevel + 1}` as 'h3' | 'h4'

  const raw = t('landing.business.points', { returnObjects: true }) as unknown
  const points: Point[] = Array.isArray(raw) ? (raw as Point[]) : []

  return (
    <section
      className="fs-biz"
      data-surface="inverse"
      aria-labelledby="fs-business-title"
    >
      <style href="fs-landing-business" precedence="medium">
        {CSS}
      </style>

      <PanelArrive>
        <div className="fs-container" style={{ position: 'relative' }}>
          <Reveal className="fs-sec-head">
            <div className="fs-sec-head__main">
              <span className="fs-eyebrow"><span className="fs-eyebrow__dot" aria-hidden="true" />{t('landing.business.label')}</span>
              <Title id="fs-business-title" className="fs-h2" style={{ maxWidth: '18ch' }}>
                <Accent text={t('landing.business.title')} />
              </Title>
            </div>
            <p className="fs-lead" style={{ maxWidth: '42ch' }}>{t('landing.business.lead')}</p>
          </Reveal>

          <RevealGroup>
            <ul className="fs-biz__points">
              {points.map((point, i) => (
                <li key={point.title}>
                  <RevealItem className="fs-biz__point">
                    <span className="fs-label fs-biz__index">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <Point>{point.title}</Point>
                    <p>{point.body}</p>
                  </RevealItem>
                </li>
              ))}
            </ul>
          </RevealGroup>

          <Reveal className="fs-biz__foot">
            <p className="fs-biz__note">{t('landing.business.note')}</p>
            <div>
              <ButtonLink
                to={onPitchPage ? '/signup?role=business' : '/for-business'}
                size="lg"
                arrow
              >
                {t('landing.business.cta')}
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </PanelArrive>
    </section>
  )
}
