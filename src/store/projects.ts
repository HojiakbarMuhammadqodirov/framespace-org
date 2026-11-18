/**
 * The project model.
 *
 * Persistence is NOT reimplemented here. `src/lib/storage.js` is frozen and
 * already owns the localStorage key `framespace.projects.v1`, the cap of 12
 * entries and the eviction-on-quota loop. This store is a typed, reactive
 * facade over it.
 *
 * The one wrinkle: `saveProject()` writes a fixed set of fields
 * (id, savedAt, style, notes, budget, brief, renders) and silently drops
 * anything else. The dashboard needs a title, a room type and a status, which
 * that shape has no room for — so they ride along inside `brief.meta`, which
 * IS persisted. The legacy screens read `brief.budget` and `brief.furniture`
 * and ignore unknown keys, so adding `meta` cannot break them.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { loadProjects, saveProject, deleteProject } from '@/lib/storage.js'
import { forgetRecord, newProjectId, renameRecord } from '@/features/capture/store'

import { copyScene, hasScene, removeScene } from './roomScene'
import { projectChanged, projectDeleted } from './syncBus'

export type ProjectStatus = 'draft' | 'rendering' | 'ready' | 'failed'

export const ROOM_TYPES = [
  'living',
  'bedroom',
  'kitchen',
  'office',
  'kids',
  'bathroom',
  'other',
] as const
export type RoomType = (typeof ROOM_TYPES)[number]

export const PROJECT_STATUSES: ProjectStatus[] = ['draft', 'rendering', 'ready', 'failed']

export type Money = {
  currency?: string
  limit?: number
  estimatedTotal?: number
} | null

export type Project = {
  id: string
  title: string
  roomType: RoomType
  /** Free text: the design style name the render used ("Japandi", …). */
  style: string
  status: ProjectStatus
  createdAt: string
  savedAt: string
  notes: string
  budget: Money
  /** First render's data URL, when there is one. Otherwise we draw a plan. */
  cover: string | null
  renderCount: number
  /** The server's design brief, untouched. */
  brief: Record<string, unknown> | null
  /** A 3D builder plan exists for this project — it can be edited in /app/room/:id. */
  hasScene: boolean
  /**
   * Listed from the account, not stored on this device yet (made on another
   * device, or evicted here by the 12-project cap). Opening it downloads it.
   */
  remote: boolean
}

/**
 * One row of `GET /api/projects` (server/projects.js) — the account's copy of
 * a project's dashboard fields, without the renders or the scene.
 */
export type RemoteProject = {
  id: string
  title: string
  roomType: string
  style: string
  status: string
  createdAt: string
  updatedAt: string
  notes: string
  budget: Money
  cover: string | null
  renderCount: number
  hasScene: boolean
  hasResult: boolean
}

/** Stable-ish number from an id, so every project draws the same plan twice. */
export function seedOf(id: string): number {
  let n = 0
  for (let i = 0; i < id.length; i += 1) n = (n * 31 + id.charCodeAt(i)) >>> 0
  return n
}

function isRoomType(value: unknown): value is RoomType {
  return typeof value === 'string' && (ROOM_TYPES as readonly string[]).includes(value)
}

function isStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && PROJECT_STATUSES.includes(value as ProjectStatus)
}

/**
 * The card's money line. The request's own budget only knows the limit; the
 * total the server worked out lives in the brief — a card needs both.
 */
function budgetOf(entry: Record<string, any>, brief: Record<string, any> | null): Money {
  const asked = entry?.budget && typeof entry.budget === 'object' ? entry.budget : null
  const answered = brief?.budget && typeof brief.budget === 'object' ? brief.budget : null
  if (!asked && !answered) return null
  return {
    currency: answered?.currency || asked?.currency,
    limit: Number(asked?.limit ?? answered?.limit) || undefined,
    estimatedTotal: Number(answered?.estimatedTotal ?? asked?.estimatedTotal) || undefined,
  }
}

/** storage.js entry → Project. Tolerant: legacy entries have no `meta`. */
function toProject(entry: Record<string, any>): Project {
  const brief = (entry?.brief ?? null) as Record<string, any> | null
  const meta = (brief?.meta ?? {}) as Record<string, unknown>
  const renders: Array<Record<string, any>> = Array.isArray(entry?.renders) ? entry.renders : []
  const savedAt = typeof entry?.savedAt === 'string' ? entry.savedAt : new Date().toISOString()
  const id = String(entry?.id ?? `proj_${Date.now()}`)

  return {
    id,
    title:
      (typeof meta.title === 'string' && meta.title) ||
      (typeof brief?.design?.styleName === 'string' ? `${brief.design.styleName}` : '') ||
      String(entry?.style ?? ''),
    roomType: isRoomType(meta.roomType) ? meta.roomType : 'living',
    style: String(entry?.style ?? ''),
    status: isStatus(meta.status) ? meta.status : renders.length ? 'ready' : 'draft',
    createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : savedAt,
    savedAt,
    notes: typeof entry?.notes === 'string' ? entry.notes : '',
    budget: budgetOf(entry, brief),
    // Capture writes a small `meta.cover`; older entries only have the renders.
    cover:
      typeof meta.cover === 'string' && meta.cover
        ? meta.cover
        : typeof renders[0]?.image === 'string'
          ? renders[0].image
          : null,
    renderCount: renders.length,
    brief,
    hasScene: hasScene(id),
    remote: false,
  }
}

