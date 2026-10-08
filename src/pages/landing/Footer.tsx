import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Marquee } from '@/ui/Interactive'
import { Logo } from '@/ui/Logo'
import { Reveal } from '@/ui/Reveal'

/**
 * §12 — the footer.
 *
 * Large and editorial rather than a compressed strip: the mark and the tagline
 * take the left five columns, the three link columns sit in 7-12, and a mono
 * bottom bar closes the page under a hairline. The mark itself is sized up
 * from the header's — this is the page's closing statement, not another nav
 * — and a `Marquee` of the catalog's style names runs the full width above
 * the bottom bar, a last texture before the page ends. The three link
 * columns stagger up on their own delays rather than firing together, since
 * they can't share a single reveal wrapper without breaking the grid's
 * explicit column placement.
 *
 * Each column's <nav> carries `.fs-nav` so the existing "dim the siblings on
 * hover" behaviour in components.css applies, and the links carry `.fs-navlink`
 * for the underline that draws itself in.
 *
 * NOTE for the locale agent: `/legal/terms` and `/legal/privacy` are in the
 * sitemap but no key was specified for their labels. They read
 * `landing.footer.terms` / `landing.footer.privacy` with an English
 * defaultValue so the footer never renders a raw key; adding those two strings
 * to the locale files is all that is needed.
 */

type Column = {
  heading: string
  links: Array<{ to: string; label: string }>
}

const CSS = `
.fs-foot {
  padding-block: var(--section-y) var(--s10);
  border-top: 1px solid var(--border-strong);
}
.fs-foot__brand {
  grid-column: 1 / -1;
}
.fs-foot__col {
  grid-column: span 2;
}
.fs-foot__grid {
  row-gap: var(--s10);
}
.fs-foot__list {
  list-style: none;
  margin: var(--s4) 0 0;
  padding: 0;
}
.fs-foot__col .fs-navlink {
  display: flex;
  align-items: center;
  min-height: var(--tap);
}
.fs-foot__bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s3) var(--s6);
  justify-content: space-between;
  margin-top: var(--section-gap);
  padding-top: var(--s6);
  border-top: 1px solid var(--hairline);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  font-weight: 500;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.fs-foot__marquee {
  margin-top: var(--section-gap);
  padding-top: var(--s6);
  border-top: 1px solid var(--hairline);
}
.fs-foot__style {
  display: inline-flex;
  align-items: center;
  gap: var(--s6);
  color: var(--text-muted);
  font-family: var(--font-display);
  font-style: italic;
  font-size: var(--step-3);
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.fs-foot__style::after {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--accent);
  opacity: 0.6;
}

@media (min-width: 768px) {
  .fs-foot__brand { grid-column: 1 / 6; }
  .fs-foot__col--0 { grid-column: 7 / 9; }
  .fs-foot__col--1 { grid-column: 9 / 11; }
  .fs-foot__col--2 { grid-column: 11 / 13; }
}
`

export function Footer() {
  const { t } = useTranslation()

  const rawStyles = t('styles', { returnObjects: true }) as unknown
  const styleNames: string[] =
    rawStyles && typeof rawStyles === 'object'
      ? // Only the names: the same namespace also holds `styles.blurb.*`, and an
        // object in this list would crash the render.
        Object.values(rawStyles as Record<string, unknown>).filter(
          (v): v is string => typeof v === 'string'
        )
      : []

  const columns: Column[] = [
    {
      heading: t('landing.footer.product'),
      links: [
        { to: '/how-it-works', label: t('nav.howItWorks') },
        { to: '/catalog', label: t('nav.catalog') },
        { to: '/styles', label: t('nav.styles') },
        { to: '/gallery', label: t('nav.gallery') },
        { to: '/pricing', label: t('nav.pricing') },
      ],
    },
    {
      heading: t('landing.footer.company'),
      links: [
        { to: '/for-business', label: t('nav.forBusiness') },
        { to: '/about', label: t('nav.about') },
        { to: '/contact', label: t('nav.contact') },
      ],
    },
    {
      heading: t('landing.footer.legal'),
      links: [
        { to: '/faq', label: t('nav.faq') },
        { to: '/legal/terms', label: t('landing.footer.terms', { defaultValue: 'Terms' }) },
        { to: '/legal/privacy', label: t('landing.footer.privacy', { defaultValue: 'Privacy' }) },
      ],
    },
  ]

  return (
    <footer className="fs-foot">
      <style href="fs-landing-footer" precedence="medium">
        {CSS}
      </style>

      <div className="fs-container">
        <div className="fs-grid fs-foot__grid">
          <Reveal className="fs-foot__brand">
            <Logo size={48} />
            <p
              style={{
                marginTop: 'var(--s6)',
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--step-2)',
                lineHeight: 1.3,
                letterSpacing: 'var(--tracking-heading)',
                color: 'var(--text-strong)',
                maxWidth: '24ch',
              }}
            >
              {t('landing.footer.tagline')}
            </p>
          </Reveal>

          {columns.map((column, i) => (
            <Reveal key={column.heading} className={`fs-foot__col fs-foot__col--${i}`} delay={i * 0.08}>
              <FooterColumn column={column} />
            </Reveal>
          ))}
        </div>

        {styleNames.length > 0 && (
          <div className="fs-foot__marquee">
            <Marquee speed={26}>
              {styleNames.map((name) => (
                <span className="fs-foot__style" key={name}>
                  {name}
                </span>
              ))}
            </Marquee>
          </div>
        )}

        <div className="fs-foot__bar">
          <span>{t('landing.footer.rights')}</span>
          <span>{t('landing.footer.madeIn')}</span>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ column }: { column: Column }) {
  return (
    <nav className="fs-nav" aria-label={column.heading}>
      <span className="fs-label">{column.heading}</span>
      <ul className="fs-foot__list">
        {column.links.map((link) => (
          <li key={link.to}>
            <Link className="fs-navlink" to={link.to}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
