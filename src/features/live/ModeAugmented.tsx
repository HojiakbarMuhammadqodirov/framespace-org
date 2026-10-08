import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WebGLRenderer } from 'three'

import { SceneCanvas } from '@/three/Canvas'
import { Button } from '@/ui/Button'
import { ArScene } from './ArScene'
import { Cluster, GlyphPlay, GlyphStop, Readout } from './Chrome'
import { LiveNotice } from './LiveNotice'
import { LIVE_MODELS, hasAssets, type LiveModel } from './models'
import type { LiveCapabilities } from './types'

/**
 * MODE B — augmented reality, by whichever route this device actually has.
 *
 *   WebXR `immersive-ar`  → 6DoF, hit-test, anchors (Android Chrome, Quest)
 *   `<a rel="ar">`        → AR Quick Look, one USDZ at a time (iOS Safari)
 *   neither               → a designed state that points back at Mode C
 *
 * Both routes are feature-detected — `navigator.xr.isSessionSupported` and
 * `relList.supports('ar')`. Nothing here reads a user-agent string, because
 * the platform that most needs the fallback (iOS) is also the one whose UA is
 * most often spoofed by in-app browsers.
 *
 * There are no model assets in this repository, so what is placed is
 * placeholder geometry at the real dimensions and the Quick Look button says
 * plainly that the catalog has nothing to hand it yet. See `models.ts`.
 */

const CSS = `
.fsl-ar {
  position: fixed;
  inset: 0;
  height: 100dvh;
  background: var(--bg-inverse);
  overflow: hidden;
}
.fsl-ar__canvas { position: absolute; inset: 0; }
.fsl-ar__overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  align-content: end;
  gap: var(--s3);
  padding: var(--s4);
  padding-bottom: calc(var(--s4) + env(safe-area-inset-bottom, 0px));
  pointer-events: none;
}
.fsl-ar__overlay > * { pointer-events: auto; }
.fsl-ar__pad { display: grid; gap: var(--s3); padding: var(--s4); }
.fsl-ar__row { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); }
.fsl-ar__picker { display: flex; gap: var(--s1); padding: var(--s1); }
.fsl-ar__pick {
  flex: 1;
  min-height: var(--tap);
  border: 0;
  border-radius: var(--radius-inner-xl);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  cursor: pointer;
  transition: transform var(--d-fast) var(--ease), background-color var(--d-base) var(--ease),
    color var(--d-base) var(--ease);
}
.fsl-ar__pick:active { transform: scale(0.98); }
.fsl-ar__pick[aria-pressed='true'] {
  background: color-mix(in srgb, var(--paper) 14%, transparent);
  box-shadow: var(--inset-hi);
  color: var(--text-strong);
}
.fsl-ar__guide {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: center;
}
@media (prefers-reduced-motion: reduce) {
  .fsl-ar__pick { transition: none; }
}
`

type Phase = 'idle' | 'starting' | 'running' | 'error'

export interface ModeAugmentedProps {
  capabilities: LiveCapabilities
  onExit: () => void
  /** Offered as the way out of every unsupported state. */
  onFallback: () => void
}

