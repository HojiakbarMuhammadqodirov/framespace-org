/**
 * Route wrappers for pages that open ONE project by id.
 *
 * The result page, the live view and the 3D builder all read their project
 * synchronously from this device's storage the moment they mount. For a
 * signed-in account that copy may not be here yet — the project was made on
 * another device, or evicted by the 12-project cap — so the route waits for
 * `ensureProject` (src/store/sync.ts) to bring it down first. Guests, and
 * projects already on the device, pass straight through.
 *
 * `RoomRoute` additionally watches the builder's saved scene from outside the
 * editor: the first real edit turns a new room into a draft project on the
 * dashboard, and every later save is mirrored to the account.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'

import i18n from '@/i18n/config'
import { PageFallback } from '@/layouts/PageFallback'
import { newProjectId } from '@/features/capture/store'
import { localProject, useProjects } from '@/store/projects'
import { copyScene, parseScene, readSceneRaw, removeScene, sceneItemCount } from '@/store/roomScene'
import { ensureProject, projectReadyNow } from '@/store/sync'
import { projectChanged } from '@/store/syncBus'

export function ProjectGate({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id?: string }>()
  const key = id ?? ''
  // Decided synchronously when it can be, so a guest or an already-local
  // project never flashes the loading state.
  const [readyFor, setReadyFor] = useState<string | null>(() => (projectReadyNow(id) ? key : null))

  useEffect(() => {
    if (projectReadyNow(id)) {
      setReadyFor(key)
      return
    }
    let alive = true
    void ensureProject(id).then(() => {
      if (alive) setReadyFor(key)
    })
    return () => {
      alive = false
    }
  }, [id, key])

  if (readyFor !== key) return <PageFallback />
  return <>{children}</>
}

/* ------------------------------------------------------------ new rooms */

/** How often the builder's saved scene is compared with the last one seen. */
const WATCH_MS = 1000
/** Longer than the builder store's write debounce, for the edit made on the way out. */
const SETTLE_MS = 1500

let lastNewRoom: { navigation: string; id: string } | null = null

/**
 * One fresh id per visit to /app/room/new. Keyed by the navigation entry so
 * React's double render in development cannot mint two.
 */
function newRoomIdFor(navigation: string): string {
  if (lastNewRoom?.navigation === navigation) return lastNewRoom.id
  const id = newProjectId()
  // Before rooms had their own ids every "new room" shared the key
  // `framespace.room.new`. A plan drawn there moves into this room instead of
  // being left behind (or, worse, reappearing in every room started after it).
  if (copyScene('new', id)) removeScene('new')
  lastNewRoom = { navigation, id }
  return id
}

/**
 * /app/room/new → /app/room/<fresh id>. Every "Build it in 3D" starts its own
 * room; the query (`?add=` from a catalogue page) carries over untouched.
 */
export function NewRoomRedirect() {
  const location = useLocation()
  return <Navigate to={`/app/room/${newRoomIdFor(location.key)}${location.search}`} replace />
}

/** Rooms with a watcher mounted right now (React mounts effects twice in dev). */
const watching = new Map<string, number>()

/**
 * Watches `framespace.room.<id>` while the builder is open.
 *
 * The builder store is not ours to edit, so this reads its persisted scene the
 * same way a second tab would. A room's first write is only its untouched
 * starting scene — that is not an edit, and for a brand-new room not a project
 * yet. The first write that differs (a piece placed, a wall moved) creates the
 * draft on the dashboard; every later one marks the plan for upload.
 */
function useRoomWatch(id: string | undefined) {
  useEffect(() => {
    if (!id) return
    watching.set(id, (watching.get(id) ?? 0) + 1)
    let last = readSceneRaw(id)
    /** No plan was stored under this id when the page opened. */
    const startedEmpty = last === null
    let edited = false

    const check = () => {
      const raw = readSceneRaw(id)
      if (raw === last || raw === null) return
      const first = last === null
      last = raw
      // The starting scene of a room nobody has touched yet.
      if (first && sceneItemCount(parseScene(raw)) === 0) return
      if (localProject(id) === null) {
        // `create` announces the whole project, plan included.
        useProjects.getState().create({
          id,
          title: i18n.t('app.dash.draftTitle'),
          status: 'draft',
        })
        edited = true
        return
      }
      // Once per visit is enough to bring the room to the top of the list;
      // re-writing the archive on every save would be wasted work.
      if (!edited) useProjects.getState().touch(id)
      edited = true
      projectChanged(id, 'scene')
    }

    const timer = window.setInterval(check, WATCH_MS)
    return () => {
      window.clearInterval(timer)
      check()
      const left = (watching.get(id) ?? 1) - 1
      if (left > 0) watching.set(id, left)
      else watching.delete(id)
      // The store debounces its writes: an edit made in the last half second
      // lands after this page is gone.
      window.setTimeout(() => {
        // Opened again in the meantime: that visit's watcher has it.
        if (watching.has(id)) return
        check()
        // A room opened and left exactly as it started is not worth keeping:
        // its starting scene would otherwise sit in storage for good (and, for
        // a photographed project, read as "this one has a 3D plan").
        if (startedEmpty && !edited && sceneItemCount(parseScene(readSceneRaw(id))) === 0) removeScene(id)
      }, SETTLE_MS)
    }
  }, [id])
}

function RoomWatch() {
  const { id } = useParams<{ id?: string }>()
  useRoomWatch(id)
  return null
}

/** The builder route: project on the device first, then the editor + the watcher. */
export function RoomRoute({ children }: { children: ReactNode }) {
  return (
    <ProjectGate>
      <RoomWatch />
      {children}
    </ProjectGate>
  )
}
