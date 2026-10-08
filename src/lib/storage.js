// The Archive tab. Finished projects live in localStorage so they survive a
// refresh without needing an account. Renders are stored as data URLs, which
// is heavy — hence the cap and the eviction of the oldest entry when the quota
// bites.

const KEY = 'framespace.projects.v1'
const MAX_PROJECTS = 12

export function loadProjects() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p === 'object') : []
  } catch {
    return []
  }
}

function write(projects) {
  localStorage.setItem(KEY, JSON.stringify(projects))
}

export function saveProject(project) {
  const projects = loadProjects()
  const entry = {
    id: project.id || `proj_${Date.now()}`,
    savedAt: new Date().toISOString(),
    style: project.style,
    notes: project.notes,
    budget: project.budget,
    brief: project.brief,
    renders: project.renders,
  }

  const next = [entry, ...projects.filter((p) => p.id !== entry.id)].slice(0, MAX_PROJECTS)

  // Data URLs are big. If we blow the quota, drop the oldest entries until it
  // fits rather than silently losing the save the user just made.
  let attempt = [...next]
  while (attempt.length) {
    try {
      write(attempt)
      return entry
    } catch {
      attempt = attempt.slice(0, -1)
    }
  }
  throw new Error('This project is too large to store on the device.')
}

export function deleteProject(id) {
  try {
    write(loadProjects().filter((p) => p.id !== id))
  } catch {
    // Storage blocked: nothing was written there either.
  }
}

export function clearProjects() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Storage blocked.
  }
}
