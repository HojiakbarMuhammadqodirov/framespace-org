import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Preparing the phone to be held up for five minutes: keep the screen awake,
 * keep it in portrait.
 *
 * Both APIs fail constantly in the wild and neither failure is worth an error
 * dialog, so both report a status the chrome shows as a quiet mono line:
 *
 * • Wake Lock is absent in Firefox and in most in-app browsers, and the lock
 *   is released by the browser whenever the tab is backgrounded — so it has to
 *   be re-taken on `visibilitychange`, not just requested once.
 * • `screen.orientation.lock()` rejects outside fullscreen on Android and does
 *   not exist at all on iOS Safari. Both degrade to "hold the phone upright",
 *   which is what the person was going to do anyway.
 */

export type StageStatus = 'idle' | 'on' | 'unsupported' | 'failed'

type WakeLockSentinelLike = { released: boolean; release: () => Promise<void> }
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
}
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>
  unlock?: () => void
}

export interface Stage {
  wakeLock: StageStatus
  portrait: StageStatus
  /** Call from a user gesture; both APIs are happier that way. */
  engage: () => Promise<void>
  release: () => void
}

export function useStage(active: boolean): Stage {
  const [wakeLock, setWakeLock] = useState<StageStatus>('idle')
  const [portrait, setPortrait] = useState<StageStatus>('idle')
  const sentinel = useRef<WakeLockSentinelLike | null>(null)

  const takeWakeLock = useCallback(async () => {
    // Already holding one. Requesting a second would orphan the first, and an
    // orphaned sentinel is a screen that never sleeps again.
    if (sentinel.current && !sentinel.current.released) return
    const api = (navigator as WakeLockNavigator).wakeLock
    if (!api) {
      setWakeLock('unsupported')
      return
    }
    try {
      sentinel.current = await api.request('screen')
      setWakeLock('on')
    } catch {
      // NotAllowedError when the document is hidden, or the battery saver
      // refused. Not fatal, and not worth shouting about.
      setWakeLock('failed')
    }
  }, [])

  const lockPortrait = useCallback(async () => {
    const orientation = window.screen?.orientation as LockableOrientation | undefined
    if (!orientation || typeof orientation.lock !== 'function') {
      setPortrait('unsupported')
      return
    }
    try {
      await orientation.lock('portrait')
      setPortrait('on')
    } catch {
      // Chrome rejects unless the document is fullscreen. The quaternion
      // already compensates for screen.orientation.angle, so an unlocked
      // screen is a comfort problem, not a correctness one.
      setPortrait('failed')
    }
  }, [])

  const engage = useCallback(async () => {
    await Promise.all([takeWakeLock(), lockPortrait()])
  }, [takeWakeLock, lockPortrait])

  const release = useCallback(() => {
    const held = sentinel.current
    sentinel.current = null
    if (held && !held.released) held.release().catch(() => {})
    setWakeLock((prev) => (prev === 'on' ? 'idle' : prev))
    const orientation = window.screen?.orientation as LockableOrientation | undefined
    try {
      orientation?.unlock?.()
    } catch {
      // Already unlocked, or never locked.
    }
    setPortrait((prev) => (prev === 'on' ? 'idle' : prev))
  }, [])

  useEffect(() => {
    if (!active) return
    void engage()
    const onVisible = () => {
      // The browser drops the lock on every tab switch. Take it back.
      if (document.visibilityState === 'visible' && !sentinel.current) void takeWakeLock()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      release()
    }
  }, [active, engage, takeWakeLock, release])

  return { wakeLock, portrait, engage, release }
}
