/**
 * Account sync — what makes a project belong to the account instead of to one
 * browser.
 *
 * The working copy of everything stays where the rest of the app already
 * reads it: the frozen `framespace.projects.v1` archive, the capture slice,
 * the builder's `framespace.room.<id>` scenes and the shortlist. Guests use
 * exactly that and nothing here runs for them. For a signed-in account this
 * module mirrors it to `/api/projects` and `/api/saved` (server/projects.js):
 *
 * - every local write announces itself on the bus (./syncBus) and is pushed,
 *   debounced, slice by slice — a moved sofa uploads a few kB of scene, not
 *   the renders again;
 * - on sign-in (and on every page load while signed in) the account's list is
 *   pulled. Projects this device does not hold are listed from the account and
 *   downloaded when opened (`ensureProject`), so a second device shows the same
 *   dashboard without first downloading every render;
 * - what a guest made before signing up is adopted into the account;
 * - on sign-out the device copy is wiped. It belongs to the account, and the
 *   next person at this browser must not find it.
 *
 * A small ledger (`framespace.sync.v1`) records who owns the device copy and,
 * per project, the account revision it matches and what still has to go up —
 * so a push that failed offline is retried on the next visit.
 */
import { create } from 'zustand'

import { clearProjects, deleteProject, saveProject } from '@/lib/storage.js'
import { clearRecords, forgetRecord, getRecord, importRecord } from '@/features/capture/store'
import type { CaptureRecord, RoomTypeId } from '@/features/capture/types'

import {
  localProject,
  localProjectIds,
  useProjects,
  useSaved,
  type RemoteProject,
  type SavedItem,
} from './projects'
import { listSceneIds, readScene, removeScene, writeScene, type StoredScene } from './roomScene'
import { useSession } from './session'
import { onSyncEvent, setBeforeLogout, silently, type ProjectPart } from './syncBus'

/* ------------------------------------------------------------------ ledger */

type Part = Exclude<ProjectPart, 'all'>
const ALL_PARTS: Part[] = ['meta', 'record', 'scene']

type LedgerItem = {
  /** The account's `updatedAt` this device's copy corresponds to. */
  rev: string | null
  /** Slices changed here since then. Empty = in step with the account. */
  dirty: Part[]
}

type Ledger = {
  /** Whose projects the device copy is. null = a guest's. */
  owner: string | null
  items: Record<string, LedgerItem>
  /** Deleted here, delete on the account still owed. */
  deleted: string[]
  savedDirty: boolean
}

const LEDGER_KEY = 'framespace.sync.v1'

function emptyLedger(owner: string | null = null): Ledger {
  return { owner, items: {}, deleted: [], savedDirty: false }
}

function readLedger(): Ledger {
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Ledger>) : null
    if (!parsed || typeof parsed !== 'object') return emptyLedger()
    return {
      owner: typeof parsed.owner === 'string' ? parsed.owner : null,
      items: parsed.items && typeof parsed.items === 'object' ? parsed.items : {},
      deleted: Array.isArray(parsed.deleted) ? parsed.deleted.filter((id) => typeof id === 'string') : [],
      savedDirty: Boolean(parsed.savedDirty),
    }
  } catch {
    return emptyLedger()
  }
}

let ledger: Ledger = typeof window === 'undefined' ? emptyLedger() : readLedger()

function saveLedger() {
  try {
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger))
  } catch {
    // Quota: the ledger lives on in memory for this visit; the worst case
    // after a reload is one redundant upload.
  }
}

/* ------------------------------------------------------------------ status */

export type SyncStatus =
  /** Not signed in: everything stays in this browser. */
  | 'local'
  | 'syncing'
  | 'synced'
  /** The last attempt failed; it is retried on the next change or visit. */
  | 'error'

type SyncState = {
  status: SyncStatus
  /** The account's list has been fetched at least once since sign-in. */
  pulled: boolean
  /** Machine-readable reason for `error` (`offline`, `project_limit`, `http_500` …). */
  reason: string | null
}

export const useSync = create<SyncState>(() => ({ status: 'local', pulled: false, reason: null }))

/* --------------------------------------------------------------------- api */

class SyncError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function api<T>(path: string, method: 'GET' | 'PUT' | 'DELETE' = 'GET', body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new SyncError(0, 'offline', 'Network request failed.')
  }
  if (res.status === 204) return null as T
  const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
  if (!res.ok) {
    throw new SyncError(res.status, payload.code || `http_${res.status}`, payload.error || `HTTP ${res.status}`)
  }
  return payload as T
}

