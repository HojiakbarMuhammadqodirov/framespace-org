/**
 * The seam between "something changed on this device" and "mirror it to the
 * account" (src/store/sync.ts).
 *
 * It exists as its own import-free module because the things that change —
 * the capture store, the projects store, the session — are all imported BY the
 * sync engine; if they imported it back the module graph would be a cycle.
 * They announce here instead, and the engine listens.
 */

/** Which slice of a project changed. `all` = brand new or fully rewritten. */
export type ProjectPart = 'meta' | 'record' | 'scene' | 'all'

export type SyncEvent =
  | { type: 'changed'; id: string; part: ProjectPart }
  | { type: 'deleted'; id: string }

type Listener = (event: SyncEvent) => void

const listeners = new Set<Listener>()
let muted = 0

export function onSyncEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit(event: SyncEvent) {
  if (muted > 0) return
  listeners.forEach((listener) => {
    try {
      listener(event)
    } catch {
      /* a listener must never break the write that announced itself */
    }
  })
}

/** A project (or one slice of it) was written locally. */
export function projectChanged(id: string, part: ProjectPart = 'all') {
  emit({ type: 'changed', id, part })
}

/** A project was deleted locally. */
export function projectDeleted(id: string) {
  emit({ type: 'deleted', id })
}

/**
 * Run local writes that must NOT be mirrored back — the engine itself writing
 * what it just downloaded, or wiping the device after sign-out.
 */
export function silently<T>(fn: () => T): T {
  muted += 1
  try {
    return fn()
  } finally {
    muted -= 1
  }
}

/* ------------------------------------------------------------ sign-out */

type LogoutHook = () => Promise<void> | void
let beforeLogout: LogoutHook | null = null

/** The engine registers its "push what is still pending" step here. */
export function setBeforeLogout(hook: LogoutHook | null) {
  beforeLogout = hook
}

/** Called by the session store just before the cookie is dropped. Never throws. */
export async function runBeforeLogout() {
  try {
    await beforeLogout?.()
  } catch {
    /* signing out must always succeed */
  }
}
