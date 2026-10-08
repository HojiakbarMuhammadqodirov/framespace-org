/**
 * The analytics events named in brief §11.
 *
 * No provider is wired yet — there is no analytics key in `.env.example` and
 * `server/` is frozen. `track()` therefore buffers to a bounded in-memory queue
 * and logs in development, so the call sites can be written correctly now and a
 * real provider becomes a one-function change later.
 */

export type AnalyticsEvent =
  | 'capture_started'
  | 'capture_completed'
  | 'room_built'
  | 'generation_requested'
  | 'generation_ready'
  | 'see_by_yourself_started'
  | 'product_rotated'
  | 'share_clicked'
  | 'signup'
  | 'business_lead'

type Payload = Record<string, string | number | boolean | null | undefined>

type Entry = { event: AnalyticsEvent; payload: Payload; at: string }

const MAX_BUFFERED = 200
const buffer: Entry[] = []

type Sink = (entry: Entry) => void
let sink: Sink | null = null

/** Point the queue at a real provider. Flushes whatever was buffered first. */
export function setAnalyticsSink(next: Sink) {
  sink = next
  while (buffer.length) {
    const entry = buffer.shift()
    if (entry) sink(entry)
  }
}

export function track(event: AnalyticsEvent, payload: Payload = {}) {
  const entry: Entry = { event, payload, at: new Date().toISOString() }

  if (sink) {
    sink(entry)
    return
  }

  buffer.push(entry)
  if (buffer.length > MAX_BUFFERED) buffer.shift()

  if (import.meta.env.DEV) {
    console.debug('[analytics]', event, payload)
  }
}

/** For tests and the styleguide. */
export function bufferedEvents(): readonly Entry[] {
  return buffer
}