export function ModeAugmented({ capabilities, onExit, onFallback }: ModeAugmentedProps) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('idle')
  const [session, setSession] = useState<XRSession | null>(null)
  const [model, setModel] = useState<LiveModel>(LIVE_MODELS[0])
  const [placed, setPlaced] = useState(0)
  const [tracking, setTracking] = useState(false)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const endSession = useCallback(() => {
    session?.end().catch(() => {})
  }, [session])

  useEffect(() => {
    if (!session) return
    const onEnd = () => {
      setSession(null)
      setPhase('idle')
      setPlaced(0)
      setTracking(false)
    }
    session.addEventListener('end', onEnd)
    return () => {
      session.removeEventListener('end', onEnd)
      // Leaving the screen must leave the headset/AR view too.
      session.end().catch(() => {})
    }
  }, [session])

  const start = useCallback(async () => {
    const xr = navigator.xr
    const renderer = rendererRef.current
    if (!xr || !renderer) return
    setPhase('starting')
    try {
      const next = await xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        // Every one of these is optional in the spec and absent somewhere:
        // `anchors` on older ARCore, `dom-overlay` on Quest browser.
        optionalFeatures: ['anchors', 'local-floor', 'dom-overlay'],
        domOverlay: overlayRef.current ? { root: overlayRef.current } : undefined,
      })
      renderer.xr.enabled = true
      await renderer.xr.setReferenceSpaceType('local')
      await renderer.xr.setSession(next)
      setSession(next)
      setPhase('running')
    } catch {
      setPhase('error')
    }
  }, [])

  /* ------------------------------------------------- iOS: AR Quick Look */

  if (capabilities.xrAr === false && capabilities.quickLook) {
    const usdz = LIVE_MODELS.find((m) => m.usdz)?.usdz ?? null
    return (
      <LiveNotice
        code="AR QUICK LOOK"
        title={t('live.ar.quicklook.title')}
        body={t('live.ar.quicklook.body')}
        action={
          usdz
            ? {
                label: t('live.action.enter'),
                onClick: () => {
                  // Quick Look is entered by activating an <a rel="ar"> that
                  // contains an <img>. Safari intercepts the navigation.
                  const anchor = document.createElement('a')
                  anchor.rel = 'ar'
                  anchor.href = usdz
                  anchor.appendChild(document.createElement('img'))
                  anchor.click()
                },
              }
            : undefined
        }
        secondary={{ label: t('live.mode.c.name'), onClick: onFallback }}
      >
        {hasAssets('usdz') ? t('live.ar.placeholder.body') : t('live.ar.quicklook.missing')}
      </LiveNotice>
    )
  }

  /* --------------------------------------------- neither route available */

  if (capabilities.xrAr === false) {
    return (
      <LiveNotice
        code="WEBXR"
        title={t('live.ar.unsupported.title')}
        body={t('live.ar.unsupported.body')}
        action={{ label: t('live.mode.c.name'), onClick: onFallback }}
        secondary={{ label: t('live.action.back'), onClick: onExit }}
      />
    )
  }

  /* ------------------------------------------------------------- WebXR */

  return (
    <div className="fsl-ar">
      <style href="fs-live-ar" precedence="medium">
        {CSS}
      </style>

      <SceneCanvas
        className="fsl-ar__canvas"
        shadows={false}
        rootMargin="0px"
        onCreated={(state) => {
          rendererRef.current = state.gl
        }}
      >
        {session ? (
          <ArScene
            session={session}
            model={model}
            onPlacedCount={setPlaced}
            onTracking={setTracking}
          />
        ) : null}
      </SceneCanvas>

      <div className="fsl-ar__overlay" ref={overlayRef}>
        <Cluster small quiet>
          <div className="fsl-ar__picker" role="group" aria-label={t('live.ar.title')}>
            {LIVE_MODELS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="fsl-ar__pick"
                aria-pressed={item.id === model.id}
                onClick={() => setModel(item)}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>
        </Cluster>

        <Cluster>
          <div className="fsl-ar__pad">
            <div className="fsl-ar__row">
              <Readout label={t('live.ar.placed')} value={String(placed).padStart(2, '0')} />
              <Readout
                label={t('live.mode.label')}
                value="WEBXR · 6DOF"
                tone={phase === 'running' ? 'ok' : 'default'}
                align="end"
              />
            </div>

            <p className="fsl-ar__guide" aria-live="polite">
              {phase !== 'running'
                ? t('live.ar.body')
                : tracking
                  ? t('live.ar.ready')
                  : t('live.ar.scanning')}
            </p>

            {phase === 'error' && (
              <p
                style={{
                  margin: 0,
                  color: 'var(--err)',
                  fontSize: 'var(--step--1)',
                  textAlign: 'center',
                }}
              >
                {t('live.error.generic.body')}
              </p>
            )}

            {phase === 'running' ? (
              <Button variant="secondary" block icon={<GlyphStop />} onClick={endSession}>
                {t('live.action.leave')}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                block
                icon={<GlyphPlay />}
                onClick={() => void start()}
                disabled={capabilities.xrAr !== true || phase === 'starting'}
              >
                {t('live.action.enter')}
              </Button>
            )}

            <p
              style={{
                margin: 0,
                color: 'var(--text-muted)',
                fontSize: 'var(--step--1)',
                lineHeight: 'var(--lh-body)',
                textAlign: 'center',
              }}
            >
              {t('live.ar.placeholder.body')}
            </p>
          </div>
        </Cluster>
      </div>
    </div>
  )
}
