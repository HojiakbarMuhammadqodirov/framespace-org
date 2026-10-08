import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Seo } from '@/lib/seo'
import { BeforeAfter } from '@/ui/BeforeAfter'
import { RoomSketch } from '@/ui/RoomSketch'
import { Chip } from '@/ui/Chip'
import { Reveal } from '@/ui/Reveal'
import { CountUp } from '@/ui/CountUp'
import { STYLES } from '@/lib/styles'
import { ButtonLink } from '@/ui/Button'
import { EditorialStyles } from './editorial'

type Shot = { id: string; style: string; room: string; area: number; tone: string }

/**
 * The before/after showcase. Every image here is a drawn blueprint room, not a
 * photograph: this repository ships no image assets. When real project photos
 * exist they drop straight into the `before`/`after` slots of `BeforeAfter`.
 */
const SHOTS: Shot[] = [
  { id: 'g1', style: 'Japandi', room: 'living', area: 24.4, tone: 'var(--clay-300)' },
  { id: 'g2', style: 'Minimalist', room: 'bedroom', area: 16.8, tone: 'var(--clay-500)' },
  { id: 'g3', style: 'Modern luxe', room: 'living', area: 31.2, tone: 'var(--accent)' },
  { id: 'g4', style: 'Scandinavian', room: 'kitchen', area: 12.6, tone: 'var(--clay-300)' },
  { id: 'g5', style: 'Industrial', room: 'office', area: 19.0, tone: 'var(--clay-700)' },
  { id: 'g6', style: 'Bohemian', room: 'living', area: 27.5, tone: 'var(--accent)' },
]

