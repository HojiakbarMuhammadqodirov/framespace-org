// Demo-mode renderer: an eye-level, one-point-perspective illustration of a
// room drawn straight to SVG. No API keys, no rasteriser — just projected
// polygons with soft shadows, floor boards, daylight patches and furniture
// built from a few boxes and prisms each so a sofa reads as a sofa.
//
// Input is the normalised scene shape from scene.js (room.footprint,
// room.heightM, walls[].openings, items[]) plus a few decorative options.
// Coordinates: x east, z south, y up, metres. Item rotation follows three.js:
// local +z (the front of a piece) points along (sin r, cos r).

const W = 1024
const H = 768
const NEAR = 0.06
const HFOV = (76 * Math.PI) / 180
const F = W / 2 / Math.tan(HFOV / 2)
const HY = H * 0.47 // horizon a little above centre: more floor, less ceiling
const MAX_BYTES = 58 * 1024

export const MATERIAL_HEX = {
  oak: '#c9a87c',
  walnut: '#6b4a35',
  ink: '#2f2620',
  linen: '#ece4d6',
  sand: '#e4d9cb',
  clay: '#b4825f',
  olive: '#6e7f63',
  terracotta: '#c0623e',
  brass: '#b8914a',
  indigo: '#3f4a78',
}

// ------------------------------------------------------------------ colour
function rgbOf(hex) {
  const h = String(hex).replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const hexOf = ([r, g, b]) =>
  `#${((1 << 24) | (clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b)).toString(16).slice(1)}`
const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)))
export const shade = (hex, f) => hexOf(rgbOf(hex).map((c) => c * f))
export const mix = (a, b, t) => {
  const A = rgbOf(a)
  const B = rgbOf(b)
  return hexOf(A.map((c, i) => c + (B[i] - c) * t))
}
const lum = (hex) => {
  const [r, g, b] = rgbOf(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

// -------------------------------------------------------------------- misc
// Coordinate precision: tenths of a pixel normally, whole pixels when a busy
// room has to squeeze under the size cap.
let PREC = 10
const n1 = (v) => String(Math.round(v * PREC) / PREC)
function rng(seedStr) {
  let s = 2166136261
  for (const ch of String(seedStr)) s = Math.imul(s ^ ch.charCodeAt(0), 16777619)
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function pointInPoly(x, z, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}
const LIGHT = (() => {
  const v = [-0.38, 0.8, 0.46]
  const l = Math.hypot(...v)
  return v.map((c) => c / l)
})()
const litFactor = (n) => {
  const l = Math.hypot(n[0], n[1], n[2]) || 1
  const d = (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / l
  return 0.7 + 0.36 * Math.max(0, d) + (n[1] / l > 0.9 ? 0.03 : 0)
}

// ------------------------------------------------------------------ camera
function makeCamera(room, view) {
  const fp = room.footprint
  const xs = fp.map((p) => p[0])
  const zs = fp.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  let [dx, dz] = view.dir
  const dl = Math.hypot(dx, dz) || 1
  dx /= dl
  dz /= dl
  let cx
  let cz
  if (view.pos) [cx, cz] = view.pos
  else {
    const half = (Math.abs(dx) * (maxX - minX)) / 2 + (Math.abs(dz) * (maxZ - minZ)) / 2
    cx = (minX + maxX) / 2 - dx * Math.max(0, half - 0.15)
    cz = (minZ + maxZ) / 2 - dz * Math.max(0, half - 0.15)
  }
  // An L-shaped room can put that spot outside the floor: walk it inwards.
  const gx = xs.reduce((a, b) => a + b, 0) / xs.length
  const gz = zs.reduce((a, b) => a + b, 0) / zs.length
  for (let i = 0; i < 24 && fp.length >= 3 && !pointInPoly(cx, cz, fp); i++) {
    cx += (gx - cx) * 0.15
    cz += (gz - cz) * 0.15
  }
  const cy = Math.min(1.35, room.heightM * 0.52)
  const rx = -dz
  const rz = dx
  return {
    pos: [cx, cy, cz],
    toCam: ([x, y, z]) => {
      const px = x - cx
      const pz = z - cz
      return [px * rx + pz * rz, y - cy, px * dx + pz * dz]
    },
  }
}

const toScreen = ([x, y, z]) => [W / 2 + (F * x) / z, HY - (F * y) / z]

/** Clip a world polygon against the near plane and project it. */
function projectPoly(cam, worldPts) {
  const pts = worldPts.map(cam.toCam)
  const out = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const ain = a[2] >= NEAR
    const bin = b[2] >= NEAR
    if (ain) out.push(a)
    if (ain !== bin) {
      const t = (NEAR - a[2]) / (b[2] - a[2])
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), NEAR])
    }
  }
  if (out.length < 3) return null
  const q = out.map(toScreen)
  // Entirely off-canvas polygons cost bytes and draw nothing.
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const [x, y] of q) {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  if (x1 < -2 || x0 > W + 2 || y1 < -2 || y0 > H + 2) return null
  return q
}
function projectSeg(cam, A, B) {
  let a = cam.toCam(A)
  let b = cam.toCam(B)
  if (a[2] < NEAR && b[2] < NEAR) return null
  if (a[2] < NEAR || b[2] < NEAR) {
    const t = (NEAR - a[2]) / (b[2] - a[2])
    const m = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), NEAR]
    if (a[2] < NEAR) a = m
    else b = m
  }
  return [toScreen(a), toScreen(b)]
}
function projectPt(cam, p) {
  const c = cam.toCam(p)
  return c[2] < NEAR ? null : { p: toScreen(c), z: c[2] }
}
const ptsAttr = (p) => p.map(([x, y]) => `${n1(x)},${n1(y)}`).join(' ')
const polyEl = (p, attrs) => `<polygon points="${ptsAttr(p)}" ${attrs}/>`
const segPath = (segs) => segs.map(([[x1, y1], [x2, y2]]) => `M${n1(x1)} ${n1(y1)}L${n1(x2)} ${n1(y2)}`).join('')

// ------------------------------------------------------------ local frames
function frameOf(it) {
  const t = ((it.rotationDeg || 0) * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)
  return {
    at: (lx, y, lz) => [it.x + lx * c + lz * s, y, it.z - lx * s + lz * c],
    dir: (lx, ly, lz) => [lx * c + lz * s, ly, -lx * s + lz * c],
  }
}

/** A wall as a frame: local x runs along the wall, local +z points into the room. */
function wallFrame(w) {
  const r = (Math.atan2(-w.uz, w.ux) * 180) / Math.PI
  return { x: w.ax, z: w.az, rotationDeg: r }
}

