import { useTranslation } from 'react-i18next'

import { Seo, faqJsonLd, softwareJsonLd } from '@/lib/seo'
import { STYLES } from '@/lib/styles'
import { PRODUCTS } from '@/features/catalog/data'
import { ButtonLink } from '@/ui/Button'
import { CountUp } from '@/ui/CountUp'
import { Accent } from '@/ui/Accent'
import { Reveal } from '@/ui/Reveal'
import { Hero } from './landing/Hero'
import { HowItWorks } from './landing/HowItWorks'
import { lazy, Suspense } from 'react'
import { ensureSections } from '@/i18n/config'

// The strip renders catalog copy (feature bundle) and live 3D cards, so it
// loads with its translations instead of painting raw keys on first view.
const CatalogStrip = lazy(() =>
  Promise.all([import('./landing/CatalogStrip'), ensureSections()]).then(([m]) => ({
    default: m.CatalogStrip,
  }))
)
import { AiExplainer } from './landing/AiExplainer'
import { SeeByYourself } from './landing/SeeByYourself'
import { ForBusiness } from './landing/ForBusiness'
import { Pricing } from './landing/Pricing'
import { Faq } from './landing/Faq'

/** i18next language → a full locale tag for number formatting. */
const NUMBER_LOCALE: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' }

/* The proof strip counts what the product actually ships with, so the
   numbers move when the catalog does instead of drifting from it. */
const PROOF = [
  { key: 'styles', value: STYLES.length, fallback: 'interyer uslubi' },
  { key: 'items', value: PRODUCTS.length, fallback: 'katalogdagi buyum' },
  {
    key: 'stores',
    value: new Set(PRODUCTS.map((p) => p.vendorSlug)).size,
    fallback: "hamkor do'kon",
  },
  { key: 'speed', value: 4, fallback: 'daqiqada tayyor loyiha' },
] as const

const CSS = `
.fs-proof {
  padding-block: var(--s8) 0;
}
.fs-proof__panel {
  border-radius: 28px;
  padding: 6px;
  background: var(--bezel-shell);
  box-shadow: inset 0 0 0 1px var(--bezel-ring);
}
.fs-proof__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  border-radius: 22px;
  background: var(--bg-raised);
  box-shadow: var(--inset-hi), var(--shadow-ambient);
  overflow: hidden;
}
.fs-proof__cell {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding: var(--s5) var(--s5);
  box-shadow: inset -1px 0 0 var(--hairline), inset 0 -1px 0 var(--hairline);
}
.fs-proof__value {
  font-family: var(--font-display);
  font-size: var(--step-4);
  font-weight: 400;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
}
.fs-proof__value small {
  font-size: 0.45em;
  letter-spacing: 0;
  margin-left: 0.15em;
  color: var(--accent-ink);
}
.fs-proof__label {
  color: var(--text-muted);
  font-size: var(--step--1);
  font-weight: 500;
  line-height: 1.4;
}
@media (min-width: 768px) {
  .fs-proof__grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .fs-proof__cell { padding: var(--s8) var(--s6); box-shadow: inset -1px 0 0 var(--hairline); }
  .fs-proof__cell:last-child { box-shadow: none; }
}

.fs-closing {
  padding-block: 0 var(--section-y);
}
.fs-closing__panel {
  position: relative;
  overflow: hidden;
  border-radius: 36px;
  padding: clamp(2.25rem, 1.2rem + 5vw, 6rem) clamp(1.5rem, 1rem + 4vw, 5rem);
  box-shadow: var(--shadow-float);
}
.fs-closing__panel::before {
  content: '';
  position: absolute;
  inset: -40% -20% auto auto;
  width: 70%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--accent) 38%, transparent), transparent 65%);
  pointer-events: none;
}
.fs-closing__inner {
  position: relative;
  display: grid;
  gap: var(--s6);
  max-width: 760px;
}
.fs-closing__title {
  font-size: var(--step-5);
  font-weight: 400;
  letter-spacing: -0.022em;
  line-height: 1.02;
  text-wrap: balance;
  max-width: 14ch;
}
:lang(ru) .fs-closing__title { line-height: 1.08; max-width: 16ch; }
.fs-closing__ctas {
  display: grid;
  gap: var(--s3);
  margin-top: var(--s4);
}
@media (min-width: 640px) {
  .fs-closing__ctas { display: flex; flex-wrap: wrap; gap: var(--s4); }
}
`

/** A slim band of real numbers between the hero's promise and the details. */
function ProofStrip() {
  const { t, i18n } = useTranslation()
  const locale = NUMBER_LOCALE[(i18n.language || 'uz').slice(0, 2)] ?? 'uz-UZ'

  return (
    <section className="fs-proof" aria-label={t('landing.proof.title')}>
      <div className="fs-container">
        <Reveal className="fs-proof__panel">
          <dl className="fs-proof__grid">
            {PROOF.map((stat) => (
              <div key={stat.key} className="fs-proof__cell">
                <dt className="fs-proof__label" style={{ order: 2 }}>
                  {t(`landing.proof.${stat.key}`)}
                </dt>
                <dd className="fs-proof__value" style={{ margin: 0, order: 1 }}>
                  <CountUp to={stat.value} locale={locale} />
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}

/** The last beat: one sentence and the same two doors the hero opened. */
function ClosingBand() {
  const { t } = useTranslation()

  return (
    <section className="fs-closing" aria-labelledby="fs-closing-title">
      <div className="fs-container">
        <div className="fs-closing__panel" data-surface="inverse">
          <Reveal blur={false} className="fs-closing__inner">
            <h2 id="fs-closing-title" className="fs-closing__title">
              <Accent
                text={t('landing.closing.title', {
                  defaultValue: "Xonangizni bugun yangi ko'rinishda ko'ring.",
                })}
              />
            </h2>
            <p className="fs-lead" style={{ maxWidth: '46ch' }}>
              {t('landing.closing.lead', {
                defaultValue:
                  'Bir necha surat — va xonangiz tanlangan uslubda, haqiqiy mebel bilan tayyor.',
              })}
            </p>
            <div className="fs-closing__ctas">
              <ButtonLink to="/app/capture" size="lg" arrow>
                {t('landing.hero.ctaCamera', { defaultValue: 'Xonani suratga olish' })}
              </ButtonLink>
              <ButtonLink to="/app/capture?mode=upload" size="lg" variant="secondary">
                {t('landing.hero.ctaUpload', { defaultValue: 'Suratlarni yuklash' })}
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  const { t } = useTranslation()
  const faqItems =
    (t('landing.faq.items', { returnObjects: true }) as Array<{ q: string; a: string }>) || []
  const description = t('landing.hero.lead')

  return (
    <>
      <Seo
        title={`${t('brand.name')} — ${t('brand.tagline')}`}
        description={description}
        path="/"
        jsonLd={[softwareJsonLd(description), faqJsonLd(faqItems)]}
      />
      <style href="fs-landing" precedence="medium">
        {CSS}
      </style>

      <Hero />
      <ProofStrip />
      <HowItWorks />
      <Suspense fallback={<div style={{ minHeight: '640px' }} aria-hidden="true" />}>
        <CatalogStrip />
      </Suspense>
      <AiExplainer />
      <SeeByYourself />
      <ForBusiness />
      <Pricing />
      <Faq />
      <ClosingBand />
    </>
  )
}
