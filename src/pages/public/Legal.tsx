import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Seo } from '@/lib/seo'
import { Reveal } from '@/ui/Reveal'

export type LegalDoc = 'terms' | 'privacy'
type Section = { h: string; p: string }

const CSS = `
.lg { padding-block: var(--s24) var(--s32); }
.lg__grid { display: grid; gap: var(--s12); }
@media (min-width: 960px) { .lg__grid { grid-template-columns: 16rem minmax(0, 1fr); gap: var(--s16); align-items: start; } }
.lg__toc { position: sticky; top: calc(var(--hdr-offset, 88px) + var(--s4)); display: none; }
@media (min-width: 960px) { .lg__toc { display: block; } }
.lg__toc ol { list-style: none; margin: var(--s4) 0 0; padding: 0; display: grid; gap: var(--s2); }
.lg__toc a {
  display: flex; gap: var(--s3); align-items: baseline;
  color: var(--text-muted); text-decoration: none; font-size: var(--step--1);
  transition: color var(--d-fast) var(--ease);
}
.lg__toc a:hover { color: var(--text-strong); }
.lg__toc span { font-family: var(--font-mono); font-size: var(--step--2); color: var(--accent-ink); }
.lg__switch { display: flex; gap: var(--s2); flex-wrap: wrap; margin-top: var(--s8); }
.lg__body { display: grid; gap: var(--s2); }
.lg__sec {
  display: grid; gap: var(--s3);
  padding: var(--s8) 0;
  border-top: 1px solid var(--hairline);
  scroll-margin-top: calc(var(--hdr-offset, 88px) + var(--s4));
}
@media (min-width: 720px) { .lg__sec { grid-template-columns: 3.5rem minmax(0, 1fr); } }
.lg__n { font-family: var(--font-mono); font-size: var(--step--2); letter-spacing: 0.12em; color: var(--accent-ink); padding-top: 0.5em; }
.lg__h { font-family: var(--font-display); font-size: var(--step-2); line-height: var(--lh-tight); color: var(--text-strong); }
.lg__p { margin-top: var(--s3); color: var(--text-muted); max-width: 62ch; line-height: 1.7; }
.lg__updated { font-family: var(--font-mono); font-size: var(--step--2); letter-spacing: 0.08em; color: var(--text-muted); margin-top: var(--s6); }
.lg__foot { margin-top: var(--s12); padding: var(--s8); border-radius: 1.5rem; background: var(--bg-sunken); box-shadow: inset 0 0 0 1px var(--hairline); display: flex; flex-wrap: wrap; gap: var(--s4); align-items: center; justify-content: space-between; }
`

/** /legal/terms and /legal/privacy — real, translated documents. */
export function Legal({ doc }: { doc: LegalDoc }) {
  const { t } = useTranslation()
  const raw = t(`legal.${doc}.sections`, { returnObjects: true }) as unknown
  const sections: Section[] = Array.isArray(raw) ? (raw as Section[]) : []
  const title = t(`legal.${doc}.title`)

  return (
    <>
      <style href="fs-legal" precedence="medium">
        {CSS}
      </style>
      <Seo title={`${title} — ${t('brand.name')}`} description={t(`legal.${doc}.lead`)} path={`/legal/${doc}`} />

      <section className="fs-container lg">
        <Reveal>
          <span className="fs-eyebrow">
            <span className="fs-eyebrow__dot" aria-hidden="true" />
            {t('legal.eyebrow')}
          </span>
          <h1 className="fs-display" style={{ marginTop: 'var(--s5)', maxWidth: '16ch' }}>
            {title}
          </h1>
          <p className="fs-lead" style={{ marginTop: 'var(--s6)', maxWidth: '52ch' }}>
            {t(`legal.${doc}.lead`)}
          </p>
          <p className="lg__updated">{t('legal.updated')}</p>
          <div className="lg__switch">
            {(['terms', 'privacy'] as const).map((d) => (
              <Link key={d} to={`/legal/${d}`} className="fs-chip" data-selected={d === doc} aria-current={d === doc ? 'page' : undefined}>
                {t(`legal.${d}.title`)}
              </Link>
            ))}
          </div>
        </Reveal>

        <div className="lg__grid" style={{ marginTop: 'var(--s16)' }}>
          <nav className="lg__toc" aria-label={t('legal.toc')}>
            <span className="fs-label">{t('legal.toc')}</span>
            <ol>
              {sections.map((s, i) => (
                <li key={s.h}>
                  <a href={`#s${i + 1}`}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {s.h}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="lg__body">
            {sections.map((s, i) => (
              <section className="lg__sec" id={`s${i + 1}`} key={s.h}>
                <span className="lg__n">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h2 className="lg__h">{s.h}</h2>
                  <p className="lg__p">{s.p}</p>
                </div>
              </section>
            ))}
            <div className="lg__foot">
              <span className="lg__h" style={{ fontSize: 'var(--step-1)' }}>
                {t('legal.contactCta')}
              </span>
              <Link to="/contact" className="fs-navlink">
                {t('nav.contact')} →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default Legal
