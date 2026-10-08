/**
 * The capture state machine.
 *
 * It owns the camera, the compass, the shots and the one request that turns
 * them into a room. Everything the screens need is returned from here so the
 * step components stay presentational.
 *
 * The shape of the flow is dictated by the endpoint: `/api/render` is
 * synchronous, takes every photo in one body and answers once, about thirty
 * seconds later. There is no job id to poll and nothing to resume, so the flow
 * collects *everything* first and only then fires a single request.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useSession } from '@/store/session'

import { ANGLE_ORDER, REQUIRED_ANGLE_IDS, RECOMMENDED_ANGLE_IDS, prepareCapture, requestRender } from './contract'
import type { PreparedImage } from './contract'
import { grabFrame, loadImage, mimeOf, shrinkForStorage } from './frame'
import { requestMotionPermission, useCameraStream, useDeviceHeading, useOnline } from './hooks'
import { flagsFor, measure, normalise } from './quality'
import { cacheRecord, newProjectId, persistRecord } from './store'
import { STEPS_NEEDING_SHOTS, isCaptureStep } from './types'
import type {
  AngleId,
  BudgetChoice,
  CaptureMode,
  CaptureRecord,
  CaptureStep,
  FlowError,
  FlowErrorKind,
  RoomTypeId,
  Shot,
  ShotMeta,
} from './types'

/** Map a thrown error onto a designed error screen. */
function classify(err: unknown): FlowErrorKind {
  if ((err as Error)?.name === 'TimeoutError') return 'timeout'
  if ((err as { status?: number })?.status === 429) return 'quota'
  const text = ((err as Error)?.message || '').toLowerCase()
  if (text === 'timeout') return 'timeout'
  if (/quota|too many|rate limit|429|limit reached/.test(text)) return 'quota'
  if (/failed to fetch|networkerror|network request|load failed/.test(text)) return 'offline'
  return 'render-failed'
}

/* ------------------------------------------------------------------ draft */

/**
 * A refresh, a crash or Android's back gesture must not cost the person the
 * photos they just walked the room for. Everything typed and shot so far is
 * mirrored into sessionStorage — per tab, gone when the tab closes — with the
 * photos shrunk so a full set still fits the ~5 MB quota.
 */
export const DRAFT_KEY = 'framespace.capture.draft'
const DRAFT_EDGE = 960

type DraftShot = ShotMeta & { dataUrl: string; width: number; height: number }

type Draft = {
  v: 1
  savedAt: number
  step: CaptureStep
  mode: CaptureMode
  roomName: string
  roomType: RoomTypeId
  style: string
  budget: BudgetChoice
  notes: string
  activeId: AngleId
  anchorHeading: number | null
  shots: DraftShot[]
}

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    const parsed = raw ? (JSON.parse(raw) as Draft) : null
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.shots)) return null
    return parsed
  } catch {
    return null
  }
}

function writeDraft(draft: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Over quota: keep the words at least. The photos can be shot again.
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, shots: [] }))
    } catch {
      // Storage blocked entirely (private mode). Nothing to fall back to.
    }
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // Same as above.
  }
}

function shotFromDraft(saved: DraftShot): Shot {
  const comma = saved.dataUrl.indexOf(',')
  return {
    ...saved,
    base64: comma >= 0 ? saved.dataUrl.slice(comma + 1) : '',
    mediaType: mimeOf(saved.dataUrl),
  }
}

/* ------------------------------------------------------------------- hook */

export type CaptureFlowOptions = {
  /** `upload` starts on the room step and treats the gallery as the source. */
  mode?: CaptureMode
  /** The step named in the URL (`?step=`), honoured when it is reachable. */
  initialStep?: CaptureStep | null
  /** A STYLES name to preselect. */
  initialStyle?: string | null
  /** A catalogue piece the person came from; folded into the notes sent. */
  featured?: string | null
}

export type CaptureOutcome = {
  /** The result is on screen but did not fit on the device. */
  storageFull: boolean
  /** Older projects the device dropped to make room for this one. */
  evicted: number
}

