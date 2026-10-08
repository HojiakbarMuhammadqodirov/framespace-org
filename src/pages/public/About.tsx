import { useTranslation } from 'react-i18next'

import { Seo } from '@/lib/seo'
import { Reveal, RevealGroup, RevealItem } from '@/ui/Reveal'
import { CountUp } from '@/ui/CountUp'
import { ButtonLink } from '@/ui/Button'
import { RoomSketch } from '@/ui/RoomSketch'
import { Plinth, PIECE_PALETTES } from './Plinth'
import { EditorialStyles, emphasize } from './editorial'

type Item = { title: string; body: string }

const CSS = `
.ab-hero { padding-block: var(--s16) var(--s16); }
@media (min-width: 768px) { .ab-hero { padding-block: var(--s24) var(--s16); } }
.ab-hero__grid { display: grid; gap: var(--s12); align-items: end; }
@media (min-width: 960px) {
  .ab-hero__grid { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: var(--s16); }
}
.ab-hero__title { margin-top: var(--s6); max-width: 13ch; font-size: var(--step-5); font-weight: 400; }
.ab-hero__lead { margin-top: var(--s8); max-width: 44ch; }
.ab-hero__meta {
  margin-top: var(--s10); display: flex; flex-wrap: wrap; gap: var(--s2) var(--s6);
  font-family: var(--font-mono); font-size: var(--step--2); letter-spacing: var(--tracking-mono);
  text-transform: uppercase; color: var(--text-muted);
}

.ab-manifesto { display: grid; gap: var(--s8); }
@media (min-width: 900px) { .ab-manifesto { grid-template-columns: 3fr 9fr; gap: var(--s12); } }
.ab-manifesto__text {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 1.1rem + 1.8vw, 2.6rem);
  line-height: 1.28;
  letter-spacing: -0.015em;
  color: var(--text-strong);
  max-width: 30ch;
}
.ab-manifesto__text::first-letter {
  font-style: italic; color: var(--accent-ink);
}

.ab-values { display: grid; gap: 0; margin-top: var(--s12); border-top: 1px solid var(--border-strong); }
@media (min-width: 768px) { .ab-values { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--s12); } }
.ab-value { display: grid; grid-template-columns: 3rem minmax(0, 1fr); gap: var(--s4); padding-block: var(--s8); border-bottom: 1px solid var(--hairline); }
.ab-value .ed-body { margin-top: var(--s3); }

.ab-band { border-radius: var(--radius-3xl); padding: var(--s10) var(--s6); overflow: hidden; }
@media (min-width: 768px) { .ab-band { padding: var(--s16) var(--s12); } }
.ab-band__grid { display: grid; gap: var(--s10); margin-top: var(--s10); }
@media (min-width: 768px) { .ab-band__grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s8); } }
.ab-metric { padding-top: var(--s5); border-top: 1px solid var(--border-strong); }
.ab-metric strong {
  display: block; font-family: var(--font-display); font-weight: 400;
  font-size: clamp(3.5rem, 2.4rem + 4vw, 6rem); line-height: 0.9; letter-spacing: -0.04em; color: var(--text-strong);
}
.ab-metric span { display: block; margin-top: var(--s3); color: var(--text-muted); font-size: var(--step--1); }

.ab-studio { display: grid; gap: var(--s12); }
@media (min-width: 960px) { .ab-studio { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: var(--s16); align-items: start; } }
.ab-roles { display: grid; gap: var(--s4); }
@media (min-width: 640px) { .ab-roles { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.ab-role {
  display: grid; align-content: start; gap: var(--s3);
  padding: var(--s6); border-radius: var(--radius-2xl);
  background: var(--bg-raised); box-shadow: var(--shadow-ambient), inset 0 0 0 1px var(--hairline);
}
.ab-role__mark { width: 56px; height: 56px; margin-bottom: var(--s4); }
.ab-role p { color: var(--text-muted); font-size: var(--step--1); line-height: var(--lh-body); }
.ab-join {
  margin-top: var(--s6); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s5);
  padding: var(--s6); border-radius: var(--radius-2xl); background: var(--bg-sunken); box-shadow: inset 0 0 0 1px var(--hairline);
}
.ab-join p { color: var(--text-muted); font-size: var(--step--1); margin-top: var(--s1); max-width: 40ch; }
.ab-sketch { margin-top: var(--s8); border-radius: var(--radius-2xl); overflow: hidden; aspect-ratio: 16 / 10; box-shadow: inset 0 0 0 1px var(--hairline); }
`

