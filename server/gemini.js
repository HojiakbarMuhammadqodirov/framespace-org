// Gemini does the seeing half: it takes one real photograph of the room plus
// the prompt Claude wrote for that exact camera position, and returns the same
// room restyled — same walls, same windows, same perspective, new everything
// else. For 3D builder scenes there is no photograph, so it generates from the
// scene description instead (text-to-image).

import { GoogleGenAI } from '@google/genai'
import { withRetry, withTimeout } from './lib/retry.js'

export const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview'
const MODEL = GEMINI_MODEL
const ATTEMPT_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS ?? 120_000)
const RETRIES = Number(process.env.GEMINI_MAX_RETRIES ?? 2)

let client = null
function getClient() {
  if (!process.env.GEMINI_API_KEY) return null
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return client
}

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY)
}

// Appended to every prompt Claude writes. These are the constraints that make
// the output read as "your room, redecorated" instead of "a room".
const GEOMETRY_GUARD = [
  'This is a photograph of a real room being redecorated.',
  'Keep the camera position, lens perspective, and framing exactly as they are.',
  'Keep the room geometry unchanged: wall positions, ceiling height, and the size and position of every window and door.',
  'Keep the direction and quality of the daylight consistent with the original photograph.',
  'Do not add windows, doors, or walls that are not in the photograph.',
  'Photorealistic interior photography, natural depth of field, no text, no watermark, no people.',
].join(' ')

const SCENE_GUARD = [
  'Render exactly the room described: its proportions, the openings on the wall ahead, and only the furniture listed, where it is listed.',
  'Photorealistic interior photography, 4:3 landscape, natural depth of field, no text, no watermark, no people.',
].join(' ')

function findImagePart(response) {
  const parts = response?.candidates?.[0]?.content?.parts || []
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data
    if (inline?.data) {
      return {
        data: inline.data,
        mediaType: inline.mimeType || inline.mime_type || 'image/png',
      }
    }
  }
  return null
}

async function generateOnce({ ai, parts, config, label }) {
  const response = await withRetry(
    () =>
      withTimeout(
        ai.models.generateContent({
          model: MODEL,
          contents: [{ role: 'user', parts }],
          ...(config ? { config } : {}),
        }),
        ATTEMPT_TIMEOUT_MS,
        label
      ),
    { retries: RETRIES, label }
  )
  return findImagePart(response)
}

async function generateImage(parts, label) {
  const ai = getClient()
  if (!ai) throw new Error('GEMINI_API_KEY is not set')

  let image = await generateOnce({ ai, parts, label })
  // Some image model versions only emit an image when the modality is asked
  // for explicitly. Retry once that way before giving up.
  if (!image) {
    image = await generateOnce({ ai, parts, label, config: { responseModalities: ['TEXT', 'IMAGE'] } })
  }
  if (!image) throw new Error('Gemini returned no image for this angle.')
  return image
}

/**
 * Restyle one photograph.
 * @returns {Promise<{data:string, mediaType:string}>} base64 image
 */
export function renderAngle({ photo, prompt, angleId = 'angle' }) {
  return generateImage(
    [
      { inlineData: { mimeType: photo.mediaType || 'image/jpeg', data: photo.data } },
      { text: `${prompt}\n\n${GEOMETRY_GUARD}` },
    ],
    `gemini:${angleId}`
  )
}

/** Generate one view of a 3D builder scene from text alone. */
export function renderSceneView({ prompt, angleId = 'view' }) {
  return generateImage([{ text: `${prompt}\n\n${SCENE_GUARD}` }], `gemini-scene:${angleId}`)
}

async function settleAll(jobs, run) {
  const settled = await Promise.allSettled(
    jobs.map(async (job) => {
      const image = await run(job)
      return {
        angleId: job.angleId,
        angleLabel: job.angleLabel,
        prompt: job.prompt,
        image: `data:${image.mediaType};base64,${image.data}`,
      }
    })
  )
  const renders = []
  const failures = []
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') renders.push(result.value)
    else {
      console.warn(`[gemini] ${jobs[i].angleId} failed:`, result.reason?.message || result.reason)
      failures.push({ angleId: jobs[i].angleId, error: publicMessage(result.reason) })
    }
  })
  return { renders, failures }
}

/** Provider errors can carry raw JSON payloads; keep what reaches users short. */
function publicMessage(err) {
  const status = Number(err?.status || 0)
  if (status === 429) return 'The image service is busy right now.'
  if (status === 504 || /timed out/i.test(err?.message || '')) return 'The image took too long to generate.'
  if (status >= 500) return 'The image service had a problem.'
  let msg = String(err?.message || err || 'Image generation failed.')
  try {
    msg = JSON.parse(msg)?.error?.message || msg
  } catch {
    // not a JSON payload
  }
  if (status === 401 || status === 403 || /api key/i.test(msg)) return 'The image service is not configured correctly.'
  return msg.length > 200 ? `${msg.slice(0, 197)}...` : msg
}

/**
 * Restyle every angle in parallel. A failure on one angle does not lose the
 * others; it is reported in `failures`.
 */
export function renderAll({ jobs }) {
  return settleAll(jobs, (job) => renderAngle({ photo: job.photo, prompt: job.prompt, angleId: job.angleId }))
}

export function renderSceneAll({ jobs }) {
  return settleAll(jobs, (job) => renderSceneView({ prompt: job.prompt, angleId: job.angleId }))
}
