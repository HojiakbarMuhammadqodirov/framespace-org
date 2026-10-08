import { Suspense, lazy, useMemo } from 'react'
import { Link, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'framer-motion'

import { Seo } from '@/lib/seo'
import { ButtonLink } from '@/ui/Button'
import { EASE } from '@/design/motion'
import { PRODUCTS } from '@/features/catalog/data'

const ProductViewer = lazy(() => import('@/three/ProductViewer'))

const CSS = `
.nf {
  position: relative;
  min-height: calc(100dvh - var(--hdr-offset, 0px));
  display: grid;
  align-items: center;
  padding-block: var(--s16) var(--s24);
  overflow: hidden;
}
.nf__grid { display: grid; gap: var(--s10); align-items: center; }
@media (min-width: 960px) { .nf__grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: var(--s16); } }
.nf__code {
  font-family: var(--font-display);
  font-size: clamp(6rem, 22vw, 15rem);
  line-height: 0.82;
  letter-spacing: -0.06em;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
}
.nf__code em { font-style: italic; color: var(--accent-ink); }
.nf__title {
  margin-top: var(--s8);
  font-family: var(--font-display);
  font-size: var(--step-3);
  line-height: var(--lh-tight);
  letter-spacing: var(--tracking-display);
  color: var(--text-strong);
  max-width: 18ch;
}
.nf__lead { margin-top: var(--s4); max-width: 44ch; }
.nf__path {
  display: inline-block;
  margin-top: var(--s6);
  padding: var(--s1) var(--s3);
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.06em;
  color: var(--text-muted);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nf__actions { margin-top: var(--s8); display: flex; gap: var(--s5); flex-wrap: wrap; align-items: center; }
.nf__stage {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 2.25rem;
  padding: var(--s2);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.nf__plate {
  position: relative;
  height: 100%;
  border-radius: calc(2.25rem - var(--s2));
  overflow: hidden;
  background:
    radial-gradient(80% 70% at 50% 35%, color-mix(in srgb, var(--white) 55%, transparent), transparent 70%),
    var(--bg-raised);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--white) 60%, transparent), inset 0 0 0 1px var(--hairline);
}
.nf__caption {
  position: absolute;
  left: var(--s5);
  bottom: var(--s5);
  z-index: 2;
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.nf__links { margin-top: var(--s12); display: flex; flex-wrap: wrap; gap: var(--s2); }
`

/** Any URL nothing else claims. Localised, never indexed, a 3D piece and three ways out. */
export function NotFound() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const reduced = useReducedMotion()
  const title = t('notFound.title')

  // A lone armchair "looking for its room" — picked deterministically by path.
  const piece = useMemo(() => {
    const chairs = PRODUCTS.filter((p) => p.model === 'armchair')
    const pool = chairs.length ? chairs : PRODUCTS
    let h = 0
    for (let i = 0; i < pathname.length; i += 1) h = (h * 31 + pathname.charCodeAt(i)) >>> 0
    return pool[h % pool.length]
  }, [pathname])

  const rise = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.7, ease: EASE, delay: reduced ? 0 : delay },
  })

  return (
    <>
      <style href="fs-notfound" precedence="medium">
        {CSS}
      </style>
      <Seo title={`${title} — ${t('brand.name')}`} description={t('brand.tagline')} path={pathname} noindex />

      <section className="nf">
        <div className="fs-container">
          <div className="nf__grid">
            <div>
              <motion.div className="nf__code" aria-hidden="true" {...rise(0)}>
                4<em>0</em>4
              </motion.div>
              <motion.h1 className="nf__title" {...rise(0.08)}>
                {title}
              </motion.h1>
              <motion.p className="fs-lead nf__lead" {...rise(0.14)}>
                {t('notFound.lead')}
              </motion.p>
              <motion.code className="nf__path" {...rise(0.18)}>
                {pathname}
              </motion.code>
              <motion.div className="nf__actions" {...rise(0.22)}>
                <ButtonLink to="/" arrow>
                  {t('notFound.home')}
                </ButtonLink>
                <Link to="/catalog" className="fs-navlink">
                  {t('notFound.catalog')}
                </Link>
                <Link to="/contact" className="fs-navlink">
                  {t('nav.contact')}
                </Link>
              </motion.div>
            </div>

            <motion.div className="nf__stage" {...rise(0.12)}>
              <div className="nf__plate">
                {piece && (
                  <Suspense fallback={null}>
                    <ProductViewer
                      model={piece.model}
                      palette={piece.palette}
                      spin={!reduced}
                      spinSpeed={0.28}
                      shadows
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                      label={t(`catalog.products.${piece.nameKey}.name`)}
                    />
                  </Suspense>
                )}
                <span className="nf__caption">{piece ? `${piece.brand} — ${t(`catalog.products.${piece.nameKey}.name`)}` : ''}</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  )
}

export default NotFound
