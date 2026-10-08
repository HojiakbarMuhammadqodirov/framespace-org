import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'

import { EASE_FLUID } from '@/design/motion'

import { ButtonLink } from '@/ui/Button'
import { TextReveal, MaskRise } from '@/ui/TextReveal'
import { plainText } from '@/ui/Accent'
import { DimensionLine } from '@/ui/DimensionLine'

// The WebGL room never lands in the initial bundle. This component only ever
// mounts on a pointer-capable screen (see Hero.tsx); the chunk is requested
// as soon as the first paint is done.
const loadHeroScene = () => import('../HeroScene')
const HeroScene = lazy(loadHeroScene)

type StyleChip = { key: string; label: string }

/* Sofa / wood / wall of each room palette (src/three/HeroRoom ROOM_STYLES),
   copied rather than imported so three.js stays out of the landing chunk. */
const SWATCHES: Record<string, [string, string, string]> = {
  minimal: ['#E4D9CB', '#C9B49A', '#F6F1E9'],
  japandi: ['#B9AD9B', '#6B4A35', '#E9E2D6'],
  modernUzbek: ['#C08A63', '#A8452F', '#5A3A27'],
  classic: ['#4A3529', '#2A1D16', '#D8CBB8'],
}

/**
 * Desktop hero: copy on the left, a live 3D showroom on the right.
 *
 * The room is the first thing a visitor sees — not a scroll-scrubbed video
 * that only handed over to WebGL two-thirds of a viewport down (most visitors
 * never got there, so the hero read as a static photo). The poster frame sits
 * underneath as the loading state and the no-WebGL fallback, and fades out
 * once the canvas reports its first frame.
 *
 * The style switcher lives inside the stage, like a product configurator: it
 * re-dresses the room in place. Nothing in this hero is pinned, so there is
 * no scroll distance to spend and no blank band left behind it.
 */