// ------------------------------------------------------------------- parts
const box = (ox, oz, w, d, y0, y1, color) => ({ type: 'box', ox, oz, w, d, y0, y1, color })
const prism = (ox, oz, r0, r1, y0, y1, color, sides = 10) => ({ type: 'prism', ox, oz, w: 2 * Math.max(r0, r1), d: 2 * Math.max(r0, r1), r0, r1, y0, y1, color, sides })

function boxFaces(fr, b) {
  const hw = b.w / 2
  const hd = b.d / 2
  const { ox, oz, y0, y1 } = b
  const P = (sx, y, sz) => fr.at(ox + sx * hw, y, oz + sz * hd)
  return [
    { n: [0, 1, 0], pts: [P(-1, y1, -1), P(1, y1, -1), P(1, y1, 1), P(-1, y1, 1)] },
    { n: [0, -1, 0], pts: [P(-1, y0, 1), P(1, y0, 1), P(1, y0, -1), P(-1, y0, -1)] },
    { n: fr.dir(0, 0, 1), pts: [P(-1, y0, 1), P(1, y0, 1), P(1, y1, 1), P(-1, y1, 1)] },
    { n: fr.dir(0, 0, -1), pts: [P(1, y0, -1), P(-1, y0, -1), P(-1, y1, -1), P(1, y1, -1)] },
    { n: fr.dir(1, 0, 0), pts: [P(1, y0, 1), P(1, y0, -1), P(1, y1, -1), P(1, y1, 1)] },
    { n: fr.dir(-1, 0, 0), pts: [P(-1, y0, -1), P(-1, y0, 1), P(-1, y1, 1), P(-1, y1, -1)] },
  ]
}

function prismFaces(fr, p) {
  const n = p.sides
  const ring = (r, y) => Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n
    return fr.at(p.ox + Math.cos(a) * r, y, p.oz + Math.sin(a) * r)
  })
  const bot = ring(p.r0, p.y0)
  const top = ring(p.r1, p.y1)
  const slope = (p.r0 - p.r1) / Math.max(0.01, p.y1 - p.y0)
  const faces = [
    { n: [0, 1, 0], pts: top },
    { n: [0, -1, 0], pts: [...bot].reverse() },
  ]
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const a = (2 * Math.PI * (i + 0.5)) / n
    faces.push({ n: fr.dir(Math.cos(a), slope, Math.sin(a)), pts: [bot[i], bot[j], top[j], top[i]] })
  }
  return faces
}

function drawSolid(cam, fr, part, out) {
  const faces = part.type === 'prism' ? prismFaces(fr, part) : boxFaces(fr, part)
  const [px, py, pz] = cam.pos
  for (const f of faces) {
    let cx = 0
    let cy = 0
    let cz = 0
    for (const p of f.pts) {
      cx += p[0]
      cy += p[1]
      cz += p[2]
    }
    const k = f.pts.length
    if (f.n[0] * (px - cx / k) + f.n[1] * (py - cy / k) + f.n[2] * (pz - cz / k) <= 0) continue
    const q = projectPoly(cam, f.pts)
    if (!q) continue
    const fill = part.glow && f.n[1] < 0 ? '#fff6e0' : shade(part.color, part.glow ? 1.08 : litFactor(f.n))
    out.push(polyEl(q, `fill="${fill}"`))
  }
}

/** Order parts of one piece: depth first, but anything resting on another part goes after it. */
function orderParts(cam, fr, parts) {
  for (const p of parts) p.depth = cam.toCam(fr.at(p.ox, (p.y0 + p.y1) / 2, p.oz))[2]
  parts.sort((a, b) => b.depth - a.depth)
  const under = (a, b) =>
    a.y1 <= b.y0 + 0.004 &&
    Math.abs(a.ox - b.ox) < (a.w + b.w) / 2 - 0.001 &&
    Math.abs(a.oz - b.oz) < (a.d + b.d) / 2 - 0.001
  for (let pass = 0; pass < parts.length; pass++) {
    let moved = false
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        if (under(parts[j], parts[i])) {
          const [p] = parts.splice(j, 1)
          parts.splice(i, 0, p)
          moved = true
        }
      }
    }
    if (!moved) break
  }
  return parts
}

// ---------------------------------------------------------------- furniture
export function kindOf(it) {
  if (it.kind) return it.kind
  const id = String(it.catalogId || '').toLowerCase()
  if (it.heightM < 0.05 || /rug|carpet/.test(id)) return 'rug'
  if (/armchair|lounge/.test(id)) return 'armchair'
  if (/sofa|couch/.test(id)) return 'sofa'
  if (/chair|stool/.test(id)) return 'chair'
  if (/coffee|lowtable|sidetable/.test(id)) return 'lowTable'
  if (/dining/.test(id)) return 'diningTable'
  if (/desk/.test(id)) return 'desk'
  if (/table/.test(id)) return it.heightM < 0.6 ? 'lowTable' : 'diningTable'
  if (/bed/.test(id)) return 'bed'
  if (/wardrobe|closet|cabinet/.test(id)) return 'wardrobe'
  if (/shel|book/.test(id)) return 'shelf'
  if (/sideboard|dresser|commode|console|tv/.test(id)) return 'sideboard'
  if (/plant|tree/.test(id)) return 'plant'
  if (/pendant/.test(id)) return 'pendant'
  if (/lamp|light/.test(id)) return 'floorLamp'
  switch (it.category) {
    case 'seating':
      return it.widthM > 1.3 ? 'sofa' : 'armchair'
    case 'table':
      return it.heightM < 0.6 ? 'lowTable' : 'diningTable'
    case 'storage':
      return it.heightM > 1.5 ? (it.depthM < 0.45 ? 'shelf' : 'wardrobe') : 'sideboard'
    case 'bed':
      return 'bed'
    case 'lighting':
      return 'floorLamp'
    case 'plants':
      return 'plant'
    case 'rug':
    case 'textiles':
      return 'rug'
    default:
      return 'box'
  }
}

function legs4(w, d, top, color, inset = 0.07, size = 0.045) {
  return [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([sx, sz]) => box(sx * (w / 2 - inset), sz * (d / 2 - inset), size, size, 0, top, color))
}

