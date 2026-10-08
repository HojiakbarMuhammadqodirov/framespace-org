/**
 * Where a finished generation lives.
 *
 * Two layers, deliberately:
 *
 * 1. An in-memory map, written the moment `/api/render` answers. The result
 *    exists for the rest of the session even if the device refuses to store it
 *    — which matters, because the request is synchronous and unrepeatable.
 * 2. `localStorage`, written ONCE per heavy asset. The renders are the heavy
 *    part and live only in the frozen `framespace.projects.v1` archive
 *    (`src/lib/storage.js`), because the Archive, the legacy app and the Live
 *    screen all read them from there. This feature's own key keeps everything
 *    that archive has no field for — the compass trail, the small "before"
 *    photos, the room name — with `result.renders` stripped; `getRecord()`
 *    joins the two back together on read.
 */
import { loadProjects, saveProject } from '@/lib/storage.js'

import { shrinkForStorage } from './frame'
import type { CaptureRecord, RenderImage, RoomTypeId } from './types'

const KEY = 'framespace.capture.v1'
/** Without renders a record is a few hundred kB of small JPEGs. */
const MAX_RECORDS = 6
/** Renders arrive as PNG data URLs; on disk they are JPEG at this size. */
const RENDER_EDGE = 1152
const RENDER_QUALITY = 0.78
const COVER_EDGE = 480

const memory = new Map<string, CaptureRecord>()

