import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion, useScroll } from 'framer-motion'
import { useLocation } from 'react-router'

import { DURATION, EASE_FLUID } from '@/design/motion'

/** Wipe length; the panel fully covers the screen at WIPE_COVER of it. */
const WIPE = 0.72
const WIPE_COVER = WIPE * 0.38

/**
 * Which part of the product a path belongs to. The ink wipe marks the jump
 * between the marketing site and the app; moving around inside one part is a
 * plain crossfade, so tab-hopping through /app or /business never flashes.
 */
function section(pathname: string) {
  if (pathname === '/app' || pathname.startsWith('/app/')) return 'app'
  if (pathname === '/business' || pathname.startsWith('/business/')) return 'business'
  return 'site'
}

function shouldWipe(from: string, to: string) {
  const a = section(from)
  const b = section(to)
  return a !== b && (a === 'app' || b === 'app') && a !== 'business' && b !== 'business'
}

/**
 * Route transition: a solid ink panel sweeps across, the mark pulses once
 * behind it, and the next route resolves underneath. The panel is a single
 * `scaleX` on a fixed element, so nothing reflows and nothing repaints beyond
 * one compositor layer.
 */
function Wipe({ routeKey }: { routeKey: string }) {
  return (
    <motion.div
      key={`wipe-${routeKey}`}
      aria-hidden="true"
      initial={{ scaleX: 0, originX: 0 }}
      animate={{ scaleX: [0, 1, 1, 0], originX: [0, 0, 1, 1] }}
      transition={{ duration: WIPE, ease: EASE_FLUID, times: [0, 0.38, 0.52, 1] }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        pointerEvents: 'none',
        background: 'var(--ink-1000)',
        willChange: 'transform',
      }}
    >
      <motion.span
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.94, 1, 1, 0.98] }}
        transition={{ duration: WIPE, ease: EASE_FLUID, times: [0, 0.38, 0.52, 1] }}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text-strong)',
        }}
      >
        <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
          <rect x="2.5" y="2.5" width="27" height="27" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9.5" y="9.5" width="13" height="13" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </motion.span>
    </motion.div>
  )
}

/** Thin accent bar at the very top tracking how far down the page you are. */
export function ScrollProgress() {
  // Raw progress: Lenis has already smoothed the scroll, and a soft spring on
  // top left the bar visibly creeping toward its position after the page had
  // stopped moving. A progress indicator that lags is just wrong information.
  const { scrollYProgress: scaleX } = useScroll()
  const reduced = useReducedMotion()
  if (reduced) return null

  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: '0 0 auto 0',
        height: 2,
        zIndex: 95,
        transformOrigin: '0 50%',
        scaleX,
        background: 'var(--accent)',
        willChange: 'transform',
      }}
    />
  )
}

/**
 * Wraps the routed content inside the layout's <main>, so the shell around it
 * never re-mounts. The first render does not animate at all (`initial={false}`)
 * — the page is simply there. After that, a route change is a short opacity
 * crossfade; only the site↔app jump plays the ink wipe, with the swap hidden
 * under the panel. Under reduced motion it simply swaps.
 *
 * Callers pass a frozen outlet (`useOutlet()`), not `<Outlet/>`, so the page
 * fading out keeps rendering the old route rather than the new one.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  const reduced = useReducedMotion()
  const [wipeKey, setWipeKey] = useState<string | null>(null)
  const prevPath = useRef(location.pathname)
  // Last pathname the scroll/focus effect handled; null before the first run.
  const settledPath = useRef<string | null>(null)

  // Decided during render so the incoming page's transition already knows
  // whether a panel is covering it. Search/hash changes never get here: the
  // key below is the pathname alone.
  const wipeNow = useRef(false)
  if (prevPath.current !== location.pathname) {
    wipeNow.current = !reduced && shouldWipe(prevPath.current, location.pathname)
  }

  useEffect(() => {
    const from = prevPath.current
    prevPath.current = location.pathname
    if (from === location.pathname) return
    if (!wipeNow.current) return
    setWipeKey(location.pathname)
    const timer = window.setTimeout(() => setWipeKey(null), WIPE * 1000 + 40)
    return () => window.clearTimeout(timer)
  }, [location.pathname])

  // Every route starts at the top, or at its #anchor when it has one; without
  // this you land halfway down the next page after scrolling the previous one.
  // Then focus moves to <main>, so a screen reader starts reading the new page
  // instead of staying on the link that was pressed.
  useEffect(() => {
    // First paint keeps the browser's own scroll position and focus; so does
    // an effect re-run for the same page (StrictMode, a hash-only change).
    const changed = settledPath.current !== null && settledPath.current !== location.pathname
    settledPath.current = location.pathname

    const id = location.hash ? decodeURIComponent(location.hash.slice(1)) : ''
    let frame = 0
    let tries = 0
    // The target may sit in a route chunk that is still loading; look for it
    // for about a second before giving up.
    const toAnchor = () => {
      const el = id ? document.getElementById(id) : null
      if (el) {
        el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
        return
      }
      if (++tries < 60) frame = requestAnimationFrame(toAnchor)
    }

    if (id) toAnchor()
    else if (changed) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })

    if (changed) document.getElementById('main')?.focus({ preventScroll: true })
    return () => cancelAnimationFrame(frame)
  }, [location.pathname, location.hash, reduced])

  const fade = reduced ? 0 : DURATION.fast + 0.02
  // During a wipe the old page holds still and the new one appears only once
  // the panel covers the screen, so neither is ever seen mid-swap. Passed as
  // `custom` because the exiting page keeps the props of its last render.
  const variants = {
    in: (wipe: boolean) => ({
      opacity: 1,
      transition: wipe ? { duration: 0, delay: WIPE_COVER } : { duration: fade, ease: EASE_FLUID },
    }),
    out: (wipe: boolean) => ({
      opacity: 0,
      transition: wipe ? { duration: 0, delay: WIPE_COVER } : { duration: fade, ease: EASE_FLUID },
    }),
  }

  return (
    <>
      <ScrollProgress />
      <AnimatePresence>{wipeKey && <Wipe routeKey={wipeKey} />}</AnimatePresence>

      <AnimatePresence initial={false} mode="popLayout" custom={wipeNow.current}>
        <motion.div
          key={location.pathname}
          custom={wipeNow.current}
          variants={variants}
          initial={reduced ? false : 'out'}
          animate="in"
          exit={reduced ? undefined : 'out'}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  )
}
