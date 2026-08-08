async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`)
  return payload
}

export async function getHealth() {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) throw new Error()
    return await res.json()
  } catch {
    return { ok: false, demoMode: true, providers: { claude: false, gemini: false } }
  }
}

/**
 * @param {object} project
 * @param {Record<string,{base64:string,mediaType:string}>} project.captures keyed by angleId
 */
export function requestRender({ captures, style, budget, notes }) {
  const photos = Object.entries(captures).map(([angleId, capture]) => ({
    angleId,
    data: capture.base64,
    mediaType: capture.mediaType,
  }))
  return post('/api/render', { photos, style, budget, notes })
}

export function sendContact(payload) {
  return post('/api/contact', payload)
}
