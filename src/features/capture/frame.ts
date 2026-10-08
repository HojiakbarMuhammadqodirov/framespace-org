/**
 * Pixel helpers that are *not* the API compression path.
 *
 * `prepareCapture()` in `src/lib/image.js` owns everything that gets sent to
 * `/api/render` (1280px, JPEG q0.85, tuned to the 30 MB body limit) and is used
 * unchanged. The two functions here serve different jobs: pulling a still out
 * of the live `<video>` so `prepareCapture()` has a file to work on, and making
 * a much smaller copy so a finished project still fits in localStorage.
 */

/** Pull the current video frame out as a JPEG blob plus the canvas it drew on. */
export async function grabFrame(
  video: HTMLVideoElement
): Promise<{ blob: Blob; canvas: HTMLCanvasElement }> {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) throw new Error('camera-not-ready')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas-unavailable')
  ctx.drawImage(video, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.92)
  })
  if (!blob) throw new Error('frame-encode-failed')
  return { blob, canvas }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image-decode-failed'))
    img.src = src
  })
}

/**
 * A storage-sized copy of a capture. Renders come back as full data URLs and
 * the originals are another few megabytes on top; localStorage gives us about
 * five. The "before" half of the before/after wipe does not need 1280px.
 */
export async function shrinkForStorage(dataUrl: string, edge = 640, quality = 0.7) {
  try {
    const img = await loadImage(dataUrl)
    const scale = Math.min(1, edge / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return dataUrl
  }
}

/** Trigger a download of a data URL without leaving the page. */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/** `data:image/jpeg;base64,...` → `image/jpeg`. Falls back to PNG, the API's format. */
export function mimeOf(dataUrl: string): string {
  const match = /^data:([^;,]+)[;,]/.exec(dataUrl)
  return match ? match[1] : 'image/png'
}

/** File extension for a data URL, read from its MIME type rather than assumed. */
export function extensionOf(dataUrl: string): string {
  const sub = mimeOf(dataUrl).split('/')[1] || 'png'
  if (sub === 'jpeg') return 'jpg'
  if (sub === 'svg+xml') return 'svg'
  return sub.replace(/[^a-z0-9]/gi, '') || 'png'
}

/** A data URL as a `File`, for the Web Share API's `files` field. */
export async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob()
  return new File([blob], name, { type: blob.type || mimeOf(dataUrl) })
}
