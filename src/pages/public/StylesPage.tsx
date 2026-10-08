import { useTranslation } from 'react-i18next'

import { Seo } from '@/lib/seo'
import { Reveal } from '@/ui/Reveal'
import { ButtonLink } from '@/ui/Button'
import { STYLES } from '@/lib/styles'
import type { ProductModelKey, ProductPalette } from '@/three/ProductViewer'
import { Plinth } from './Plinth'
import { EditorialStyles } from './editorial'

type StyleEntry = { name: string; blurb: string; swatch: string[] }

/**
 * Each style's dossier: an i18n slug, the signature piece that stands on its
 * plinth, and the six colour roles that piece is painted with. The swatches
 * on the page are the API's own (`STYLES`); these extend them to a material.
 */
const DOSSIER: Record<string, { slug: string; model: ProductModelKey; palette: ProductPalette }> = {
  Scandinavian: {
    slug: 'scandinavian',
    model: 'armchair',
    palette: { body: '#E6DDD0', accent: '#8C7B6B', wood: '#D2B998', metal: '#9A9186', fabric: '#F2EDE6', neutral: '#FAF6F0' },
  },
  Japandi: {
    slug: 'japandi',
    model: 'coffeeTable',
    palette: { body: '#B9A58C', accent: '#7A6A58', wood: '#9C7F60', metal: '#5C534A', fabric: '#E6DDD0', neutral: '#EFE9E1' },
  },
  Minimalist: {
    slug: 'minimalist',
    model: 'diningTable',
    palette: { body: '#E8E6E2', accent: '#33312E', wood: '#D9D5CE', metal: '#33312E', fabric: '#F0EEEB', neutral: '#F6F5F3' },
  },
  'Mid-century modern': {
    slug: 'midcentury',
    model: 'sideboard',
    palette: { body: '#8C5A34', accent: '#D89B63', wood: '#7A4B2A', metal: '#B8935A', fabric: '#D9A877', neutral: '#EFE3D2' },
  },
  Industrial: {
    slug: 'industrial',
    model: 'shelf',
    palette: { body: '#4A4540', accent: '#8A6A4F', wood: '#6E5440', metal: '#2A2724', fabric: '#8F877E', neutral: '#DFDCD7' },
  },
  Bohemian: {
    slug: 'bohemian',
    model: 'planter',
    palette: { body: '#C27A45', accent: '#D9A05B', wood: '#A47A4E', metal: '#7C6A4F', fabric: '#E9D6BA', neutral: '#F3E7D6' },
  },
  'Modern luxe': {
    slug: 'luxe',
    model: 'sofa',
    palette: { body: '#3F5147', accent: '#C7B299', wood: '#4A3A2E', metal: '#B8975A', fabric: '#3F5147', neutral: '#EDE9E4' },
  },
  Coastal: {
    slug: 'coastal',
    model: 'bed',
    palette: { body: '#E9E4DA', accent: '#7E9AA6', wood: '#CDBFA8', metal: '#A3A8A6', fabric: '#CFDCE0', neutral: '#F4F1EA' },
  },
}

