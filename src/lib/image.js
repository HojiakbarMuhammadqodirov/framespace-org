// Phone cameras hand back 12-megapixel JPEGs. Sending six of those as base64
// would be ~40MB of request body and would slow the model down for no gain, so
// every capture is downscaled and re-encoded before it leaves the device.

const MAX_EDGE = 1280
const QUALITY = 0.85

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file is not a readable image.'))
    img.src = src
  })
}

/** HEIC/HEIF — the iPhone default. Only Safari can decode it. */
export function isHeic(file) {
  const type = (file && file.type ? file.type : '').toLowerCase()
  const name = (file && file.name ? file.name : '').toLowerCase()
  return /hei[cf]/.test(type) || /\.hei[cf]$/.test(name)
}

/**
 * Decode a Blob into something drawable. An object URL avoids holding a
 * second base64 copy of a 10 MB original in memory; `createImageBitmap` is
 * tried as a fallback for formats `<img>` refuses.
 */
async function decode(file) {
  const url = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : null
  try {
    if (url) return await loadImage(url)
    return await loadImage(await readFileAsDataUrl(file))
  } catch (err) {
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(file)
      } catch {
        // fall through
      }
    }
    if (isHeic(file)) {
      const heic = new Error('heic')
      heic.name = 'HeicError'
      throw heic
    }
    throw err
  } finally {
    // The pixels are decoded once onload fires; the URL is no longer needed.
    if (url) setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/**
 * @returns {Promise<{dataUrl:string, base64:string, mediaType:string, width:number, height:number}>}
 */
export async function prepareCapture(file) {
  const img = await decode(file)
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  if (!srcW || !srcH) throw new Error('That file is not a readable image.')

  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH))
  const width = Math.max(1, Math.round(srcW * scale))
  const height = Math.max(1, Math.round(srcH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable.')
  // Transparent PNGs would otherwise turn black in the JPEG.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)
  if (typeof img.close === 'function') img.close()

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
  return {
    dataUrl,
    base64: dataUrl.split(',')[1],
    mediaType: 'image/jpeg',
    width,
    height,
  }
}
