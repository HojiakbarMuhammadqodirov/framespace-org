/**
 * Free, signup-less error tracking.
 *
 * Uncaught errors, unhandled promise rejections and React render errors (via
 * the root's onUncaughtError / onCaughtError in main.tsx) are sanitised here
 * and POSTed to our own `POST /api/client-errors`, which writes one structured
 * log line per report and keeps the newest few hundred in storage. Read them
 * in the host's log view (Render → Logs, filter `client_error`).
 *
 * What is sent: the error message and stack (trimmed, URLs without query
 * strings, anything that looks like an email or key masked), the page path
 * (no query, no hash), and a kind. Never form contents, photos, cookies or
 * user ids.
 *
 * ── Plugging in Sentry later ────────────────────────────────────────────────
 * Set VITE_SENTRY_DSN at build time, `npm i @sentry/browser`, and in main.tsx:
 *
 *   import * as Sentry from '@sentry/browser'
 *   if (import.meta.env.VITE_SENTRY_DSN) {
 *     Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, sendDefaultPii: false })
 *     registerErrorSink((error, report) => Sentry.captureException(error, { extra: report }))
 *   }
 *
 * Every report then goes to Sentry as well as to /api/client-errors. Nothing
 * here imports Sentry, so the bundle stays as it is until you opt in.
 */

export type ClientErrorKind = 'error' | 'unhandledrejection' | 'react' | 'manual'

export type ClientErrorReport = {
  kind: ClientErrorKind
  message: string
  stack?: string
  source?: string
  line?: number
  column?: number
  path: string
  release?: string
}

type Sink = (error: unknown, report: ClientErrorReport) => void

const ENDPOINT = '/api/client-errors'
/** One page load never sends more than this — a render loop must not DoS us. */
const MAX_PER_PAGE = 10
const sinks: Sink[] = []
const seen = new Set<string>()
let sent = 0
let installed = false

/** Add a second destination (Sentry, a console sink in tests, …). */
export function registerErrorSink(sink: Sink) {
  sinks.push(sink)
}

/** Whether a report is worth sending at all. */
function isNoise(message: string, source?: string): boolean {
  if (!message) return true
  // Cross-origin script errors carry no information.
  if (/^Script error\.?$/i.test(message)) return true
  // Benign browser warnings that surface as errors.
  if (/ResizeObserver loop/i.test(message)) return true
  // Browser extensions injecting into the page are not our bugs.
  if (source && /^(chrome|moz|safari)(-web)?-extension:/i.test(source)) return true
  // A cancelled request is the user's choice.
  if (/AbortError|The user aborted|cancelled/i.test(message)) return true
  return false
}

/** Same rules the server applies again on arrival. */
export function scrub(text: string | undefined, max: number): string | undefined {
  if (!text) return undefined
  return String(text)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}/g, '[key]')
    .replace(/\b(?:eyJ[\w-]+\.){2}[\w-]+/g, '[jwt]')
    .replace(/data:[\w/+.-]+;base64,[A-Za-z0-9+/=]{16,}/g, '[data-url]')
    .replace(/(https?:\/\/[^\s?#'")]+)[?#][^\s'")]*/g, '$1')
    .slice(0, max)
}

function toReport(kind: ClientErrorKind, error: unknown, extra: Partial<ClientErrorReport> = {}): ClientErrorReport {
  const err = error instanceof Error ? error : null
  const message =
    err?.message ||
    (typeof error === 'string' ? error : '') ||
    (() => {
      try {
        return JSON.stringify(error)
      } catch {
        return String(error)
      }
    })()
  return {
    kind,
    message: scrub(`${err && err.name && err.name !== 'Error' ? `${err.name}: ` : ''}${message}`, 500) || 'Unknown error',
    stack: scrub(err?.stack, 4000),
    path: typeof location === 'undefined' ? '' : location.pathname.slice(0, 300),
    release: import.meta.env.VITE_RELEASE || undefined,
    ...extra,
    source: scrub(extra.source, 300),
  }
}

function send(report: ClientErrorReport) {
  const body = JSON.stringify(report)
  try {
    // sendBeacon survives the page unloading; fall back to a keepalive fetch.
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) return
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {})
  } catch {
    /* reporting must never throw */
  }
}

/** Report one error. Safe to call from anywhere, any number of times. */
export function reportError(error: unknown, kind: ClientErrorKind = 'manual', extra: Partial<ClientErrorReport> = {}) {
  try {
    const report = toReport(kind, error, extra)
    if (isNoise(report.message, extra.source)) return
    const key = `${report.message}|${(report.stack || '').split('\n')[1] || ''}`
    if (seen.has(key) || sent >= MAX_PER_PAGE) return
    seen.add(key)
    sent += 1
    for (const sink of sinks) {
      try {
        sink(error, report)
      } catch {
        /* a broken sink must not stop the others */
      }
    }
    // Development already shows errors in the console and the overlay.
    if (import.meta.env.PROD) send(report)
  } catch {
    /* never let the reporter itself become the error */
  }
}

/** Hook window-level handlers once. Called from main.tsx. */
export function installErrorReporter() {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', (event) => {
    // Resource load failures (img/script 404) arrive here without an error.
    if (!event.error && !event.message) return
    reportError(event.error || event.message, 'error', {
      source: event.filename,
      line: event.lineno || undefined,
      column: event.colno || undefined,
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, 'unhandledrejection')
  })
  if (import.meta.env.VITE_SENTRY_DSN && sinks.length === 0 && import.meta.env.DEV) {
    console.info('[errors] VITE_SENTRY_DSN is set but no Sentry sink is registered — see src/lib/errorReporter.ts.')
  }
}