const CSS = `
.sp-hero { padding-block: var(--s16) var(--s12); }
@media (min-width: 768px) { .sp-hero { padding-block: var(--s24) var(--s12); } }
.sp-hero__grid { display: grid; gap: var(--s8); align-items: end; }
@media (min-width: 960px) { .sp-hero__grid { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: var(--s16); } }
.sp-hero__title { margin-top: var(--s6); max-width: 12ch; font-size: var(--step-5); font-weight: 400; }

.sp-index { margin-top: var(--s12); border-top: 1px solid var(--border-strong); }
.sp-index ol {
  list-style: none; margin: 0; padding: 0;
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (min-width: 768px) { .sp-index ol { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.sp-index a {
  display: flex; align-items: center; gap: var(--s3);
  min-height: var(--tap); padding: var(--s3) var(--s2) var(--s3) 0;
  border-bottom: 1px solid var(--hairline);
  color: var(--text); text-decoration: none; font-size: var(--step--1);
  transition: color var(--d-fast) var(--ease);
}
.sp-index a:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: var(--radius-sm); }
@media (hover: hover) and (pointer: fine) { .sp-index a:hover { color: var(--accent-ink); } }
.sp-index__n { font-family: var(--font-mono); font-size: var(--step--2); color: var(--text-faint); letter-spacing: 0.08em; }
.sp-index__dots { display: inline-flex; margin-left: auto; }
.sp-index__dots i { width: 10px; height: 10px; border-radius: 50%; margin-left: -3px; box-shadow: 0 0 0 1.5px var(--bg); }

.sp-list { display: grid; gap: var(--s4); padding-bottom: var(--s16); }
.sp-row {
  display: grid; gap: var(--s8); align-items: center;
  padding-block: var(--s12);
  border-top: 1px solid var(--hairline);
  scroll-margin-top: calc(var(--hdr-offset, 88px) + var(--s4));
}
@media (min-width: 960px) {
  .sp-row { grid-template-columns: minmax(0, 6fr) minmax(0, 5fr); gap: var(--s16); padding-block: var(--s16); }
  .sp-row:nth-child(even) .sp-row__media { order: 2; }
}
.sp-row__head { display: flex; align-items: baseline; gap: var(--s4); }
.sp-row__num {
  font-family: var(--font-display); font-style: italic; font-weight: 400;
  font-size: var(--step-3); line-height: 1; color: var(--accent-ink);
}
.sp-row__name {
  font-family: var(--font-display); font-weight: 400;
  font-size: var(--step-4); line-height: var(--lh-display); letter-spacing: var(--tracking-display);
  color: var(--text-strong);
}
.sp-row__mood { margin-top: var(--s4); font-family: var(--font-display); font-style: italic; font-size: var(--step-1); color: var(--text); }
.sp-row__blurb { margin-top: var(--s3); color: var(--text-muted); max-width: 42ch; }

.sp-spec { margin-top: var(--s8); display: grid; gap: var(--s6); }
.sp-spec__label { display: block; margin-bottom: var(--s3); }
.sp-swatches { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s2); max-width: 26rem; }
.sp-swatch {
  display: grid; align-content: end;
  aspect-ratio: 4 / 3; padding: var(--s2) var(--s3);
  border-radius: var(--radius-lg);
  box-shadow: inset 0 0 0 1px var(--bezel-ring);
  font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
}
.sp-materials { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--s2); }
.sp-materials li {
  padding: var(--s1) var(--s3); border-radius: var(--radius-full);
  background: var(--bg-sunken); box-shadow: inset 0 0 0 1px var(--hairline);
  font-size: var(--step--1); color: var(--text);
}
.sp-row__cta { margin-top: var(--s8); }
`

/** Readable ink on a swatch: dark on pale paint, paper on deep paint. */
function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luma > 0.55 ? 'rgba(42, 29, 22, 0.72)' : 'rgba(246, 241, 233, 0.86)'
}

/**
 * The eight styles. `STYLES` is the API contract — the `name` is sent verbatim
 * to the render endpoint and keys the server's demo palettes, so the English
 * name travels while only the label is translated.
 */
