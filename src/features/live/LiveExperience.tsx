import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DESKTOP, useMediaQuery } from '@/lib/useMediaQuery'
import { LiveChromeStyles } from './Chrome'
import { DesktopHandoff } from './DesktopHandoff'
import { LiveIntro, type IntroMode } from './LiveIntro'
import { LiveNotice } from './LiveNotice'
import { LiveTopBar, type ModeOption } from './LiveTopBar'
import { ModeAugmented } from './ModeAugmented'
import { ModePanorama } from './ModePanorama'
import { ModeRestyle } from './ModeRestyle'
import { useLiveCapabilities } from './capabilities'
import { planPanorama } from './renders'
import { useEquirect } from './useEquirect'
import { useLiveOrientation, useLiveReadout } from './useLiveOrientation'
import { useStage } from './useStage'
import type { LiveModeId, LiveProject } from './types'

/**
 * "See by yourself", assembled.
 *
 * The order of the gates is the order things actually fail in:
 *
 *   desktop      → the panorama, by mouse (drag, wheel, arrows), with the phone
 *                  handoff as a secondary panel; the full handoff page only
 *                  when there is nothing to show or no WebGL
 *   insecure     → no sensors, no camera, nothing to negotiate
 *   no renders   → nothing to show; send them to capture
 *   intro        → one tap: motion permission (iOS), wake lock, portrait lock
 *   mode         → C by default, because C always works
 *
 * Mode selection degrades downward and never upward. Anything that cannot run
 * falls back to C, which needs no network, no WebXR and no session token.
 */

export interface LiveExperienceProps {
  project: LiveProject | null
  projectId: string
  onExit: () => void
  /** Sends the visitor to the capture flow when there is nothing to show. */
  onCapture: () => void
}

