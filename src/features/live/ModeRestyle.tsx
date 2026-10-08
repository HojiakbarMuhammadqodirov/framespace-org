import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/ui/Button'
import { Cluster, GlyphPlay, GlyphStop, Readout } from './Chrome'
import { LiveNotice } from './LiveNotice'
import {
  FREE_SESSION_RANGE,
  FREE_SESSION_SECONDS,
  RestyleConnection,
  RestyleError,
  isRestyleConfigured,
  mintRestyleSession,
  type RestyleSession,
} from './realtime'
import type { LiveCapabilities } from './types'

/**
 * MODE A — live AI restyle.
 *
 * The full screen is here: camera preview, session clock, plan read-out,
 * connect and stop. What is not here is a connection, because the endpoint
 * that mints the session token does not exist and the server is frozen.
 *
 * So the screen has two faces. Unconfigured, it is an honest specification —
 * it names the three things that have to land, and it does not show a
 * stylised camera feed and call it a restyle. Configured, the same component
 * runs the pipeline in `realtime.ts` for real, with the free-plan clock
 * counting down and cutting the session at the cap.
 */

const CSS = `
.fsl-restyle {
  position: fixed;
  inset: 0;
  height: 100dvh;
  background: var(--bg-inverse);
  overflow: hidden;
}
.fsl-restyle__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.fsl-restyle__badge {
  position: absolute;
  top: calc(var(--s16) + env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 25;
}
.fsl-restyle__badgeText {
  margin: 0;
  padding: var(--s2) var(--s4);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--warn-ink);
}
.fsl-restyle__deck {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  padding: var(--s4);
  padding-bottom: calc(var(--s4) + env(safe-area-inset-bottom, 0px));
}
.fsl-restyle__pad { display: grid; gap: var(--s3); padding: var(--s4); }
.fsl-restyle__row { display: flex; align-items: center; justify-content: space-between; gap: var(--s4); }
.fsl-restyle__clock {
  position: relative;
  height: 3px;
  border-radius: 2px;
  background: var(--hairline);
  overflow: hidden;
}
.fsl-restyle__clock span {
  display: block;
  height: 100%;
  background: var(--accent);
  transform-origin: left center;
  transition: transform var(--d-slow) var(--ease);
}
.fsl-needs { display: grid; gap: var(--s4); margin: 0; padding: 0; list-style: none; }
.fsl-needs li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--s4);
  align-items: start;
  border-top: 1px solid var(--hairline);
  padding-top: var(--s4);
}
.fsl-needs__n {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  color: var(--accent);
}
.fsl-needs__t { color: var(--text-muted); line-height: var(--lh-body); }
@media (min-width: 768px) {
  .fsl-restyle__deck { left: auto; right: var(--s6); width: min(420px, 42vw); }
}
@media (prefers-reduced-motion: reduce) {
  .fsl-restyle__clock span { transition: none; }
}
`

type Phase = 'idle' | 'camera' | 'connecting' | 'live' | 'error'

export interface ModeRestyleProps {
  projectId: string
  style: string
  capabilities: LiveCapabilities
  onExit: () => void
  onFallback: () => void
}

