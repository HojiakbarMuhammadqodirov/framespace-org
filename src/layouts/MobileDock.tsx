import { Link, NavLink, useMatch } from 'react-router'
import { useTranslation } from 'react-i18next'

/**
 * The fixed bottom bar from brief §5, kept from the current app: big round
 * camera button in the centre, Projects left, Upload right. Safe-area aware so
 * it clears the iOS home indicator, and it stays put while the landing scrolls.
 *
 * Hidden at >=1200px, the same breakpoint where the header shows its full nav
 * — below that the burger is the only other way around. Not rendered on
 * /app/capture, which has its own shutter and would otherwise get two.
 */
export function MobileDock() {
  const { t } = useTranslation()
  const capture = useMatch('/app/capture') !== null
  if (capture) return null

  return (
    <>
      <style href="fs-dock" precedence="medium">{`
        /* Detached from the bottom edge and floating, so the page visibly
           runs underneath it. Blur is safe here: the element is fixed. */
        .fs-dock {
          position: fixed;
          left: 50%;
          bottom: calc(var(--s3) + env(safe-area-inset-bottom));
          transform: translateX(-50%);
          z-index: 50;
          width: calc(100% - 2 * var(--gutter));
          max-width: 400px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: var(--s2);
          padding: 6px var(--s3);
          border-radius: var(--radius-full);
          background: color-mix(in srgb, var(--bg) 78%, transparent);
          backdrop-filter: blur(18px) saturate(1.4);
          -webkit-backdrop-filter: blur(18px) saturate(1.4);
          box-shadow: inset 0 0 0 1px var(--bezel-ring), var(--inset-hi), var(--shadow-float);
        }
        @media (max-width: 767px) {
          .fs-dock {
            background: color-mix(in srgb, var(--bg) 94%, transparent);
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
          }
        }
        /* The menu overlay owns the screen while it is open. */
        [data-menu='open'] .fs-dock { display: none; }
        .fs-dock__side {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          min-height: 48px;
          justify-content: center;
          border-radius: var(--radius-full);
          text-decoration: none;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.005em;
          transition: color var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease);
        }
        .fs-dock__side[aria-current='page'] { color: var(--text-strong); }
        .fs-dock__side[aria-current='page'] svg { color: var(--accent-ink); }
        .fs-dock__side:active { background: var(--bezel-shell); }
        .fs-dock__camera {
          display: grid;
          place-items: center;
          width: 58px;
          height: 58px;
          margin-top: -22px;
          border-radius: var(--radius-full);
          background: radial-gradient(120% 120% at 30% 20%, #d4673f 0%, var(--accent-ink) 55%, #8f3b20 100%);
          color: #f6f1e9;
          text-decoration: none;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.28), inset 0 -2px 6px rgba(0,0,0,.18),
            0 10px 24px -6px rgba(180, 77, 43, 0.6),
            0 0 0 5px color-mix(in srgb, var(--bg) 92%, transparent);
          transition: transform var(--d-base) var(--ease-fluid),
            box-shadow var(--d-base) var(--ease-fluid);
        }
        @media (hover: hover) {
          .fs-dock__side:hover { color: var(--text); }
          .fs-dock__camera:hover { transform: translateY(-2px) scale(1.03); }
        }
        .fs-dock__camera:active { transform: scale(0.96); }
        .fs-dock__spacer { height: calc(88px + env(safe-area-inset-bottom)); }
        @media (min-width: 1200px) {
          .fs-dock, .fs-dock__spacer { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fs-dock__camera:hover,
          .fs-dock__camera:active { transform: translateX(0); }
        }
      `}</style>

      <nav
        className="fs-dock"
        aria-label={t('a11y.quickActions', { defaultValue: 'Tezkor amallar' })}
      >
        <NavLink to="/app" end className="fs-dock__side">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {t('dock.projects')}
        </NavLink>

        <Link to="/app/capture" className="fs-dock__camera" aria-label={t('dock.capture')}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 8h3l1.5-2h7L17 8h3v11H4z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="13" r="3.6" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </Link>

        <Link to="/app/capture?mode=upload" className="fs-dock__side">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 16V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="m8 9 4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 19h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {t('dock.upload')}
        </Link>
      </nav>
    </>
  )
}

/** Keeps page content clear of the fixed dock. */
export function MobileDockSpacer() {
  return <div className="fs-dock__spacer" aria-hidden="true" />
}
