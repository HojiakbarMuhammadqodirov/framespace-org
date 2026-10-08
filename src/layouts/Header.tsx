import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { Logo } from '@/ui/Logo'
import { Button, ButtonLink } from '@/ui/Button'
import { EASE_FLUID } from '@/design/motion'
import { LANGUAGES, type LanguageCode } from '@/i18n/config'
import { usePrefs } from '@/store/prefs'
import { useSession } from '@/store/session'

const PRIMARY = [
  { to: '/how-it-works', key: 'nav.howItWorks' },
  { to: '/catalog', key: 'nav.catalog' },
  { to: '/styles', key: 'nav.styles' },
  { to: '/gallery', key: 'nav.gallery' },
  { to: '/pricing', key: 'nav.pricing' },
  { to: '/for-business', key: 'nav.forBusiness' },
]

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * A floating glass island rather than a bar glued to the top edge. It is
 * `position: sticky` and detached by a margin, so the page visibly runs
 * underneath it — which is the whole point of the effect.
 */
export function Header() {
  const { t } = useTranslation()
  const user = useSession((s) => s.user)
  // Per-field selectors: the Header is on every page, and subscribing to the
  // whole store re-rendered it whenever an unrelated pref (currency) changed.
  const lang = usePrefs((s) => s.lang)
  const setLang = usePrefs((s) => s.setLang)
  const theme = usePrefs((s) => s.theme)
  const toggleTheme = usePrefs((s) => s.toggleTheme)
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const islandRef = useRef<HTMLElement | null>(null)
  const burgerRef = useRef<HTMLButtonElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  // Closed because a link was followed: focus then belongs to the new page
  // (PageTransition moves it to <main>), not back on the burger.
  const closedByNav = useRef(false)

  useEffect(() => {
    closedByNav.current = true
    setOpen(false)
  }, [location.pathname])

  // A scroll listener would reflow on every frame; an observer on a sentinel
  // fires twice in the whole page's life.
  useEffect(() => {
    const sentinel = document.createElement('div')
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none'
    document.body.appendChild(sentinel)
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting))
    io.observe(sentinel)
    return () => {
      io.disconnect()
      sentinel.remove()
    }
  }, [])

  // Publish how much room the floating island takes, so sticky bars and
  // anchor targets elsewhere sit just below it instead of sliding under it.
  // base.css carries a static fallback for before this runs.
  useEffect(() => {
    const island = islandRef.current
    if (!island) return
    const root = document.documentElement
    const write = () => {
      const top = parseFloat(getComputedStyle(island).top) || 0
      root.style.setProperty(
        '--hdr-offset',
        `calc(${Math.round(island.offsetHeight + top)}px + var(--s3))`
      )
    }
    write()
    const ro = new ResizeObserver(write)
    ro.observe(island)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--hdr-offset')
    }
  }, [])

  // Scroll lock, plus a flag the dock (and anything else fixed) reads to get
  // out of the way while the menu is up.
  useEffect(() => {
    const root = document.documentElement
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) root.dataset.menu = 'open'
    else delete root.dataset.menu
    return () => {
      document.body.style.overflow = ''
      delete root.dataset.menu
    }
  }, [open])

  // Dialog behaviour: focus the first link on open, keep Tab inside the
  // overlay plus the burger (a visual close control; the overlay carries its
  // own for assistive tech), Esc closes,
  // and focus returns to the burger afterwards.
  useEffect(() => {
    if (!open) return
    closedByNav.current = false
    const frame = requestAnimationFrame(() => {
      overlayRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true })
    })

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const items = [
        ...Array.from(overlayRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
        ...(burgerRef.current ? [burgerRef.current] : []),
      ]
      if (!items.length) return
      const index = items.indexOf(document.activeElement as HTMLElement)
      event.preventDefault()
      const next = event.shiftKey
        ? index <= 0
          ? items.length - 1
          : index - 1
        : index === -1 || index === items.length - 1
          ? 0
          : index + 1
      items[next].focus()
    }
    document.addEventListener('keydown', onKey)

    const burger = burgerRef.current
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      if (!closedByNav.current) burger?.focus({ preventScroll: true })
    }
  }, [open])

  return (
    <>
      <style href="fs-header" precedence="medium">{`
        .fs-hdr__nav, .fs-hdr__meta, .fs-hdr__auth { display: none; }
        .fs-hdr__burger { display: grid; margin-left: auto; }
        .fs-hdr__nav { flex: 1; justify-content: center; }
        .fs-hdr__nav .fs-navlink { white-space: nowrap; }
        /* 1200, not 1024: six nav items plus auth in Russian or Uzbek do not
           fit a 1024px island without wrapping. Keep in sync with the dock. */
        @media (min-width: 1200px) {
          .fs-hdr__nav { display: flex; gap: var(--s5); }
          .fs-hdr__meta { display: flex; gap: var(--s1); align-items: center; }
          .fs-hdr__auth { display: flex; gap: var(--s3); align-items: center; }
          .fs-hdr__burger { display: none; }
        }
        .fs-hdr__langs { display: contents; }
        .fs-hdr__lang {
          background: none; border: 0; cursor: pointer;
          /* A real hit area: these were 11px glyphs with 4px of padding, which
             is well under any sane touch target. */
          min-width: var(--tap); min-height: var(--tap);
          display: inline-grid; place-items: center;
          padding: 0 var(--s2);
          font-family: var(--font-mono); font-size: 0.75rem; font-weight: 500;
          letter-spacing: var(--tracking-mono); text-transform: uppercase;
          color: var(--text-muted);
          transition: color var(--d-base) var(--ease-fluid);
        }
        .fs-hdr__lang[aria-pressed='true'] { color: var(--text-strong); }
        .fs-hdr__theme { letter-spacing: 0; color: var(--text); }
        @media (hover: hover) and (pointer: fine) {
          .fs-hdr__lang:hover { color: var(--text-strong); }
        }
        .fs-hdr__divider {
          width: 1px; height: 18px; background: var(--bezel-ring); margin-inline: var(--s2);
        }
        .fs-hdr__overlay {
          /* Under the island (60) so the burger's morphing X stays on top and
             tappable as the close control; above the dock (50). */
          position: fixed; inset: 0; z-index: 55;
          background: color-mix(in srgb, var(--bg) 82%, transparent);
          backdrop-filter: blur(28px) saturate(1.3);
          -webkit-backdrop-filter: blur(28px) saturate(1.3);
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        .fs-hdr__overlay-link {
          display: flex;
          align-items: baseline;
          gap: var(--s4);
          padding-block: var(--s3);
          border-bottom: 1px solid var(--hairline);
          font-family: var(--font-display);
          font-size: clamp(1.75rem, 1.3rem + 2.4vw, 2.6rem);
          font-weight: 400;
          letter-spacing: var(--tracking-display);
          line-height: 1.12;
          color: var(--text-strong);
          text-decoration: none;
          transition: color var(--d-base) var(--ease-fluid), padding var(--d-base) var(--ease-fluid);
        }
        .fs-hdr__overlay-link small {
          font-family: var(--font-mono);
          font-size: var(--step--2);
          letter-spacing: var(--tracking-mono);
          color: var(--text-muted);
          transform: translateY(-0.6em);
        }
        .fs-hdr__overlay-link[aria-current='page'] { color: var(--accent-ink); }
        .fs-hdr__overlay-link[aria-current='page'] small { color: var(--accent-ink); }
        @media (hover: hover) and (pointer: fine) {
          .fs-hdr__overlay-link:hover { padding-left: var(--s2); color: var(--accent-ink); font-style: italic; }
        }
      `}</style>

      <header ref={islandRef} className="fs-island" data-scrolled={scrolled}>
        <div className="fs-island__inner">
          <Link to="/" aria-label="FrameSpace" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Logo size={24} />
          </Link>

          <nav
            className="fs-nav fs-hdr__nav"
            aria-label={t('a11y.primaryNav', { defaultValue: 'Asosiy menyu' })}
          >
            {PRIMARY.map((item) => (
              <NavLink key={item.to} to={item.to} className="fs-navlink">
                {t(item.key)}
              </NavLink>
            ))}
          </nav>

          <span className="fs-hdr__divider fs-hdr__meta" aria-hidden="true" />

          <div className="fs-nav fs-hdr__meta">
            <div
              className="fs-hdr__langs"
              role="group"
              aria-label={t('a11y.language', { defaultValue: 'Til' })}
            >
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLang(l.code as LanguageCode)}
                  aria-pressed={lang === l.code}
                  // Each language named in itself, so a Russian speaker on the
                  // Uzbek site still hears "Русский".
                  aria-label={l.label}
                  lang={l.htmlLang}
                  className="fs-hdr__lang"
                >
                  {l.code}
                </button>
              ))}
            </div>
            {/* An inline SVG, not ☀/☾. Geist carries no astronomical glyphs,
                so the character fell through to a fallback face and rendered
                as a clipped stray letter next to the language codes. */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={t('a11y.toggleTheme')}
              className="fs-hdr__lang fs-hdr__theme"
            >
              {theme === 'dark' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
                  <path
                    d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7 5.4 5.4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M20 13.6A8.4 8.4 0 0 1 10.4 4a8.4 8.4 0 1 0 9.6 9.6Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>

          <div className="fs-hdr__auth">
            {user ? (
              <ButtonLink to="/app" size="sm" arrow aria-label={t('nav.dashboard')}>
                {t('nav.dashboard')}
              </ButtonLink>
            ) : (
              <>
                <Link to="/login" className="fs-navlink">
                  {t('nav.login')}
                </Link>
                <ButtonLink to="/signup" size="sm" arrow aria-label={t('nav.signup')}>
                  {t('nav.signup')}
                </ButtonLink>
              </>
            )}
          </div>

          <button
            ref={burgerRef}
            type="button"
            className="fs-burger fs-hdr__burger"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t('nav.close') : t('nav.menu')}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={overlayRef}
            id="mobile-menu"
            className="fs-hdr__overlay"
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.menu')}
            // Long menus (landscape phones) scroll natively, not via Lenis.
            data-lenis-prevent=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE_FLUID }}
          >
            <div className="fs-container" style={{ paddingBlock: 'calc(var(--hdr-offset, 80px) + var(--s6)) var(--s12)' }}>
              {/* Each link rises out of an invisible mask, staggered, rather
                  than the whole list fading in at once. */}
              <nav
                aria-label={t('a11y.mobileNav', { defaultValue: 'Mobil menyu' })}
                style={{ display: 'grid' }}
              >
                {PRIMARY.map((item, i) => (
                  <div key={item.to} style={{ overflow: 'hidden' }}>
                    <motion.div
                      initial={{ y: '110%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '110%' }}
                      transition={{ duration: 0.55, ease: EASE_FLUID, delay: 0.05 + i * 0.045 }}
                    >
                      <NavLink to={item.to} className="fs-hdr__overlay-link">
                        <small aria-hidden="true">{String(i + 1).padStart(2, '0')}</small>
                        {t(item.key)}
                      </NavLink>
                    </motion.div>
                  </div>
                ))}
              </nav>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE_FLUID, delay: 0.3 }}
              >
                <hr className="fs-rule" style={{ marginBlock: 'var(--s8)' }} />

                <div
                  role="group"
                  aria-label={t('a11y.language', { defaultValue: 'Til' })}
                  style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap' }}
                >
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setLang(l.code as LanguageCode)}
                      className="fs-chip"
                      data-selected={lang === l.code}
                      aria-pressed={lang === l.code}
                      lang={l.htmlLang}
                    >
                      {l.label}
                    </button>
                  ))}
                  <button type="button" onClick={toggleTheme} className="fs-chip">
                    {theme === 'dark' ? t('common.themeLight') : t('common.themeDark')}
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 'var(--s3)', marginTop: 'var(--s10)' }}>
                  {user ? (
                    <ButtonLink to="/app" block arrow size="lg">
                      {t('nav.dashboard')}
                    </ButtonLink>
                  ) : (
                    <>
                      <ButtonLink to="/signup" block arrow size="lg">
                        {t('nav.signup')}
                      </ButtonLink>
                      <ButtonLink to="/login" block variant="secondary">
                        {t('nav.login')}
                      </ButtonLink>
                    </>
                  )}
                  {/* A close control inside the dialog: with aria-modal, screen
                      readers on phones cannot reach the burger outside it. */}
                  <Button type="button" block variant="ghost" onClick={() => setOpen(false)}>
                    {t('nav.close')}
                  </Button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
