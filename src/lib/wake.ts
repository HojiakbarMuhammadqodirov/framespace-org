/**
 * The API runs on a free host that falls asleep after ~15 idle minutes
 * (Render's free tier). The first request after that takes 30–60 s while the
 * server boots, and the Vercel proxy in front may give up early with a bare
 * 502/504 page instead of our JSON.
 *
 * `ensureAwake()` probes `/api/health` and retries a few times with backoff,
 * flipping a small global state the `ServerWakeNotice` banner shows while it
 * waits. Every API call goes through it first — POSTs especially, so a large
 * render body is never sent into a server that is still booting, and nothing
 * non-idempotent is ever retried.
 */
import { useSyncExternalStore } from 'react'

export type WakeState = 'awake' | 'waking' | 'down'

let state: WakeState = 'awake'
const listeners = new Set<() => void>()

function setState(next: WakeState) {
  if (state === next) return
  state = next
  listeners.forEach((fn) => fn())
}

export function useServerWake(): WakeState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => state,
    () => 'awake'
  )
}

/** Our server always answers JSON. A 5xx that is not JSON came from a proxy. */
export function isGatewayFailure(res: Response): boolean {
  if (![500, 502, 503, 504].includes(res.status)) return false
  return !(res.headers.get('content-type') || '').includes('application/json')
}

/** A response seen by any caller proves the server is up. */
export function markAwake() {
  lastOkAt = Date.now()
  setState('awake')
}

/** The free host sleeps after 15 idle minutes; re-probe after a quieter 5. */
const FRESH_MS = 5 * 60 * 1000
/** After this long without an answer, say so instead of a silent spinner. */
const SLOW_MS = 2500
const PROBE_TIMEOUT_MS = 25_000
const BACKOFF_MS = [2000, 4000, 8000, 12_000]

let lastOkAt = 0
let inflight: Promise<boolean> | null = null

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function probe(): Promise<'ok' | 'gateway'> {
  const controller = typeof AbortController === 'undefined' ? null : new AbortController()
  const timer = controller ? setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS) : null
  try {
    const res = await fetch('/api/health', { cache: 'no-store', signal: controller?.signal })
    // Anything but a proxy failure means our server answered.
    return isGatewayFailure(res) ? 'gateway' : 'ok'
  } catch {
    return 'gateway'
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Resolves true once the API answers, false if it never did after a few
 * tries (state becomes 'down'). Concurrent callers share one probe.
 */
export function ensureAwake(): Promise<boolean> {
  if (Date.now() - lastOkAt < FRESH_MS) return Promise.resolve(true)
  if (typeof fetch === 'undefined') return Promise.resolve(true)
  if (inflight) return inflight
  // Offline is a different problem with its own UI; do not call it "waking".
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(false)

  inflight = (async () => {
    const slow = setTimeout(() => setState('waking'), SLOW_MS)
    try {
      for (let attempt = 0; ; attempt++) {
        if ((await probe()) === 'ok') {
          markAwake()
          return true
        }
        if (attempt >= BACKOFF_MS.length) break
        setState('waking')
        await sleep(BACKOFF_MS[attempt])
      }
      setState('down')
      return false
    } finally {
      clearTimeout(slow)
      inflight = null
    }
  })()
  return inflight
}

/**
 * `fetch` for idempotent API calls (GET): wakes the server first, and retries
 * once more through `ensureAwake()` if a proxy failure still slips through.
 */
export async function apiGet(url: string, init: RequestInit = {}): Promise<Response> {
  await ensureAwake()
  let res = await fetch(url, init)
  if (isGatewayFailure(res)) {
    lastOkAt = 0
    if (await ensureAwake()) res = await fetch(url, init)
  } else {
    markAwake()
  }
  return res
}
