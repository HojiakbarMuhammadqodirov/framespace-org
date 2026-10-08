import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Seo } from '@/lib/seo'
import { loadProjects } from '@/lib/storage.js'
import { LiveExperience } from '@/features/live'
import type { LiveProject } from '@/features/live'

/**
 * `/app/projects/:id/live` — "See by yourself".
 *
 * Thin on purpose: find the project, own the head, hand everything else to the
 * feature. The router is wired elsewhere; this file only exports the component.
 *
 * Projects live in `localStorage` under the frozen `framespace.projects.v1`
 * key. With no `:id` — or an id that no longer resolves, which happens when
 * the 12-project cap has evicted it — the most recent project is opened
 * instead of erroring, because the person pressing this button is standing in
 * a room holding a phone up and wants to see something.
 */
export function Live() {
  const { t } = useTranslation()
  const params = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<LiveProject[] | null>(null)

  useEffect(() => {
    // Reading is synchronous but can throw in private mode; `loadProjects`
    // already swallows that and returns [].
    setProjects(loadProjects() as LiveProject[])
  }, [])

  const project = useMemo(() => {
    if (!projects) return null
    if (params.id) {
      const match = projects.find((p) => p.id === params.id)
      if (match) return match
    }
    return projects[0] ?? null
  }, [projects, params.id])

  const projectId = project?.id ?? params.id ?? 'unsaved'

  // Back only when there is an in-app page to go back to. Opened from a QR
  // code or a shared link, `navigate(-1)` would leave the site entirely.
  const exit = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(project?.id ? `/app/projects/${project.id}` : '/app', { replace: true })
  }

  return (
    <>
      <Seo
        title={t('live.meta.title')}
        description={t('live.meta.description')}
        path={params.id ? `/app/projects/${params.id}/live` : '/app/live'}
        noindex
      />

      {/* `projects === null` is the one tick before localStorage is read. The
          feature's own "no renders" state would flash in that tick, so hold. */}
      {projects === null ? null : (
        <LiveExperience
          project={project}
          projectId={projectId}
          onExit={exit}
          onCapture={() => navigate('/app/capture')}
        />
      )}
    </>
  )
}

export default Live