export type CaptureFlow = ReturnType<typeof useCaptureFlow>

type WakeLockLike = { release: () => Promise<void> }

/** What happened to a batch of picked files, for the upload screen. */
export type UploadReport = {
  added: number
  heic: number
  unreadable: number
  overflow: number
}

/** Max files read from one pick or drop. */
const MAX_BATCH = 12

export function useCaptureFlow(
  onComplete: (record: CaptureRecord, outcome: CaptureOutcome) => void,
  options: CaptureFlowOptions = {}
) {
  const camera = useCameraStream()
  const [sensorsOn, setSensorsOn] = useState(false)
  const heading = useDeviceHeading(sensorsOn)
  const online = useOnline()

  // Read once, before anything can overwrite it.
  const [offer, setOffer] = useState<Draft | null>(() => {
    const draft = readDraft()
    if (!draft) return null
    return draft.shots.length || draft.roomName?.trim() || draft.notes?.trim() ? draft : null
  })

  const [mode, setMode] = useState<CaptureMode>(options.mode === 'upload' ? 'upload' : 'camera')
  const [step, setStep] = useState<CaptureStep>(() => {
    // `?mode=upload` is the "skip the camera" tap, made before arriving.
    const base: CaptureStep = options.mode === 'upload' ? 'room' : 'permission'
    const wanted = options.initialStep
    if (!wanted || wanted === 'permission') return base
    // A fresh mount has no photos: anything past the shoot falls back to the
    // room step, where the "continue where you left off" offer is visible.
    if (STEPS_NEEDING_SHOTS.includes(wanted)) return 'room'
    if (offer && wanted === 'shoot') return 'room'
    return wanted
  })
  const [roomName, setRoomName] = useState('')
  const [roomType, setRoomType] = useState<RoomTypeId>('living')
  const [shots, setShots] = useState<Record<AngleId, Shot>>({})
  const [activeId, setActiveId] = useState<AngleId>(ANGLE_ORDER[0].id)
  const [pending, setPending] = useState<Shot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<FlowError | null>(null)
  const [uploadReport, setUploadReport] = useState<UploadReport | null>(null)
  /** A one-line, dismissible message above the step ("generation cancelled"). */
  const [notice, setNotice] = useState<'cancelled' | null>(null)
  /** The in-flight render, so it can be cancelled — or abandoned on unmount. */
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  const [style, setStyle] = useState(options.initialStyle || 'Japandi')
  const [budget, setBudget] = useState<BudgetChoice>({ tier: 'optimal', limit: 0, currency: 'UZS' })
  const [notes, setNotes] = useState('')

  /** The first shot fixes the anchor; later shots are bearings from it. */
  const anchorRef = useRef<number | null>(null)
  const [anchorHeading, setAnchorHeading] = useState<number | null>(null)

  /**
   * The source of truth for shots inside async handlers. A batch of gallery
   * files resolves one after another; reading `shots` from a closure there
   * would let each file overwrite the one before it.
   */
  const shotsRef = useRef<Record<AngleId, Shot>>({})
  const commitShots = useCallback((next: Record<AngleId, Shot>) => {
    shotsRef.current = next
    setShots(next)
  }, [])

  /** State updates are async; a double tap on the shutter is not. */
  const busyRef = useRef(false)
  const begin = useCallback(() => {
    busyRef.current = true
    setBusy(true)
  }, [])
  const end = useCallback(() => {
    busyRef.current = false
    setBusy(false)
  }, [])

  const plan = useMemo(
    () => ANGLE_ORDER.filter((a) => RECOMMENDED_ANGLE_IDS.includes(a.id) || a.required),
    []
  )
  const extras = useMemo(
    () => ANGLE_ORDER.filter((a) => !plan.some((p) => p.id === a.id)),
    [plan]
  )

  const captured = useMemo(() => Object.keys(shots), [shots])
  const missingRequired = useMemo(
    () => REQUIRED_ANGLE_IDS.filter((id) => !shots[id]),
    [shots]
  )
  const canContinue = missingRequired.length === 0
  const cameraPitch = heading.orientation.pitch != null ? heading.orientation.pitch - 90 : null
  // Before the first shot there is no anchor — and none is needed: whatever the
  // phone is pointed at when the shutter is first pressed *becomes* north here.
  const relativeHeading =
    heading.orientation.heading == null
      ? null
      : anchorHeading == null
        ? 0
        : normalise(heading.orientation.heading - anchorHeading)

  /**
   * Move to a step named from outside (the URL, the back button). Steps that
   * need photos fall back to the room step without them, and a request that
   * is not in flight cannot be re-entered — that lands on the plan instead.
   */
  const goTo = useCallback((target: CaptureStep) => {
    setStep((current) => {
      if (target === current) return current
      const have = Object.keys(shotsRef.current).length > 0
      if (STEPS_NEEDING_SHOTS.includes(target) && !have) return 'room'
      if (target === 'generating' || target === 'failed') return 'plan'
      return target
    })
  }, [])

  /* ------------------------------------------------------------ permission */

  /**
   * MUST be called straight from the tap handler. `requestMotionPermission()`
   * calls `DeviceOrientationEvent.requestPermission()` before its first await,
   * which is the only way iOS accepts it.
   */
  const grantAndStart = useCallback(() => {
    const sensors = requestMotionPermission()
    const cam = camera.start()

    sensors.then((outcome) => setSensorsOn(outcome === 'granted'))
    return cam.then((ok) => {
      if (ok) {
        setError(null)
        setMode('camera')
        setStep('room')
      }
      return ok
    })
  }, [camera])

  /**
   * Explicit "carry on without the camera" — the gallery path. Gallery photos
   * carry no heading, so the compass is not asked for either.
   */
  const skipCamera = useCallback(() => {
    setMode('upload')
    setStep('room')
  }, [])

  /** "Use camera instead" / "turn the camera on". Also from a tap only. */
  const switchToCamera = useCallback(() => {
    const sensors = requestMotionPermission()
    sensors.then((outcome) => setSensorsOn(outcome === 'granted'))
    setMode('camera')
    return camera.start().then((ok) => {
      if (ok) setError(null)
      return ok
    })
  }, [camera])

  /* ---------------------------------------------------------------- shots */

  const advance = useCallback(
    (fromId: AngleId, taken: Record<AngleId, Shot>) => {
      const remaining = plan.filter((a) => a.id !== fromId && !taken[a.id])
      const nextRequired = remaining.find((a) => a.required)
      const next = nextRequired || remaining[0]
      if (next) setActiveId(next.id)
    },
    [plan]
  )

  const keep = useCallback(
    (shot: Shot) => {
      const next = { ...shotsRef.current, [shot.angleId]: shot }
      commitShots(next)
      setPending(null)
      advance(shot.angleId, next)
      // A short tick in the hand: the frame is filed.
      try {
        navigator.vibrate?.(15)
      } catch {
        // Not every browser lets a page vibrate. Silence is fine.
      }
    },
    [advance, commitShots]
  )

  /** A shot-failed notice goes away the moment the person tries again. */
  const clearShotError = useCallback(() => {
    setError((current) => (current?.kind === 'shot-failed' ? null : current))
  }, [])

  /**
   * File one already-compressed image under an angle. Camera frames carry the
   * live heading; gallery files carry none (`null`), which also keeps them out
   * of the duplicate-direction check — a photo from the gallery says nothing
   * about where the phone is pointing now.
   */
  const record = useCallback(
    (
      angleId: AngleId,
      prepared: PreparedImage,
      sample: { blurScore: number; luma: number },
      opts: { fromFile: boolean; gate: boolean }
    ) => {
      const current = shotsRef.current
      let shotHeading: number | null = null
      let relative: number | null = null
      let pitch: number | null = null
      let roll: number | null = null

      if (!opts.fromFile) {
        const reading = heading.read()
        if (anchorRef.current == null && reading.heading != null) {
          anchorRef.current = reading.heading
          setAnchorHeading(reading.heading)
        }
        const anchor = anchorRef.current
        shotHeading = reading.heading
        relative =
          reading.heading != null && anchor != null ? normalise(reading.heading - anchor) : null
        pitch = reading.pitch
        roll = reading.roll
      }

      const flags = flagsFor(
        { blurScore: sample.blurScore, luma: sample.luma, flags: [] },
        { angleId, relativeHeading: relative },
        Object.values(current)
      )

      const shot: Shot = {
        angleId,
        dataUrl: prepared.dataUrl,
        base64: prepared.base64,
        mediaType: prepared.mediaType,
        width: prepared.width,
        height: prepared.height,
        heading: shotHeading,
        relativeHeading: relative,
        pitch,
        roll,
        takenAt: Date.now(),
        anchor: Object.keys(current).length === 0,
        blurScore: sample.blurScore,
        luma: sample.luma,
        flags,
      }

      // A flagged shot is held back for the user to judge — never dropped.
      // A batch from the gallery is not interrupted; its flags show on Review.
      if (flags.length && opts.gate) setPending(shot)
      else keep(shot)
      return shot
    },
    [heading, keep]
  )

  /** Shutter. Pulls the live frame, measures it, compresses it, files it. */
  const shoot = useCallback(async () => {
    const video = camera.videoRef.current
    if (!video || busyRef.current) return
    begin()
    clearShotError()
    try {
      const { blob, canvas } = await grabFrame(video)
      const sample = measure(canvas, canvas.width, canvas.height)
      const prepared = await prepareCapture(blob)
      record(activeId, prepared, sample, { fromFile: false, gate: true })
    } catch (err) {
      setError({ kind: 'shot-failed', detail: (err as Error)?.message })
    } finally {
      end()
    }
  }, [activeId, begin, camera, clearShotError, end, record])

  /** Decode one file once: compress, then measure the compressed copy. */
  const fileToShot = useCallback(
    async (file: File, angleId: AngleId, gate: boolean) => {
      const prepared = await prepareCapture(file)
      const img = await loadImage(prepared.dataUrl)
      const sample = measure(img, prepared.width, prepared.height)
      record(angleId, prepared, sample, { fromFile: true, gate })
    },
    [record]
  )

  /** The no-camera path: one file from the system picker, measured the same way. */
  const shootFromFile = useCallback(
    async (file: File, angleId: AngleId = activeId) => {
      if (busyRef.current) return
      begin()
      clearShotError()
      setUploadReport(null)
      try {
        // The quality sheet belongs to the live camera; uploads show their
        // flags on the slot instead of interrupting.
        await fileToShot(file, angleId, mode === 'camera')
        setUploadReport({ added: 1, heic: 0, unreadable: 0, overflow: 0 })
      } catch (err) {
        const heic = (err as Error)?.name === 'HeicError'
        setUploadReport({ added: 0, heic: heic ? 1 : 0, unreadable: heic ? 0 : 1, overflow: 0 })
        setError({ kind: 'shot-failed', detail: heic ? 'heic' : (err as Error)?.message })
      } finally {
        end()
      }
    },
    [activeId, begin, clearShotError, end, fileToShot, mode]
  )

  /**
   * Several files in one pick. They fill the missing walls first, then the
   * recommended extras, then whatever is left — so four photos picked at once
   * become the four required walls without a single extra tap.
   */
  const shootFromFiles = useCallback(
    async (list: FileList | File[], target?: AngleId) => {
      const all = Array.from(list)
      // Windows reports HEIC with an empty type; keep anything that could be an image.
      const files = all.filter(
        (f) =>
          !f.type ||
          f.type.startsWith('image/') ||
          /\.(hei[cf]|jpe?g|png|webp|avif|gif)$/i.test(f.name)
      )
      const rejected = all.length - files.length
      if (!files.length) {
        if (rejected) setUploadReport({ added: 0, heic: 0, unreadable: rejected, overflow: 0 })
        return
      }
      if (files.length === 1 && (target || mode === 'camera')) {
        await shootFromFile(files[0], target || activeId)
        return
      }
      if (busyRef.current) return

      const taken = shotsRef.current
      const slots = [
        ...plan.filter((a) => a.required && !taken[a.id]),
        ...plan.filter((a) => !a.required && !taken[a.id]),
        ...extras.filter((a) => !taken[a.id]),
      ].map((a) => a.id)
      if (target) {
        const at = slots.indexOf(target)
        if (at > 0) slots.splice(at, 1)
        if (at !== 0) slots.unshift(target)
      }
      if (!slots.length) slots.push(activeId)

      begin()
      clearShotError()
      setUploadReport(null)
      const report: UploadReport = { added: 0, heic: 0, unreadable: rejected, overflow: 0 }
      const batch = files.slice(0, MAX_BATCH)
      report.overflow = Math.max(0, files.length - MAX_BATCH)
      let slot = 0
      for (let i = 0; i < batch.length; i += 1) {
        if (slot >= slots.length) {
          report.overflow += batch.length - i
          break
        }
        try {
          await fileToShot(batch[i], slots[slot], false)
          report.added += 1
          // A file that failed does not use up a slot.
          slot += 1
        } catch (err) {
          if ((err as Error)?.name === 'HeicError') report.heic += 1
          else report.unreadable += 1
        }
      }
      if (mountedRef.current) setUploadReport(report)
      end()
    },
    [activeId, begin, clearShotError, end, extras, fileToShot, mode, plan, shootFromFile]
  )

  const keepPending = useCallback(() => {
    if (pending) keep(pending)
  }, [keep, pending])

  const discardPending = useCallback(() => setPending(null), [])

  /** Take one photo out of the set (the upload grid's "remove"). */
  const removeShot = useCallback(
    (angleId: AngleId) => {
      const next = { ...shotsRef.current }
      delete next[angleId]
      if (Object.keys(next).length === 0) {
        anchorRef.current = null
        setAnchorHeading(null)
      }
      commitShots(next)
    },
    [commitShots]
  )

  const dismissUploadReport = useCallback(() => setUploadReport(null), [])
  const dismissNotice = useCallback(() => setNotice(null), [])

  const retake = useCallback(
    (angleId: AngleId) => {
      const next = { ...shotsRef.current }
      delete next[angleId]
      commitShots(next)
      setActiveId(angleId)
      setStep('shoot')
    },
    [commitShots]
  )

  /* ---------------------------------------------------------------- draft */

  const resumeDraft = useCallback(() => {
    const draft = offer
    if (!draft) return
    const restored: Record<AngleId, Shot> = {}
    draft.shots.forEach((saved) => {
      restored[saved.angleId] = shotFromDraft(saved)
    })
    commitShots(restored)
    setMode(draft.mode === 'upload' ? 'upload' : 'camera')
    setRoomName(draft.roomName || '')
    setRoomType(draft.roomType || 'living')
    setStyle(draft.style || 'Japandi')
    if (draft.budget) setBudget(draft.budget)
    setNotes(draft.notes || '')
    if (draft.activeId) setActiveId(draft.activeId)
    anchorRef.current = draft.anchorHeading ?? null
    setAnchorHeading(draft.anchorHeading ?? null)

    const have = draft.shots.length > 0
    let target: CaptureStep = isCaptureStep(draft.step) ? draft.step : 'room'
    if (target === 'generating' || target === 'failed') target = 'plan'
    if (target === 'permission') target = 'room'
    // The camera does not survive a reload; a camera-mode shoot resumes on the
    // review grid, where "keep shooting" turns it back on from a tap.
    if (target === 'shoot' && draft.mode !== 'upload') target = have ? 'review' : 'room'
    if (STEPS_NEEDING_SHOTS.includes(target) && !have) target = 'room'
    if (target === 'plan' && REQUIRED_ANGLE_IDS.some((id) => !restored[id])) target = 'review'
    setStep(target)
    setOffer(null)
  }, [commitShots, offer])

  const discardDraft = useCallback(() => {
    clearDraft()
    setOffer(null)
  }, [])

  // Starting new work (a shot, a room name, notes) instead of resuming is an
  // answer to the offer: the new work wins, so the mirror below can save it.
  useEffect(() => {
    if (!offer) return
    if (Object.keys(shots).length || roomName.trim() || notes.trim()) setOffer(null)
  }, [offer, shots, roomName, notes])

  // Mirror the work into the draft a beat after it settles. Never while the
  // offer is on screen: that would overwrite the very draft being offered.
  const shrunk = useRef(new Map<string, string>())
  const finished = useRef(false)
  useEffect(() => {
    if (offer || finished.current) return undefined
    let cancelled = false
    const list = Object.values(shots)
    const meaningful = list.length > 0 || roomName.trim() !== '' || notes.trim() !== ''
    const timer = window.setTimeout(async () => {
      if (!meaningful) {
        clearDraft()
        return
      }
      const draftShots: DraftShot[] = await Promise.all(
        list.map(async ({ dataUrl, base64: _b, mediaType: _m, width, height, ...meta }) => {
          // Restored shots are already small, and a shot never changes once
          // taken, so each one is shrunk at most once.
          const key = `${meta.angleId}:${meta.takenAt}`
          let small = shrunk.current.get(key)
          if (!small) {
            small = await shrinkForStorage(dataUrl, DRAFT_EDGE)
            shrunk.current.set(key, small)
          }
          const scale = Math.min(1, DRAFT_EDGE / Math.max(width, height, 1))
          return {
            ...meta,
            dataUrl: small,
            width: Math.round(width * scale),
            height: Math.round(height * scale),
          }
        })
      )
      if (cancelled || finished.current) return
      writeDraft({
        v: 1,
        savedAt: Date.now(),
        step,
        mode,
        roomName,
        roomType,
        style,
        budget,
        notes,
        activeId,
        anchorHeading: anchorRef.current,
        shots: draftShots,
      })
    }, 450)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeId, budget, mode, notes, offer, roomName, roomType, shots, step, style])

  /* ------------------------------------------------------------- generate */

  const generate = useCallback(async () => {
    // A second tap while the first request is in flight would send twice.
    if (abortRef.current) return
    if (!online) {
      setError({ kind: 'offline' })
      return
    }
    if (missingRequired.length) return
    // The plan screen already swaps its button for sign-up / pricing at zero;
    // this is the same rule for the retry button on the failure screen.
    if (useSession.getState().generationsLeft() <= 0) {
      setError({ kind: 'quota' })
      setStep('failed')
      return
    }

    setError(null)
    setNotice(null)
    setStep('generating')
    camera.stop()
    const controller = new AbortController()
    abortRef.current = controller

    const current = shotsRef.current
    const captures: Record<AngleId, { base64: string; mediaType: string }> = {}
    Object.values(current).forEach((shot) => {
      captures[shot.angleId] = { base64: shot.base64, mediaType: shot.mediaType }
    })

    // The endpoint has no room name and no room type. `notes` is the only free
    // text it forwards to the model, so the room description rides in there.
    const composedNotes = [
      roomName.trim() ? `Room: ${roomName.trim()}` : '',
      `Room type: ${roomType}`,
      options.featured ? `Include this piece: ${options.featured}` : '',
      notes.trim(),
    ]
      .filter(Boolean)
      .join('\n')

    try {
      const result = await requestRender(
        {
          captures,
          style,
          budget: budget.limit > 0 ? { limit: budget.limit, currency: budget.currency } : null,
          notes: composedNotes,
        },
        controller.signal
      )
      if (controller.signal.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' })
      if (!result || !Array.isArray(result.renders) || result.renders.length === 0) {
        throw new Error(result?.failures?.[0]?.error || 'The server answered without any renders.')
      }

      // Demo answers are canned; they cost the person nothing.
      if (!result.demoMode) useSession.getState().consumeGeneration()

      const before: Record<AngleId, string> = {}
      await Promise.all(
        Object.values(current).map(async (shot) => {
          before[shot.angleId] = await shrinkForStorage(shot.dataUrl)
        })
      )

      const entry: CaptureRecord = {
        id: newProjectId(),
        createdAt: new Date().toISOString(),
        roomName: roomName.trim(),
        roomType,
        style,
        notes,
        budget: budget.limit > 0 ? { limit: budget.limit, currency: budget.currency } : null,
        capture: {
          anchorHeading: anchorRef.current,
          source: heading.orientation.source,
          shots: Object.values(current).map(
            ({ dataUrl: _d, base64: _b, mediaType: _m, width: _w, height: _h, ...meta }) => meta
          ),
        },
        before,
        result,
      }

      // Memory first: the request cannot be repeated, so the result must
      // survive even if the device refuses to store it.
      cacheRecord(entry)
      const outcome: CaptureOutcome = { storageFull: false, evicted: 0 }
      try {
        outcome.evicted = (await persistRecord(entry)).evicted
      } catch {
        outcome.storageFull = true
      }

      // The work is done and saved; the draft has served its purpose.
      finished.current = true
      clearDraft()
      abortRef.current = null
      if (mountedRef.current) onComplete(entry, outcome)
    } catch (err) {
      if (abortRef.current === controller) abortRef.current = null
      if (!mountedRef.current) return
      // A cancel is the person's choice, not a failure: back to the plan.
      if ((err as Error)?.name === 'AbortError' || controller.signal.aborted) {
        setNotice('cancelled')
        setStep('plan')
        return
      }
      setError({ kind: classify(err), detail: (err as Error)?.message || '' })
      setStep('failed')
    }
  }, [budget, camera, heading.orientation.source, missingRequired.length, notes, onComplete, online, options.featured, roomName, roomType, style])

  /** Abandon the in-flight request. The photos stay. */
  const cancel = useCallback(() => {
    const controller = abortRef.current
    abortRef.current = null
    controller?.abort()
  }, [])

  /* ---------------------------------------------------------------- guards */

  // Leaving mid-request loses the result, and leaving with photos in hand
  // loses the walk around the room. The draft covers a refresh in this tab;
  // this is the browser's own last word for everything else.
  const guardUnload = step === 'generating' || captured.length > 0
  useEffect(() => {
    if (!guardUnload) return undefined
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [guardUnload])

  // Thirty seconds of a still phone is long enough for the screen to sleep,
  // and some browsers throttle or drop the request when it does.
  useEffect(() => {
    if (step !== 'generating') return undefined
    let lock: WakeLockLike | null = null
    let released = false
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<WakeLockLike> }
      }
      nav.wakeLock
        ?.request('screen')
        .then((sentinel) => {
          if (released) void sentinel.release().catch(() => undefined)
          else lock = sentinel
        })
        .catch(() => undefined)
    } catch {
      // Unsupported or refused — the "stay on this page" notice still stands.
    }
    return () => {
      released = true
      if (lock) void lock.release().catch(() => undefined)
    }
  }, [step])

  // Re-bind the stream whenever the preview comes back on stage.
  useEffect(() => {
    if (step === 'shoot') camera.attach()
  }, [camera.attach, camera.status, step])

  return {
    step,
    setStep,
    goTo,
    mode,
    error,
    setError,
    online,
    busy,

    camera,
    sensorsOn,
    orientation: heading.orientation,
    relativeHeading,
    cameraPitch,
    anchorHeading,

    roomName,
    setRoomName,
    roomType,
    setRoomType,

    plan,
    extras,
    shots,
    captured,
    activeId,
    setActiveId,
    missingRequired,
    canContinue,
    pending,
    uploadReport,
    dismissUploadReport,
    notice,
    dismissNotice,
    removeShot,
    cancel,
    setMode,

    style,
    setStyle,
    budget,
    setBudget,
    notes,
    setNotes,
    featured: options.featured || null,

    draft: offer ? { savedAt: offer.savedAt, shots: offer.shots.length, roomName: offer.roomName } : null,
    resumeDraft,
    discardDraft,

    grantAndStart,
    skipCamera,
    switchToCamera,
    shoot,
    shootFromFile,
    shootFromFiles,
    keepPending,
    discardPending,
    retake,
    generate,
  }
}