export function HeroDesktop({
  styleKey,
  setStyleKey,
  chips,
  onPhoneHandoff,
  reduced,
}: {
  styleKey: string
  setStyleKey: (key: string) => void
  chips: StyleChip[]
  onPhoneHandoff: () => void
  reduced: boolean
}) {
  const { t } = useTranslation()
  const [armed, setArmed] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const onSceneReady = useCallback(() => setSceneReady(true), [])

  // Mount the canvas once the first paint has landed, so the copy and the
  // poster are never held back by the WebGL chunk.
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const arm = () => {
      void loadHeroScene().then(() => setArmed(true))
    }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(arm, { timeout: 900 })
      return () => w.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(arm, 300)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <section className="fs-heroD" aria-labelledby="fs-hero-title">
      <style href="fs-hero-desktop" precedence="medium">{`
        .fs-heroD {
          position: relative;
          isolation: isolate;
          min-height: calc(100svh - var(--hdr-offset, 88px));
          display: flex;
          align-items: center;
          padding-block: var(--s6) var(--s12);
        }
        .fs-heroD__grid {
          width: 100%;
          max-width: 1440px;
          margin-inline: auto;
          padding-inline: var(--gutter);
          display: grid;
          grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
          gap: clamp(var(--s8), 4vw, var(--s16));
          align-items: center;
        }

        /* ----------------------------------------------------------- copy */
        .fs-heroD__copy { display: grid; gap: var(--s6); align-content: center; }
        .fs-heroD__title {
          font-size: min(clamp(2.6rem, 1.3rem + 3.2vw, 4.9rem), 10vh);
          font-weight: 400;
          letter-spacing: -0.02em;
          line-height: 1.04;
          text-wrap: balance;
          max-width: 12ch;
        }
        :lang(ru) .fs-heroD__title { max-width: 14ch; line-height: 1.08; font-size: min(clamp(2.4rem, 1.2rem + 2.9vw, 4.5rem), 9.4vh); }
        .fs-heroD__lead { max-width: 36ch; font-size: clamp(1.0625rem, 0.95rem + 0.3vw, 1.25rem); line-height: 1.6; color: var(--text); text-wrap: pretty; }
        .fs-heroD__ctas { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s3); }
        .fs-heroD__alt {
          display: flex;
          flex-wrap: wrap;
          gap: var(--s2) var(--s6);
          padding-top: var(--s5);
          border-top: 1px solid var(--hairline);
        }
        .fs-heroD__link {
          display: inline-flex;
          align-items: center;
          gap: var(--s2);
          min-height: var(--tap);
          padding: 0;
          background: none;
          border: 0;
          cursor: pointer;
          font-size: var(--step--1);
          color: var(--text);
        }
        .fs-heroD__link svg { color: var(--accent); }

        /* ---------------------------------------------------------- stage */
        .fs-heroD__stage {
          position: relative;
          aspect-ratio: 5 / 4;
          max-height: calc(100svh - var(--hdr-offset, 88px) - var(--s16));
          width: 100%;
          border-radius: 36px;
          padding: 6px;
          background: linear-gradient(160deg, rgba(255,255,255,.55), rgba(166,123,91,.12));
          box-shadow:
            inset 0 0 0 1px var(--bezel-ring),
            0 2px 4px rgba(74,53,41,.05),
            0 30px 60px -20px rgba(74,53,41,.28),
            0 80px 120px -40px rgba(74,53,41,.30);
        }
        :root[data-theme='dark'] .fs-heroD__stage {
          background: linear-gradient(160deg, rgba(246,241,233,.08), rgba(0,0,0,.2));
        }
        .fs-heroD__plate {
          position: relative;
          height: 100%;
          border-radius: 30px;
          overflow: hidden;
          background:
            radial-gradient(120% 90% at 30% 20%, #4a3529 0%, #2a1d16 55%, #1b120d 100%);
          isolation: isolate;
        }
        .fs-heroD__poster,
        .fs-heroD__scene {
          position: absolute;
          inset: 0;
          transition: opacity 700ms var(--ease-fluid);
        }
        .fs-heroD__poster img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .fs-heroD__scene { opacity: 0; }
        .fs-heroD__plate[data-ready='true'] .fs-heroD__scene { opacity: 1; }
        .fs-heroD__plate[data-ready='true'] .fs-heroD__poster { opacity: 0; }
        .fs-heroD__scene > * { width: 100%; height: 100%; }
        .fs-heroD__plate::after {
          /* A soft vignette so the overlays always sit on a readable edge. */
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(20,13,9,.38) 0%, transparent 22%, transparent 70%, rgba(20,13,9,.5) 100%);
          z-index: 1;
        }

        .fs-heroD__glass {
          position: absolute;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          gap: var(--s2);
          padding: 8px 14px;
          border-radius: var(--radius-full);
          background: rgba(42, 29, 22, 0.42);
          backdrop-filter: blur(14px) saturate(1.3);
          -webkit-backdrop-filter: blur(14px) saturate(1.3);
          box-shadow: inset 0 0 0 1px rgba(246,241,233,.16), inset 0 1px 0 rgba(255,255,255,.12);
          color: #f6f1e9;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .fs-heroD__live { top: 18px; left: 18px; }
        .fs-heroD__live i {
          width: 7px; height: 7px; border-radius: 50%;
          background: #e2794f;
          box-shadow: 0 0 0 0 rgba(226,121,79,.7);
          animation: fs-live 2.2s ease-out infinite;
        }
        @keyframes fs-live {
          0% { box-shadow: 0 0 0 0 rgba(226,121,79,.6); }
          70%, 100% { box-shadow: 0 0 0 9px rgba(226,121,79,0); }
        }
        .fs-heroD__drag { top: 18px; right: 18px; }

        .fs-heroD__dock {
          position: absolute;
          z-index: 2;
          left: 50%;
          bottom: 14px;
          transform: translateX(-50%);
          max-width: calc(100% - 28px);
          display: flex;
          flex-wrap: nowrap;
          gap: 2px;
          padding: 4px;
          border-radius: var(--radius-full);
          overflow-x: auto;
          scrollbar-width: none;
          background: rgba(246, 241, 233, 0.72);
          backdrop-filter: blur(18px) saturate(1.4);
          -webkit-backdrop-filter: blur(18px) saturate(1.4);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.5), 0 10px 28px -10px rgba(20,13,9,.5);
        }
        .fs-heroD__dock::-webkit-scrollbar { display: none; }
        .fs-heroD__style {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 32px;
          padding: 0 12px 0 7px;
          border: 0;
          border-radius: var(--radius-full);
          background: transparent;
          color: #4a3529;
          font-size: 12.5px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          transition: background-color var(--d-base) var(--ease-fluid), color var(--d-base) var(--ease-fluid), box-shadow var(--d-base) var(--ease-fluid);
        }
        .fs-heroD__style:hover { background: rgba(255,255,255,.65); }
        .fs-heroD__style[aria-pressed='true'] {
          background: #2a1d16;
          color: #f6f1e9;
          box-shadow: 0 4px 12px -4px rgba(20,13,9,.6);
        }
        .fs-heroD__sw { display: inline-flex; }
        .fs-heroD__sw span {
          width: 12px; height: 12px; border-radius: 50%;
          box-shadow: 0 0 0 1.5px #f6f1e9;
        }
        .fs-heroD__style[aria-pressed='true'] .fs-heroD__sw span { box-shadow: 0 0 0 1.5px #2a1d16; }
        .fs-heroD__sw span + span { margin-left: -4px; }
        .fs-heroD__edge {
          position: absolute;
          right: 0;
          bottom: calc(-1 * var(--s8));
          width: 46%;
        }
        @media (max-width: 1180px) {
          .fs-heroD__drag { display: none; }
        }
        @media (max-height: 760px) {
          .fs-heroD__copy { gap: var(--s4); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fs-heroD__live i { animation: none; }
        }
      `}</style>

      <div className="fs-heroD__grid">
        <div className="fs-heroD__copy">
          <span className="fs-eyebrow" style={{ justifySelf: 'start' }}>
            <span className="fs-eyebrow__dot" aria-hidden="true" />
            {t('landing.hero.label')}
          </span>

          <TextReveal
            as="h1"
            text={t('landing.hero.title')}
            className="fs-heroD__title"
            immediate
          />
          {/* TextReveal renders aria-label; give the section a stable name. */}
          <span id="fs-hero-title" hidden>
            {plainText(t('landing.hero.title'))}
          </span>

          <MaskRise immediate delay={0.2} duration={0.6}>
            <p className="fs-lead fs-heroD__lead">{t('landing.hero.lead')}</p>
          </MaskRise>

          <MaskRise immediate delay={0.3} duration={0.6}>
            <div className="fs-heroD__ctas">
              <ButtonLink to="/app/capture?mode=upload" size="lg" arrow>
                {t('landing.hero.ctaUpload')}
              </ButtonLink>
              <ButtonLink to="/app/room/new" size="lg" variant="secondary">
                {t('landing.hero.ctaBuild')}
              </ButtonLink>
            </div>
          </MaskRise>

          <MaskRise immediate delay={0.4} duration={0.6}>
            <div className="fs-heroD__alt">
              <button
                type="button"
                className="fs-heroD__link fs-navlink"
                onClick={onPhoneHandoff}
                aria-haspopup="dialog"
              >
                <svg width="14" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
                  <rect
                    x="0.75"
                    y="0.75"
                    width="10.5"
                    height="18.5"
                    rx="2.5"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                  <path
                    d="M4.5 3.2h3"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
                {t('landing.hero.ctaPhone')}
              </button>
              <Link to="/catalog" className="fs-heroD__link fs-navlink">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z M3 7.5V16.5L12 21l9-4.5V7.5 M12 12v9"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                </svg>
                {t('landing.catalog.cta')}
              </Link>
            </div>
          </MaskRise>
        </div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 28, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease: EASE_FLUID, delay: 0.1 }}
        >
          <div className="fs-heroD__stage">
            <div className="fs-heroD__plate" data-ready={sceneReady} data-cursor={t('common.drag')}>
              <div className="fs-heroD__poster" aria-hidden="true">
                <img src="/hero-poster.webp" alt="" decoding="async" fetchPriority="high" />
              </div>

              <div className="fs-heroD__scene">
                {armed && (
                  <Suspense fallback={null}>
                    <HeroScene styleKey={styleKey} autoRotate={!reduced} onReady={onSceneReady} />
                  </Suspense>
                )}
              </div>

              <span className="fs-heroD__glass fs-heroD__live">
                <i aria-hidden="true" />
                {t('landing.hero.liveBadge')}
              </span>
              <span className="fs-heroD__glass fs-heroD__drag" aria-hidden="true">
                {t('landing.hero.filmHint')}
              </span>

              <div
                className="fs-heroD__dock"
                role="group"
                aria-label={t('landing.hero.styleGroup')}
              >
                {chips.map((chip) => {
                  const sw = SWATCHES[chip.key] ?? SWATCHES.japandi
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      className="fs-heroD__style"
                      aria-pressed={styleKey === chip.key}
                      onClick={() => setStyleKey(chip.key)}
                    >
                      <span className="fs-heroD__sw" aria-hidden="true">
                        {sw.slice(0, 2).map((c, i) => (
                          <span key={i} style={{ background: c }} />
                        ))}
                      </span>
                      {chip.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div style={{ position: 'relative', height: 0 }}>
            <div className="fs-heroD__edge" aria-hidden="true">
              <DimensionLine value="4.20" unit="m" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