type FullProject = RemoteProject & { record: CaptureRecord | null; scene: StoredScene | null }

const signedInId = () => useSession.getState().user?.id ?? null

/* -------------------------------------------------------------------- push */

/** The slices of one local project, shaped for `PUT /api/projects/:id`. */
function payloadFor(id: string, parts: Part[]): Record<string, unknown> | null {
  const project = localProject(id)
  const scene = readScene(id)
  const record = getRecord(id)
  const finished = record?.result?.renders?.length ? record : null
  // Nothing on this device under that id any more — nothing to mirror.
  if (!project && !scene && !finished) return null
  const body: Record<string, unknown> = {}
  if (parts.includes('meta') && !project && finished) {
    // The device had no room to store this generation (quota), so there is no
    // archive row to read the card's fields from — the record itself has them.
    Object.assign(body, {
      title: (finished.roomName || '').slice(0, 160),
      roomType: finished.roomType === 'terrace' ? 'other' : finished.roomType,
      style: (finished.style || '').slice(0, 64),
      status: 'ready',
      createdAt: finished.createdAt,
      notes: (finished.notes || '').slice(0, 4000),
      budget: finished.budget,
    })
  }
  if (parts.includes('meta') && project) {
    // The archive's cover may be a full render (older entries); the account
    // list wants a thumbnail, so anything large is left out.
    const cover = project.cover && project.cover.length <= 500_000 ? project.cover : null
    Object.assign(body, {
      title: project.title.slice(0, 160),
      roomType: project.roomType,
      style: project.style.slice(0, 64),
      status: project.status,
      createdAt: project.createdAt,
      notes: project.notes.slice(0, 4000),
      budget: project.budget,
      cover,
    })
  }
  if (parts.includes('record')) body.record = finished
  if (parts.includes('scene')) body.scene = scene
  return body
}

/** Bumped on every local change, so a push can tell whether it raced one. */
const edits = new Map<string, number>()

async function pushOne(id: string) {
  const item = ledger.items[id]
  if (!item || item.dirty.length === 0) return
  const parts = [...item.dirty]
  const body = payloadFor(id, parts)
  if (!body) {
    delete ledger.items[id]
    saveLedger()
    return
  }
  const editsBefore = edits.get(id) ?? 0
  const { project } = await api<{ project: RemoteProject }>(`projects/${encodeURIComponent(id)}`, 'PUT', body)
  // Only what was sent is settled — an edit made while the request was in
  // flight re-marked its slice and stays dirty for the next round.
  const current = ledger.items[id]
  if (current) {
    current.rev = project.updatedAt
    if ((edits.get(id) ?? 0) === editsBefore) {
      current.dirty = current.dirty.filter((part) => !parts.includes(part))
    }
    saveLedger()
  }
  const { remote, stale } = useProjects.getState()
  useProjects.getState().setRemote(
    [project, ...remote.filter((row) => row.id !== id)],
    stale.filter((other) => other !== id)
  )
}

let flushing: Promise<void> | null = null
let flushAgain = false

/** Push every pending delete and change. Safe to call at any time. */
export function flush(): Promise<void> {
  if (flushing) {
    flushAgain = true
    return flushing
  }
  flushing = (async () => {
    // Yield once before anything else: an async function runs synchronously
    // up to its first await, so a run with nothing to do would otherwise reach
    // its `finally` (flushing = null) BEFORE the assignment above lands — and
    // leave a finished promise parked in `flushing` for good.
    await Promise.resolve()
    try {
      do {
        flushAgain = false
        const user = signedInId()
        if (!user || ledger.owner !== user) return
        const pendingDeletes = [...ledger.deleted]
        const pendingIds = Object.keys(ledger.items).filter((id) => ledger.items[id].dirty.length > 0)
        if (pendingDeletes.length === 0 && pendingIds.length === 0 && !ledger.savedDirty) {
          if (useSync.getState().pulled) useSync.setState({ status: 'synced', reason: null })
          return
        }
        useSync.setState({ status: 'syncing', reason: null })
        for (const id of pendingDeletes) {
          await api(`projects/${encodeURIComponent(id)}`, 'DELETE')
          ledger.deleted = ledger.deleted.filter((other) => other !== id)
          saveLedger()
        }
        let failure: SyncError | null = null
        for (const id of pendingIds) {
          try {
            await pushOne(id)
          } catch (err) {
            const error = err instanceof SyncError ? err : new SyncError(0, 'unknown', String(err))
            // The server refuses this one project for good (invalid, too
            // large, account full): stop retrying it, keep syncing the rest.
            if ([400, 409, 413].includes(error.status)) {
              ledger.items[id].dirty = []
              saveLedger()
              failure = failure || error
              continue
            }
            throw error
          }
        }
        if (ledger.savedDirty) await pushSaved()
        if (failure) throw failure
        useSync.setState({ status: 'synced', reason: null })
      } while (flushAgain)
    } catch (err) {
      const error = err instanceof SyncError ? err : new SyncError(0, 'unknown', String(err))
      // The session ended somewhere else: the session store finds out and the
      // reconcile that follows wipes the device copy.
      if (error.status === 401) void useSession.getState().refresh()
      useSync.setState({ status: 'error', reason: error.code })
    } finally {
      flushing = null
    }
  })()
  return flushing
}

