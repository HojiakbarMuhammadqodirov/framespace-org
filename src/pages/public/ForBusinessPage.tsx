import { useTranslation } from 'react-i18next'

import { Seo } from '@/lib/seo'
import { ButtonLink } from '@/ui/Button'
import { Reveal, RevealGroup, RevealItem } from '@/ui/Reveal'
import { DimensionLine } from '@/ui/DimensionLine'
import { ForBusiness } from '@/pages/landing/ForBusiness'
import { Pricing } from '@/pages/landing/Pricing'
import { Plinth, PIECE_PALETTES } from './Plinth'
import { EditorialStyles } from './editorial'

type Point = { title: string; body: string }

const CSS = `
.fb-hero { padding-block: var(--s16) var(--s12); }
@media (min-width: 768px) { .fb-hero { padding-block: var(--s24) var(--s16); } }
.fb-hero__grid { display: grid; gap: var(--s12); align-items: center; }
@media (min-width: 960px) { .fb-hero__grid { grid-template-columns: minmax(0, 6fr) minmax(0, 6fr); gap: var(--s16); } }
.fb-hero__title { margin-top: var(--s6); max-width: 13ch; font-size: var(--step-5); font-weight: 400; }
.fb-hero__actions { margin-top: var(--s10); display: flex; flex-wrap: wrap; gap: var(--s3); }
.fb-dim { position: absolute; left: 14%; right: 14%; top: 17%; z-index: 2; pointer-events: none; }

.fb-points { display: grid; border-top: 1px solid var(--border-strong); }
@media (min-width: 768px) { .fb-points { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.fb-point { padding: var(--s8) 0; border-bottom: 1px solid var(--hairline); }
@media (min-width: 768px) {
  .fb-point { padding: var(--s8) var(--s8) var(--s8) 0; border-bottom: 0; }
  .fb-point + .fb-point { padding-left: var(--s8); border-left: 1px solid var(--hairline); }
}
.fb-point .ed-body { margin-top: var(--s3); font-size: var(--step--1); }
`

/**
 * /for-business — the pitch to furniture stores, given a page of its own so
 * the landing's "for business" CTA and the footer link land somewhere real.
 *
 * A sofa on a plinth stands in for the store's own catalogue: the same live
 * 3D a buyer sees. The landing's sections carry the substance; this page adds
 * a proper h1, three plain promises and a direct line to a person.
 */
export function ForBusinessPage() {
  const { t } = useTranslation()
  const points = (t('public2.business.points', { returnObjects: true }) as Point[]) ?? []

  return (
    <>
      <Seo
        title={t('forBusinessPage.seoTitle')}
        description={t('forBusinessPage.seoDescription')}
        path="/for-business"
      />
      <EditorialStyles />
      <style href="fs-business" precedence="medium">{CSS}</style>

      <section className="fs-container fb-hero">
        <div className="fb-hero__grid">
          <Reveal>
            <span className="fs-eyebrow">
              <span className="fs-eyebrow__dot" aria-hidden="true" />
              {t('forBusinessPage.eyebrow')}
            </span>
            <h1 className="fs-display fb-hero__title">{t('forBusinessPage.title')}</h1>
            <p className="fs-lead" style={{ marginTop: 'var(--s8)', maxWidth: '44ch' }}>
              {t('forBusinessPage.lead')}
            </p>
            <div className="fb-hero__actions">
              <ButtonLink to="/signup?role=business" size="lg" arrow>
                {t('nav.signup')}
              </ButtonLink>
              <ButtonLink to="/contact?topic=business" size="lg" variant="secondary">
                {t('forBusinessPage.cta')}
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <Plinth
              model="sofa"
              palette={PIECE_PALETTES.moss}
              label={t('public2.pieces.sofa')}
              aspect="5 / 4"
              tag={t('public2.business.plinthTag')}
              caption={
                <>
                  <span>{t('public2.pieces.sofa')}</span>
                  <span>{t('public2.modelled')}</span>
                </>
              }
            >
              <div className="fb-dim" aria-hidden="true">
                <DimensionLine value="220" unit="cm" />
              </div>
            </Plinth>
          </Reveal>
        </div>
      </section>

      <section className="fs-container" style={{ paddingBottom: 'var(--s8)' }}>
        <RevealGroup className="fb-points">
          {points.map((point, i) => (
            <RevealItem key={point.title} className="fb-point">
              <span className="ed-index">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="ed-h3" style={{ marginTop: 'var(--s4)' }}>
                {point.title}
              </h2>
              <p className="ed-body">{point.body}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <ForBusiness />
      <Pricing />

      <section className="fs-container" style={{ paddingBottom: 'var(--s24)' }}>
        <Reveal className="ed-cta">
          <div>
            <h2 className="ed-h2" style={{ fontSize: 'var(--step-3)', maxWidth: '18ch' }}>
              {t('public2.business.ctaTitle')}
            </h2>
            <p className="ed-body" style={{ marginTop: 'var(--s4)' }}>
              {t('contact.lead')}
            </p>
          </div>
          <div className="ed-cta__actions">
            <ButtonLink to="/contact?topic=business" size="lg" arrow>
              {t('forBusinessPage.cta')}
            </ButtonLink>
          </div>
        </Reveal>
      </section>
    </>
  )
}
