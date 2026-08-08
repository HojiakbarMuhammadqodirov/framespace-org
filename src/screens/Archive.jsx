import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { TrashIcon, CameraIcon, ChevronIcon } from '../components/Icons.jsx'
import { loadProjects, deleteProject } from '../lib/storage.js'
import { formatMoney } from '../lib/styles.js'

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

export default function Archive({ onOpen, onStartScan }) {
  const [projects, setProjects] = useState(() => loadProjects())

  function remove(id) {
    deleteProject(id)
    setProjects(loadProjects())
  }

  return (
    <div className="screen">
      <PageHeader
        eyebrow="Archive"
        title="Rooms you've designed"
        subtitle={
          projects.length
            ? 'Saved on this device. Open one to see its renders and shopping list again.'
            : undefined
        }
      />

      <div className="mx-auto max-w-lg px-5 pt-5">
        {projects.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-ink-3 text-muted">
              <CameraIcon />
            </span>
            <p className="display text-[20px]">Nothing here yet</p>
            <p className="mt-2 max-w-[28ch] text-[13px] leading-relaxed text-muted">
              Scan a room and its renders, palette and costed furniture list will be kept here.
            </p>
            <button type="button" onClick={onStartScan} className="btn btn-primary mt-6">
              Scan a room
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {projects.map((project) => {
              const cover = project.renders?.[0]?.image
              const total = project.brief?.budget?.estimatedTotal
              const currency = project.brief?.budget?.currency || 'USD'
              return (
                <li key={project.id} className="card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => onOpen(project)}
                    className="flex w-full items-center gap-4 p-3 text-left"
                  >
                    <div className="h-[68px] w-[88px] shrink-0 overflow-hidden rounded-xl bg-ink-3">
                      {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold leading-tight">{project.style}</p>
                      <p className="mt-1 text-[12px] text-muted">
                        {formatDate(project.savedAt)} · {project.renders?.length || 0} renders
                      </p>
                      {total != null && (
                        <p className="mt-1 text-[12.5px] tabular-nums text-clay-soft">
                          {formatMoney(total, currency)} of furniture
                        </p>
                      )}
                    </div>
                    <ChevronIcon className="shrink-0 text-muted" />
                  </button>
                  <div className="flex justify-end border-t border-line px-3 py-2">
                    <button
                      type="button"
                      onClick={() => remove(project.id)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] text-muted transition-colors active:text-clay-soft"
                    >
                      <TrashIcon width={15} height={15} />
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
