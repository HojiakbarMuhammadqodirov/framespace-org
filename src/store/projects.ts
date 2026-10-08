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
import { forgetRecord } from '@/features/capture/store'

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

/** storage.js entry → Project. Tolerant: legacy entries have no `meta`. */
function toProject(entry: Record<string, any>): Project {
  const brief = (entry?.brief ?? null) as Record<string, any> | null
  const meta = (brief?.meta ?? {}) as Record<string, unknown>
  const renders: Array<Record<string, any>> = Array.isArray(entry?.renders) ? entry.renders : []
  const savedAt = typeof entry?.savedAt === 'string' ? entry.savedAt : new Date().toISOString()

  return {
    id: String(entry?.id ?? `proj_${Date.now()}`),
    title:
      (typeof meta.title === 'string' && meta.title) ||
      (typeof brief?.design?.styleName === 'string' ? `${brief.design.styleName}` : '') ||
      String(entry?.style ?? 'Loyiha'),
    roomType: isRoomType(meta.roomType) ? meta.roomType : 'living',
    style: String(entry?.style ?? ''),
    status: isStatus(meta.status) ? meta.status : renders.length ? 'ready' : 'draft',
    createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : savedAt,
    savedAt,
    notes: typeof entry?.notes === 'string' ? entry.notes : '',
    budget: (entry?.budget ?? brief?.budget ?? null) as Money,
    // Capture writes a small `meta.cover`; older entries only have the renders.
    cover:
      typeof meta.cover === 'string' && meta.cover
        ? meta.cover
        : typeof renders[0]?.image === 'string'
          ? renders[0].image
          : null,
    renderCount: renders.length,
    brief,
  }
}

/** Project → the exact shape storage.js persists. Renders are preserved. */
function toEntry(project: Project, renders: unknown[]) {
  const { meta: previous, ...rest } = (project.brief ?? {}) as Record<string, any>
  // Only a cover that was already in `meta` is carried over — `project.cover`
  // may be a full render, which must not be written a second time.
  const cover = typeof previous?.cover === 'string' ? previous.cover : undefined
  return {
    id: project.id,
    style: project.style,
    notes: project.notes,
    budget: project.budget,
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

export type NewProject = {
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

  hydrate: () => void
  create: (input: NewProject) => Project | null
  update: (id: string, patch: Partial<NewProject>) => void
  duplicate: (id: string) => Project | null
  remove: (id: string) => void
  clearError: () => void
}

export const useProjects = create<ProjectsState>((set, get) => ({
  projects: [],
  ready: false,
  error: null,

  hydrate: () => {
    const raw = loadProjects()
    const projects = (Array.isArray(raw) ? raw : []).map(toProject)
    set({ projects, ready: true })
  },

  create: (input) => {
    const now = new Date().toISOString()
    const project: Project = {
      id: `proj_${Date.now()}`,
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
    }
    try {
      saveProject(toEntry(project, []))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return null
    }
    get().hydrate()
    return get().projects.find((p) => p.id === project.id) ?? project
  },

  update: (id, patch) => {
    const current = get().projects.find((p) => p.id === id)
    if (!current) return
    const next: Project = { ...current, ...patch, title: patch.title ?? current.title }
    try {
      // storage.js re-dates `savedAt` itself and moves the entry to the front.
      saveProject(toEntry(next, rendersOf(id)))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return
    }
    get().hydrate()
  },

  duplicate: (id) => {
    const source = get().projects.find((p) => p.id === id)
    if (!source) return null
    const now = new Date().toISOString()
    const copy: Project = {
      ...source,
      id: `proj_${Date.now()}`,
      title: `${source.title} — 2`,
      status: 'draft',
      createdAt: now,
      savedAt: now,
    }
    try {
      // The copy deliberately carries no renders: they are the heaviest thing
      // in storage and storage.js starts evicting the moment the quota bites.
      saveProject(toEntry(copy, []))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return null
    }
    get().hydrate()
    return get().projects.find((p) => p.id === copy.id) ?? copy
  },

  remove: (id) => {
    deleteProject(id)
    // The capture feature keeps its own slice of the same project (compass
    // trail, "before" photos). Deleting the project deletes that too.
    forgetRecord(id)
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
