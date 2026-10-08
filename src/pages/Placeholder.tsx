import { Suspense, lazy } from 'react'
import { useTranslation } from 'react-i18next'

import { Seo } from '@/lib/seo'
import { ButtonLink } from '@/ui/Button'
import { ensureSections } from '@/i18n/config'

/** Legal documents carry their copy in the lazily loaded `public` section. */
const Legal = lazy(() =>
  Promise.all([import('@/pages/public/Legal'), ensureSections()]).then(([m]) => ({ default: m.Legal }))
)

/**
 * Routes the router still mounts through this component. The two legal
 * routes render their real documents; anything else gets a calm, branded
 * holding page with a way back.
 */
export function Placeholder({
  labelKey,
  titleKey,
  path,
}: {
  /** i18n key of the eyebrow above the title, e.g. "placeholder.legal". */
  labelKey: string
  titleKey: string
  /** Kept for router compatibility; no longer shown. */
  step?: number
  path: string
}) {
  const { t } = useTranslation()

  if (path === '/legal/terms' || path === '/legal/privacy') {
    return (
      <Suspense fallback={<section className="fs-container" style={{ minHeight: '80dvh' }} />}>
        <Legal doc={path === '/legal/terms' ? 'terms' : 'privacy'} />
      </Suspense>
    )
  }

  const title = t(titleKey)
  return (
    <>
      <Seo title={`${title} — ${t('brand.name')}`} description={t('brand.tagline')} path={path} noindex />
      <section
        className="fs-container"
        style={{ paddingBlock: 'var(--s24) var(--s32)', minHeight: '70dvh', display: 'grid', alignContent: 'center' }}
      >
        <span className="fs-eyebrow">
          <span className="fs-eyebrow__dot" aria-hidden="true" />
          {t(labelKey)}
        </span>
        <h1
          className="fs-display"
          style={{ marginTop: 'var(--s6)', maxWidth: '16ch', fontSize: 'var(--step-5)', fontWeight: 400 }}
        >
          {title}
        </h1>
        <p className="fs-lead" style={{ marginTop: 'var(--s6)', maxWidth: '44ch' }}>
          {t('public2.placeholder.lead', {
            defaultValue: 'Bu sahifa ustida ishlayapmiz. Hozircha bosh sahifa yoki katalogdan davom eting.',
          })}
        </p>
        <div style={{ marginTop: 'var(--s10)', display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap' }}>
          <ButtonLink to="/" arrow>
            {t('notFound.home')}
          </ButtonLink>
          <ButtonLink to="/catalog" variant="secondary">
            {t('public2.placeholder.catalog', { defaultValue: 'Katalogni ochish' })}
          </ButtonLink>
        </div>
      </section>
    </>
  )
}
