import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { ButtonLink } from '@/ui/Button'
import { CountUp } from '@/ui/CountUp'
import { Reveal, RevealGroup, RevealItem } from '@/ui/Reveal'
import { Accent } from '@/ui/Accent'
import { EASE_FLUID } from '@/design/scroll'

/**
 * §7 — pricing.
 *
 * Three plans, one layout decision: the recommended plan is the only one that
 * is a surface. It spans six of the twelve columns, sits on --bg-raised with
 * the lifted shadow, and carries the badge; the two side plans are bare
 * editorial columns under a strong hairline, three columns each and pushed
 * down so the middle one reads as the page's centre of gravity.
 *
 * The recommended plan asserts itself on arrival: it rises and settles with
 * a touch more travel than its neighbours, an accent ring fades in around it
 * a beat later, and the badge pops in with a small spring overshoot — three
 * layered "this one" cues instead of one flat reveal. Every plan's feature
 * list staggers its own rows in as the card settles.
 *
 * Prices arrive from the locale as a plain numeric string (thousands
 * separated with spaces, e.g. "99 000") with the currency living in
 * `period`, so the numeral itself can count up with `CountUp`; anything
 * that isn't purely numeric (a future "Contact us" style plan) falls back to
 * being rendered verbatim.
 */

type Plan = {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
}

const FEATURED = 1

/** Where each plan's CTA goes, by position: free, pro, studio. */
const PLAN_HREFS = ['/signup', '/signup?plan=pro', '/contact?topic=studio'] as const

/** i18next language → a full locale tag for number formatting. */
const NUMBER_LOCALE: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' }

const featuredVariants: Variants = {
  hidden: { opacity: 0, y: 34, scale: 0.94 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.9, ease: EASE_FLUID, delay: 0.06 },
  },
}

const ringVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: EASE_FLUID, delay: 0.4 },
  },
}

const badgeVariants: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 340, damping: 16, delay: 0.5 },
  },
}

const featureListVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } },
}

const featureItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_FLUID } },
}

/** A plan's price: counts up when it parses as a plain number, otherwise
 *  renders the locale string exactly as given. The real figure is always in
 *  the text (for readers, crawlers and anyone who never scrolls the counter
 *  into view); the animated one is decoration and hidden from AT. */
function PlanPrice({
  price,
  featured,
  locale,
}: {
  price: string
  featured: boolean
  locale: string
}) {
  const digits = price.replace(/[^\d]/g, '')
  const numeric = digits.length > 0 ? Number(digits) : NaN
  const counts = Number.isFinite(numeric)
  return (
    // No aria-label here: ARIA prohibits naming a paragraph, so screen readers
    // would skip it anyway. The visually-hidden span carries the real figure.
    <p
      className="fs-price__amount"
      style={{ fontSize: featured ? 'var(--step-4)' : 'var(--step-3)' }}
    >
      {counts ? (
        <>
          <span className="fs-price__sr">{price}</span>
          <span aria-hidden="true">
            <CountUp to={numeric} duration={1100} locale={locale} />
          </span>
        </>
      ) : (
        price
      )}
    </p>
  )
}

/** Feature rows, staggering in as the card they belong to settles. */
function FeatureList({ features }: { features: string[] }) {
  const reduced = useReducedMotion()
  if (reduced) {
    return (
      <ul className="fs-price__features">
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    )
  }
  return (
    <motion.ul className="fs-price__features" variants={featureListVariants}>
      {features.map((feature) => (
        <motion.li key={feature} variants={featureItemVariants}>
          {feature}
        </motion.li>
      ))}
    </motion.ul>
  )
}

