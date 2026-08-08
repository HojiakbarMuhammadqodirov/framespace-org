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
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file is not a readable image.'))
    img.src = src
  })
}

/**
 * @returns {Promise<{dataUrl:string, base64:string, mediaType:string, width:number, height:number}>}
 */
export async function prepareCapture(file) {
  const original = await readFileAsDataUrl(file)
  const img = await loadImage(original)

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
  const width = Math.round(img.width * scale)
  const height = Math.round(img.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
  return {
    dataUrl,
    base64: dataUrl.split(',')[1],
    mediaType: 'image/jpeg',
    width,
    height,
  }
}