function seating(it, ctx, isSofa) {
  const { widthM: w, depthM: d, heightM: h } = it
  const B = it.color
  const A = ctx.accent
  const legH = 0.1
  const arm = Math.min(isSofa ? 0.2 : 0.16, w * 0.12)
  const back = Math.min(0.24, d * 0.28)
  const seatTop = Math.min(0.44, h * 0.55)
  const inner = w - 2 * arm
  const n = isSofa ? (inner > 1.5 ? 3 : inner > 0.9 ? 2 : 1) : 1
  const cw = inner / n
  const parts = [
    ...legs4(w, d, legH, ctx.legs, 0.09, 0.05),
    box(0, 0, w, d, legH, seatTop - 0.1, shade(B, 0.9)),
    box(-(w / 2 - arm / 2), 0, arm, d, legH, Math.min(h - 0.06, seatTop + 0.2), B),
    box(w / 2 - arm / 2, 0, arm, d, legH, Math.min(h - 0.06, seatTop + 0.2), B),
    box(0, -d / 2 + back / 2, w, back, legH, h, shade(B, 0.95)),
  ]
  for (let i = 0; i < n; i++) {
    const x = -inner / 2 + cw * (i + 0.5)
    parts.push(box(x, back / 2, cw - 0.025, d - back - 0.02, seatTop - 0.1, seatTop, shade(B, 1.05)))
    if (ctx.detail > 0) parts.push(box(x, -d / 2 + back + 0.075, cw - 0.04, 0.15, seatTop, h - 0.04, shade(B, 1.02)))
  }
  if (ctx.detail > 0) {
    const py = seatTop + Math.min(0.38, h - seatTop - 0.04)
    const pz = -d / 2 + back + 0.21
    if (isSofa) {
      parts.push(box(-(inner / 2 - 0.26), pz, 0.4, 0.12, seatTop, py, A))
      parts.push(box(inner / 2 - 0.26, pz, 0.4, 0.12, seatTop, py, shade(A, 1.18)))
    } else {
      parts.push(box(0, pz, Math.min(0.38, inner * 0.7), 0.12, seatTop, seatTop + 0.3, A))
    }
  }
  return parts
}

function bed(it, ctx) {
  const { widthM: w, depthM: d, heightM: h } = it
  const B = it.color
  const hb = 0.08
  const head = Math.max(1.0, h + 0.45)
  const mz = hb / 2
  const md = d - hb
  const parts = [
    box(0, -d / 2 + hb / 2, w + 0.04, hb, 0, head, shade(B, 0.92)),
    box(0, mz, w - 0.12, md - 0.12, 0, 0.07, ctx.legs),
    box(0, mz, w, md, 0.07, 0.3, shade(B, 0.88)),
    box(0, mz - 0.02, w - 0.06, md - 0.06, 0.3, 0.5, '#f4efe7'),
    // Duvet over the foot two-thirds, draped down the front.
    box(0, mz + md * 0.18, w + 0.03, md * 0.62, 0.5, 0.55, ctx.accent),
    box(0, d / 2 - 0.015, w + 0.03, 0.03, 0.28, 0.55, shade(ctx.accent, 0.92)),
  ]
  const pw = Math.min(0.62, w / 2 - 0.08)
  const pz = -d / 2 + hb + 0.22
  if (w > 1.2) {
    parts.push(box(-w / 4, pz, pw, 0.34, 0.5, 0.63, '#fbf8f2'), box(w / 4, pz, pw, 0.34, 0.5, 0.63, '#fbf8f2'))
  } else {
    parts.push(box(0, pz, Math.min(0.62, w - 0.2), 0.34, 0.5, 0.63, '#fbf8f2'))
  }
  if (ctx.detail > 0) parts.push(box(0, d / 2 - 0.3, w + 0.03, 0.42, 0.55, 0.565, shade(ctx.accent, 0.78)))
  return parts
}

function cabinetFronts(w, d, y0, y1, n, B, handle, handleH) {
  const parts = []
  const pw = w / n
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + pw * (i + 0.5)
    parts.push(box(x, d / 2 + 0.006, pw - 0.014, 0.012, y0, y1, shade(B, 1.04)))
    const hx = i % 2 === 0 ? x + pw / 2 - 0.06 : x - pw / 2 + 0.06
    parts.push(handleH ? box(x, d / 2 + 0.02, 0.14, 0.016, y1 - 0.08, y1 - 0.065, handle) : box(n === 1 ? x + pw / 2 - 0.06 : hx, d / 2 + 0.02, 0.018, 0.018, (y0 + y1) / 2 - 0.12, (y0 + y1) / 2 + 0.12, handle))
  }
  return parts
}

function wardrobe(it, ctx) {
  const { widthM: w, depthM: d, heightM: h } = it
  const B = it.color
  return [
    box(0, -0.02, w - 0.04, d - 0.04, 0, 0.06, shade(B, 0.6)),
    box(0, 0, w, d, 0.06, h, B),
    ...cabinetFronts(w, d, 0.09, h - 0.04, w > 1.5 ? 3 : 2, B, ctx.metal, false),
  ]
}

function sideboard(it, ctx) {
  const { widthM: w, depthM: d, heightM: h } = it
  const B = it.color
  const legH = Math.min(0.16, h * 0.22)
  const parts = [...legs4(w, d, legH, ctx.legs, 0.06, 0.04), box(0, 0, w, d, legH, h, B), ...cabinetFronts(w, d, legH + 0.03, h - 0.03, w > 1.2 ? 3 : 2, B, ctx.metal, true)]
  if (ctx.detail > 0 && h < 1.2) {
    parts.push(prism(w * 0.3, 0, 0.055, 0.075, h, h + 0.28, ctx.accent, 8))
    parts.push(box(-w * 0.26, 0, 0.28, 0.21, h, h + 0.05, ctx.mid), box(-w * 0.26, 0, 0.24, 0.19, h + 0.05, h + 0.09, shade(ctx.accent, 1.15)))
  }
  return parts
}

function shelf(it, ctx) {
  const { widthM: w, depthM: d, heightM: h } = it
  const B = it.color
  const t = 0.03
  const n = Math.max(3, Math.round(h / 0.36))
  const parts = [
    box(0, -d / 2 + 0.006, w - 0.02, 0.012, 0, h, shade(B, 0.8)),
    box(-w / 2 + t / 2, 0, t, d, 0, h, B),
    box(w / 2 - t / 2, 0, t, d, 0, h, B),
  ]
  const rand = rng(it.id || 'shelf')
  const pool = [ctx.accent, ctx.mid, ctx.dark, shade(ctx.accent, 1.25), '#d9cbb3', '#9a5b43', '#e8e0d2']
  const gap = (h - t) / n
  for (let i = 0; i <= n; i++) {
    const y = (h - t) * (i / n)
    parts.push(box(0, 0, w - 2 * t, d, y, y + t, shade(B, 1.04)))
    if (i === n || ctx.detail < 2) continue
    let x = -w / 2 + t + 0.03 + rand() * 0.08
    const end = w / 2 - t - 0.03
    const until = x + (end - x) * (0.45 + rand() * 0.5)
    while (x < until) {
      const bw = 0.025 + rand() * 0.035
      const bh = Math.min(gap - 0.05, 0.17 + rand() * 0.11)
      parts.push(box(x + bw / 2, 0.01, bw, d * 0.72, y + t, y + t + bh, pool[Math.floor(rand() * pool.length)]))
      x += bw + 0.004
    }
    if (rand() > 0.45 && end - x > 0.16) parts.push(prism(end - 0.08, 0, 0.045, 0.06, y + t, y + t + Math.min(gap - 0.08, 0.18), pool[Math.floor(rand() * 3)], 8))
  }
  return parts
}

