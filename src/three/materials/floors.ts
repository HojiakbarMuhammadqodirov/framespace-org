/**
 * Floor coverings, drawn rather than downloaded.
 *
 * Each covering is painted once to a canvas — a colour map and a matching
 * height map — and cached, so choosing "walnut" costs one texture upload the
 * first time and nothing after. The floor plate's UVs are in metres, so every
 * texture declares how many metres one tile of it covers and the repeat falls
 * out of that: a plank is the width of a plank whatever the room's size.
 *
 * The height map does two jobs: it is the bump map (board joints and grout
 * catch the light) and the roughness map (joints are matt, a board's face has
 * a slight sheen), which is most of what separates "a floor" from "a brown
 * rectangle".
 */
import * as THREE from 'three'
import type { FloorKey } from '@/features/room-builder/types'

type Tier = 'high' | 'low'

interface FloorSpec {
  /** Metres covered by one repeat of the canvas. */
  metres: number
  roughness: number
  bump: number
  /** Texture rotation in radians (herringbone is drawn square, laid at 45°). */
  rotation?: number
  draw: (c: Painter) => void
}

/** Deterministic PRNG: the same floor every load, and no flicker on re-creation. */
function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Painter {
  size: number
  color: CanvasRenderingContext2D
  height: CanvasRenderingContext2D
  rand: () => number
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amount)))
  return `#${c.getHexString()}`
}

