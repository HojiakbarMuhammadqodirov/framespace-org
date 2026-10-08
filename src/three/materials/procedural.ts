import * as THREE from 'three'

/**
 * Tiny canvas-generated roughness maps — no downloads, this repo ships no
 * texture assets and none are fetched.
 *
 * Each pattern is drawn to an offscreen `<canvas>` exactly once and cached
 * module-wide (`build*Canvas`); every call after that reuses the same pixels.
 * What IS created per call is a small `THREE.CanvasTexture` wrapper
 * (`make*Map`), because two consumers rarely want the same `repeat` — a wall
 * of wood flooring and a chair leg need very different tiling from the same
 * grain. That wrapper is cheap (one GPU upload of a ~96px greyscale image,
 * done once at material-creation time, never per frame) and is meant to be
 * disposed by the caller when its owning material set is replaced, exactly
 * like the geometries and materials it sits next to.
 */

const SIZE = 96

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  return { canvas, ctx }
}

let woodCanvas: HTMLCanvasElement | null | undefined
let fabricCanvas: HTMLCanvasElement | null | undefined
let metalCanvas: HTMLCanvasElement | null | undefined

/** Horizontal grain streaks + a few darker rays: reads as wood grain when
 * tiled long-ways down a plank. */
function buildWoodCanvas(): HTMLCanvasElement | null {
  const made = makeCanvas()
  if (!made) return null
  const { canvas, ctx } = made
  ctx.fillStyle = 'rgb(150,150,150)'
  ctx.fillRect(0, 0, SIZE, SIZE)
  for (let y = 0; y < SIZE; y += 1) {
    const band = Math.sin(y * 0.4) * 14 + Math.sin(y * 1.7) * 6 + (Math.random() - 0.5) * 10
    const v = Math.max(0, Math.min(255, 150 + band))
    ctx.fillStyle = `rgba(${v},${v},${v},0.55)`
    ctx.fillRect(0, y, SIZE, 1)
  }
  for (let i = 0; i < 40; i += 1) {
    const y = Math.random() * SIZE
    const h = 0.4 + Math.random() * 1.1
    const v = 150 + (Math.random() - 0.5) * 60
    ctx.fillStyle = `rgba(${v},${v},${v},0.3)`
    ctx.fillRect(0, y, SIZE, h)
  }
  return canvas
}

/** Fine crosshatch + speckle: reads as a woven upholstery/rug surface. */
function buildFabricCanvas(): HTMLCanvasElement | null {
  const made = makeCanvas()
  if (!made) return null
  const { canvas, ctx } = made
  ctx.fillStyle = 'rgb(165,165,165)'
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.lineWidth = 1
  const pitch = 3
  for (let x = 0; x <= SIZE; x += pitch) {
    const v = 150 + (Math.random() - 0.5) * 30
    ctx.strokeStyle = `rgba(${v},${v},${v},0.35)`
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, SIZE)
    ctx.stroke()
  }
  for (let y = 0; y <= SIZE; y += pitch) {
    const v = 150 + (Math.random() - 0.5) * 30
    ctx.strokeStyle = `rgba(${v},${v},${v},0.35)`
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(SIZE, y)
    ctx.stroke()
  }
  for (let i = 0; i < 500; i += 1) {
    const v = 150 + (Math.random() - 0.5) * 50
    ctx.fillStyle = `rgba(${v},${v},${v},0.2)`
    ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1, 1)
  }
  return canvas
}

/** Sparse directional scratches over a mid grey: reads as brushed metal. */
function buildMetalCanvas(): HTMLCanvasElement | null {
  const made = makeCanvas()
  if (!made) return null
  const { canvas, ctx } = made
  ctx.fillStyle = 'rgb(205,205,205)'
  ctx.fillRect(0, 0, SIZE, SIZE)
  for (let i = 0; i < 70; i += 1) {
    const y = Math.random() * SIZE
    const len = 8 + Math.random() * SIZE * 0.6
    const x0 = Math.random() * SIZE
    const v = 205 + (Math.random() - 0.5) * 70
    ctx.strokeStyle = `rgba(${v},${v},${v},0.25)`
    ctx.lineWidth = 0.6 + Math.random() * 0.8
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.lineTo(x0 + len, y + (Math.random() - 0.5) * 3)
    ctx.stroke()
  }
  return canvas
}

function wrapTexture(canvas: HTMLCanvasElement, repeatX: number, repeatY: number): THREE.Texture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  // Roughness data is not colour: keep it out of the sRGB pipeline.
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

/** Fallback: a 1x1 neutral-grey texture so callers never have to null-check
 * on the server or in a browser with no canvas 2D context. */
let blankCanvas: HTMLCanvasElement | null | undefined
function getBlankCanvas(): HTMLCanvasElement {
  if (blankCanvas) return blankCanvas
  const made = makeCanvas()
  if (made) {
    made.ctx.fillStyle = 'rgb(190,190,190)'
    made.ctx.fillRect(0, 0, SIZE, SIZE)
    blankCanvas = made.canvas
  } else {
    // Only reachable outside a DOM environment (SSR/tests); callers still
    // get a valid, disposable Texture.
    blankCanvas = document.createElement('canvas')
  }
  return blankCanvas
}

export function getWoodGrainMap(repeatX = 2, repeatY = 1): THREE.Texture {
  if (woodCanvas === undefined) woodCanvas = buildWoodCanvas()
  return wrapTexture(woodCanvas ?? getBlankCanvas(), repeatX, repeatY)
}

export function getFabricWeaveMap(repeatX = 3, repeatY = 3): THREE.Texture {
  if (fabricCanvas === undefined) fabricCanvas = buildFabricCanvas()
  return wrapTexture(fabricCanvas ?? getBlankCanvas(), repeatX, repeatY)
}

export function getMetalScratchMap(repeatX = 2, repeatY = 2): THREE.Texture {
  if (metalCanvas === undefined) metalCanvas = buildMetalCanvas()
  return wrapTexture(metalCanvas ?? getBlankCanvas(), repeatX, repeatY)
}

/** A warm-white radial sprite for additive point systems (dust motes) and
 * soft glow billboards. Cached the same way as the roughness canvases. */
let glowCanvas: HTMLCanvasElement | null | undefined
export function getGlowSpriteTexture(): THREE.Texture | null {
  if (glowCanvas === undefined) {
    const made = typeof document !== 'undefined' ? makeCanvas() : null
    if (made) {
      const { canvas, ctx } = made
      const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.4, 'rgba(255,255,255,0.5)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, SIZE, SIZE)
      glowCanvas = canvas
    } else {
      glowCanvas = null
    }
  }
  if (!glowCanvas) return null
  const texture = new THREE.CanvasTexture(glowCanvas)
  // Colour-bearing sprite: sRGB, like every map that ends up on screen.
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