function table(it, ctx, kind) {
  const { widthM: w, depthM: d, heightM: h } = it
  const B = it.color
  const top = kind === 'lowTable' ? 0.045 : 0.04
  const parts = [box(0, 0, w, d, h - top, h, B)]
  if (kind === 'desk') {
    parts.push(box(-w / 2 + 0.05, 0, 0.04, d - 0.08, 0, h - top, shade(B, 0.85)))
    const pw = Math.min(0.42, w * 0.32)
    const px = w / 2 - pw / 2 - 0.02
    parts.push(box(px, 0, pw, d - 0.06, 0, h - top, shade(B, 0.95)))
    for (let k = 0; k < 3; k++) {
      const y0 = 0.04 + ((h - top - 0.06) / 3) * k
      parts.push(box(px, (d - 0.06) / 2 + 0.006, pw - 0.03, 0.012, y0, y0 + (h - top - 0.06) / 3 - 0.015, shade(B, 1.04)))
    }
    if (ctx.detail > 0) {
      parts.push(box(-w * 0.12, 0.05, 0.34, 0.24, h, h + 0.015, '#3b3a3c'))
      parts.push(box(-w * 0.12, -0.07, 0.34, 0.012, h + 0.015, h + 0.24, '#2c2b2e'))
      parts.push(prism(w * 0.28, -d * 0.2, 0.06, 0.06, h, h + 0.1, ctx.accent, 8))
    }
    return parts
  }
  parts.push(...legs4(w, d, h - top, shade(B, 0.86), kind === 'lowTable' ? 0.07 : 0.09, kind === 'lowTable' ? 0.045 : 0.06))
  if (kind === 'lowTable' && h > 0.3) parts.push(box(0, 0, w - 0.16, d - 0.12, 0.1, 0.125, shade(B, 0.94)))
  if (ctx.detail > 0) {
    if (kind === 'lowTable') {
      parts.push(box(-w * 0.2, 0, Math.min(0.3, w * 0.3), Math.min(0.22, d * 0.4), h, h + 0.05, ctx.accent))
      parts.push(prism(w * 0.22, 0, 0.07, 0.11, h, h + 0.07, ctx.dark, 10))
    } else {
      parts.push(box(0, 0, Math.min(w * 0.6, 1.2), 0.32, h, h + 0.006, shade(ctx.accent, 1.1)))
      parts.push(prism(0, 0, 0.06, 0.08, h + 0.006, h + 0.3, ctx.mid, 8))
    }
  }
  return parts
}

function chair(it, ctx) {
  const { widthM: w, depthM: d, heightM: h } = it
  const B = it.color
  const seat = Math.min(0.46, h * 0.52)
  return [
    ...legs4(w, d, seat - 0.04, shade(B, 0.85), 0.04, 0.035),
    box(0, 0.01, w, d - 0.02, seat - 0.04, seat, B),
    box(-(w / 2 - 0.03), -d / 2 + 0.03, 0.035, 0.035, seat, h, shade(B, 0.88)),
    box(w / 2 - 0.03, -d / 2 + 0.03, 0.035, 0.035, seat, h, shade(B, 0.88)),
    box(0, -d / 2 + 0.03, w - 0.02, 0.03, h - 0.22, h - 0.02, B),
  ]
}

function floorLamp(it, ctx) {
  const h = it.heightM
  const r = Math.min(0.24, Math.max(it.widthM, it.depthM) / 2)
  const shadeTone = ctx.lampsOn ? '#fff1d4' : mix(it.color, '#ffffff', 0.25)
  return [
    prism(0, 0, r * 0.7, r * 0.66, 0, 0.03, ctx.metal, 12),
    box(0, 0, 0.026, 0.026, 0.03, h - 0.3, ctx.metal),
    { ...prism(0, 0, r, r * 0.7, h - 0.38, h, shadeTone, 12), glow: ctx.lampsOn },
  ]
}

function plant(it, ctx) {
  const h = it.heightM
  const R = Math.max(it.widthM, it.depthM) / 2
  const potH = Math.min(0.42, h * 0.32)
  return [
    prism(0, 0, R * 0.42, R * 0.56, 0, potH, ctx.pot, 12),
    prism(0, 0, R * 0.5, R * 0.5, potH - 0.025, potH - 0.005, '#4a3a2c', 10),
    { type: 'foliage', ox: 0, oz: 0, w: R * 1.6, d: R * 1.6, y0: potH, y1: h, R },
  ]
}

function pendant(it, ctx) {
  const top = ctx.RH
  const y1 = top - 0.42
  return [
    { type: 'cord', ox: 0, oz: 0, w: 0.01, d: 0.01, y0: y1, y1: top },
    { ...prism(0, 0, 0.22, 0.08, y1 - 0.2, y1, ctx.dark, 14), glow: ctx.lampsOn || ctx.lighting === 'evening' },
  ]
}

function curtains(it, ctx) {
  // `it` is a wall-aligned pseudo item: local x along the wall, +z into the room.
  const { t0, t1, top } = it
  const c = ctx.curtain
  const parts = [box((t0 + t1) / 2, 0.08, t1 - t0 + 0.9, 0.025, top, top + 0.025, ctx.metal)]
  for (const side of [-1, 1]) {
    const edge = side < 0 ? t0 - 0.03 : t1 + 0.03
    for (let k = 0; k < 3; k++) {
      const x = edge + side * (0.07 + k * 0.13)
      parts.push(box(x, k % 2 ? 0.13 : 0.1, 0.13, 0.05, 0.015, top, shade(c, k % 2 ? 0.93 : 1.02)))
    }
  }
  return parts
}

