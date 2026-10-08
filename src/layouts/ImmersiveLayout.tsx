import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'

import { Header } from './Header'
import { PageFallback } from './PageFallback'

/**
 * Chrome-free shell for the full-screen tools (live camera, room builder).
 * No dock, footer or atmosphere competing with the viewport for pixels or GPU.
 *
 * `compact` keeps the header so the builder still has a way home; the live
 * views own the whole screen and carry their own exit control.
 */
export function ImmersiveLayout({ compact = false }: { compact?: boolean }) {
  const { pathname } = useLocation()

  // There is no PageTransition here to reset scroll, so do it directly.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])

  const main = (
    <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </main>
  )

  if (!compact) return main

  return (
    <div className="fs-above">
      <Header />
      {main}
    </div>
  )
}
