/**
 * MODE A — live AI restyle. The client pipeline, written against a documented
 * interface that nothing implements yet.
 *
 * ## Why this file exists in this state
 *
 * A real-time video-to-video model needs a provider key. The key cannot live
 * in the browser (anyone can read it out of the bundle and spend your quota),
 * so the only correct shape is: the browser asks OUR server for a
 * short-lived, single-session token, and the server is the only thing that
 * ever sees the provider key. `server/**` is frozen, so that endpoint does not
 * exist and may not be created here.
 *
 * The response is not to fake it. There is no synthetic "restyled" stream, no
 * CSS filter pretending to be a model, and no key anywhere. What there is:
 * the complete client — `getUserMedia`, the peer connection, the SDP exchange,
 * the track plumbing, the session clock — plus an interface precise enough
 * that the server can be written against it, and a "not connected" state that
 * names all three missing pieces.
 *
 * ## The contract the server must satisfy
 *
 * ```
 * POST  {VITE_LIVE_RESTYLE_URL}/session
 *   headers: Authorization: Bearer <the app's own user session>
 *   body:    { projectId: string, style: string }
 *   200:     {
 *              token:      string,      // short-lived, one session, minted server-side
 *              expiresAt:  string,      // ISO 8601; the client refuses to start after this
 *              signalUrl:  string,      // where to POST the SDP offer
 *              iceServers: RTCIceServer[],
 *              maxSeconds: number,      // hard cap — 60..120 on the free plan
 *              plan:       'free' | 'pro' | 'studio',
 *              remaining:  number       // sessions left in the current period
 *            }
 *   402:     { error: 'plan_limit',  resetAt: string }
 *   429:     { error: 'rate_limit',  retryAfter: number }
 *
 * POST  {signalUrl}
 *   headers: Authorization: Bearer <token>
 *   body:    { sdp: string, type: 'offer', style: string }
 *   200:     { sdp: string, type: 'answer' }
 * ```
 *
 * The provider key is read from the environment inside that handler and is
 * never returned, logged, or proxied. The token is bound to one session, one
 * user and one expiry, so a leaked token is worth at most the remainder of one
 * capped session.
 *
 * Nothing below sends anything anywhere until `VITE_LIVE_RESTYLE_URL` is set.
 */

export type RestylePlan = 'free' | 'pro' | 'studio'

export interface RestyleSession {
  token: string
  expiresAt: string
  signalUrl: string
  iceServers: RTCIceServer[]
  maxSeconds: number
  plan: RestylePlan
  remaining: number
}

export type RestyleErrorCode =
  | 'not_configured'
  | 'no_camera'
  | 'plan_limit'
  | 'rate_limit'
  | 'token_expired'
  | 'signalling_failed'
  | 'connection_failed'

export class RestyleError extends Error {
  code: RestyleErrorCode
  detail?: unknown
  constructor(code: RestyleErrorCode, message?: string, detail?: unknown) {
    super(message ?? code)
    this.name = 'RestyleError'
    this.code = code
    this.detail = detail
  }
}

/** Free-plan cap, in seconds. The server is the authority; this is the floor. */
export const FREE_SESSION_SECONDS = 90
export const FREE_SESSION_RANGE: [number, number] = [60, 120]

/** The one switch. Unset in this repository, and that is the whole gate. */
export function restyleEndpoint(): string | null {
  const url = import.meta.env?.VITE_LIVE_RESTYLE_URL
  return typeof url === 'string' && url.length > 0 ? url : null
}

export function isRestyleConfigured(): boolean {
  return restyleEndpoint() !== null
}

/**
 * Ask our own server for a session token. The provider key is not involved on
 * this side of the wire and never will be.
 */
export async function mintRestyleSession(input: {
  projectId: string
  style: string
  signal?: AbortSignal
}): Promise<RestyleSession> {
  const endpoint = restyleEndpoint()
  if (!endpoint) throw new RestyleError('not_configured')

  const response = await fetch(`${endpoint.replace(/\/$/, '')}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Same-origin cookies carry the app's own session; no bearer is assembled
    // in the client, because the client has nothing worth bearing.
    credentials: 'include',
    body: JSON.stringify({ projectId: input.projectId, style: input.style }),
    signal: input.signal,
  })

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (response.status === 402) throw new RestyleError('plan_limit', undefined, payload)
  if (response.status === 429) throw new RestyleError('rate_limit', undefined, payload)
  if (!response.ok) throw new RestyleError('signalling_failed', undefined, payload)

  return payload as unknown as RestyleSession
}

export interface RestyleEvents {
  onRemoteStream?: (stream: MediaStream) => void
  onState?: (state: RTCPeerConnectionState) => void
  onError?: (error: RestyleError) => void
}

/**
 * The peer connection. One video track up, one video track down.
 *
 * Deliberately a plain class rather than a hook: it owns non-React resources
 * with a strict teardown order (tracks, then transceivers, then the peer
 * connection, then the camera), and getting that order wrong leaves the
 * camera light on after the user has left the page.
 */
export class RestyleConnection {
  private pc: RTCPeerConnection | null = null
  private local: MediaStream | null = null
  private events: RestyleEvents

  constructor(events: RestyleEvents = {}) {
    this.events = events
  }

  /** The untouched camera feed, shown while the restyle is not connected. */
  async openCamera(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) throw new RestyleError('no_camera')
    try {
      this.local = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      })
      return this.local
    } catch (error) {
      throw new RestyleError('no_camera', undefined, error)
    }
  }

  async connect(session: RestyleSession, style: string): Promise<void> {
    if (Date.parse(session.expiresAt) <= Date.now()) {
      throw new RestyleError('token_expired')
    }
    const stream = this.local ?? (await this.openCamera())

    const pc = new RTCPeerConnection({ iceServers: session.iceServers })
    this.pc = pc

    pc.onconnectionstatechange = () => this.events.onState?.(pc.connectionState)
    pc.ontrack = (event) => {
      const [remote] = event.streams
      if (remote) this.events.onRemoteStream?.(remote)
    }

    for (const track of stream.getVideoTracks()) pc.addTrack(track, stream)
    // We expect exactly one restyled track back.
    pc.addTransceiver('video', { direction: 'sendrecv' })

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await waitForIce(pc)

    let answer: RTCSessionDescriptionInit
    try {
      const response = await fetch(session.signalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp,
          type: pc.localDescription?.type,
          style,
        }),
      })
      if (!response.ok) throw new RestyleError('signalling_failed')
      answer = (await response.json()) as RTCSessionDescriptionInit
    } catch (error) {
      this.close()
      throw error instanceof RestyleError
        ? error
        : new RestyleError('signalling_failed', undefined, error)
    }

    await pc.setRemoteDescription(answer)
  }

  close(): void {
    const pc = this.pc
    this.pc = null
    if (pc) {
      pc.ontrack = null
      pc.onconnectionstatechange = null
      for (const sender of pc.getSenders()) sender.track?.stop()
      pc.close()
    }
    for (const track of this.local?.getTracks() ?? []) track.stop()
    this.local = null
  }
}

/**
 * Wait for ICE gathering, but not forever. Trickle ICE would be better; a
 * single-shot POST exchange cannot trickle, so this gathers for up to a second
 * and sends whatever it has — which is the pragmatic shape every one-shot
 * WHIP-style endpoint uses.
 */
function waitForIce(pc: RTCPeerConnection, timeoutMs = 1000): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      pc.removeEventListener('icegatheringstatechange', onChange)
      resolve()
    }
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') done()
    }
    const timer = setTimeout(done, timeoutMs)
    pc.addEventListener('icegatheringstatechange', onChange)
  })
}