function rugFlat(cam, it, out) {
  const fr = frameOf(it)
  const { widthM: w, depthM: d } = it
  const B = it.color
  const rect = (hw, hd, y) => [fr.at(-hw, y, -hd), fr.at(hw, y, -hd), fr.at(hw, y, hd), fr.at(-hw, y, hd)]
  const add = (pts, fill) => {
    const q = projectPoly(cam, pts)
    if (q) out.push(polyEl(q, `fill="${fill}"`))
  }
  add(rect(w / 2, d / 2, 0.004), shade(B, 0.92))
  add(rect(w / 2 - 0.09, d / 2 - 0.09, 0.005), mix(B, '#fbf3e6', 0.5))
  add(rect(w / 2 - 0.15, d / 2 - 0.15, 0.006), B)
  const dm = (sx, sz, y) => [fr.at(0, y, -sz), fr.at(sx, y, 0), fr.at(0, y, sz), fr.at(-sx, y, 0)]
  add(dm(w * 0.26, d * 0.3, 0.007), shade(B, 0.8))
  add(dm(w * 0.13, d * 0.15, 0.008), mix(B, '#fbf3e6', 0.35))
  // Fringe on the two short ends.
  const segs = []
  const long = w >= d
  const span = long ? d : w
  const n = Math.max(6, Math.round(span / 0.07))
  for (const s of [-1, 1]) {
    for (let i = 0; i <= n; i++) {
      const u = -span / 2 + 0.04 + ((span - 0.08) * i) / n
      const a = long ? fr.at((s * w) / 2, 0.004, u) : fr.at(u, 0.004, (s * d) / 2)
      const b = long ? fr.at(s * (w / 2 + 0.05), 0.004, u) : fr.at(u, 0.004, s * (d / 2 + 0.05))
      const sg = projectSeg(cam, a, b)
      if (sg) segs.push(sg)
    }
  }
  if (segs.length) out.push(`<path d="${segPath(segs)}" stroke="${mix(B, '#fbf3e6', 0.6)}" stroke-width="1.2" fill="none"/>`)
}

function piecesFor(it, ctx) {
  const kind = kindOf(it)
  if (ctx.detail < 0) {
    // Lowest detail: one block per piece (plants keep their leaves).
    if (kind === 'plant') return plant(it, ctx)
    if (kind === 'curtains' || kind === 'pendant' || kind === 'floorLamp') return piecesFor(it, { ...ctx, detail: 0 })
    return [box(0, 0, it.widthM, it.depthM, 0, it.heightM, it.color)]
  }
  switch (kind) {
    case 'sofa':
      return seating(it, ctx, true)
    case 'armchair':
      return seating(it, ctx, false)
    case 'chair':
      return chair(it, ctx)
    case 'bed':
      return bed(it, ctx)
    case 'wardrobe':
      return wardrobe(it, ctx)
    case 'sideboard':
      return sideboard(it, ctx)
    case 'shelf':
      return shelf(it, ctx)
    case 'lowTable':
    case 'diningTable':
    case 'desk':
      return table(it, ctx, kind)
    case 'floorLamp':
      return floorLamp(it, ctx)
    case 'plant':
      return plant(it, ctx)
    case 'pendant':
      return pendant(it, ctx)
    case 'curtains':
      return curtains(it, ctx)
    default:
      return [box(0, 0, it.widthM, it.depthM, 0, it.heightM, it.color)]
  }
}

function drawFoliage(cam, fr, part, it, out) {
  const centre = fr.at(part.ox, part.y0 + (part.y1 - part.y0) * 0.55, part.oz)
  const pc = projectPt(cam, centre)
  if (!pc || pc.z < 0.3) return
  const R = part.R
  const pr = (F * R) / pc.z
  const ph = (F * (part.y1 - part.y0)) / pc.z
  const [cx, cy] = pc.p
  const leaf = it.color
  const rand = rng(it.id || 'plant')
  const n = 16
  const els = []
  for (let k = 0; k < n; k++) {
    const a = k * 2.39996 + rand() * 0.4
    const r = Math.sqrt((k + 0.5) / n)
    const lx = cx + Math.cos(a) * r * pr * 0.75
    const ly = cy + Math.sin(a) * r * ph * 0.42 - (1 - r) * ph * 0.12
    const rot = (a * 180) / Math.PI
    const len = pr * (0.38 + rand() * 0.18)
    els.push(`<ellipse cx="${n1(lx)}" cy="${n1(ly)}" rx="${n1(len)}" ry="${n1(len * 0.34)}" transform="rotate(${Math.round(rot)} ${n1(lx)} ${n1(ly)})" fill="${shade(leaf, 0.72 + ((k * 7) % 5) * 0.11)}"/>`)
  }
  out.push(`<g stroke="${shade(leaf, 0.5)}" stroke-width="0.6">${els.join('')}</g>`)
}

// --------------------------------------------------------------- the scene
function wallList(scene) {
  const { footprint } = scene.room
  const outer = (scene.walls || []).filter((w) => !w.interior)
  return footprint.map(([ax, az], i) => {
    const [bx, bz] = footprint[(i + 1) % footprint.length]
    const len = Math.hypot(bx - ax, bz - az) || 1
    const ux = (bx - ax) / len
    const uz = (bz - az) / len
    const meta = outer[i] && Math.abs(outer[i].lengthM - len) < 0.15 ? outer[i] : null
    return { id: meta?.id || `w${i}`, ax, az, ux, uz, nx: -uz, nz: ux, len, openings: meta?.openings || [] }
  })
}

const wallPt = (w, t, y, off = 0) => [w.ax + w.ux * t + w.nx * off, y, w.az + w.uz * t + w.nz * off]
const wallQuad = (w, t0, t1, y0, y1, off = 0) => [wallPt(w, t0, y0, off), wallPt(w, t1, y0, off), wallPt(w, t1, y1, off), wallPt(w, t0, y1, off)]

const SKY = {
  morning: ['#c9def0', '#f3f7fa'],
  afternoon: ['#b9d3e8', '#f6efe2'],
  evening: ['#e98f5a', '#f9d9ae'],
  lamps: ['#141c30', '#33405e'],
}
const OVERLAY = {
  morning: ['#e4efff', 0.1],
  afternoon: ['#ffd9a8', 0.12],
  evening: ['#ff9a55', 0.18],
  lamps: ['#120c08', 0.46],
}
const SUN = {
  morning: { k: 0.55, s: -0.4, c: '#fffaf0', o: 0.42 },
  afternoon: { k: 0.85, s: 0.35, c: '#fff2d6', o: 0.45 },
  evening: { k: 1.7, s: 0.65, c: '#ffc38a', o: 0.4 },
}

/** Free stretches of a wall for a framed print: away from openings and tall pieces. */
function artSpot(w, items) {
  const blocked = w.openings.filter((o) => o.kind !== 'socket').map((o) => [o.offsetM - o.widthM / 2 - 0.3, o.offsetM + o.widthM / 2 + 0.3])
  for (const it of items) {
    if (it.heightM < 1.25) continue
    const px = it.x - w.ax
    const pz = it.z - w.az
    const dist = px * w.nx + pz * w.nz
    if (dist - Math.max(it.widthM, it.depthM) / 2 > 0.4) continue
    const t = px * w.ux + pz * w.uz
    const half = Math.max(it.widthM, it.depthM) / 2 + 0.15
    blocked.push([t - half, t + half])
  }
  blocked.sort((a, b) => a[0] - b[0])
  let best = null
  let cur = 0.35
  for (const [a, b] of [...blocked, [w.len - 0.35, Infinity]]) {
    if (a - cur > (best ? best[1] - best[0] : 0)) best = [cur, a]
    cur = Math.max(cur, b)
  }
  return best && best[1] - best[0] >= 0.9 ? best : null
}