let flushTimer: ReturnType<typeof setTimeout> | null = null
function scheduleFlush(delay = 900) {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flush()
  }, delay)
}

function markDirty(id: string, part: ProjectPart) {
  edits.set(id, (edits.get(id) ?? 0) + 1)
  const item = ledger.items[id] || (ledger.items[id] = { rev: null, dirty: [] })
  // A project the account has never seen goes up whole, whatever changed.
  const parts = part === 'all' || item.rev === null ? ALL_PARTS : [part]
  for (const one of parts) if (!item.dirty.includes(one)) item.dirty.push(one)
  ledger.deleted = ledger.deleted.filter((other) => other !== id)
  saveLedger()
}

/* -------------------------------------------------------------------- pull */

function removeLocal(id: string) {
  silently(() => {
    deleteProject(id)
    forgetRecord(id)
    removeScene(id)
  })
}

let pulling: Promise<void> | null = null

/** Fetch the account's list and settle it against this device. */
export function pull(): Promise<void> {
  if (pulling) return pulling
  pulling = (async () => {
    // Same reason as in `flush`: never finish before `pulling` is assigned.
    await Promise.resolve()
    const user = signedInId()
    if (!user || ledger.owner !== user) {
      pulling = null
      return
    }
    useSync.setState({ status: 'syncing', reason: null })
    try {
      const { projects: remote, deleted: tombstones = [] } = await api<{
        projects: RemoteProject[]
        deleted?: string[]
      }>('projects')
      if (signedInId() !== user) return
      const remoteById = new Map(remote.map((row) => [row.id, row]))
      const deletedElsewhere = new Set(tombstones)
      const localIds = new Set([...localProjectIds(), ...listSceneIds().filter((id) => ledger.items[id])])

      const stale: string[] = []
      for (const id of localIds) {
        const item = ledger.items[id]
        const theirs = remoteById.get(id)
        if (!item) {
          // On this device but never mirrored: made as a guest, or before
          // accounts kept projects. It joins the account.
          markDirty(id, 'all')
        } else if (!theirs && deletedElsewhere.has(id) && item.dirty.length === 0) {
          // The account says it was deleted (on another device): it goes here too.
          removeLocal(id)
          delete ledger.items[id]
        } else if (!theirs) {
          // The account does not hold it and never recorded deleting it — or
          // it was deleted elsewhere but edited here since. Either way this
          // device's copy is the only one: it goes (back) up, whole. Deleting
          // locally just because a list came back shorter would turn a server
          // that lost its data directory into every user losing their rooms.
          item.rev = null
          item.dirty = [...ALL_PARTS]
        } else if (theirs && item.rev !== theirs.updatedAt && item.dirty.length === 0) {
          stale.push(id)
        }
      }
      // Ledger rows for things neither side holds any more.
      for (const id of Object.keys(ledger.items)) {
        if (!localIds.has(id) && !remoteById.has(id)) delete ledger.items[id]
      }
      saveLedger()

      const deleted = new Set(ledger.deleted)
      useProjects.getState().setRemote(
        remote.filter((row) => !deleted.has(row.id)),
        stale
      )
      await pullSaved()
      useSync.setState({ pulled: true })
    } catch (err) {
      const error = err instanceof SyncError ? err : new SyncError(0, 'unknown', String(err))
      if (error.status === 401) void useSession.getState().refresh()
      // `pulled` still flips: pages waiting on the first pull must not hang
      // because the network is down — they show what this device has.
      useSync.setState({ status: 'error', reason: error.code, pulled: true })
      return
    } finally {
      pulling = null
    }
    await flush()
  })()
  return pulling
}

/* ------------------------------------------------------------- open by id */

