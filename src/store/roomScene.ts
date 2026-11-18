/**
 * The 3D builder's saved scene, read and written from OUTSIDE the builder.
 *
 * The builder store (src/features/room-builder/store.ts) persists one scene
 * per room under `framespace.room.<id>` through zustand/persist, i.e. as
 * `{ state: { scene }, version }`. Everything that needs a room's scene without
 * mounting the editor — account sync, "duplicate", "delete", the dashboard's
 * "has a 3D plan" check — goes through these helpers so that envelope lives in
 * exactly one place besides the store itself.
 *
 * The scene is treated as opaque JSON here on purpose: the builder may add
 * fields (wall colour, floor material, per-item scale) and none of this code
 * has to know.
 */

export type StoredScene = Record<string, unknown>

const PREFIX = 'framespace.room.'
/** Must match the `version` in the builder store's persist options. */
const ENVELOPE_VERSION = 1

export function roomKey(id: string): string {
  return `${PREFIX}${id}`
}

/** The raw stored string — cheap to compare when watching for edits. */
export function readSceneRaw(id: string): string | null {
  try {
    return window.localStorage.getItem(roomKey(id))
  } catch {
    return null
  }
}

function looksLikeScene(value: unknown): value is StoredScene {
  if (!value || typeof value !== 'object') return false
  const scene = value as { room?: unknown; items?: unknown; fixtures?: unknown }
  return Boolean(scene.room) && typeof scene.room === 'object' && Array.isArray(scene.items) && Array.isArray(scene.fixtures)
}

export function parseScene(raw: string | null): StoredScene | null {
  if (!raw) return null
  try {
    const scene = (JSON.parse(raw) as { state?: { scene?: unknown } })?.state?.scene
    return looksLikeScene(scene) ? scene : null
  } catch {
    return null
  }
}

export function readScene(id: string): StoredScene | null {
  return parseScene(readSceneRaw(id))
}

export function hasScene(id: string): boolean {
  return readSceneRaw(id) !== null
}

/** Returns false when the device refused the write (quota, private mode). */
export function writeScene(id: string, scene: StoredScene): boolean {
  if (!looksLikeScene(scene)) return false
  try {
    window.localStorage.setItem(roomKey(id), JSON.stringify({ state: { scene }, version: ENVELOPE_VERSION }))
    return true
  } catch {
    return false
  }
}

export function removeScene(id: string) {
  try {
    window.localStorage.removeItem(roomKey(id))
  } catch {
    /* storage blocked: there is nothing stored to remove either */
  }
}

/** Copies a room's plan to another id. False when there was nothing to copy. */
export function copyScene(fromId: string, toId: string): boolean {
  const raw = readSceneRaw(fromId)
  if (raw === null) return false
  try {
    window.localStorage.setItem(roomKey(toId), raw)
    return true
  } catch {
    return false
  }
}

/** Ids of every room with a stored scene on this device. */
export function listSceneIds(): string[] {
  const ids: string[] = []
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(PREFIX)) ids.push(key.slice(PREFIX.length))
    }
  } catch {
    /* storage blocked */
  }
  return ids
}

/** What a piece count the dashboard can show for a plan without rendering it. */
export function sceneItemCount(scene: StoredScene | null): number {
  const items = (scene as { items?: unknown[] } | null)?.items
  return Array.isArray(items) ? items.length : 0
}
