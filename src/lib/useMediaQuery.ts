import { useEffect, useState } from 'react'

/**
 * Matches a media query in JS.
 *
 * This exists because CSS `display: none` does not stop React from mounting a
 * component — the desktop-only WebGL room would still download Three.js on a
 * phone if it were hidden with CSS alone.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(query)
    const sync = () => setMatches(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [query])

  return matches
}

export const DESKTOP = '(min-width: 1024px)'

/**
 * Where the WebGL hero is worth its 704 KB.
 *
 * Width alone was the wrong test. A laptop with the window dragged to 833px
 * wide is still a machine that renders the room at 60fps, but it was being
 * served the flat mobile hero — so the site's one genuinely impressive moment
 * disappeared on any narrow desktop window, which is exactly what a viewport
 * audit at that width reported back as "the 3D is fake."
 *
 * `pointer: fine` is the part that keeps the promise made in Hero.tsx: a phone
 * or tablet reports `pointer: coarse` at any width and still never downloads
 * Three.js. What changes is only that a real pointer no longer has to bring a
 * 1024px-wide window with it.
 */
export const SCENE_CAPABLE = '(min-width: 820px) and (pointer: fine)'