const CSS = `
.fs-price {
  padding-block: var(--section-y);
}
.fs-price__plans {
  margin-top: var(--section-gap);
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: var(--s6);
  align-items: start;
}
.fs-price__plan {
  display: flex;
  flex-direction: column;
  gap: var(--s5);
  padding-top: var(--s6);
  border-top: 1px solid var(--border-strong);
}
.fs-price__plan--featured {
  position: relative;
  padding: var(--s8) var(--s6);
  border-top: 0;
  border-radius: var(--radius-2xl);
  background: var(--bg-raised);
  box-shadow: inset 0 0 0 1px var(--bezel-ring), var(--inset-hi), var(--shadow-raised);
}
.fs-price__ring {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px var(--accent), 0 0 48px -14px var(--accent);
  pointer-events: none;
}
.fs-price__badge {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: 26px;
  padding: 0 var(--s3);
  border-radius: var(--radius-full);
  background: var(--accent-ink);
  color: var(--paper);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  font-weight: 500;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
}
.fs-price__amount {
  margin-top: var(--s3);
  font-family: var(--font-display);
  font-weight: 400;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--text-strong);
  font-variant-numeric: lining-nums tabular-nums;
}
.fs-price__period {
  margin-top: var(--s2);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  font-weight: 500;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.fs-price__desc { color: var(--text-muted); font-size: var(--step--1); line-height: 1.55; max-width: 38ch; }
.fs-price__features {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
}
.fs-price__features li {
  position: relative;
  padding: var(--s2) 0 var(--s2) var(--s5);
  border-top: 1px solid var(--hairline);
  color: var(--text);
  font-size: var(--step--1);
  line-height: 1.5;
}
.fs-price__features li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: calc(var(--s2) + 0.5em);
  width: 8px;
  height: 4px;
  border-left: 1.5px solid var(--accent);
  border-bottom: 1.5px solid var(--accent);
  transform: rotate(-45deg);
}
.fs-price__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
.fs-price__note { margin-top: var(--section-gap); padding-top: var(--s5); border-top: 1px solid var(--hairline); }
.fs-price__note p { color: var(--text-muted); font-size: var(--step--1); max-width: 56ch; }

/* Phones: the plans become a horizontal snap carousel. The recommended plan
   comes first and every plan is a card, so the row reads as a set of equal
   choices you swipe through (the next card peeks in) rather than three
   screens of stacked feature lists. */
@media (max-width: 767.98px) {
  .fs-price__plans {
    display: flex;
    gap: var(--s3);
    margin-inline: calc(-1 * var(--gutter));
    padding: var(--s2) var(--gutter) var(--s5);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: var(--gutter);
    scrollbar-width: none;
    align-items: stretch;
  }
  .fs-price__plans::-webkit-scrollbar { display: none; }
  .fs-price__plan {
    flex: 0 0 min(84%, 320px);
    scroll-snap-align: start;
    gap: var(--s4);
    padding: var(--s6) var(--s5);
    border-top: 0;
    border-radius: var(--radius-2xl);
    background: var(--bg-raised);
    box-shadow: inset 0 0 0 1px var(--bezel-ring), var(--inset-hi), var(--shadow-ambient);
  }
  .fs-price__plan--featured { padding: var(--s6) var(--s5); }
  .fs-price__plan--1 { order: -1; }
  .fs-price__features li { padding-block: 0.4rem; }
  .fs-price__features li::before { top: calc(0.4rem + 0.5em); }
}
@media (min-width: 768px) {
  .fs-price__plan--0 { grid-column: 1 / 4; margin-top: var(--s12); }
  .fs-price__plan--1 { grid-column: 4 / 10; padding: var(--s10) var(--s8); }
  .fs-price__plan--2 { grid-column: 10 / 13; margin-top: var(--s12); }
  .fs-price__note { margin-left: 25%; }
}
`

export function Pricing({
  headingLevel = 2,
  hideHeading = false,
}: { headingLevel?: 2 | 3; /** Page already has its own hero: skip this section's head. */ hideHeading?: boolean } = {}) {
  const { t, i18n } = useTranslation()
  const reduced = useReducedMotion()
  const locale = NUMBER_LOCALE[(i18n.language || 'uz').slice(0, 2)] ?? 'uz-UZ'
  const Title = `h${headingLevel}` as 'h2' | 'h3'

  const raw = t('landing.pricing.plans', { returnObjects: true }) as unknown
  const plans: Plan[] = Array.isArray(raw) ? (raw as Plan[]) : []

  return (
    <section
      className="fs-price"
      aria-labelledby={hideHeading ? undefined : 'fs-pricing-title'}
      style={hideHeading ? { paddingTop: 0 } : undefined}
    >
      <style href="fs-landing-pricing" precedence="medium">
        {CSS}
      </style>

      <div className="fs-container">
        {!hideHeading && (
          <Reveal className="fs-sec-head">
            <div className="fs-sec-head__main">
              <span className="fs-eyebrow"><span className="fs-eyebrow__dot" aria-hidden="true" />{t('landing.pricing.label')}</span>
              <Title id="fs-pricing-title" className="fs-h2">
                <Accent text={t('landing.pricing.title')} />
              </Title>
            </div>
            <p className="fs-lead" style={{ maxWidth: '40ch' }}>{t('landing.pricing.lead')}</p>
          </Reveal>
        )}

        <RevealGroup className="fs-price__plans">
          {plans.map((plan, i) => {
            const featured = i === FEATURED
            const className = `fs-price__plan fs-price__plan--${i}${
              featured ? ' fs-price__plan--featured' : ''
            }`

            const body = (
              <>
                {featured && (
                  <motion.span
                    className="fs-price__badge"
                    variants={reduced ? undefined : badgeVariants}
                  >
                    {t('landing.pricing.popular')}
                  </motion.span>
                )}

                <div>
                  <span className="fs-label">{plan.name}</span>
                  <PlanPrice price={plan.price} featured={featured} locale={locale} />
                  <p className="fs-price__period">{plan.period}</p>
                </div>

                <p className="fs-price__desc">{plan.description}</p>

                <FeatureList features={plan.features} />

                <ButtonLink
                  to={PLAN_HREFS[i] ?? '/signup'}
                  variant={featured ? 'primary' : 'secondary'}
                  size={featured ? 'lg' : 'md'}
                  block
                  arrow={featured}
                >
                  {plan.cta}
                </ButtonLink>
              </>
            )

            if (featured) {
              return (
                <motion.div key={plan.name} className={className} variants={reduced ? undefined : featuredVariants}>
                  {!reduced && (
                    <motion.span className="fs-price__ring" aria-hidden="true" variants={ringVariants} />
                  )}
                  {body}
                </motion.div>
              )
            }

            return (
              <RevealItem key={plan.name} className={className}>
                {body}
              </RevealItem>
            )
          })}
        </RevealGroup>

        <Reveal className="fs-price__note">
          <p>{t('landing.pricing.note')}</p>
        </Reveal>
      </div>
    </section>
  )
}