/** An account row for a project this device does not hold. */
function fromRemote(row: RemoteProject): Project {
  return {
    id: row.id,
    title: row.title || row.style || '',
    roomType: isRoomType(row.roomType) ? row.roomType : 'living',
    style: row.style || '',
    status: isStatus(row.status) ? row.status : row.hasResult ? 'ready' : 'draft',
    createdAt: row.createdAt,
    savedAt: row.updatedAt,
    notes: row.notes || '',
    budget: row.budget ?? null,
    cover: row.cover ?? null,
    renderCount: row.renderCount || 0,
    brief: null,
    hasScene: Boolean(row.hasScene),
    remote: true,
  }
}

/** Project → the exact shape storage.js persists. Renders are preserved. */
function toEntry(project: Project, renders: unknown[]) {
  const { meta: previous, ...rest } = (project.brief ?? {}) as Record<string, any>
  // Only a cover that was already in `meta` is carried over — `project.cover`
  // may be a full render, which must not be written a second time.
  const cover = typeof previous?.cover === 'string' ? previous.cover : undefined
  // `project.budget` is the card's merged view (limit + the server's total);
  // what goes back to disk is the request's own budget, as capture wrote it.
  const budget = project.budget?.limit
    ? { limit: project.budget.limit, currency: project.budget.currency || 'UZS' }
    : null
  return {
    id: project.id,
    style: project.style,
    notes: project.notes,
    budget,
    brief: {
      ...rest,
      meta: {
        title: project.title,
        roomType: project.roomType,
        status: project.status,
        createdAt: project.createdAt,
        ...(cover ? { cover } : {}),
      },
    },
    renders,
  }
}

/** The renders we must not lose when re-saving a project we only patched. */
function rendersOf(id: string): unknown[] {
  const raw = loadProjects().find((p: any) => p?.id === id)
  return Array.isArray(raw?.renders) ? raw.renders : []
}

/** One project as this device holds it, or null. Read fresh, not from state. */
export function localProject(id: string): Project | null {
  const raw = (loadProjects() as Array<Record<string, any>>).find((p) => p?.id === id)
  return raw ? toProject(raw) : null
}

/** Ids of every project in this device's archive. */
export function localProjectIds(): string[] {
  return (loadProjects() as Array<{ id?: string }>).map((p) => String(p?.id ?? '')).filter(Boolean)
}

export type NewProject = {
  /** Reuse an id — the builder's room id becomes the project id. */
  id?: string
  title: string
  roomType?: RoomType
  style?: string
  status?: ProjectStatus
  notes?: string
  budget?: Money
}

type ProjectsState = {
  projects: Project[]
  ready: boolean
  /** Set when storage.js refuses a write (quota, private mode). */
  error: string | null
  /** The account's list, as last fetched. Empty for guests. */
  remote: RemoteProject[]
  /** Ids whose account copy is newer than this device's (edited elsewhere). */
  stale: string[]

  hydrate: () => void
  /** Called by the sync engine with the account's list; re-derives `projects`. */
  setRemote: (remote: RemoteProject[], stale?: string[]) => void
  create: (input: NewProject) => Project | null
  update: (id: string, patch: Partial<NewProject>) => void
  /** Marks a project as just worked on (moves it to the front of the list). */
  touch: (id: string) => void
  rename: (id: string, title: string) => void
  duplicate: (id: string) => Project | null
  remove: (id: string) => void
  clearError: () => void
}