export function StylesPage() {
  const { t } = useTranslation()
  const styles = STYLES as StyleEntry[]

  return (
    <>
      <Seo title={`${t('nav.styles')} — FrameSpace`} description={t('stylesPage.lead')} path="/styles" />
      <EditorialStyles />
      <style href="fs-styles" precedence="medium">{CSS}</style>

      <section className="fs-container sp-hero">
        <Reveal>
          <div className="sp-hero__grid">
            <div>
              <span className="fs-eyebrow">
                <span className="fs-eyebrow__dot" aria-hidden="true" />
                {t('nav.styles')}
              </span>
              <h1 className="fs-display sp-hero__title">{t('stylesPage.title')}</h1>
            </div>
            <p className="fs-lead" style={{ maxWidth: '40ch' }}>
              {t('stylesPage.lead')}
            </p>
          </div>

          <nav className="sp-index" aria-label={t('public2.styles.index')}>
            <ol>
              {styles.map((style, i) => {
                const d = DOSSIER[style.name]
                return (
                  <li key={style.name}>
                    <a href={`#${d?.slug ?? i}`}>
                      <span className="sp-index__n">{String(i + 1).padStart(2, '0')}</span>
                      {t(`styles.${style.name}`, { defaultValue: style.name })}
                      <span className="sp-index__dots" aria-hidden="true">
                        {style.swatch.map((hex) => (
                          <i key={hex} style={{ background: hex }} />
                        ))}
                      </span>
                    </a>
                  </li>
                )
              })}
            </ol>
          </nav>
        </Reveal>
      </section>

      <section className="fs-container sp-list">
        {styles.map((style, i) => {
          const d = DOSSIER[style.name]
          const label = t(`styles.${style.name}`, { defaultValue: style.name })
          const materials = d
            ? (t(`public2.styles.items.${d.slug}.materials`, { returnObjects: true }) as string[])
            : []
          const pieceName = d ? t(`public2.pieces.${d.model}`) : ''
          const headingId = `sp-${d?.slug ?? i}`
          return (
            <article key={style.name} id={d?.slug ?? String(i)} className="sp-row" aria-labelledby={headingId}>
              <Reveal className="sp-row__media">
                {d && (
                  <Plinth
                    model={d.model}
                    palette={d.palette}
                    label={`${label} — ${pieceName}`}
                    aspect="5 / 4"
                    tag={label}
                    caption={
                      <>
                        <span>
                          {t('public2.styles.piece')}: {pieceName}
                        </span>
                        <span>{String(i + 1).padStart(2, '0')} / 08</span>
                      </>
                    }
                  />
                )}
              </Reveal>

              <Reveal delay={0.06}>
                <div className="sp-row__head">
                  <span className="sp-row__num" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 id={headingId} className="sp-row__name">
                    {label}
                  </h2>
                </div>
                {d && <p className="sp-row__mood">{t(`public2.styles.items.${d.slug}.mood`)}</p>}
                <p className="sp-row__blurb">{t(`styles.blurb.${style.name}`, { defaultValue: style.blurb })}</p>

                <div className="sp-spec">
                  <div>
                    <span className="fs-label sp-spec__label">{t('public2.styles.palette')}</span>
                    <div className="sp-swatches">
                      {style.swatch.map((hex) => (
                        <span key={hex} className="sp-swatch" style={{ background: hex, color: inkOn(hex) }}>
                          {hex}
                        </span>
                      ))}
                    </div>
                  </div>
                  {Array.isArray(materials) && materials.length > 0 && (
                    <div>
                      <span className="fs-label sp-spec__label">{t('public2.styles.materials')}</span>
                      <ul className="sp-materials">
                        {materials.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="sp-row__cta">
                  <ButtonLink
                    to={`/app/capture?style=${encodeURIComponent(style.name)}`}
                    variant="secondary"
                    arrow
                  >
                    {t('stylesPage.pick')}
                  </ButtonLink>
                </div>
              </Reveal>
            </article>
          )
        })}
      </section>

      <section className="fs-container" style={{ paddingBottom: 'var(--s24)' }}>
        <Reveal className="ed-cta">
          <div>
            <h2 className="ed-h2" style={{ fontSize: 'var(--step-3)', maxWidth: '18ch' }}>
              {t('public2.styles.ctaTitle')}
            </h2>
            <p className="ed-body" style={{ marginTop: 'var(--s4)' }}>
              {t('public2.styles.ctaBody')}
            </p>
          </div>
          <div className="ed-cta__actions">
            <ButtonLink to="/app/capture" size="lg" arrow>
              {t('public2.styles.ctaButton')}
            </ButtonLink>
          </div>
        </Reveal>
      </section>
    </>
  )
}
