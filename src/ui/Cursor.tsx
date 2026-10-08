/**
 * The custom cursor was removed: it replaced the native pointer and the client
 * did not want it.
 *
 * This is kept as a no-op rather than deleted because the router mounts it, and
 * because `data-cursor` / `data-cursor-snap` attributes are still scattered
 * across the components. Those attributes are now inert and harmless — they
 * cost nothing and stay available if a pointer affordance is ever wanted again.
 *
 * It also makes sure the native cursor is restored: `html[data-cursor="on"]`
 * in base.css sets `cursor: none`, so that flag has to be cleared.
 */
import { useEffect } from 'react'

export function Cursor() {
  useEffect(() => {
    document.documentElement.dataset.cursor = 'off'
  }, [])

  return null
}