export const useProjects = create<ProjectsState>((set, get) => ({
  projects: [],
  ready: false,
  error: null,
  remote: [],
  stale: [],

  hydrate: () => {
    const raw = loadProjects()
    const local = (Array.isArray(raw) ? raw : []).map(toProject)
    const { remote, stale } = get()
    const byId = new Map(local.map((p) => [p.id, p]))
    for (const row of remote) {
      const mine = byId.get(row.id)
      if (!mine) {
        byId.set(row.id, fromRemote(row))
      } else if (stale.includes(row.id)) {
        // Edited on another device since this copy was made: show the
        // account's name and status now; opening it fetches the rest.
        const theirs = fromRemote(row)
        byId.set(row.id, {
          ...mine,
          title: theirs.title || mine.title,
          roomType: theirs.roomType,
          style: theirs.style || mine.style,
          status: theirs.status,
          savedAt: theirs.savedAt,
          renderCount: theirs.renderCount,
          cover: theirs.cover ?? mine.cover,
          hasScene: theirs.hasScene || mine.hasScene,
        })
      }
    }
    const projects = [...byId.values()].sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
    set({ projects, ready: true })
  },

  setRemote: (remote, stale = []) => {
    set({ remote, stale })
    get().hydrate()
  },

  create: (input) => {
    const now = new Date().toISOString()
    const project: Project = {
      id: input.id || newProjectId(),
      title: input.title.trim(),
      roomType: input.roomType ?? 'living',
      style: input.style ?? '',
      status: input.status ?? 'draft',
      createdAt: now,
      savedAt: now,
      notes: input.notes ?? '',
      budget: input.budget ?? null,
      cover: null,
      renderCount: 0,
      brief: null,
      hasScene: false,
      remote: false,
    }
    try {
      saveProject(toEntry(project, []))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return null
    }
    projectChanged(project.id, 'all')
    get().hydrate()
    return get().projects.find((p) => p.id === project.id) ?? project
  },

  update: (id, patch) => {
    // Read from disk, not from state: a row that is only listed from the
    // account (`remote`) has no brief or renders here to re-save.
    const current = localProject(id)
    if (!current) return
    const next: Project = { ...current, ...patch, id, title: patch.title ?? current.title }
    try {
      // storage.js re-dates `savedAt` itself and moves the entry to the front.
      saveProject(toEntry(next, rendersOf(id)))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return
    }
    projectChanged(id, 'meta')
    get().hydrate()
  },

  touch: (id) => {
    const current = localProject(id)
    if (!current) return
    try {
      saveProject(toEntry(current, rendersOf(id)))
    } catch {
      // Quota: the order on the dashboard is all that is lost.
    }
    get().hydrate()
  },

  rename: (id, title) => {
    const name = title.trim().slice(0, 120)
    if (!name) return
    // The result page reads the capture slice first; keep both in step.
    renameRecord(id, name)
    get().update(id, { title: name })
  },

  duplicate: (id) => {
    const source = localProject(id)
    if (!source) return null
    const now = new Date().toISOString()
    const copy: Project = {
      ...source,
      id: newProjectId(),
      title: `${source.title} — 2`,
      status: 'draft',
      createdAt: now,
      savedAt: now,
      renderCount: 0,
      cover: null,
      // The copy is a fresh draft of the same room: it keeps the plan, not
      // the finished design — so no brief either, or the dashboard would
      // show a price and a palette for renders that are not there.
      brief: null,
    }
    try {
      // The copy deliberately carries no renders: they are the heaviest thing
      // in storage and storage.js starts evicting the moment the quota bites.
      saveProject(toEntry(copy, []))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return null
    }
    // The 3D plan is what makes a copy worth having: it opens in the builder
    // exactly as the original stood.
    copyScene(id, copy.id)
    projectChanged(copy.id, 'all')
    get().hydrate()
    return get().projects.find((p) => p.id === copy.id) ?? copy
  },

  remove: (id) => {
    deleteProject(id)
    // The capture feature keeps its own slice of the same project (compass
    // trail, "before" photos). Deleting the project deletes that too — and
    // the builder plan saved under the same id.
    forgetRecord(id)
    removeScene(id)
    projectDeleted(id)
    // Drop it from the account list at once; the server delete is in flight.
    set((state) => ({
      remote: state.remote.filter((row) => row.id !== id),
      stale: state.stale.filter((other) => other !== id),
    }))
    get().hydrate()
  },

  clearError: () => set({ error: null }),
}))

/* ------------------------------------------------------------------ saved */
/**
 * Saved furniture. This one has no frozen helper to wrap — nothing in
 * `src/lib` persists a shortlist — so it gets its own small persisted store
 * under its own key. The catalogue itself arrives in step 9; until then the
 * Saved page seeds from what the user pins.
 */

export type SavedItem = {
  id: string
  name: string
  category: string
  style: string
  price: number
  currency: string
  /** Which room the piece was shortlisted for, when it came from a project. */
  room?: RoomType
  savedAt: string
}

type SavedState = {
  items: SavedItem[]
  save: (item: Omit<SavedItem, 'id' | 'savedAt'> & { id?: string }) => void
  remove: (id: string) => void
  has: (id: string) => boolean
  clear: () => void
}

export const useSaved = create<SavedState>()(
  persist(
    (set, get) => ({
      items: [],
      save: (item) => {
        const id = item.id ?? `fur_${Date.now().toString(36)}`
        if (get().items.some((i) => i.id === id)) return
        set((state) => ({
          items: [{ ...item, id, savedAt: new Date().toISOString() }, ...state.items],
        }))
      },
      remove: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      has: (id) => get().items.some((i) => i.id === id),
      clear: () => set({ items: [] }),
    }),
    { name: 'framespace.saved.v1' }
  )
)