/** Long, slightly wandering streaks inside one board: the grain. */
function grain(
  p: Painter,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
  along: 'x' | 'y',
) {
  const ctx = p.color
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  const long = along === 'x' ? w : h
  const short = along === 'x' ? h : w
  const lines = Math.round(short / 2.2)
  for (let i = 0; i < lines; i += 1) {
    const offset = p.rand() * short
    const drift = (p.rand() - 0.5) * short * 0.12
    const dark = p.rand() < 0.62
    ctx.strokeStyle = shade(base, dark ? -0.05 - p.rand() * 0.07 : 0.03 + p.rand() * 0.05)
    ctx.globalAlpha = 0.1 + p.rand() * 0.22
    ctx.lineWidth = 0.6 + p.rand() * 1.6
    ctx.beginPath()
    const steps = 6
    for (let s = 0; s <= steps; s += 1) {
      const a = (s / steps) * long
      const b = offset + drift * Math.sin((s / steps) * Math.PI * (1 + p.rand()))
      const px = along === 'x' ? x + a : x + b
      const py = along === 'x' ? y + b : y + a
      if (s === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
  // An occasional knot, small and soft.
  if (p.rand() < 0.22) {
    const kx = x + p.rand() * w
    const ky = y + p.rand() * h
    const r = 3 + p.rand() * 5
    const g = ctx.createRadialGradient(kx, ky, 0, kx, ky, r * 2.2)
    g.addColorStop(0, shade(base, -0.2))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = 0.55
    ctx.fillStyle = g
    ctx.fillRect(kx - r * 3, ky - r * 3, r * 6, r * 6)
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

/** One board: tone, grain, and a bevelled joint in the height map. */
function board(p: Painter, x: number, y: number, w: number, h: number, tone: string, along: 'x' | 'y') {
  const base = shade(tone, (p.rand() - 0.5) * 0.09)
  p.color.fillStyle = base
  p.color.fillRect(x, y, w, h)
  grain(p, x, y, w, h, base, along)

  // Joint: a hairline of shadow in the colour, a groove in the height.
  p.color.strokeStyle = shade(tone, -0.28)
  p.color.globalAlpha = 0.55
  p.color.lineWidth = 1
  p.color.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  p.color.globalAlpha = 1

  const lift = 205 + Math.round(p.rand() * 40)
  p.height.fillStyle = `rgb(${lift},${lift},${lift})`
  p.height.fillRect(x, y, w, h)
  p.height.strokeStyle = '#3a3a3a'
  p.height.lineWidth = 2
  p.height.strokeRect(x + 1, y + 1, w - 2, h - 2)
}

/** Straight-laid boards with staggered end joints. Tiles in both directions. */
function planks(tone: string, rows: number, perRow: number) {
  return (p: Painter) => {
    const rowH = p.size / rows
    const len = p.size / perRow
    for (let r = 0; r < rows; r += 1) {
      const stagger = ((r * 0.37 + p.rand() * 0.2) % 1) * len
      // Draw one extra board either side so the stagger wraps cleanly.
      for (let i = -1; i <= perRow; i += 1) {
        board(p, i * len + stagger, r * rowH, len, rowH, tone, 'x')
      }
    }
  }
}

/**
 * Herringbone on a square lattice: cell (i, j) belongs to a horizontal block
 * when (i + j) mod 2k < k, otherwise a vertical one. The pattern repeats every
 * 2k cells both ways, so it tiles without a seam; it is laid at 45° by the
 * texture's own rotation.
 */
function herringbone(tone: string, k: number) {
  return (p: Painter) => {
    const period = 2 * k
    const cells = period * 2
    const cell = p.size / cells
    for (let j = -period; j < cells + period; j += 1) {
      for (let i = -period; i < cells + period; i += 1) {
        const m = (((i + j) % period) + period) % period
        if (m === 0) board(p, i * cell, j * cell, cell * k, cell, tone, 'x')
        else if (m === k) board(p, i * cell, j * cell, cell, cell * k, tone, 'y')
      }
    }
  }
}

/** Soft low-frequency blotches: what stops a flat colour looking like plastic. */
function mottle(p: Painter, tone: string, blobs: number, strength: number) {
  const ctx = p.color
  for (let i = 0; i < blobs; i += 1) {
    const x = p.rand() * p.size
    const y = p.rand() * p.size
    const r = p.size * (0.04 + p.rand() * 0.16)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, shade(tone, (p.rand() - 0.5) * strength))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = 0.5
    ctx.fillStyle = g
    // Wrapped, so the blotch that crosses an edge reappears on the other side.
    for (const ox of [-p.size, 0, p.size]) {
      for (const oy of [-p.size, 0, p.size]) {
        ctx.setTransform(1, 0, 0, 1, ox, oy)
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
  ctx.globalAlpha = 1
}

function speckle(p: Painter, tone: string, count: number, size: number, strength: number) {
  for (let i = 0; i < count; i += 1) {
    const x = p.rand() * p.size
    const y = p.rand() * p.size
    const light = p.rand() - 0.5
    p.color.fillStyle = shade(tone, light * strength)
    p.color.globalAlpha = 0.5
    p.color.fillRect(x, y, size, size)
    const v = 128 + Math.round(light * 160)
    p.height.fillStyle = `rgb(${v},${v},${v})`
    p.height.fillRect(x, y, size, size)
  }
  p.color.globalAlpha = 1
}

function tiles(tone: string, grout: string, perSide: number) {
  return (p: Painter) => {
    const cell = p.size / perSide
    const gap = Math.max(2, p.size / 340)
    p.color.fillStyle = grout
    p.color.fillRect(0, 0, p.size, p.size)
    p.height.fillStyle = '#404040'
    p.height.fillRect(0, 0, p.size, p.size)
    for (let j = 0; j < perSide; j += 1) {
      for (let i = 0; i < perSide; i += 1) {
        const x = i * cell + gap / 2
        const y = j * cell + gap / 2
        const base = shade(tone, (p.rand() - 0.5) * 0.035)
        p.color.fillStyle = base
        p.color.fillRect(x, y, cell - gap, cell - gap)
        p.height.fillStyle = '#e8e8e8'
        p.height.fillRect(x, y, cell - gap, cell - gap)
      }
    }
    mottle(p, tone, 26, 0.05)
    // Re-cut the grout the mottling just softened.
    p.color.strokeStyle = grout
    p.color.lineWidth = gap
    for (let i = 0; i <= perSide; i += 1) {
      p.color.beginPath()
      p.color.moveTo(i * cell, 0)
      p.color.lineTo(i * cell, p.size)
      p.color.moveTo(0, i * cell)
      p.color.lineTo(p.size, i * cell)
      p.color.stroke()
    }
  }
}

const SPECS: Record<FloorKey, FloorSpec> = {
  oak: { metres: 2.4, roughness: 0.62, bump: 0.5, draw: planks('#bfa07a', 14, 2) },
  ash: { metres: 2.4, roughness: 0.66, bump: 0.45, draw: planks('#dcc7a6', 14, 2) },
  walnut: { metres: 2.4, roughness: 0.58, bump: 0.5, draw: planks('#6b4a34', 14, 2) },
  herringbone: {
    metres: 1.6,
    roughness: 0.6,
    bump: 0.5,
    rotation: Math.PI / 4,
    draw: herringbone('#b88c5e', 4),
  },
  tile: { metres: 1.2, roughness: 0.36, bump: 0.35, draw: tiles('#d8d2c7', '#aaa397', 2) },
  concrete: {
    metres: 3,
    roughness: 0.78,
    bump: 0.12,
    draw: (p) => {
      p.color.fillStyle = '#a7a39c'
      p.color.fillRect(0, 0, p.size, p.size)
      p.height.fillStyle = '#808080'
      p.height.fillRect(0, 0, p.size, p.size)
      mottle(p, '#a7a39c', 70, 0.16)
      speckle(p, '#a7a39c', 5000, 1.5, 0.2)
    },
  },
  carpet: {
    metres: 1,
    roughness: 1,
    bump: 0.6,
    draw: (p) => {
      p.color.fillStyle = '#b6aa9a'
      p.color.fillRect(0, 0, p.size, p.size)
      p.height.fillStyle = '#808080'
      p.height.fillRect(0, 0, p.size, p.size)
      mottle(p, '#b6aa9a', 30, 0.06)
      speckle(p, '#b6aa9a', 60000, 2, 0.22)
    },
  },
}

export interface FloorTextures {
  map: THREE.CanvasTexture
  height: THREE.CanvasTexture
  roughness: number
  bump: number
}

const cache = new Map<string, FloorTextures>()

function prepare(texture: THREE.CanvasTexture, spec: FloorSpec, srgb: boolean) {
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1 / spec.metres, 1 / spec.metres)
  texture.rotation = spec.rotation ?? 0
  texture.anisotropy = 8
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.needsUpdate = true
}

/** Cached per covering and tier; never dispose what this returns. */
export function getFloorTextures(key: FloorKey, tier: Tier): FloorTextures | null {
  if (typeof document === 'undefined') return null
  const id = `${key}:${tier}`
  const hit = cache.get(id)
  if (hit) return hit

  const spec = SPECS[key] ?? SPECS.oak
  const size = tier === 'high' ? 1024 : 512
  const make = () => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    return canvas
  }
  const colorCanvas = make()
  const heightCanvas = make()
  const color = colorCanvas.getContext('2d')
  const height = heightCanvas.getContext('2d')
  if (!color || !height) return null

  height.fillStyle = '#c8c8c8'
  height.fillRect(0, 0, size, size)
  spec.draw({ size, color, height, rand: mulberry(key.length * 7919 + 13) })

  const map = new THREE.CanvasTexture(colorCanvas)
  const heightMap = new THREE.CanvasTexture(heightCanvas)
  prepare(map, spec, true)
  prepare(heightMap, spec, false)

  const made: FloorTextures = { map, height: heightMap, roughness: spec.roughness, bump: spec.bump }
  cache.set(id, made)
  return made
}

/**
 * Points a floor material at a covering. The material is kept (no shader
 * recompile, no hitch) — only its maps and scalars change.
 */
export function applyFloor(material: THREE.MeshStandardMaterial, key: FloorKey, tier: Tier) {
  const textures = getFloorTextures(key, tier)
  if (!textures) return
  material.color.set('#ffffff')
  material.map = textures.map
  material.bumpMap = tier === 'high' ? textures.height : null
  material.bumpScale = textures.bump
  // Height doubles as roughness: joints and grout are matt, faces carry sheen.
  material.roughnessMap = null
  material.roughness = textures.roughness
  material.metalness = 0
  material.needsUpdate = true
}

/**
 * A soft dark pool, alpha only: the occlusion under a piece of furniture.
 * Drawn from a rounded-box distance field so it works on every browser (no
 * canvas blur filter) and stretches to any footprint without banding.
 */
let blob: THREE.CanvasTexture | null = null
export function getContactShadowTexture(): THREE.CanvasTexture | null {
  if (blob) return blob
  if (typeof document === 'undefined') return null
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const image = ctx.createImageData(size, size)
  const half = 0.6
  const radius = 0.22
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = Math.abs((x + 0.5) / size * 2 - 1) - (half - radius)
      const py = Math.abs((y + 0.5) / size * 2 - 1) - (half - radius)
      const outside = Math.hypot(Math.max(px, 0), Math.max(py, 0))
      const d = outside + Math.min(Math.max(px, py), 0) - radius
      // 1 well inside the footprint, easing to 0 a little beyond its edge.
      const t = Math.min(1, Math.max(0, (0.36 - d) / 0.62))
      const alpha = t * t * (3 - 2 * t)
      const i = (y * size + x) * 4
      image.data[i] = 255
      image.data[i + 1] = 255
      image.data[i + 2] = 255
      image.data[i + 3] = Math.round(alpha * 255)
    }
  }
  ctx.putImageData(image, 0, 0)
  blob = new THREE.CanvasTexture(canvas)
  return blob
}

/**
 * The view out of a window: sky, a hazy horizon and a soft band of foliage.
 * Drawn once; the lighting preset tints it through the glass material's colour.
 */
let outside: THREE.CanvasTexture | null = null
export function getOutsideViewTexture(): THREE.CanvasTexture | null {
  if (outside) return outside
  if (typeof document === 'undefined') return null
  const w = 256
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#9cc3e6')
  sky.addColorStop(0.5, '#cfe2f1')
  sky.addColorStop(0.68, '#f1ece2')
  sky.addColorStop(0.7, '#b9c7a8')
  sky.addColorStop(1, '#8fa27f')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  const rand = mulberry(4711)
  // Out-of-focus clouds and tree crowns: shapes, never detail.
  for (let i = 0; i < 9; i += 1) {
    const x = rand() * w
    const y = h * (0.12 + rand() * 0.34)
    const r = 30 + rand() * 60
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  for (let i = 0; i < 16; i += 1) {
    const x = rand() * w
    const y = h * (0.68 + rand() * 0.2)
    const r = 26 + rand() * 46
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${70 + rand() * 40},${105 + rand() * 40},${70 + rand() * 20},0.8)`)
    g.addColorStop(1, 'rgba(90,120,80,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  outside = new THREE.CanvasTexture(canvas)
  outside.colorSpace = THREE.SRGBColorSpace
  return outside
}