/** Abstract role marks — geometry, not faces. No team photos until real ones exist. */
const MARKS = [
  <svg key="a" className="ab-role__mark" viewBox="0 0 56 56" fill="none" aria-hidden="true">
    <circle cx="28" cy="28" r="27" stroke="var(--hairline)" />
    <path d="M14 38 L14 24 Q14 18 20 18 L36 18 Q42 18 42 24 L42 38" stroke="var(--clay-300)" strokeWidth="1.4" />
    <path d="M14 31 L42 31" stroke="var(--accent)" strokeWidth="1.4" />
  </svg>,
  <svg key="b" className="ab-role__mark" viewBox="0 0 56 56" fill="none" aria-hidden="true">
    <circle cx="28" cy="28" r="27" stroke="var(--hairline)" />
    <path d="M28 12 L42 20 L42 36 L28 44 L14 36 L14 20 Z" stroke="var(--clay-300)" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M14 20 L28 28 L42 20 M28 28 L28 44" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>,
  <svg key="c" className="ab-role__mark" viewBox="0 0 56 56" fill="none" aria-hidden="true">
    <circle cx="28" cy="28" r="27" stroke="var(--hairline)" />
    <circle cx="22" cy="28" r="9" stroke="var(--clay-300)" strokeWidth="1.4" />
    <circle cx="34" cy="28" r="9" stroke="var(--accent)" strokeWidth="1.4" />
  </svg>,
]

