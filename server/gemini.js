// Gemini does the seeing half: it takes one real photograph of the room plus
// the prompt Claude wrote for that exact camera position, and returns the same
// room restyled — same walls, same windows, same perspective, new everything
// else.

import { GoogleGenAI } from '@google/genai'

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview'

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

async function generateOnce({ ai, photo, prompt, config }) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: photo.mediaType || 'image/jpeg', data: photo.data } },
          { text: `${prompt}\n\n${GEOMETRY_GUARD}` },
        ],
      },
    ],
    ...(config ? { config } : {}),
  })
  return findImagePart(response)
}

/**
 * Restyle one photograph.
 * @returns {Promise<{data:string, mediaType:string}>} base64 image
 */
export async function renderAngle({ photo, prompt }) {
  const ai = getClient()
  if (!ai) throw new Error('GEMINI_API_KEY is not set')

  let image = await generateOnce({ ai, photo, prompt })

  // Some image model versions only emit an image when the modality is asked
  // for explicitly. Retry once that way before giving up.
  if (!image) {
    image = await generateOnce({
      ai,
      photo,
      prompt,
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    })
  }

  if (!image) throw new Error('Gemini returned no image for this angle.')
  return image
}

/**
 * Restyle every angle. Runs them in parallel — four requests is well inside
 * normal rate limits and it cuts the wait from ~2 minutes to ~30 seconds.
 * A failure on one angle does not lose the others.
 */
export async function renderAll({ jobs }) {
  const settled = await Promise.allSettled(
    jobs.map(async (job) => {
      const image = await renderAngle({ photo: job.photo, prompt: job.prompt })
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
    else failures.push({ angleId: jobs[i].angleId, error: String(result.reason?.message || result.reason) })
  })
  return { renders, failures }
}
