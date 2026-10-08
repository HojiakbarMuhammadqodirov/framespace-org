import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ButtonLink } from '@/ui/Button'
import { BeforeAfter } from '@/ui/BeforeAfter'
import { RoomSketch } from '@/ui/RoomSketch'
import { TextReveal, MaskRise } from '@/ui/TextReveal'

/**
 * Mobile/tablet hero. No Three.js anywhere in this file — the hard gate lives
 * in Hero.tsx, which never even imports HeroDesktop's lazy chunk unless
 * `useMediaQuery(SCENE_CAPABLE)` is true.
 *
 * Order is proof first: the headline, then the real render against the bare
 * room, and only then the copy and the camera. On a phone the first viewport
 * has to show what the product makes, not describe it. The "after" is the
 * same poster frame the desktop film opens on, so it is a real output and it
 * is already in the HTTP cache for anyone who has seen the desktop hero.
 *
 * Everything here animates on mount (`immediate`): it is all above the fold,
 * and waiting for an intersection callback left the CTAs invisible on slow
 * phones.
 */
export function HeroMobile() {
  const { t } = useTranslation()

  return (
    <section className="fs-heroM">
      <style href="fs-hero-mobile" precedence="medium">{`
        .fs-heroM { padding-block: var(--s5) var(--s8); overflow-x: clip; }
        .fs-heroM__inner { display: grid; gap: var(--s4); }
        .fs-heroM__title {
          font-size: clamp(2.3rem, 10.2vw, 3.5rem);
          font-weight: 400;
          letter-spacing: -0.02em;
          line-height: 1.04;
          text-wrap: balance;
        }
        :lang(ru) .fs-heroM__title { line-height: 1.08; font-size: clamp(2.05rem, 9vw, 3.2rem); }
        .fs-heroM__lead { font-size: var(--step-0); line-height: 1.6; color: var(--text-muted); max-width: 36ch; }
        .fs-heroM__frame {
          position: relative;
          border-radius: 28px;
          padding: 5px;
          background: linear-gradient(160deg, rgba(255,255,255,.6), rgba(166,123,91,.14));
          box-shadow: inset 0 0 0 1px var(--bezel-ring), 0 24px 48px -20px rgba(74,53,41,.35);
        }
        :root[data-theme='dark'] .fs-heroM__frame {
          background: linear-gradient(160deg, rgba(246,241,233,.08), rgba(0,0,0,.2));
        }
        .fs-heroM__frame .fs-ba { border-radius: 23px; aspect-ratio: 4 / 5; }
        .fs-heroM__badge {
          position: absolute;
          z-index: 3;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: var(--radius-full);
          background: rgba(42, 29, 22, 0.55);
          color: #f6f1e9;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: var(--tracking-mono);
          text-transform: uppercase;
          white-space: nowrap;
          pointer-events: none;
        }
        .fs-heroM__ctas { display: grid; gap: var(--s3); margin-top: var(--s1); }
        .fs-heroM__build {
          display: inline-flex;
          align-items: center;
          justify-self: center;
          min-height: var(--tap);
          font-size: var(--step--1);
        }
        .fs-heroM__poster {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      `}</style>

      <div className="fs-container fs-heroM__inner">
        <span className="fs-eyebrow">
          <span className="fs-eyebrow__dot" aria-hidden="true" />
          {t('landing.hero.label')}
        </span>

        <TextReveal as="h1" text={t('landing.hero.title')} className="fs-heroM__title" immediate />

        <MaskRise immediate delay={0.12} duration={0.6}>
          <p className="fs-heroM__lead">{t('landing.hero.lead')}</p>
        </MaskRise>

        <MaskRise immediate delay={0.2} duration={0.6}>
          <div className="fs-heroM__ctas">
            <ButtonLink to="/app/capture" size="lg" arrow block>
              {t('landing.hero.ctaCamera', { defaultValue: 'Xonani suratga olish' })}
            </ButtonLink>
            <ButtonLink to="/app/capture?mode=upload" size="lg" variant="secondary" block>
              {t('landing.hero.ctaUpload', { defaultValue: 'Suratlarni yuklash' })}
            </ButtonLink>
            <Link to="/app/room/new" className="fs-navlink fs-heroM__build">
              {t('landing.hero.ctaBuild')} →
            </Link>
          </div>
        </MaskRise>

        <MaskRise immediate delay={0.3} duration={0.7}>
          <div className="fs-heroM__frame">
            <span className="fs-heroM__badge" aria-hidden="true">
              {t('landing.hero.dragHint')}
            </span>
            <BeforeAfter
              before={<RoomSketch label={t('landing.hero.beforeLabel')} />}
              after={
                <img
                  className="fs-heroM__poster"
                  src="/hero-poster.webp"
                  alt=""
                  decoding="async"
                  fetchPriority="high"
                />
              }
              labelBefore={t('landing.hero.beforeLabel')}
              labelAfter={t('landing.hero.afterLabel')}
            />
          </div>
        </MaskRise>
      </div>
    </section>
  )
}