export function Gallery() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<string | null>(null)
  const shots = filter ? SHOTS.filter((s) => s.style === filter) : SHOTS
  const styles = [...new Set(SHOTS.map((s) => s.style))]

  return (
    <>
      <Seo title={`${t('nav.gallery')} — FrameSpace`} description={t('gallery.lead')} path="/gallery" />

      <EditorialStyles />
      <style href="fs-gallery" precedence="medium">{`
        .fs-gal-hero { padding-block: var(--s16) var(--s10); }
        @media (min-width: 768px) { .fs-gal-hero { padding-block: var(--s24) var(--s12); } }
        .fs-gal-hero__grid { display: grid; gap: var(--s8); align-items: end; }
        @media (min-width: 960px) { .fs-gal-hero__grid { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: var(--s16); } }
        .fs-gal-hero__title { margin-top: var(--s6); max-width: 13ch; font-size: var(--step-5); font-weight: 400; }
        .fs-gal-filter {
          display: flex; gap: var(--s2); flex-wrap: wrap; align-items: center;
          margin-top: var(--s12); padding-top: var(--s6); border-top: 1px solid var(--border-strong);
        }
        .fs-gal-filter__count { margin-left: auto; color: var(--text-muted); }
        @media (max-width: 639px) { .fs-gal-filter__count { flex-basis: 100%; margin-left: 0; margin-top: var(--s2); } }
        .fs-gal { display: grid; gap: var(--s10); grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 768px) {
          .fs-gal { grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--s12) var(--s8); }
          /* Alternating 7/5 then 5/7 — editorial rhythm, aligned rows. */
          .fs-gal__item:nth-child(4n+1), .fs-gal__item:nth-child(4n+4) { grid-column: span 7; }
          .fs-gal__item:nth-child(4n+2), .fs-gal__item:nth-child(4n+3) { grid-column: span 5; }
        }
        .fs-gal__frame {
          position: relative;
          border-radius: var(--radius-2xl);
          overflow: hidden;
          background:
            radial-gradient(90% 70% at 70% 20%, color-mix(in srgb, var(--gal-tone) 18%, transparent), transparent 70%),
            linear-gradient(180deg, var(--bg-raised), var(--bg-sunken));
        }
        .fs-gal__tag {
          position: absolute; top: var(--s4); left: var(--s4); z-index: 3;
          display: inline-flex; align-items: center; gap: var(--s2);
          padding: var(--s1) var(--s3);
          border-radius: var(--radius-full);
          background: color-mix(in srgb, var(--bg-raised) 88%, transparent);
          box-shadow: inset 0 0 0 1px var(--hairline);
          font-family: var(--font-mono); font-size: var(--step--2);
          letter-spacing: var(--tracking-mono); text-transform: uppercase; color: var(--text-strong);
          pointer-events: none;
        }
        .fs-gal__swatch { width: 8px; height: 8px; border-radius: 50%; background: var(--gal-tone); }
        .fs-gal__cap {
          display: flex; justify-content: space-between; align-items: baseline; gap: var(--s4);
          margin-top: var(--s5); padding-top: var(--s4); border-top: 1px solid var(--hairline);
        }
        .fs-gal__room { font-family: var(--font-display); font-weight: 400; font-size: var(--step-2); color: var(--text-strong); letter-spacing: var(--tracking-display); }
      `}</style>

      <section className="fs-container fs-gal-hero">
        <Reveal>
          <div className="fs-gal-hero__grid">
            <div>
              <span className="fs-eyebrow">
                <span className="fs-eyebrow__dot" aria-hidden="true" />
                {t('nav.gallery')}
              </span>
              <h1 className="fs-display fs-gal-hero__title">{t('gallery.title')}</h1>
            </div>
            <p className="fs-lead" style={{ maxWidth: '40ch' }}>
              {t('gallery.lead')}
            </p>
          </div>
        </Reveal>

        <div className="fs-gal-filter" role="group" aria-label={t('nav.styles')}>
          <Chip selected={filter === null} onClick={() => setFilter(null)}>
            {t('gallery.all')}
          </Chip>
          {styles.map((style) => {
            const entry = STYLES.find((s: { name: string }) => s.name === style)
            return (
              <Chip
                key={style}
                selected={filter === style}
                swatch={entry?.swatch}
                onClick={() => setFilter(style)}
              >
                {t(`styles.${style}`, { defaultValue: style })}
              </Chip>
            )
          })}
          <span className="fs-label fs-gal-filter__count" aria-live="polite">
            {t('public2.gallery.count', { count: shots.length })}
          </span>
        </div>
      </section>

      <section className="fs-container" style={{ paddingBottom: 'var(--s16)' }}>
        <div className="fs-gal">
          {shots.map((shot) => (
            <Reveal key={shot.id} className="fs-gal__item">
              <figure style={{ margin: 0, ['--gal-tone' as string]: shot.tone } as React.CSSProperties}>
                <div className="fs-bezel fs-bezel--lg fs-bezel--interactive">
                  <div className="fs-bezel__core" style={{ padding: 'var(--s2)' }}>
                    <div className="fs-gal__frame">
                      <span className="fs-gal__tag">
                        <span className="fs-gal__swatch" aria-hidden="true" />
                        {t(`styles.${shot.style}`, { defaultValue: shot.style })}
                      </span>
                      <BeforeAfter
                        autoWipe={false}
                        before={<RoomSketch tone="var(--clay-300)" showDimension={false} />}
                        after={<RoomSketch dressed tone={shot.tone} accent={shot.tone} showDimension={false} />}
                        labelBefore={t('landing.hero.beforeLabel')}
                        labelAfter={t('landing.hero.afterLabel')}
                      />
                    </div>
                  </div>
                </div>
                <figcaption className="fs-gal__cap">
                  <span className="fs-gal__room">
                    {t(`gallery.rooms.${shot.room}`, { defaultValue: shot.room })}
                  </span>
                  <span className="fs-label">
                    <CountUp to={shot.area} decimals={1} suffix=" m²" />
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>

        <p
          style={{
            marginTop: 'var(--s16)',
            fontSize: 'var(--step--1)',
            color: 'var(--text-muted)',
            maxWidth: '58ch',
          }}
        >
          {t('gallery.note')}
        </p>
      </section>

      <section className="fs-container" style={{ paddingBottom: 'var(--s24)' }}>
        <Reveal className="ed-cta">
          <h2 className="ed-h2" style={{ fontSize: 'var(--step-3)', maxWidth: '18ch' }}>
            {t('public2.gallery.ctaTitle')}
          </h2>
          <div className="ed-cta__actions">
            <ButtonLink to="/app/capture" size="lg" arrow>
              {t('public2.gallery.ctaButton')}
            </ButtonLink>
            <ButtonLink to="/styles" size="lg" variant="secondary">
              {t('nav.styles')}
            </ButtonLink>
          </div>
        </Reveal>
      </section>
    </>
  )
}
