import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

/**
 * The hero film: a clip that is scrubbed, never played.
 *
 * `currentTime` is bound to how far the page has scrolled through its first
 * viewport, so scrolling down builds the room and scrolling up empties it,
 * frame for frame. Stopping the scroll freezes the frame. A horizontal drag
 * writes to the same target, so the wheel and the hand feel like one control.
 *
 * ## Why the encode matters
 *
 * `public/hero-build.mp4` is all-intra (every frame a keyframe), B-frames off,
 * no audio track. A normal long-GOP export — the source for this one had a GOP
 * of 240 — has to decode from the previous keyframe on every backwards seek,
 * which is what makes scrubbed video stutter when you scroll up. All-intra
 * trades file size for a seek that costs one frame.
 *
 * ## Fallback ladder
 *
 * Reduced motion, a metered/slow connection, or a load failure each drop to
 * the poster still. There is no state in which this renders an empty box.
 */

const SRC = '/hero-build.mp4'
const POSTER = '/hero-poster.webp'

/** Per frame, toward the scroll target. */
const LERP = 0.1
/** Seconds of film per pixel dragged, as a fraction of duration. */
const DRAG_RATE = 0.0025
const FRICTION = 0.94
/** Idle drift starts this long after the last input, at this rate. */
const IDLE_AFTER = 3000
const IDLE_SPEED = 0.15

type Mode = 'film' | 'poster'

/** Metered or slow connections get the still, not 7MB of video. */
function connectionIsCheap(): boolean {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }
  const c = nav.connection
  if (!c) return true
  if (c.saveData) return false
  return !(c.effectiveType === '2g' || c.effectiveType === 'slow-2g' || c.effectiveType === '3g')
}

