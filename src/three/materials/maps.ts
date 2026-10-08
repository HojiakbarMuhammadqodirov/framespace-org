import * as THREE from 'three'

/**
 * Colour-bearing canvas maps (sRGB). Each is a near-white greyscale pattern
 * that the material's own `color` multiplies, so palette cross-fades keep
 * working: lerp the colour, and the figure rides along.
 *
 * Canvases are drawn once per page and cached; every call returns a fresh
 * (cheap) `CanvasTexture` wrapper that the caller owns and disposes.
 */

function makeCanvas(w: number, h: number) {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  return { canvas, ctx }
}

let blank: HTMLCanvasElement | null = null
function blankCanvas(): HTMLCanvasElement {
  if (blank) return blank
  const made = makeCanvas(4, 4)
  if (made) {
    made.ctx.fillStyle = '#fff'
    made.ctx.fillRect(0, 0, 4, 4)
    blank = made.canvas
    return blank
  }
  blank = document.createElement('canvas')
  return blank
}

/** Deterministic PRNG so every visitor sees the same grain and the same rug. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function colorTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1, wrap = true) {
  const t = new THREE.CanvasTexture(canvas)
  if (wrap) {
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeatX, repeatY)
  }
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

/* -------------------------------------------------------------- wood figure */

let woodFigure: HTMLCanvasElement | null | undefined

/** Flat-sawn figure: warped growth rings and fine pores. Runs along X. */
function buildWoodFigure(): HTMLCanvasElement | null {
  const S = 256
  const made = makeCanvas(S, S)
  if (!made) return null
  const { canvas, ctx } = made
  const rand = rng(7)
  ctx.fillStyle = 'rgb(238,238,238)'
  ctx.fillRect(0, 0, S, S)
  for (let i = 0; i < 52; i += 1) {
    const y0 = rand() * S
    const amp = 1.5 + rand() * 6
    // Whole periods across the tile so the texture wraps without a seam.
    const k = 1 + Math.floor(rand() * 3)
    const freq = (Math.PI * 2 * k) / S
    const phase = rand() * Math.PI * 2
    const v = Math.round(192 + rand() * 38)
    ctx.strokeStyle = `rgba(${v},${v - 5},${v - 12},${0.3 + rand() * 0.45})`
    ctx.lineWidth = 0.6 + rand() * 2.4
    for (const wrapY of [0, -S, S]) {
      ctx.beginPath()
      for (let x = 0; x <= S; x += 4) {
        const y = wrapY + y0 + Math.sin(x * freq + phase) * amp
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }
  for (let i = 0; i < 1600; i += 1) {
    const v = Math.round(168 + rand() * 50)
    ctx.fillStyle = `rgba(${v},${v - 6},${v - 12},0.32)`
    ctx.fillRect(rand() * S, rand() * S, 1 + rand() * 5, 0.8)
  }
  return canvas
}

export function getWoodFigureMap(repeatX = 1, repeatY = 1): THREE.Texture {
  if (woodFigure === undefined) woodFigure = buildWoodFigure()
  return colorTexture(woodFigure ?? blankCanvas(), repeatX, repeatY)
}

/* --------------------------------------------------------------------- rug */

export type RugPattern = 'border' | 'medallion' | 'stripe' | 'plain'

const rugCanvases: Partial<Record<RugPattern, HTMLCanvasElement | null>> = {}

/** Hand-knotted rug field in greys over near-white, so the finish tints it. */
function buildRug(pattern: RugPattern): HTMLCanvasElement | null {
  const W = 512
  const H = 360
  const made = makeCanvas(W, H)
  if (!made) return null
  const { canvas, ctx } = made
  const rand = rng(pattern.length * 31 + 3)
  const tone = (v: number, a = 1) => `rgba(${v},${v},${v},${a})`
  ctx.fillStyle = tone(242)
  ctx.fillRect(0, 0, W, H)

  if (pattern !== 'plain') {
    ctx.fillStyle = tone(pattern === 'stripe' ? 214 : 168)
    ctx.fillRect(0, 0, W, 26)
    ctx.fillRect(0, H - 26, W, 26)
    ctx.fillRect(0, 0, 26, H)
    ctx.fillRect(W - 26, 0, 26, H)
    ctx.strokeStyle = tone(122)
    ctx.lineWidth = 3
    ctx.strokeRect(36, 36, W - 72, H - 72)
    ctx.fillStyle = tone(208)
    const diamond = (x: number, y: number) => {
      ctx.beginPath()
      ctx.moveTo(x, y - 7)
      ctx.lineTo(x + 7, y)
      ctx.lineTo(x, y + 7)
      ctx.lineTo(x - 7, y)
      ctx.fill()
    }
    for (let x = 14; x < W; x += 22) {
      diamond(x, 13)
      diamond(x, H - 13)
    }
    for (let y = 35; y < H - 20; y += 22) {
      diamond(13, y)
      diamond(W - 13, y)
    }
  }

  if (pattern === 'medallion' || pattern === 'border') {
    const strong = pattern === 'medallion'
    const cx = W / 2
    const cy = H / 2
    const lozenge = (x: number, y: number, rx: number, ry: number, v: number) => {
      ctx.fillStyle = tone(v)
      ctx.beginPath()
      ctx.moveTo(x, y - ry)
      ctx.lineTo(x + rx, y)
      ctx.lineTo(x, y + ry)
      ctx.lineTo(x - rx, y)
      ctx.closePath()
      ctx.fill()
    }
    lozenge(cx, cy, 120, 92, strong ? 150 : 212)
    lozenge(cx, cy, 92, 70, strong ? 230 : 236)
    lozenge(cx, cy, 58, 44, strong ? 128 : 196)
    lozenge(cx, cy, 22, 17, 238)
    for (const s of [-1, 1]) {
      lozenge(cx + s * 178, cy, 40, 52, strong ? 172 : 214)
      lozenge(cx + s * 178, cy, 15, 21, 238)
    }
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        ctx.fillStyle = tone(strong ? 186 : 222)
        ctx.beginPath()
        ctx.moveTo(cx + sx * (W / 2 - 44), cy + sy * (H / 2 - 44))
        ctx.lineTo(cx + sx * (W / 2 - 124), cy + sy * (H / 2 - 44))
        ctx.lineTo(cx + sx * (W / 2 - 44), cy + sy * (H / 2 - 110))
        ctx.closePath()
        ctx.fill()
      }
    }
  } else if (pattern === 'stripe') {
    for (let x = 60; x < W - 60; x += 28) {
      ctx.fillStyle = tone(Math.round(200 + rand() * 30))
      ctx.fillRect(x, 44, 8 + rand() * 6, H - 88)
    }
  }

  // Abrash (slow wool-dye drift) and pile speckle.
  for (let i = 0; i < 18; i += 1) {
    ctx.fillStyle = tone(Math.round(200 + rand() * 40), 0.07)
    ctx.fillRect(0, rand() * H, W, 6 + rand() * 18)
  }
  for (let i = 0; i < 9000; i += 1) {
    ctx.fillStyle = tone(Math.round(150 + rand() * 105), 0.16)
    ctx.fillRect(rand() * W, rand() * H, 1, 1)
  }
  return canvas
}

