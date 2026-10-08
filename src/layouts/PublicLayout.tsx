import { Suspense, useEffect } from 'react'
import { useMatch, useOutlet } from 'react-router'
import { useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { Header } from './Header'
import { MobileDock, MobileDockSpacer } from './MobileDock'
import { PageTransition } from './PageTransition'
import { PageFallback } from './PageFallback'
import { Footer } from '@/pages/landing/Footer'
import { Atmosphere } from '@/ui/Atmosphere'

export function PublicLayout() {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  // Read here rather than rendered as <Outlet/>: the page fading out during a
  // transition must keep showing its own route, not the incoming one.
  const outlet = useOutlet()
  // Capture is a full-height tool with its own bottom controls: the header
  // stays as the way home, the dock and footer would only crowd it.
  const capture = useMatch('/app/capture') !== null

  // Lenis-style smooth scroll (§3). Never under prefers-reduced-motion, and
  // never on touch — native momentum scrolling is better than anything we
  // could fake on a phone.
  useEffect(() => {
    if (reduced) return
    if (window.matchMedia('(pointer: coarse)').matches) return

    // Fetched only here, after both checks: phones never download it.
    let cancelled = false
    let frame = 0
    let lenis: { raf: (time: number) => void; destroy: () => void } | null = null
    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return
      // `lerp` rather than `duration`: a duration-based ease makes the page
      // visibly trail the wheel, which reads as lag rather than smoothness.
      // `allowNestedScroll` lets scrollable panels inside the page (and any
      // `data-lenis-prevent` region) scroll natively instead of the page.
      const instance = new Lenis({ lerp: 0.12, smoothWheel: true, allowNestedScroll: true })
      lenis = instance
      const raf = (time: number) => {
        instance.raf(time)
        frame = requestAnimationFrame(raf)
      }
      frame = requestAnimationFrame(raf)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      lenis?.destroy()
    }
  }, [reduced])

  return (
    <>
      <a
        href="#main"
        className="fs-btn fs-btn--secondary fs-btn--sm"
        style={{
          position: 'absolute',
          left: 'var(--s4)',
          top: 'var(--s4)',
          transform: 'translateY(-200%)',
          zIndex: 100,
          background: 'var(--bg-raised)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.transform = 'translateY(-200%)'
        }}
      >
        {t('a11y.skipToContent')}
      </a>

      <Atmosphere />

      <div className="fs-above">
        <Header />
        {/* tabIndex lets PageTransition move focus here after navigation;
            the outline is suppressed because it is never a keyboard stop. */}
        <main id="main" tabIndex={-1} style={{ position: 'relative', outline: 'none' }}>
          <PageTransition>
            <Suspense fallback={<PageFallback />}>{outlet}</Suspense>
          </PageTransition>
        </main>
        {!capture && <Footer />}
      </div>
      {!capture && <MobileDockSpacer />}
      <MobileDock />
    </>
  )
}