function writeDownloaded(project: FullProject) {
  silently(() => {
    const record = project.record
    if (record && Array.isArray(record.result?.renders) && record.result.renders.length > 0) {
      importRecord(
        {
          ...record,
          id: project.id,
          roomName: project.title || record.roomName || '',
          roomType: (record.roomType || 'living') as RoomTypeId,
          capture: record.capture || { anchorHeading: null, source: 'none', shots: [] },
          before: record.before || {},
        },
        project.cover
      )
    } else if (!localProject(project.id)?.renderCount) {
      // A draft: a row in the archive is all the dashboard needs. (Never
      // written over a local copy that still has its renders.)
      try {
        saveProject({
          id: project.id,
          style: project.style,
          notes: project.notes,
          budget: project.budget,
          brief: {
            meta: {
              title: project.title,
              roomType: project.roomType,
              status: project.status,
              createdAt: project.createdAt,
              ...(project.cover ? { cover: project.cover } : {}),
            },
          },
          renders: [],
        })
      } catch {
        // No room on the device: the builder scene below is what matters.
      }
    }
    if (project.scene) writeScene(project.id, project.scene)
  })
  ledger.items[project.id] = { rev: project.updatedAt, dirty: [] }
  saveLedger()
}

const downloads = new Map<string, Promise<void>>()

/**
 * Make sure project `id` is on this device before a page that reads it
 * synchronously (result, builder, live view) mounts. Resolves — never rejects
 * — once the device copy is as good as it is going to get: at once for a
 * guest, after a download when the account holds a copy this device lacks or
 * a newer one.
 */
export async function ensureProject(id: string | undefined): Promise<void> {
  if (!id || typeof window === 'undefined') return
  const session = useSession.getState()
  // The cached user may be stale; the server's answer decides.
  if (session.status !== 'ready') await session.refresh()
  const user = signedInId()
  if (!user) return
  reconcile()
  if (!useSync.getState().pulled) await pull()
  if (signedInId() !== user || ledger.owner !== user) return

  const { remote, stale } = useProjects.getState()
  const theirs = remote.find((row) => row.id === id)
  if (!theirs) return
  const have = localProject(id) !== null || readScene(id) !== null
  if (have && !stale.includes(id)) return
  // Changed here too since the last sync: this device's copy goes up instead.
  if (have && (ledger.items[id]?.dirty.length ?? 0) > 0) return

  let job = downloads.get(id)
  if (!job) {
    job = (async () => {
      try {
        const { project } = await api<{ project: FullProject }>(`projects/${encodeURIComponent(id)}`)
        if (signedInId() !== user) return
        writeDownloaded(project)
        const state = useProjects.getState()
        state.setRemote(
          state.remote,
          state.stale.filter((other) => other !== id)
        )
      } catch {
        // Offline or gone: the page falls back to whatever is on the device.
      } finally {
        downloads.delete(id)
      }
    })()
    downloads.set(id, job)
  }
  await job
}

/**
 * The synchronous half of `ensureProject`: true when a page can mount right
 * now without waiting — a guest, or a project this device already holds an
 * up-to-date copy of.
 */
export function projectReadyNow(id: string | undefined): boolean {
  if (!id || typeof window === 'undefined') return true
  const session = useSession.getState()
  if (session.status !== 'ready') return false
  if (!session.user) return true
  if (ledger.owner !== session.user.id || !useSync.getState().pulled) return false
  const { remote, stale } = useProjects.getState()
  if (!remote.some((row) => row.id === id)) return true
  const have = localProject(id) !== null || readScene(id) !== null
  return have && (!stale.includes(id) || (ledger.items[id]?.dirty.length ?? 0) > 0)
}

/* ------------------------------------------------------------------- saved */

let applyingSaved = false

function setLocalSaved(items: SavedItem[]) {
  applyingSaved = true
  try {
    useSaved.setState({ items })
  } finally {
    applyingSaved = false
  }
}

async function pushSaved() {
  const { items } = useSaved.getState()
  await api('saved', 'PUT', { items: items.slice(0, 500) })
  ledger.savedDirty = false
  saveLedger()
}

async function pullSaved() {
  const { items: theirs } = await api<{ items: SavedItem[] }>('saved')
  const mine = useSaved.getState().items
  if (ledger.savedDirty) {
    // Pinned here and not uploaded yet (as a guest, or offline): keep both.
    const seen = new Set(mine.map((item) => item.id))
    setLocalSaved([...mine, ...theirs.filter((item) => !seen.has(item.id))])
  } else {
    setLocalSaved(Array.isArray(theirs) ? theirs : [])
  }
}

