import { useTranslation } from 'react-i18next'

import { Seo } from '@/lib/seo'
import { Reveal } from '@/ui/Reveal'
import { HowItWorks } from '@/pages/landing/HowItWorks'
import { AiExplainer } from '@/pages/landing/AiExplainer'
import { SeeByYourself } from '@/pages/landing/SeeByYourself'
import { Pricing as PricingSection } from '@/pages/landing/Pricing'
import { Faq as FaqSection } from '@/pages/landing/Faq'
import { faqJsonLd } from '@/lib/seo'

/**
 * Three routes in the sitemap are the landing's own sections given a page of
 * their own. Composing them here keeps one source of truth for the copy and
 * the layout rather than a second, drifting copy.
 *
 * Each page opens with a `PageIntro` so it has exactly one h1 (the sections
 * themselves only ever render h2 and below), using the same head markup as
 * Gallery and About.
 */

/** Visually hidden, still announced — there is no global sr-only class. */
const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

/** The standard public-page head: eyebrow, display h1, lead — editorial split on wide screens. */
export function PageIntro({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string
  title: string
  lead?: string
}) {
  return (
    <section className="fs-container fs-intro">
      <style href="fs-intro" precedence="medium">{`
        .fs-intro { padding-block: var(--s16) var(--s10); }
        @media (min-width: 768px) { .fs-intro { padding-block: var(--s24) var(--s12); } }
        .fs-intro__grid { display: grid; gap: var(--s8); align-items: end; }
        @media (min-width: 960px) { .fs-intro__grid { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: var(--s16); } }
        .fs-intro__title { margin-top: var(--s6); max-width: 14ch; font-size: var(--step-5); font-weight: 400; }
        .fs-intro__rule { margin-top: var(--s12); }
      `}</style>
      <Reveal>
        <div className="fs-intro__grid">
          <div>
            <span className="fs-eyebrow">
              <span className="fs-eyebrow__dot" aria-hidden="true" />
              {eyebrow}
            </span>
            <h1 className="fs-display fs-intro__title">{title}</h1>
          </div>
          {lead && (
            <p className="fs-lead" style={{ maxWidth: '42ch' }}>
              {lead}
            </p>
          )}
        </div>
        <hr className="fs-rule fs-intro__rule" />
      </Reveal>
    </section>
  )
}

export function HowItWorksPage() {
  const { t } = useTranslation()
  return (
    <>
      <Seo
        title={`${t('nav.howItWorks')} — FrameSpace`}
        description={t('landing.steps.lead')}
        path="/how-it-works"
      />
      {/* The section's own heading is the visible hero; the h1 names the page. */}
      <h1 style={SR_ONLY}>{t('pages.howItWorks.title')}</h1>
      <div style={{ height: 'var(--s12)' }} aria-hidden="true" />
      <HowItWorks headingLevel={2} />
      <AiExplainer />
      <SeeByYourself />
    </>
  )
}

export function PricingPage() {
  const { t } = useTranslation()
  return (
    <>
      <Seo
        title={`${t('nav.pricing')} — FrameSpace`}
        description={t('landing.pricing.lead')}
        path="/pricing"
      />
      <PageIntro
        eyebrow={t('pages.pricing.eyebrow', { defaultValue: 'Narxlar' })}
        title={t('pages.pricing.title', { defaultValue: "Bepul boshlang. Kerak bo'lganda kengaytiring." })}
        lead={t('pages.pricing.lead', {
          defaultValue: "Birinchi xona bepul. Ko'proq loyiha kerak bo'lsa — Pro yoki Studio.",
        })}
      />
      <PricingSection headingLevel={2} hideHeading />
      <FaqSection headingLevel={2} />
    </>
  )
}

export function FaqPage() {
  const { t } = useTranslation()
  const items = (t('landing.faq.items', { returnObjects: true }) as Array<{ q: string; a: string }>) || []
  return (
    <>
      <Seo
        title={`${t('nav.faq')} — FrameSpace`}
        description={t('landing.faq.title')}
        path="/faq"
        jsonLd={faqJsonLd(items)}
      />
      <h1 style={SR_ONLY}>{t('pages.faq.title')}</h1>
      <div style={{ height: 'var(--s12)' }} aria-hidden="true" />
      <FaqSection headingLevel={2} />
    </>
  )
}
