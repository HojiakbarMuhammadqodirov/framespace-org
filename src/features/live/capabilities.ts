import { useEffect, useState } from 'react'

import { probeWebGL } from '@/three/effects/quality'
import type { LiveCapabilities } from './types'

/**
 * What this device can actually do — probed, never guessed from a UA string.
 *
 * Every entry here is something that is absent on a real phone somebody will
 * use: WebXR on iOS, Wake Lock on Firefox, orientation lock on iOS Safari,
 * `deviceorientation` inside an insecure origin, the whole lot inside an
 * in-app browser. Each one has a designed state downstream.
 */

type XRNavigator = Navigator & {
  xr?: { isSessionSupported?: (mode: string) => Promise<boolean> }
}

type WakeLockNavigator = Navigator & { wakeLock?: unknown }

function probeQuickLook(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const anchor = document.createElement('a')
    return Boolean(anchor.relList?.supports?.('ar'))
  } catch {
    return false
  }
}

function snapshot(): LiveCapabilities {
  if (typeof window === 'undefined') {
    return {
      secureContext: false,
      webgl: false,
      motion: false,
      motionNeedsPermission: false,
      xrAr: null,
      quickLook: false,
      camera: false,
      wakeLock: false,
      orientationLock: false,
      online: true,
    }
  }

  const doe = window.DeviceOrientationEvent as
    | (typeof DeviceOrientationEvent & { requestPermission?: unknown })
    | undefined

  return {
    secureContext: window.isSecureContext === true,
    webgl: probeWebGL().supported,
    motion: 'DeviceOrientationEvent' in window,
    motionNeedsPermission: typeof doe?.requestPermission === 'function',
    xrAr: null,
    quickLook: probeQuickLook(),
    camera: typeof navigator.mediaDevices?.getUserMedia === 'function',
    wakeLock: 'wakeLock' in navigator && Boolean((navigator as WakeLockNavigator).wakeLock),
    orientationLock: typeof window.screen?.orientation?.lock === 'function',
    online: navigator.onLine !== false,
  }
}

export function useLiveCapabilities(): LiveCapabilities {
  const [caps, setCaps] = useState<LiveCapabilities>(snapshot)

  /* WebXR support is a promise, so it lands a tick after everything else. The
     UI shows AR as "checking" until it resolves rather than flashing the
     unsupported state at people whose phone does support it. */
  useEffect(() => {
    let cancelled = false
    const xr = (navigator as XRNavigator).xr
    if (!xr?.isSessionSupported) {
      setCaps((prev) => ({ ...prev, xrAr: false }))
      return
    }
    xr.isSessionSupported('immersive-ar')
      .then((ok) => {
        if (!cancelled) setCaps((prev) => ({ ...prev, xrAr: ok }))
      })
      .catch(() => {
        if (!cancelled) setCaps((prev) => ({ ...prev, xrAr: false }))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const sync = () => setCaps((prev) => ({ ...prev, online: navigator.onLine !== false }))
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  return caps
}