/* ------------------------------------------------------------ owner change */

/** Remove every project, plan and pin from this device. The account keeps its copy. */
function wipeDevice() {
  silently(() => {
    clearProjects()
    clearRecords()
    for (const id of listSceneIds()) removeScene(id)
    try {
      // A half-finished capture (photos included) is the previous person's too.
      window.sessionStorage.removeItem('framespace.capture.draft')
    } catch {
      /* storage blocked */
    }
  })
  setLocalSaved([])
  useProjects.getState().setRemote([], [])
}

/**
 * Settings → "erase everything". Clears this browser; never the account.
 * (Signed in, the caller logs out first and `reconcile` has already wiped.)
 */
export function eraseDevice() {
  wipeDevice()
  ledger = emptyLedger(signedInId())
  saveLedger()
}

/**
 * Line the device copy up with whoever is signed in now. Idempotent; runs on
 * every session change and before anything that needs the account's data.
 */
function reconcile() {
  const session = useSession.getState()
  // Until the server has answered, the cached user is only a hint — acting on
  // it could wipe (or upload) the wrong person's projects.
  if (session.status !== 'ready') return
  const user = session.user?.id ?? null
  if (ledger.owner === user) {
    if (!user) useSync.setState({ status: 'local', pulled: false, reason: null })
    return
  }

  if (ledger.owner !== null) {
    // Signed out, the session expired, or a different account signed in: the
    // previous account's projects leave this device.
    wipeDevice()
    ledger = emptyLedger(user)
  } else {
    // A guest signed in: what they made so far is adopted by the account.
    // (`pull` marks every un-mirrored local project for upload.)
    ledger = { ...emptyLedger(user), savedDirty: useSaved.getState().items.length > 0 }
  }
  saveLedger()
  useSync.setState({ status: user ? 'syncing' : 'local', pulled: false, reason: null })
  if (user) void pull()
}

/* -------------------------------------------------------------------- boot */

let started = false

/** Wire the engine up. Called once from main.tsx; safe to call again. */
export function initSync() {
  if (started || typeof window === 'undefined') return
  started = true

  onSyncEvent((event) => {
    // Guests: nothing to mirror. The work is adopted if they sign in later.
    const user = signedInId()
    if (!user || ledger.owner !== user) return
    if (event.type === 'deleted') {
      // Only owed to the server if the server ever had it — mirrored from
      // here, or listed from the account without ever being downloaded.
      const known =
        Boolean(ledger.items[event.id]?.rev) ||
        useProjects.getState().remote.some((row) => row.id === event.id)
      delete ledger.items[event.id]
      if (known && !ledger.deleted.includes(event.id)) ledger.deleted.push(event.id)
      saveLedger()
    } else {
      markDirty(event.id, event.part)
    }
    scheduleFlush()
  })

  useSaved.subscribe((state, previous) => {
    if (applyingSaved || state.items === previous.items) return
    ledger.savedDirty = true
    saveLedger()
    if (signedInId() && ledger.owner === signedInId()) scheduleFlush()
  })

  let lastUser: string | null | undefined
  let lastStatus = useSession.getState().status
  const onSession = () => {
    const session = useSession.getState()
    const user = session.user?.id ?? null
    if (user === lastUser && session.status === lastStatus) return
    const firstAnswer = lastStatus !== 'ready' && session.status === 'ready'
    lastUser = user
    lastStatus = session.status
    reconcile()
    // Same account as last visit: `reconcile` had nothing to change, but the
    // account may have moved on from another device.
    if (firstAnswer && user && ledger.owner === user && !useSync.getState().pulled) void pull()
  }
  useSession.subscribe(onSession)
  onSession()

  // Push what is pending before the cookie goes; bounded, so a dead network
  // cannot hold the sign-out hostage.
  setBeforeLogout(async () => {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    await Promise.race([flush(), new Promise((resolve) => setTimeout(resolve, 4000))])
  })

  // Back online, or back to the tab: retry what failed and catch up.
  window.addEventListener('online', () => {
    if (signedInId()) void pull()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
        void flush()
      }
    } else if (signedInId() && useSync.getState().status === 'error') {
      void pull()
    }
  })
}

/** Dashboard "try again" after a failed sync. */
export function retrySync() {
  return pull()
}

/** Whether project `id` has changes that have not reached the account yet. */
export function isPendingUpload(id: string): boolean {
  return (ledger.items[id]?.dirty.length ?? 0) > 0
}