export function HeroFilm({ className }: { className?: string }) {
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const reduced = useReducedMotion()

  const [mode, setMode] = useState<Mode>('poster')
  const [hint, setHint] = useState(false)

  // Decide once whether this visit gets the film at all.
  useEffect(() => {
    if (reduced) return setMode('poster')
    if (!connectionIsCheap()) return setMode('poster')
    setMode('film')
  }, [reduced])

  // Shown once per session, and only when the film is actually scrubbable.
  useEffect(() => {
    if (mode !== 'film') return
    try {
      if (sessionStorage.getItem('fs-film-hint') === 'seen') return
      sessionStorage.setItem('fs-film-hint', 'seen')
    } catch {
      /* private mode: show it, it is one line of text */
    }
    setHint(true)
    const id = setTimeout(() => setHint(false), 4200)
    return () => clearTimeout(id)
  }, [mode])

  useEffect(() => {
    if (mode !== 'film') return
    const host = hostRef.current
    const video = videoRef.current
    if (!host || !video) return

    /* One rAF for the whole component: scroll, drag inertia and idle drift all
       resolve into a single `target`, and only the last step touches the DOM. */
    let raf = 0
    let visible = false
    let current = 0
    let target = 0
    let velocity = 0
    let lastInput = performance.now()
    let dragging = false
    let lastX = 0
    let duration = 0

    const clamp = (v: number) => Math.max(0, Math.min(duration || 0, v))

    const readScroll = () => {
      // Progress through the first viewport of the page.
      const span = window.innerHeight || 1
      const p = Math.max(0, Math.min(1, window.scrollY / span))
      target = clamp(p * duration)
      lastInput = performance.now()
      velocity = 0
    }

    const onScroll = () => {
      if (dragging) return
      readScroll()
    }

    const onPointerDown = (event: PointerEvent) => {
      dragging = true
      lastX = event.clientX
      velocity = 0
      lastInput = performance.now()
      host.setPointerCapture?.(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || !duration) return
      const dx = event.clientX - lastX
      lastX = event.clientX
      velocity = dx * DRAG_RATE * duration
      target = clamp(target + velocity)
      lastInput = performance.now()
    }

    const endDrag = (event: PointerEvent) => {
      if (!dragging) return
      dragging = false
      host.releasePointerCapture?.(event.pointerId)
      lastInput = performance.now()
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible || !duration) return

      // Inertia after the hand leaves.
      if (!dragging && Math.abs(velocity) > 0.0005) {
        velocity *= FRICTION
        target = clamp(target + velocity)
      } else if (!dragging && now - lastInput > IDLE_AFTER) {
        // Idle drift, wrapping so the room keeps rebuilding itself.
        target += (IDLE_SPEED * 16.7) / 1000
        if (target > duration) target = 0
      }

      current += (target - current) * LERP
      // A seek under a frame is invisible and costs a decode; skip it.
      if (Math.abs(current - video.currentTime) > 1 / 48) {
        video.currentTime = current
      }
    }

    const onMeta = () => {
      duration = video.duration || 0
      readScroll()
      current = target
      video.currentTime = current
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
      },
      { rootMargin: '10%' }
    )
    io.observe(host)

    video.addEventListener('loadedmetadata', onMeta)
    if (video.readyState >= 1) onMeta()

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    host.addEventListener('pointerdown', onPointerDown)
    host.addEventListener('pointermove', onPointerMove)
    host.addEventListener('pointerup', endDrag)
    host.addEventListener('pointercancel', endDrag)

    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      video.removeEventListener('loadedmetadata', onMeta)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      host.removeEventListener('pointerdown', onPointerDown)
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerup', endDrag)
      host.removeEventListener('pointercancel', endDrag)
    }
  }, [mode])

  /* The film is ~7MB. Fetch only its metadata (duration, first frame) until
     the visitor shows intent — any scroll or pointer — so a phone that lands
     and leaves never pays for the whole file. Set imperatively: the JSX value
     never changes, so React will not put it back. */
  useEffect(() => {
    if (mode !== 'film') return
    const events = ['scroll', 'pointerdown', 'pointermove', 'touchstart'] as const
    const upgrade = () => {
      const video = videoRef.current
      if (video && video.preload !== 'auto') video.preload = 'auto'
      for (const name of events) window.removeEventListener(name, upgrade)
    }
    for (const name of events) window.addEventListener(name, upgrade, { passive: true })
    return () => {
      for (const name of events) window.removeEventListener(name, upgrade)
    }
  }, [mode])

  /* iOS refuses to seek a video that has never been handed a user gesture.
     One play/pause pair inside the first gesture unlocks it, silently. */
  useEffect(() => {
    if (mode !== 'film') return
    const unlock = () => {
      const video = videoRef.current
      if (!video) return
      video.play().then(() => video.pause()).catch(() => {})
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: true, passive: true })
    window.addEventListener('touchstart', unlock, { once: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
  }, [mode])

  return (
    <div ref={hostRef} className={className} data-film={mode}>
      <style href="fs-hero-film" precedence="medium">{`
        .fs-film { position: relative; overflow: hidden; }
        .fs-film__media,
        .fs-film__still {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .fs-film[data-film='film'] { cursor: grab; touch-action: pan-y; }
        .fs-film[data-film='film']:active { cursor: grabbing; }
        .fs-film__hint {
          position: absolute;
          left: 50%;
          bottom: var(--s6);
          transform: translateX(-50%);
          z-index: 2;
          padding: var(--s2) var(--s4);
          border-radius: 999px;
          background: color-mix(in srgb, var(--bg) 78%, transparent);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          font-family: var(--font-mono);
          font-size: var(--step--2);
          letter-spacing: var(--tracking-mono);
          text-transform: uppercase;
          color: var(--text);
          pointer-events: none;
          animation: fs-film-hint 4.2s var(--ease) forwards;
        }
        @keyframes fs-film-hint {
          0% { opacity: 0; transform: translate(-50%, 8px); }
          12%, 76% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fs-film__hint { animation: none; opacity: 1; }
        }
      `}</style>

      {mode === 'film' ? (
        <video
          ref={videoRef}
          className="fs-film__media"
          src={SRC}
          poster={POSTER}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={() => setMode('poster')}
        />
      ) : (
        <img className="fs-film__still" src={POSTER} alt="" aria-hidden="true" />
      )}

      {hint && <span className="fs-film__hint">{t('landing.hero.filmHint')}</span>}
    </div>
  )
}
