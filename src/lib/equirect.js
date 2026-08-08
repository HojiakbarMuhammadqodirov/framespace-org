// Turns the four flat renders into one equirectangular panorama.
//
// This is an approximation, and worth being honest about: the renders are
// perspective photographs of four walls, not a true spherical capture. Each one
// is placed into the 90° sector of the sphere it was shot from, cross-faded
// into its neighbours, with the ceiling and floor filled from the colours at
// the top and bottom of each image. The result reads convincingly as "standing
// in the room and turning around" without pretending to be photogrammetry.

const WIDTH = 4096
const HEIGHT = 2048
const HORIZON_TOP = 0.17 // where the wall band starts, as a fraction of height
const HORIZON_BOTTOM = 0.85 // and where it ends
const OVERLAP = 0.16 // sector overlap used for the cross-fade

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load a render.'))
    img.src = src
  })
}

// Average colour of the top and bottom strips of an image, used to fill the
// ceiling and floor so the sphere has no visible seam at the poles.
function edgeColours(img) {
  const s = 8
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, s, s)
  const { data } = ctx.getImageData(0, 0, s, s)

  const avg = (fromRow, toRow) => {
    let r = 0
    let g = 0
    let b = 0
    let n = 0
    for (let y = fromRow; y < toRow; y++) {
      for (let x = 0; x < s; x++) {
        const i = (y * s + x) * 4
        r += data[i]
        g += data[i + 1]
        b += data[i + 2]
        n++
      }
    }
    return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`
  }

  return { top: avg(0, 2), bottom: avg(s - 2, s) }
}

// Cover-fit: fill the target rect completely, cropping the overflow.
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

// One sector, rendered into its own canvas with soft left/right edges so it
// cross-fades into whatever was drawn before it.
function featheredSector(img, w, h) {
  const c = document.createElement('canvas')
  c.width = Math.round(w)
  c.height = h
  const ctx = c.getContext('2d')

  const bandTop = h * HORIZON_TOP
  const bandHeight = h * (HORIZON_BOTTOM - HORIZON_TOP)
  const { top, bottom } = edgeColours(img)

  const sky = ctx.createLinearGradient(0, 0, 0, bandTop)
  sky.addColorStop(0, top)
  sky.addColorStop(1, top)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, c.width, bandTop + 2)

  ctx.fillStyle = bottom
  ctx.fillRect(0, bandTop + bandHeight - 2, c.width, h - bandTop - bandHeight + 2)

  drawCover(ctx, img, 0, bandTop, c.width, bandHeight)

  // Alpha ramp in from both edges.
  const fade = c.width * 0.14
  const mask = ctx.createLinearGradient(0, 0, c.width, 0)
  mask.addColorStop(0, 'rgba(0,0,0,0)')
  mask.addColorStop(fade / c.width, 'rgba(0,0,0,1)')
  mask.addColorStop(1 - fade / c.width, 'rgba(0,0,0,1)')
  mask.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = mask
  ctx.fillRect(0, 0, c.width, h)

  return c
}

/**
 * @param {Array<{angleId:string, image:string}>} renders
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function buildEquirect(renders) {
  const images = await Promise.all(renders.map((r) => loadImage(r.image)))
  if (!images.length) throw new Error('No renders to build a panorama from.')

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')

  // Base fill so nothing is ever transparent, even if a sector fails.
  const base = edgeColours(images[0])
  const backdrop = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  backdrop.addColorStop(0, base.top)
  backdrop.addColorStop(HORIZON_TOP, base.top)
  backdrop.addColorStop(HORIZON_BOTTOM, base.bottom)
  backdrop.addColorStop(1, base.bottom)
  ctx.fillStyle = backdrop
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const n = images.length
  const sectorW = WIDTH / n
  const drawW = sectorW * (1 + OVERLAP)

  images.forEach((img, i) => {
    const sector = featheredSector(img, drawW, HEIGHT)
    const x = i * sectorW - (drawW - sectorW) / 2
    ctx.drawImage(sector, x, 0)
    // Wrap the sectors that straddle the seam at 0°/360°.
    if (x < 0) ctx.drawImage(sector, x + WIDTH, 0)
    if (x + drawW > WIDTH) ctx.drawImage(sector, x - WIDTH, 0)
  })

  return canvas
}