export function LiveExperience({ project, projectId, onExit, onCapture }: LiveExperienceProps) {
  const { t } = useTranslation()
  const desktop = useMediaQuery(DESKTOP)
  const capabilities = useLiveCapabilities()

  const [entered, setEntered] = useState(false)
  const [mode, setMode] = useState<LiveModeId>('c')
  const [busy, setBusy] = useState(false)
  /** Motion refused, or granted but silent: the finger drives the sphere. */
  const [touchOnly, setTouchOnly] = useState(false)

  const orientation = useLiveOrientation(entered && !desktop)
  const readout = useLiveReadout(orientation)
  const stage = useStage(entered && !desktop)

  const plan = useMemo(() => planPanorama(project?.renders), [project])
  // Stitched here rather than inside mode C, so switching to another mode and
  // back does not re-stitch four renders.
  const equirect = useEquirect(plan, Boolean(plan) && capabilities.webgl && (desktop || entered))

  // "Granted" is what Android and desktop browsers report even with no sensor
  // behind it. Without a reading shortly after entering, hand over to touch so
  // the sphere is never frozen.
  useEffect(() => {
    if (!entered || desktop || touchOnly || readout.live) return undefined
    const timer = window.setTimeout(() => setTouchOnly(true), 1800)
    return () => window.clearTimeout(timer)
  }, [entered, desktop, touchOnly, readout.live])
  useEffect(() => {
    if (touchOnly && readout.live) setTouchOnly(false)
    // Only a live reading may take control back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readout.live])

  const gyro =
    !touchOnly &&
    capabilities.motion &&
    orientation.permission === 'granted' &&
    capabilities.secureContext

  const title = useMemo(() => {
    const meta = (project?.brief as { meta?: { title?: unknown } } | undefined)?.meta
    return (typeof meta?.title === 'string' && meta.title) || project?.style || t('live.legend.room')
  }, [project, t])

  const enter = useCallback(
    async (next: LiveModeId) => {
      setBusy(true)
      setMode(next)
      // Both of these must originate in the tap handler. `request()` is awaited
      // first because iOS invalidates the gesture as soon as anything else
      // does; the stage locks are forgiving by comparison.
      try {
        if (capabilities.motion) await orientation.request()
      } finally {
        void stage.engage()
        setEntered(true)
        setBusy(false)
      }
    },
    [capabilities.motion, orientation, stage]
  )

  /* ------------------------------------------------------------- gates */

  if (desktop && (!plan || !capabilities.webgl)) return <DesktopHandoff />

  // Sensors and the camera need HTTPS; the desktop panorama needs neither.
  if (!desktop && !capabilities.secureContext) {
    return (
      <>
        <LiveChromeStyles />
        <LiveNotice
          code="HTTPS"
          title={t('live.error.insecure.title')}
          body={t('live.error.insecure.body')}
          secondary={{ label: t('live.action.back'), onClick: onExit }}
        />
      </>
    )
  }

  if (!plan) {
    return (
      <>
        <LiveChromeStyles />
        <LiveNotice
          code="NO RENDERS"
          title={t('live.error.noRenders.title')}
          body={t('live.error.noRenders.body')}
          action={{ label: t('live.error.noRenders.cta'), onClick: onCapture }}
          secondary={{ label: t('live.action.back'), onClick: onExit }}
        />
      </>
    )
  }

  /* ----------------------------------------------------------- desktop */

  if (desktop) {
    return (
      <>
        <LiveChromeStyles />
        <ModePanorama
          project={project}
          projectId={projectId}
          plan={plan}
          orientation={orientation}
          readout={readout}
          gyro={false}
          webgl={capabilities.webgl}
          equirect={equirect}
          onExit={onExit}
        >
          <LiveTopBar
            title={title}
            subtitle={t('live.desktop.lookHere', { defaultValue: 'Shu yerga qarang' })}
            modes={[{ id: 'c', label: t('live.mode.c.name'), available: true }]}
            mode="c"
            onMode={() => undefined}
            onExit={onExit}
            status={[
              {
                label: t('live.status.sectors'),
                value: String(plan.renders.length).padStart(2, '0'),
                tone: plan.even ? 'default' : 'warn',
              },
            ]}
          />
          <DesktopHandoff compact />
        </ModePanorama>
      </>
    )
  }

  /* ------------------------------------------------------------- intro */

  const introModes: IntroMode[] = [
    { id: 'c', available: capabilities.webgl },
    {
      id: 'b',
      available: capabilities.xrAr === true || capabilities.quickLook,
      reason:
        capabilities.xrAr === null
          ? t('live.align.source.none')
          : capabilities.quickLook
            ? t('live.ar.quicklook.title')
            : t('live.ar.unsupported.title'),
    },
    { id: 'a', available: false, reason: t('live.restyle.gated.title') },
  ]

  if (!entered) {
    return (
      <>
        <LiveChromeStyles />
        <LiveIntro modes={introModes} onEnter={(id) => void enter(id)} primary="c" busy={busy} />
      </>
    )
  }

  if (orientation.permission === 'denied' && mode === 'c' && !touchOnly) {
    return (
      <>
        <LiveChromeStyles />
        <LiveNotice
          code="MOTION"
          title={t('live.error.motionDenied.title')}
          body={t('live.error.motionDenied.body')}
          action={{ label: t('live.action.grant'), onClick: () => void orientation.request() }}
          secondary={{ label: t('live.touch.useTouch'), onClick: () => setTouchOnly(true) }}
        />
      </>
    )
  }

  if (!capabilities.online && mode !== 'c') {
    return (
      <>
        <LiveChromeStyles />
        <LiveNotice
          code="OFFLINE"
          title={t('live.error.offline.title')}
          body={t('live.error.offline.body')}
          action={{ label: t('live.mode.c.name'), onClick: () => setMode('c') }}
          secondary={{ label: t('live.action.back'), onClick: onExit }}
        />
      </>
    )
  }

  /* -------------------------------------------------------------- live */

  const modeOptions: ModeOption[] = [
    { id: 'c', label: t('live.mode.c.name'), available: capabilities.webgl },
    {
      id: 'b',
      label: t('live.mode.b.name'),
      available: capabilities.xrAr === true || capabilities.quickLook,
    },
    { id: 'a', label: t('live.mode.a.name'), available: false },
  ]

  const status: React.ComponentProps<typeof LiveTopBar>['status'] = [
    {
      label: t('live.status.sectors'),
      value: String(plan.renders.length).padStart(2, '0'),
      tone: plan.even ? 'default' : 'warn',
    },
    {
      label: 'WAKE',
      value:
        stage.wakeLock === 'on'
          ? t('live.status.wakeOn')
          : stage.wakeLock === 'unsupported' || stage.wakeLock === 'failed'
            ? t('live.status.wakeOff')
            : '———',
      tone: stage.wakeLock === 'on' ? 'ok' : 'default',
    },
  ]

  const topBar = (
    <LiveTopBar
      title={title}
      subtitle={
        touchOnly
          ? t('live.touch.noSensor')
          : stage.portrait === 'on'
            ? t('live.status.portraitLocked')
            : t('live.status.portraitFree')
      }
      modes={modeOptions}
      mode={mode}
      onMode={setMode}
      onExit={onExit}
      status={status}
    />
  )

  return (
    <>
      <LiveChromeStyles />

      {mode === 'c' && (
        <ModePanorama
          project={project}
          projectId={projectId}
          plan={plan}
          orientation={orientation}
          readout={readout}
          gyro={gyro}
          webgl={capabilities.webgl}
          equirect={equirect}
          onExit={onExit}
        >
          {topBar}
        </ModePanorama>
      )}

      {mode === 'b' && (
        <>
          <ModeAugmented
            capabilities={capabilities}
            onExit={onExit}
            onFallback={() => setMode('c')}
          />
          {topBar}
        </>
      )}

      {mode === 'a' && (
        <>
          <ModeRestyle
            projectId={projectId}
            style={project?.style ?? ''}
            capabilities={capabilities}
            onExit={onExit}
            onFallback={() => setMode('c')}
          />
          {topBar}
        </>
      )}
    </>
  )
}
