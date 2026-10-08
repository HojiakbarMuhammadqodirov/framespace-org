import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * The page backdrop: soft light washes, a blueprint dot field, and a pointer
 * spotlight that lifts the grid where the cursor is.
 *
 * ## Why a canvas instead of CSS
 *
 * This used to be two 70vmax divs under `filter: blur(80px)`, drifting on a
 * long animation. That is roughly a 1400×1400 layer per wash, re-rasterised
 * with a large-radius blur, permanently, on every page — and it was the reason
 * the site stuttered.
 *
 * The same look comes free from drawing the washes into a **tiny** canvas
 * (~220px wide) and letting the browser scale it up: bilinear upscaling *is* a
 * blur, and it costs nothing. The whole backdrop is now a handful of radial
 * gradients on a postage stamp, redrawn at ~30fps only while something moves.
 */

const MAX_W = 220 // backing-store width; the upscale supplies the softness
const FPS = 30

/**
 * Touch-first or modest hardware: the drift is barely visible on a phone held
 * at arm's length, but a 30fps loop still costs battery and main-thread time
 * on exactly the devices that can least spare it. These get one static frame.
 */
function isLowEnd() {
  if (typeof window === 'undefined') return true
  const nav = navigator as Navigator & { deviceMemory?: number }
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 4)
  )
}

type Wash = {
  /** Base position in 0..1 of the canvas. */
  bx: number
  by: number
  /** Orbit radius and speed for the idle drift. */
  ax: number
  ay: number
  speed: number
  phase: number
  /** How strongly this wash chases the pointer. */
  pull: number
  radius: number
  color: string
  alpha: number
}

export function Ambient() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    // Read the palette once from the tokens so the backdrop follows the theme.
    const root = getComputedStyle(document.documentElement)
    const clay = root.getPropertyValue('--clay-300').trim() || '#a67b5b'
    const accent = root.getPropertyValue('--accent').trim() || '#c6552f'

    const washes: Wash[] = [
      { bx: 0.82, by: 0.12, ax: 0.06, ay: 0.05, speed: 0.045, phase: 0, pull: 0.1, radius: 0.72, color: clay, alpha: 0.22 },
      { bx: 0.12, by: 0.86, ax: 0.05, ay: 0.06, speed: 0.033, phase: 2.1, pull: 0.07, radius: 0.66, color: accent, alpha: 0.13 },
      // A third, small and tight, that mostly follows the pointer — this is
      // the part that makes the background feel alive rather than decorative.
      { bx: 0.5, by: 0.4, ax: 0.02, ay: 0.02, speed: 0.08, phase: 1.1, pull: 0.92, radius: 0.34, color: accent, alpha: 0.1 },
    ]

    let w = 0
    let h = 0
    let dpr = 1

    const resize = () => {
      // A hidden or zero-sized viewport (background tab, emulation reset)
      // reports 0 here, and 0/0 poisoned every later gradient with NaN.
      const vw = Math.max(1, window.innerWidth)
      const vh = Math.max(1, window.innerHeight)
      dpr = Math.min(vw, MAX_W) / vw
      w = Math.max(1, Math.round(vw * dpr))
      h = Math.max(1, Math.round(vh * dpr))
      canvas.width = w
      canvas.height = h
    }
    resize()

    // Pointer target in 0..1, damped toward on each frame.
    const target = { x: 0.5, y: 0.4 }
    const eased = { x: 0.5, y: 0.4 }
    let pointerSeen = false

    const onPointer = (event: PointerEvent) => {
      target.x = event.clientX / Math.max(1, window.innerWidth)
      target.y = event.clientY / Math.max(1, window.innerHeight)
      pointerSeen = true
    }

    const draw = (time: number) => {
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'

      for (const wash of washes) {
        const t = time * wash.speed + wash.phase
        const driftX = Math.cos(t) * wash.ax
        const driftY = Math.sin(t * 0.8) * wash.ay
        const x = (wash.bx + driftX) * (1 - wash.pull) + eased.x * wash.pull
        const y = (wash.by + driftY) * (1 - wash.pull) + eased.y * wash.pull
        const r = wash.radius * Math.max(w, h)
        if (!Number.isFinite(x) || !Number.isFinite(y) || !(r > 0)) continue

        const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r)
        g.addColorStop(0, hexToRgba(wash.color, wash.alpha))
        g.addColorStop(1, hexToRgba(wash.color, 0))
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }
    }

    let raf = 0
    let last = 0
    let running = true

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!running) return
      if (now - last < 1000 / FPS) return
      last = now

      // Frame-rate independent damping — a fixed per-frame factor would make
      // the chase twice as fast on a 120Hz display.
      const k = 1 - Math.exp(-(1 / FPS) / 0.22)
      eased.x += (target.x - eased.x) * k
      eased.y += (target.y - eased.y) * k

      draw(now / 1000)
    }

    const onVisibility = () => {
      running = document.visibilityState === 'visible'
    }

    const still = reduced || isLowEnd()

    if (still) {
      // One static frame, no loop, no pointer or visibility listeners.
      draw(0)
    } else {
      window.addEventListener('pointermove', onPointer, { passive: true })
      document.addEventListener('visibilitychange', onVisibility)
      raf = requestAnimationFrame(frame)
    }

    const onResize = () => {
      resize()
      // Resizing clears the canvas; a static backdrop has no loop to repaint it.
      if (still) draw(0)
    }
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      void pointerSeen
    }
  }, [reduced])

  return (
    <canvas
      ref={canvasRef}
      className="fs-ambient-canvas"
      aria-hidden="true"
      // The tiny backing store is stretched over the viewport; the upscale is
      // what produces the softness, at no cost.
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
    />
  )
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = parseInt(full, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const GRAIN = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220">
     <filter id="n">
       <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" stitchTiles="stitch"/>
       <feColorMatrix type="saturate" values="0"/>
     </filter>
     <rect width="220" height="220" filter="url(#n)"/>
   </svg>`
)

export function Grain() {
  return (
    <div
      className="fs-grain"
      aria-hidden="true"
      style={{ backgroundImage: `url("data:image/svg+xml,${GRAIN}")`, backgroundSize: '220px 220px' }}
    />
  )
}

/**
 * The blueprint dot field, plus a spotlight that follows the pointer and lifts
 * the dots around it. Both are pure CSS background-images on fixed elements,
 * and the spotlight moves with a transform — no blur filter, no repaint.
 */
export function Grid() {
  const ref = useRef<HTMLDivElement | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    let raf = 0
    let x = window.innerWidth / 2
    let y = window.innerHeight / 2
    let tx = x
    let ty = y

    // The loop only runs while the spot is still catching up with the
    // pointer; once settled it stops and the next pointermove restarts it.
    const tick = () => {
      x += (tx - x) * 0.12
      y += (ty - y) * 0.12
      el.style.transform = `translate3d(${x - 320}px, ${y - 320}px, 0)`
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0
    }

    const onMove = (event: PointerEvent) => {
      tx = event.clientX
      ty = event.clientY
      if (!raf) raf = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [reduced])

  return (
    <>
      <div className="fs-dots" aria-hidden="true" />
      {!reduced && <div className="fs-spot" ref={ref} aria-hidden="true" />}
    </>
  )
}

/** The whole backdrop, for a page shell. */
export function Atmosphere() {
  return (
    <>
      <Ambient />
      <Grid />
      <Grain />
    </>
  )
}