export function ModeRestyle({
  projectId,
  style,
  capabilities,
  onExit,
  onFallback,
}: ModeRestyleProps) {
  const { t } = useTranslation()
  const configured = isRestyleConfigured()

  const videoRef = useRef<HTMLVideoElement>(null)
  const connectionRef = useRef<RestyleConnection | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [session, setSession] = useState<RestyleSession | null>(null)
  const [remaining, setRemaining] = useState(FREE_SESSION_SECONDS)
  const [error, setError] = useState<RestyleError | null>(null)
  const [restyled, setRestyled] = useState(false)

  const stop = useCallback(() => {
    connectionRef.current?.close()
    connectionRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setPhase('idle')
    setRestyled(false)
    setSession(null)
  }, [])

  useEffect(() => stop, [stop])

  /* The cap is enforced on both ends. The server owns the real limit; the
     client counts down visibly and cuts the session itself, so a free session
     cannot quietly run long because a response was slow. */
  useEffect(() => {
    if (phase !== 'live') return
    const limit = session?.maxSeconds ?? FREE_SESSION_SECONDS
    setRemaining(limit)
    const started = Date.now()
    const id = window.setInterval(() => {
      const left = Math.max(0, limit - Math.round((Date.now() - started) / 1000))
      setRemaining(left)
      if (left === 0) stop()
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase, session, stop])

  const start = useCallback(async () => {
    setError(null)
    const connection = new RestyleConnection({
      onRemoteStream: (stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream
        setRestyled(true)
        setPhase('live')
      },
      onState: (state) => {
        if (state === 'failed' || state === 'disconnected') {
          setError(new RestyleError('connection_failed'))
          setPhase('error')
        }
      },
    })
    connectionRef.current = connection

    try {
      setPhase('camera')
      const local = await connection.openCamera()
      if (videoRef.current) {
        videoRef.current.srcObject = local
        await videoRef.current.play().catch(() => {})
      }

      setPhase('connecting')
      const minted = await mintRestyleSession({ projectId, style })
      setSession(minted)
      await connection.connect(minted, style)
    } catch (caught) {
      const err =
        caught instanceof RestyleError ? caught : new RestyleError('connection_failed', undefined, caught)
      setError(err)
      setPhase('error')
    }
  }, [projectId, style])

  /* -------------------------------------------------- the gate, by default */

  if (!configured) {
    return (
      <LiveNotice
        code="MODE A — NOT CONNECTED"
        title={t('live.restyle.gated.title')}
        body={t('live.restyle.gated.body')}
        action={{ label: t('live.mode.c.name'), onClick: onFallback }}
        secondary={{ label: t('live.action.back'), onClick: onExit }}
      >
        <style href="fs-live-restyle" precedence="medium">
          {CSS}
        </style>
        <ol className="fsl-needs">
          {[t('live.restyle.gated.need1'), t('live.restyle.gated.need2'), t('live.restyle.gated.need3')].map(
            (line, i) => (
              <li key={i}>
                <span className="fsl-needs__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="fsl-needs__t">{line}</span>
              </li>
            )
          )}
        </ol>
        <p style={{ marginTop: 'var(--s5)' }}>
          {t('live.restyle.gated.note')}{' '}
          <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
            {t('live.restyle.cap', { seconds: FREE_SESSION_RANGE.join('–') })}
          </span>
        </p>
      </LiveNotice>
    )
  }

  if (!capabilities.camera) {
    return (
      <LiveNotice
        code="CAMERA"
        title={t('live.error.camera.title')}
        body={t('live.error.camera.body')}
        action={{ label: t('live.mode.c.name'), onClick: onFallback }}
        secondary={{ label: t('live.action.back'), onClick: onExit }}
      />
    )
  }

  /* ------------------------------------------------------ the live screen */

  const limit = session?.maxSeconds ?? FREE_SESSION_SECONDS
  const running = phase === 'live'

  return (
    <div className="fsl-restyle">
      <style href="fs-live-restyle" precedence="medium">
        {CSS}
      </style>

      <video className="fsl-restyle__video" ref={videoRef} playsInline muted autoPlay />

      {phase !== 'idle' && !restyled && (
        <div className="fsl-restyle__badge">
          <Cluster small quiet>
            <p className="fsl-restyle__badgeText">{t('live.restyle.badge')}</p>
          </Cluster>
        </div>
      )}

      <div className="fsl-restyle__deck">
        <Cluster>
          <div className="fsl-restyle__pad">
            <div className="fsl-restyle__row">
              <Readout
                label={t('live.restyle.session')}
                value={session ? session.plan.toUpperCase() : '———'}
              />
              <Readout
                label={t('live.restyle.remaining')}
                value={running ? `${String(remaining).padStart(3, '0')}s` : '———'}
                tone={running && remaining <= 10 ? 'err' : 'default'}
                align="end"
              />
            </div>

            <div className="fsl-restyle__clock" aria-hidden="true">
              <span style={{ transform: `scaleX(${running ? remaining / limit : 0})` }} />
            </div>

            {error && (
              <p style={{ margin: 0, color: 'var(--err)', fontSize: 'var(--step--1)' }}>
                {t(
                  error.code === 'plan_limit' || error.code === 'rate_limit'
                    ? 'live.restyle.gated.need2'
                    : 'live.error.generic.body'
                )}
              </p>
            )}

            {running ? (
              <Button variant="secondary" block icon={<GlyphStop />} onClick={stop}>
                {t('live.action.stop')}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                block
                icon={<GlyphPlay />}
                onClick={() => void start()}
                disabled={phase === 'connecting' || phase === 'camera'}
              >
                {t('live.action.connect')}
              </Button>
            )}

            <p
              style={{
                margin: 0,
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 'var(--step--1)',
              }}
            >
              {t('live.restyle.cap', { seconds: limit })}
            </p>
          </div>
        </Cluster>
      </div>
    </div>
  )
}