export function About() {
  const { t } = useTranslation()

  const values = (t('public2.about.values', { returnObjects: true }) as Item[]) ?? []
  const roles = (t('public2.about.roles', { returnObjects: true }) as Item[]) ?? []
  const metrics = [
    { value: 8, key: 'angles' },
    { value: 3, key: 'languages' },
    { value: 4, key: 'minutes' },
  ]

  return (
    <>
      <Seo title={`${t('nav.about')} — FrameSpace`} description={t('about.lead')} path="/about" />
      <EditorialStyles />
      <style href="fs-about" precedence="medium">{CSS}</style>

      {/* ---- hero ------------------------------------------------------ */}
      <section className="fs-container ab-hero">
        <div className="ab-hero__grid">
          <Reveal>
            <span className="fs-eyebrow">
              <span className="fs-eyebrow__dot" aria-hidden="true" />
              {t('nav.about')}
            </span>
            <h1 className="fs-display ab-hero__title">
              {emphasize(t('about.title'), t('public2.about.titleEm'))}
            </h1>
            <p className="fs-lead ab-hero__lead">{t('about.lead')}</p>
            <div className="ab-hero__meta" aria-hidden="true">
              <span>41.31° N · 69.28° E</span>
              <span>Toshkent · 2026</span>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <Plinth
              model="armchair"
              palette={PIECE_PALETTES.terracotta}
              label={t('public2.pieces.armchair')}
              tag={t('public2.about.plinthTag')}
              caption={
                <>
                  <span>{t('public2.pieces.armchair')}</span>
                  <span>84 × 86 × 80</span>
                </>
              }
            />
          </Reveal>
        </div>
      </section>

      {/* ---- manifesto ------------------------------------------------- */}
      <section className="fs-container ed-section" style={{ paddingTop: 'var(--s12)' }}>
        <Reveal className="ab-manifesto">
          <div>
            <hr className="fs-rule-strong" />
            <p className="ed-index" style={{ marginTop: 'var(--s4)' }}>
              01 — {t('public2.about.manifestoLabel')}
            </p>
          </div>
          <p className="ab-manifesto__text">{t('about.body')}</p>
        </Reveal>
      </section>

      {/* ---- values ---------------------------------------------------- */}
      <section className="fs-container ed-section" style={{ paddingTop: 0 }} aria-labelledby="ab-values">
        <Reveal>
          <p className="ed-index">02 — {t('public2.about.valuesLabel')}</p>
          <h2 id="ab-values" className="ed-h2" style={{ marginTop: 'var(--s4)' }}>
            {t('public2.about.valuesTitle')} <em className="ed-em">{t('public2.about.valuesTitleEm')}</em>
          </h2>
        </Reveal>
        <RevealGroup className="ab-values">
          {values.map((value, i) => (
            <RevealItem key={value.title} className="ab-value">
              <span className="ed-index" style={{ paddingTop: '0.5em' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="ed-h3">{value.title}</h3>
                <p className="ed-body">{value.body}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* ---- metrics band --------------------------------------------- */}
      <section className="fs-container" aria-labelledby="ab-metrics">
        <Reveal>
          <div className="ab-band" data-surface="inverse">
            <p className="ed-index" style={{ color: 'var(--accent-soft)' }}>
              03 — {t('about.metricsLabel')}
            </p>
            <h2 id="ab-metrics" className="ed-h2" style={{ marginTop: 'var(--s4)', fontSize: 'var(--step-3)' }}>
              {t('public2.about.metricsTitle')}
            </h2>
            <div className="ab-band__grid">
              {metrics.map((metric) => (
                <div key={metric.key} className="ab-metric">
                  <strong>
                    <CountUp to={metric.value} />
                  </strong>
                  <span>{t(`about.metrics.${metric.key}`)}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---- studio ---------------------------------------------------- */}
      <section className="fs-container ed-section" aria-labelledby="ab-studio">
        <div className="ab-studio">
          <Reveal>
            <p className="ed-index">04 — {t('public2.about.studioLabel')}</p>
            <h2 id="ab-studio" className="ed-h2" style={{ marginTop: 'var(--s4)', fontSize: 'var(--step-3)' }}>
              {t('public2.about.studioTitle')}
            </h2>
            <p className="ed-body" style={{ marginTop: 'var(--s5)' }}>
              {t('public2.about.studioBody')}
            </p>
            <div className="ab-sketch">
              <RoomSketch dressed showDimension={false} />
            </div>
          </Reveal>

          <div>
            <RevealGroup className="ab-roles">
              {roles.map((role, i) => (
                <RevealItem key={role.title} className="ab-role">
                  {MARKS[i % MARKS.length]}
                  <h3 className="ed-h3" style={{ fontSize: 'var(--step-1)' }}>
                    {role.title}
                  </h3>
                  <p>{role.body}</p>
                </RevealItem>
              ))}
            </RevealGroup>
            <Reveal>
              <div className="ab-join">
                <div>
                  <h3 className="ed-h3" style={{ fontSize: 'var(--step-1)' }}>
                    {t('public2.about.joinTitle')}
                  </h3>
                  <p>{t('public2.about.joinBody')}</p>
                </div>
                <ButtonLink to="/contact" variant="secondary" size="sm" arrow>
                  {t('public2.about.joinCta')}
                </ButtonLink>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---- closing --------------------------------------------------- */}
      <section className="fs-container" style={{ paddingBottom: 'var(--s24)' }}>
        <Reveal className="ed-cta">
          <h2 className="ed-h2">
            {t('public2.about.ctaTitle')} <em className="ed-em">{t('public2.about.ctaTitleEm')}</em>
          </h2>
          <div className="ed-cta__actions">
            <ButtonLink to="/app/capture" size="lg" arrow>
              {t('public2.about.ctaPrimary')}
            </ButtonLink>
            <ButtonLink to="/catalog" size="lg" variant="secondary">
              {t('public2.about.ctaSecondary')}
            </ButtonLink>
          </div>
        </Reveal>
      </section>
    </>
  )
}