export function newProjectId(): string {
  return `proj_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function readAll(): CaptureRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as CaptureRecord[]) : []
  } catch {
    return []
  }
}

function writeAll(records: CaptureRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(records))
}

/** Session-only. Always succeeds; never touches the disk. */
export function cacheRecord(record: CaptureRecord) {
  memory.set(record.id, record)
}

export function listRecords(): CaptureRecord[] {
  const stored = readAll()
  const seen = new Set(stored.map((r) => r.id))
  const extras = [...memory.values()].filter((r) => !seen.has(r.id))
  return [...extras, ...stored].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

/** The archive's copy of the renders, for a record stored without them. */
function withRenders(record: CaptureRecord | null | undefined): CaptureRecord | null {
  if (!record) return null
  if (record.result?.renders?.length) return record
  let renders: RenderImage[] = []
  try {
    const entry = (loadProjects() as Array<{ id?: string; renders?: RenderImage[] }>).find(
      (p) => p?.id === record.id
    )
    renders = Array.isArray(entry?.renders) ? entry.renders : []
  } catch {
    renders = []
  }
  return { ...record, result: { ...record.result, renders } }
}

export function getRecord(id: string | undefined): CaptureRecord | null {
  if (!id) return null
  if (id === 'latest') {
    const first = listRecords()[0]
    return first ? getRecord(first.id) : null
  }
  return memory.get(id) || withRenders(readAll().find((r) => r.id === id)) || fromArchive(id)
}

/**
 * A project that only exists in the shared archive — saved by an older build,
 * by the room builder, or whose capture slot was evicted. It still has renders
 * and a brief, which is everything the result page needs except the "before"
 * photos.
 */
function fromArchive(id: string): CaptureRecord | null {
  let entry: Record<string, any> | undefined
  try {
    entry = (loadProjects() as Array<Record<string, any>>).find((p) => p?.id === id)
  } catch {
    entry = undefined
  }
  if (!entry || !Array.isArray(entry.renders) || entry.renders.length === 0) return null
  const brief = (entry.brief && typeof entry.brief === 'object' ? entry.brief : {}) as Record<string, any>
  const meta = (brief.meta || {}) as Record<string, any>
  const roomType = typeof meta.roomType === 'string' ? meta.roomType : 'living'
  const budget =
    entry.budget && typeof entry.budget === 'object' && Number(entry.budget.limit) > 0
      ? { limit: Number(entry.budget.limit), currency: String(entry.budget.currency || 'UZS') }
      : null
  return {
    id: String(entry.id),
    createdAt: String(meta.createdAt || entry.savedAt || new Date().toISOString()),
    roomName: typeof meta.title === 'string' ? meta.title : '',
    roomType: (roomType === 'other' ? 'living' : roomType) as RoomTypeId,
    style: String(entry.style || brief.design?.styleName || ''),
    notes: typeof entry.notes === 'string' ? entry.notes : '',
    budget,
    capture: { anchorHeading: null, source: 'none', shots: [] },
    before: {},
    result: { brief, renders: entry.renders as RenderImage[] },
  }
}

/** Every saved generation of the same room — the variant chips on the result. */
export function variantsOf(record: CaptureRecord | null): CaptureRecord[] {
  if (!record) return []
  const key = (record.roomName || "").trim().toLowerCase()
  const all = listRecords().filter((r) => (r.roomName || "").trim().toLowerCase() === key)
  if (!all.some((r) => r.id === record.id)) all.unshift(record)
  return all.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
}

export function isSaved(id: string): boolean {
  if (readAll().some((r) => r.id === id)) return true
  try {
    return (loadProjects() as Array<{ id?: string; renders?: unknown[] }>).some(
      (p) => p?.id === id && Array.isArray(p.renders) && p.renders.length > 0
    )
  } catch {
    return false
  }
}

/** The dashboard's room types are a slightly different list from capture's. */
function archiveRoomType(type: RoomTypeId): string {
  return type === 'terrace' ? 'other' : type
}

/** Renders re-encoded for disk. A failed re-encode keeps the original. */
async function compactRenders(renders: RenderImage[] = []): Promise<RenderImage[]> {
  return Promise.all(
    renders.map(async (render) => {
      const small = await shrinkForStorage(render.image, RENDER_EDGE, RENDER_QUALITY)
      // Demo renders are compact SVGs; a JPEG of one is bigger, not smaller.
      return { ...render, image: small.length < render.image.length ? small : render.image }
    })
  )
}

export type PersistOutcome = {
  /** How many older projects the device had to drop to make room. */
  evicted: number
}

/**
 * Write to disk. Drops the oldest entries until it fits rather than losing the
 * save the user just asked for; throws `storage-full` only when even this one
 * record is too big for the device. Resolves with how many older projects were
 * dropped, so the result page can say so.
 */
export async function persistRecord(record: CaptureRecord): Promise<PersistOutcome> {
  cacheRecord(record)

  const renders = await compactRenders(record.result.renders)
  const cover = renders[0]?.image ? await shrinkForStorage(renders[0].image, COVER_EDGE) : null

  // 1. The renders, once, in the shared archive. Its own loop evicts the
  //    oldest projects on quota; counting before and after tells us how many.
  const before = new Set(
    (loadProjects() as Array<{ id?: string }>).map((p) => p?.id).filter(Boolean) as string[]
  )
  try {
    saveProject({
      id: record.id,
      style: record.style,
      notes: record.notes,
      budget: record.budget,
      brief: {
        ...(record.result.brief || {}),
        // The dashboard's fields ride inside `brief.meta` — see store/projects.ts.
        meta: {
          title: record.roomName,
          roomType: archiveRoomType(record.roomType),
          status: 'ready',
          createdAt: record.createdAt,
          cover,
        },
      },
      renders,
    })
  } catch {
    throw new Error('storage-full')
  }
  const after = new Set(
    (loadProjects() as Array<{ id?: string }>).map((p) => p?.id).filter(Boolean) as string[]
  )
  let evicted = 0
  before.forEach((id) => {
    if (!after.has(id)) evicted += 1
  })

  // 2. Everything else, without the renders, under this feature's key.
  const slim: CaptureRecord = { ...record, result: { ...record.result, renders: [] } }
  const next = [slim, ...readAll().filter((r) => r.id !== record.id)].slice(0, MAX_RECORDS)
  let attempt = [...next]
  let stored = false
  while (attempt.length) {
    try {
      writeAll(attempt)
      stored = true
      break
    } catch {
      attempt = attempt.slice(0, -1)
    }
  }
  if (!stored) throw new Error('storage-full')

  return { evicted }
}

export function duplicateRecord(record: CaptureRecord): CaptureRecord {
  return {
    ...record,
    id: newProjectId(),
    createdAt: new Date().toISOString(),
  }
}

/** Settings → erase everything. Memory and disk both. */
export function clearRecords() {
  memory.clear()
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Storage blocked — nothing was written there either.
  }
}

export function forgetRecord(id: string) {
  memory.delete(id)
  try {
    writeAll(readAll().filter((r) => r.id !== id))
  } catch {
    // Nothing to do — the entry stays until the next successful write.
  }
}