export function getRugPatternMap(pattern: RugPattern = 'border'): THREE.Texture {
  if (!(pattern in rugCanvases)) rugCanvases[pattern] = buildRug(pattern)
  return colorTexture(rugCanvases[pattern] ?? blankCanvas(), 1, 1, false)
}

const motifCanvases: Partial<Record<RugPattern, HTMLCanvasElement | null>> = {}

/**
 * The same rug drawing inverted into an alpha mask: field = 0, motif = 1.
 * Lets a second, coloured layer paint the motif in its own colour (cream on
 * a red Uzbek rug) while the base stays tintable.
 */
export function getRugMotifMask(pattern: RugPattern = 'border'): THREE.Texture {
  if (!(pattern in motifCanvases)) {
    if (!(pattern in rugCanvases)) rugCanvases[pattern] = buildRug(pattern)
    const src = rugCanvases[pattern]
    let out: HTMLCanvasElement | null = null
    if (src) {
      const made = makeCanvas(src.width, src.height)
      if (made) {
        made.ctx.drawImage(src, 0, 0)
        const img = made.ctx.getImageData(0, 0, src.width, src.height)
        const px = img.data
        for (let i = 0; i < px.length; i += 4) {
          const v = THREE.MathUtils.clamp((236 - px[i]) / 100, 0, 1) * 255
          px[i] = v
          px[i + 1] = v
          px[i + 2] = v
          px[i + 3] = 255
        }
        made.ctx.putImageData(img, 0, 0)
        out = made.canvas
      }
    }
    motifCanvases[pattern] = out
  }
  const t = new THREE.CanvasTexture(motifCanvases[pattern] ?? blankCanvas())
  t.colorSpace = THREE.NoColorSpace
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

/* --------------------------------------------------------------------- art */

let artCanvas: HTMLCanvasElement | null | undefined

/** A quiet abstract print — arches, a sun, a horizon line — tinted by the
 * art colour so it belongs to whichever room style it hangs in. */
function buildArt(): HTMLCanvasElement | null {
  const W = 256
  const H = 340
  const made = makeCanvas(W, H)
  if (!made) return null
  const { canvas, ctx } = made
  ctx.fillStyle = 'rgb(250,248,244)'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgb(216,208,198)'
  ctx.beginPath()
  ctx.moveTo(30, H - 40)
  ctx.lineTo(30, 150)
  ctx.arc(110, 150, 80, Math.PI, 0)
  ctx.lineTo(190, H - 40)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgb(178,152,130)'
  ctx.beginPath()
  ctx.arc(172, 112, 40, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgb(118,102,90)'
  ctx.beginPath()
  ctx.moveTo(92, H - 40)
  ctx.lineTo(92, 222)
  ctx.arc(152, 222, 60, Math.PI, 0)
  ctx.lineTo(212, H - 40)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgb(58,50,44)'
  ctx.fillRect(30, H - 46, 196, 4)
  const rand = rng(11)
  for (let i = 0; i < 3000; i += 1) {
    const v = Math.round(200 + rand() * 55)
    ctx.fillStyle = `rgba(${v},${v},${v},0.08)`
    ctx.fillRect(rand() * W, rand() * H, 1, 1)
  }
  return canvas
}

export function getArtPrintMap(): THREE.Texture {
  if (artCanvas === undefined) artCanvas = buildArt()
  return colorTexture(artCanvas ?? blankCanvas(), 1, 1, false)
}

/* ------------------------------------------------------------- disposal */

const MAP_SLOTS = [
  'map',
  'roughnessMap',
  'bumpMap',
  'normalMap',
  'metalnessMap',
  'alphaMap',
  'aoMap',
  'emissiveMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'clearcoatMap',
] as const

/** Disposes a material and every texture slot it may carry. */
export function disposeMaterialDeep(material: THREE.Material) {
  const m = material as unknown as Record<string, unknown>
  for (const key of MAP_SLOTS) {
    const tex = m[key] as THREE.Texture | null | undefined
    if (tex && tex.isTexture) tex.dispose()
  }
  material.dispose()
}