function renderOnce(scene, view, palette, opts) {
  const [wallHex, floorHex0, midHex, darkHex, accentHex] = palette
  const lighting = scene.lighting || 'afternoon'
  const lampsOn = lighting === 'lamps' || lighting === 'evening'
  const detail = opts.detail
  PREC = detail < 1 ? 1 : 10
  const cam = makeCamera(scene.room, view)
  const RH = scene.room.heightM
  const floorHex = mix(floorHex0, '#b98d5f', lum(floorHex0) > 0.72 ? 0.32 : 0.15)
  const trim = mix(wallHex, '#ffffff', 0.55)
  const ctx = {
    detail,
    RH,
    lighting,
    lampsOn,
    accent: accentHex,
    mid: midHex,
    dark: darkHex,
    legs: shade(darkHex, 1.25),
    metal: mix(darkHex, '#8b7a63', 0.25),
    pot: mix(midHex, '#e9dfd2', 0.45),
    curtain: mix(accentHex, '#f7f1e8', 0.62),
  }
  const walls = wallList(scene)
  const body = []

  // Ceiling and floor.
  const ceil = projectPoly(cam, scene.room.footprint.map(([x, z]) => [x, RH, z]))
  if (ceil) body.push(polyEl(ceil, `fill="url(#cg)"`))
  const floor = projectPoly(cam, scene.room.footprint.map(([x, z]) => [x, 0, z]))
  if (floor) body.push(polyEl(floor, 'fill="url(#fg)"'))

  // Floor boards along the room's longer side, with staggered joints.
  const xs = scene.room.footprint.map((p) => p[0])
  const zs = scene.room.footprint.map((p) => p[1])
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]
  const alongZ = maxZ - minZ >= maxX - minX
  const bw = 0.16
  const boards = []
  const joints = []
  const across = alongZ ? [minX, maxX] : [minZ, maxZ]
  const along = alongZ ? [minZ, maxZ] : [minX, maxX]
  const P = (a, b) => (alongZ ? [a, 0, b] : [b, 0, a])
  for (let i = 1, u = across[0] + bw; u < across[1]; i++, u += bw) {
    const s = projectSeg(cam, P(u, along[0]), P(u, along[1]))
    if (s) boards.push(s)
    if (detail < 1) continue
    for (let v = along[0] + ((i * 0.618) % 1) * 1.3; v < along[1]; v += 1.3) {
      const j = projectSeg(cam, P(u - bw, v), P(u, v))
      if (j) joints.push(j)
    }
  }
  const floorClip = floor ? `<clipPath id="fc"><polygon points="${ptsAttr(floor)}"/></clipPath>` : ''
  body.push(`<g clip-path="url(#fc)" fill="none" stroke="${shade(floorHex, 0.72)}" stroke-opacity="0.55"><path d="${segPath(boards)}" stroke-width="1.1"/><path d="${segPath(joints)}" stroke-width="0.9"/>`)

  // Daylight falling through each window onto the floor.
  const sun = SUN[lighting]
  if (sun) {
    const patches = []
    for (const w of walls) {
      for (const o of w.openings) {
        if (o.kind !== 'window') continue
        const t0 = o.offsetM - o.widthM / 2
        const t1 = o.offsetM + o.widthM / 2
        const foot = (t, y) => {
          const k = y * sun.k
          return [w.ax + w.ux * (t + y * sun.s) + w.nx * k, 0.002, w.az + w.uz * (t + y * sun.s) + w.nz * k]
        }
        const y0 = o.sillM
        const y1 = Math.min(RH, o.sillM + o.heightM)
        const q = projectPoly(cam, [foot(t0, y0), foot(t1, y0), foot(t1, y1), foot(t0, y1)])
        if (q) patches.push(polyEl(q, ''))
      }
    }
    if (patches.length) body.push(`<g fill="${sun.c}" stroke="none" opacity="${sun.o}" filter="url(#bl)">${patches.join('')}</g>`)
  }
  body.push('</g>')

  // Walls, far to near, each with its openings and decoration.
  const ordered = walls
    .map((w) => ({ w, depth: [wallPt(w, 0, RH / 2), wallPt(w, w.len, RH / 2)].reduce((s, p) => s + cam.toCam(p)[2], 0) / 2 }))
    .sort((a, b) => b.depth - a.depth)
  const [vdx, vdz] = view.dir
  const ao = []
  const extras = []
  let artCount = 0
  for (const { w } of ordered) {
    const facing = Math.abs(w.nx * vdx + w.nz * vdz)
    const q = projectPoly(cam, wallQuad(w, 0, w.len, 0, RH))
    if (!q) continue
    body.push(polyEl(q, `fill="${shade(wallHex, 0.84 + 0.16 * facing)}"`))
    const sk = projectPoly(cam, wallQuad(w, 0, w.len, 0, 0.09, 0.012))
    if (sk) body.push(polyEl(sk, `fill="${trim}" stroke="${shade(wallHex, 0.8)}" stroke-width="0.8"`))
    const fl = projectSeg(cam, wallPt(w, 0, 0.004), wallPt(w, w.len, 0.004))
    if (fl) ao.push(`<path d="${segPath([fl])}" stroke-width="16" stroke-opacity="0.3"/>`)
    const corner = projectSeg(cam, wallPt(w, 0, 0), wallPt(w, 0, RH))
    if (corner) ao.push(`<path d="${segPath([corner])}" stroke-width="22" stroke-opacity="0.12"/>`)
    const cn = projectSeg(cam, wallPt(w, 0, RH - 0.002), wallPt(w, w.len, RH - 0.002))
    if (cn) ao.push(`<path d="${segPath([cn])}" stroke-width="10" stroke-opacity="0.1"/>`)
    const wf = frameOf(wallFrame(w))

    let hasWindow = false
    for (const o of w.openings) {
      const t0 = Math.max(0, o.offsetM - o.widthM / 2)
      const t1 = Math.min(w.len, o.offsetM + o.widthM / 2)
      const y0 = o.sillM
      const y1 = Math.min(RH - 0.02, o.sillM + o.heightM)
      if (o.kind === 'socket') {
        const s = projectPoly(cam, wallQuad(w, t0, t1, y0, y1, 0.005))
        if (s) body.push(polyEl(s, `fill="${trim}" stroke="${shade(wallHex, 0.7)}" stroke-width="0.6"`))
      } else if (o.kind === 'window') {
        hasWindow = true
        const fr = projectPoly(cam, wallQuad(w, t0 - 0.07, t1 + 0.07, y0 - 0.07, y1 + 0.07, 0.008))
        if (fr) body.push(polyEl(fr, `fill="${trim}" stroke="${shade(wallHex, 0.75)}" stroke-width="0.8"`))
        const rv = projectPoly(cam, wallQuad(w, t0, t1, y0, y1, 0.01))
        if (rv) body.push(polyEl(rv, `fill="${shade(wallHex, 0.7)}"`))
        const gl = projectPoly(cam, wallQuad(w, t0, t1, y0, y1, -0.14))
        if (gl) {
          const z = cam.toCam(wallPt(w, (t0 + t1) / 2, (y0 + y1) / 2, -0.14))[2]
          const sw = Math.max(2, Math.min(14, (F * 0.05) / Math.max(z, 0.3)))
          body.push(polyEl(gl, 'fill="url(#sky)"'))
          const hill = projectPoly(cam, wallQuad(w, t0, t1, y0, y0 + (y1 - y0) * 0.32, -0.14))
          if (hill && lighting !== 'lamps') body.push(polyEl(hill, `fill="#93a986" opacity="0.45"`))
          const tm = (t0 + t1) / 2
          const ym = y0 + (y1 - y0) * 0.62
          const mull = [projectSeg(cam, wallPt(w, tm, y0, -0.14), wallPt(w, tm, y1, -0.14)), projectSeg(cam, wallPt(w, t0, ym, -0.14), wallPt(w, t1, ym, -0.14))].filter(Boolean)
          body.push(polyEl(gl, `fill="none" stroke="${trim}" stroke-width="${n1(sw)}" stroke-linejoin="round"`))
          if (mull.length) body.push(`<path d="${segPath(mull)}" stroke="${trim}" stroke-width="${n1(sw * 0.6)}"/>`)
        }
        drawSolid(cam, wf, box((t0 + t1) / 2, 0.05, t1 - t0 + 0.18, 0.12, y0 - 0.05, y0, trim), body)
        if (opts.curtains) {
          const top = Math.min(RH - 0.06, y1 + 0.22)
          extras.push({ kind: 'curtains', id: `c${w.id}${t0}`, ...wallFrame(w), t0, t1, top, widthM: t1 - t0 + 1, depthM: 0.2, heightM: top, color: ctx.curtain, cx: (t0 + t1) / 2 })
        }
      } else if (o.kind === 'door') {
        const ar = projectPoly(cam, wallQuad(w, t0 - 0.07, t1 + 0.07, 0, y1 + 0.07, 0.008))
        if (ar) body.push(polyEl(ar, `fill="${trim}" stroke="${shade(wallHex, 0.75)}" stroke-width="0.8"`))
        const doorHex = mix(midHex, wallHex, 0.25)
        const lf = projectPoly(cam, wallQuad(w, t0, t1, 0, y1, 0.014))
        if (lf) body.push(polyEl(lf, `fill="${doorHex}" stroke="${shade(doorHex, 0.75)}" stroke-width="1"`))
        for (const [a, b] of [[0.14, y1 * 0.47], [y1 * 0.53, y1 - 0.14]]) {
          const pn = projectPoly(cam, wallQuad(w, t0 + 0.1, t1 - 0.1, a, b, 0.016))
          if (pn) body.push(polyEl(pn, `fill="${shade(doorHex, 0.94)}" stroke="${shade(doorHex, 0.78)}" stroke-width="1"`))
        }
        const hd = projectPt(cam, wallPt(w, t1 - 0.09, 1.0, 0.03))
        if (hd) body.push(`<circle cx="${n1(hd.p[0])}" cy="${n1(hd.p[1])}" r="${n1(Math.max(1.5, (F * 0.03) / hd.z))}" fill="${ctx.metal}"/>`)
      } else {
        const rd = projectPoly(cam, wallQuad(w, t0, t1, y0, y1, 0.05))
        if (rd) {
          body.push(polyEl(rd, `fill="#f2efe9" stroke="${shade(wallHex, 0.7)}" stroke-width="1"`))
          const fins = []
          for (let t = t0 + 0.06; t < t1 - 0.03; t += 0.07) {
            const s = projectSeg(cam, wallPt(w, t, y0 + 0.03, 0.051), wallPt(w, t, y1 - 0.03, 0.051))
            if (s) fins.push(s)
          }
          if (fins.length) body.push(`<path d="${segPath(fins)}" stroke="${shade(wallHex, 0.72)}" stroke-width="1"/>`)
        }
      }
    }

    // A framed print on clear walls without windows.
    if (opts.art && !hasWindow && artCount < 3 && w.len >= 1.8) {
      const spot = artSpot(w, scene.items)
      if (spot) {
        artCount++
        const tc = (spot[0] + spot[1]) / 2
        const free = spot[1] - spot[0]
        const frames = free > 2.2 ? [[-0.36, 0.56, 0.74], [0.36, 0.56, 0.74]] : [[0, Math.min(1.05, free * 0.6), Math.min(1.05, free * 0.6) * 0.72]]
        const rand = rng(`${w.id}art`)
        for (const [dx, aw, ah] of frames) {
          const a0 = tc + dx - aw / 2
          const a1 = tc + dx + aw / 2
          const yc = 1.55
          const b0 = yc - ah / 2
          const b1 = yc + ah / 2
          const add = (t0, t1, y0, y1, off, fill, extra = '') => {
            const qq = projectPoly(cam, wallQuad(w, t0, t1, y0, y1, off))
            if (qq) body.push(polyEl(qq, `fill="${fill}"${extra}`))
          }
          add(a0, a1, b0, b1, 0.02, darkHex)
          add(a0 + 0.025, a1 - 0.025, b0 + 0.025, b1 - 0.025, 0.022, '#f8f4ec')
          const i0 = a0 + 0.09
          const i1 = a1 - 0.09
          const j0 = b0 + 0.09
          const j1 = b1 - 0.09
          add(i0, i1, j0, j1, 0.023, mix(accentHex, '#f8f4ec', 0.55))
          // Abstract landscape: a low hill and a sun.
          const hill = []
          for (let k = 0; k <= 8; k++) {
            const tt = i0 + ((i1 - i0) * k) / 8
            hill.push(wallPt(w, tt, j0 + (j1 - j0) * (0.32 + 0.14 * Math.sin(k * 0.9 + rand() * 2)), 0.024))
          }
          hill.push(wallPt(w, i1, j0, 0.024), wallPt(w, i0, j0, 0.024))
          const hq = projectPoly(cam, hill)
          if (hq) body.push(polyEl(hq, `fill="${shade(accentHex, 0.85)}"`))
          const sr = Math.min(i1 - i0, j1 - j0) * 0.17
          const sx = i0 + (i1 - i0) * (0.3 + rand() * 0.4)
          const sy = j0 + (j1 - j0) * 0.68
          const sun = Array.from({ length: 12 }, (_, k) => wallPt(w, sx + Math.cos((k * Math.PI) / 6) * sr, sy + Math.sin((k * Math.PI) / 6) * sr, 0.024))
          const sq = projectPoly(cam, sun)
          if (sq) body.push(polyEl(sq, `fill="${mix(midHex, '#d98c55', 0.5)}"`))
        }
      }
    }
  }
  body.push(`<g filter="url(#ao)" stroke="#3a2618" fill="none">${ao.join('')}</g>`)

  // Furniture. Rugs lie flat first, then contact shadows, then everything
  // else far to near.
  const items = [...scene.items.map((it) => ({ ...it, color: it.color || MATERIAL_HEX[it.material] || midHex })), ...extras]
  if (opts.pendant) {
    const [cx, cz] = opts.pendant
    items.push({ id: 'pendant', kind: 'pendant', x: cx, z: cz, widthM: 0.55, depthM: 0.55, heightM: 0.3, color: darkHex, ceiling: true })
  }
  const visible = []
  for (const it of items) {
    const kind = kindOf(it)
    const fr = frameOf(it)
    const cx = kind === 'curtains' ? it.cx : 0
    const centre = cam.toCam(fr.at(cx, kind === 'pendant' ? RH - 0.7 : it.heightM / 2, kind === 'curtains' ? 0.1 : 0))
    if (kind !== 'rug' && centre[2] < 0.75) continue
    if (kind === 'rug' && centre[2] < -Math.max(it.widthM, it.depthM)) continue
    visible.push({ it, kind, fr, depth: centre[2] })
  }

  for (const v of visible) if (v.kind === 'rug') rugFlat(cam, v.it, body)

  const shadows = []
  for (const { it, kind, fr } of visible) {
    if (kind === 'rug' || kind === 'curtains' || kind === 'pendant') continue
    let pts
    if (kind === 'plant' || kind === 'floorLamp') {
      const r = Math.max(it.widthM, it.depthM) * 0.42
      pts = Array.from({ length: 8 }, (_, k) => fr.at(Math.cos((k * Math.PI) / 4) * r, 0.003, Math.sin((k * Math.PI) / 4) * r))
    } else {
      const hw = it.widthM / 2 + 0.05
      const hd = it.depthM / 2 + 0.05
      pts = [fr.at(-hw, 0.003, -hd), fr.at(hw, 0.003, -hd), fr.at(hw, 0.003, hd + 0.04), fr.at(-hw, 0.003, hd + 0.04)]
    }
    const q = projectPoly(cam, pts)
    if (q) shadows.push(polyEl(q, ''))
  }
  if (shadows.length) body.push(`<g fill="#2b1b10" opacity="0.34" filter="url(#sh)">${shadows.join('')}</g>`)

  const glows = []
  const solid = []
  visible
    .filter((v) => v.kind !== 'rug')
    .sort((a, b) => b.depth - a.depth)
    .forEach(({ it, kind, fr }) => {
      const parts = orderParts(cam, fr, piecesFor(it, ctx))
      const out = []
      for (const p of parts) {
        if (p.type === 'foliage') drawFoliage(cam, fr, p, it, out)
        else if (p.type === 'cord') {
          const s = projectSeg(cam, fr.at(0, p.y0, 0), fr.at(0, p.y1, 0))
          if (s) out.push(`<path d="${segPath([s])}" stroke="${darkHex}" stroke-width="1.4"/>`)
        } else drawSolid(cam, fr, p, out)
        if (p.glow) {
          const g = projectPt(cam, fr.at(p.ox, p.y0 + (p.y1 - p.y0) * 0.3, p.oz))
          if (g) glows.push(`<circle cx="${n1(g.p[0])}" cy="${n1(g.p[1])}" r="${n1(Math.min(420, (F * 1.1) / g.z))}" fill="url(#glow)"/>`)
        }
      }
      solid.push(out.join(''))
    })
  body.push(`<g stroke="#2a1a0e" stroke-width="0.8" stroke-opacity="0.22" stroke-linejoin="round">${solid.join('\n')}</g>`)

  const [ovFill, ovOpacity] = OVERLAY[lighting] || OVERLAY.afternoon
  const sky = SKY[lighting] || SKY.afternoon
  const ceilHex = shade(wallHex, lighting === 'lamps' ? 0.95 : 1.03)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(floorHex, 0.8)}"/><stop offset="1" stop-color="${shade(floorHex, 1.04)}"/></linearGradient>
<linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ceilHex}"/><stop offset="1" stop-color="${shade(ceilHex, 0.93)}"/></linearGradient>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
<linearGradient id="lt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#ffd9a0" stop-opacity="0.7"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
<radialGradient id="vg" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#2a180c" stop-opacity="0"/><stop offset="1" stop-color="#2a180c" stop-opacity="0.32"/></radialGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
<filter id="bl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter>
<filter id="ao" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9"/></filter>
${floorClip}
</defs>
<rect width="${W}" height="${H}" fill="${shade(wallHex, 0.9)}"/>
${body.join('\n')}
<rect width="${W}" height="${H}" fill="${ovFill}" opacity="${ovOpacity}"/>
${glows.join('')}
<rect width="${W}" height="${H}" fill="url(#lt)"/>
<rect width="${W}" height="${H}" fill="url(#vg)"/>
</svg>`
}

/**
 * @param {object} scene  normalised scene (room, walls, items, lighting)
 * @param {{dir:[number,number], pos?:[number,number]}} view
 * @param {string[]} palette  [walls, floor, mid, anchor, accent]
 * @param {{curtains?:boolean, art?:boolean, pendant?:[number,number]|null}} [options]
 * @returns {string} a data: URL
 */
export function renderRoomSvg(scene, view, palette, options = {}) {
  const base = { curtains: true, art: true, pendant: null, ...options }
  let detail = scene.items.length > 80 ? -1 : scene.items.length > 40 ? 1 : 2
  let svg = renderOnce(scene, view, palette, { ...base, detail })
  while (Buffer.byteLength(svg) > MAX_BYTES && detail > -1) {
    detail -= 1
    svg = renderOnce(scene, view, palette, { ...base, detail })
  }
  // Last resort for very crowded rooms: keep the biggest pieces.
  for (let keep = 60; Buffer.byteLength(svg) > MAX_BYTES && keep >= 10; keep = Math.floor(keep * 0.7)) {
    const items = [...scene.items].sort((a, b) => b.widthM * b.depthM * b.heightM - a.widthM * a.depthM * a.heightM).slice(0, keep)
    svg = renderOnce({ ...scene, items }, view, palette, { ...base, detail: -1 })
  }
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
