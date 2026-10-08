import {
  Suspense,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas as R3FCanvas, useThree, type CanvasProps } from '@react-three/fiber'
import { PCFShadowMap } from 'three'

import { Button } from '@/ui/Button'
import { detectSceneTier, probeWebGL, type SceneTier } from './effects/quality'

/**
 * Shared "the visitor asked for calm" flag. R3F bridges React context across
 * its own reconciler root, so scenes inside the canvas can read this directly.
 */
const ReducedMotionContext = createContext(false)

/** Read the reduced-motion preference from inside (or outside) the scene. */
export function useSceneReducedMotion(): boolean {
  return useContext(ReducedMotionContext)
}

/** Live `prefers-reduced-motion: reduce` subscription. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * One-shot, cached WebGL probe. Shares its single probe context with the
 * device tiering in `effects/quality.ts`, so a page never creates two.
 */
export function detectWebGL(): boolean {
  return probeWebGL().supported
}

/** Per-tier GPU settings. Low trades sharpness for a steady frame. */
const GPU: Record<SceneTier, { dpr: [number, number]; gl: CanvasProps['gl'] }> = {
  high: { dpr: [1, 1.75], gl: { antialias: true, powerPreference: 'high-performance' } },
  low: { dpr: [1, 1.25], gl: { antialias: false, powerPreference: 'default' } },
}

/**
 * three r180+ deprecated PCFSoftShadowMap (it logs a warning and falls back),
 * and R3F still maps `shadows="soft"` / `shadows` to it. PCFShadowMap now
 * filters softly on its own and honours `light.shadow.radius`, so map the
 * soft request onto it explicitly.
 */
function resolveShadows(shadows: CanvasProps['shadows']): CanvasProps['shadows'] {
  if (shadows === true || shadows === 'soft') return { enabled: true, type: PCFShadowMap }
  return shadows
}

/**
 * R3F drops `invalidate()` calls while the loop is 'never', so a demand-driven
 * scene coming back on screen (or out from under a modal) would sit on a stale
 * frame — or freeze mid-transition. One kick on resume restarts it; any
 * animation still in flight then keeps itself going from its own useFrame.
 */
function ResumeKick({ running }: { running: boolean }) {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    if (!running) return
    const id = requestAnimationFrame(() => invalidate())
    return () => cancelAnimationFrame(id)
  }, [running, invalidate])
  return null
}

export interface SceneCanvasProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Rendered instead of the canvas when WebGL is unavailable. A designed state, not a crash. */
  fallback?: ReactNode
  /** Rendered inside the scene while suspended. Must be 3D content (or null). */
  sceneFallback?: ReactNode
  shadows?: CanvasProps['shadows']
  /**
   * NoToneMapping by default: the brand palette is a narrow warm band and ACES
   * visibly desaturates the clay tones we are contractually showing off.
   */
  flat?: boolean
  /** Extra margin for the visibility probe, e.g. '200px' to warm up just before scroll-in. */
  rootMargin?: string
  /** Force-disable the frameloop regardless of visibility (e.g. a modal is open above it). */
  paused?: boolean
  /**
   * 'demand' renders only when the scene calls `invalidate()` — an editor or a
   * still product idles at zero frames. 'always' is for scenes that animate.
   */
  frameloop?: 'always' | 'demand'
  /**
   * The canvas takes gestures (orbit, zoom). Marks the host so smooth scroll
   * leaves the wheel to the scene. Defaults to true.
   */
  interactive?: boolean
  /** Accessible name. A decorative canvas without one is hidden from AT. */
  label?: string
  /** Overrides the detected device tier (e.g. the builder's manual toggle). */
  tier?: SceneTier
  onCreated?: CanvasProps['onCreated']
}

/**
 * R3F canvas that only burns GPU time while it is actually on screen.
 *
 * `frameloop` flips to 'never' when the wrapper leaves the viewport or the tab
 * is hidden, which is the difference between a landing page that idles at 0%
 * CPU and one that cooks a phone battery below the fold. Scenes that are still
 * most of the time pass `frameloop="demand"` and invalidate while they move.
 *
 * Device tier reaches the GPU here: low-tier phones get a lower DPR ceiling,
 * no MSAA and the default power profile.
 */
export function SceneCanvas({
  children,
  className,
  style,
  fallback = null,
  sceneFallback = null,
  shadows = 'soft',
  flat = true,
  rootMargin = '120px',
  paused = false,
  frameloop = 'always',
  interactive = true,
  label,
  tier: tierProp,
  onCreated,
}: SceneCanvasProps) {
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [tabVisible, setTabVisible] = useState(true)
  const supported = useMemo(() => detectWebGL(), [])
  const detectedTier = useMemo(() => detectSceneTier(), [])
  const gpu = GPU[tierProp ?? detectedTier]
  const reducedMotion = usePrefersReducedMotion()
  // A lost context (GPU reset, too many tabs) is recoverable: bumping the key
  // remounts the canvas with a fresh renderer.
  const [lost, setLost] = useState(false)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin, threshold: 0 },
    )
    io.observe(host)
    return () => io.disconnect()
  }, [rootMargin])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVis = () => setTabVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const a11y = label
    ? interactive
      ? { role: 'group', 'aria-roledescription': '3D', 'aria-label': label }
      : { role: 'img', 'aria-label': label }
    : {}
  const hostProps = {
    ref: hostRef,
    className,
    style,
    ...(interactive ? { 'data-lenis-prevent-wheel': '' } : null),
    ...a11y,
  }

  if (!supported) {
    return <div {...hostProps}>{fallback}</div>
  }

  if (lost) {
    return (
      <div {...hostProps}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {fallback}
          <div
            role="alert"
            style={{
              position: 'absolute',
              insetInline: 0,
              bottom: 'var(--s4)',
              display: 'grid',
              justifyItems: 'center',
              gap: 'var(--s2)',
              zIndex: 4,
              color: 'var(--text-muted)',
              fontSize: 'var(--step--1)',
              textAlign: 'center',
              paddingInline: 'var(--s4)',
            }}
          >
            <span>
              {t('builder.webgl.lost', {
                defaultValue:
                  '3D koʻrinish toʻxtab qoldi. Xonangiz saqlangan — sahifani qayta yuklang.',
              })}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setLost(false)
                setGeneration((n) => n + 1)
              }}
            >
              {t('builder.webgl.reload', { defaultValue: 'Qayta yuklash' })}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const running = visible && tabVisible && !paused

  return (
    <div {...hostProps}>
      <ReducedMotionContext.Provider value={reducedMotion}>
        <R3FCanvas
          key={generation}
          frameloop={running ? frameloop : 'never'}
          dpr={gpu.dpr}
          shadows={resolveShadows(shadows)}
          flat={flat}
          gl={gpu.gl}
          onCreated={(state) => {
            state.gl.domElement.addEventListener(
              'webglcontextlost',
              (event) => {
                // Without preventDefault the browser never offers the context back.
                event.preventDefault()
                setLost(true)
              },
              { once: true },
            )
            onCreated?.(state)
          }}
        >
          <ResumeKick running={running} />
          <Suspense fallback={sceneFallback}>{children}</Suspense>
        </R3FCanvas>
      </ReducedMotionContext.Provider>
    </div>
  )
}

export default SceneCanvas
