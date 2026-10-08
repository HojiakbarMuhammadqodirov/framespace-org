// The 3D room builder's scene payload (src/features/room-builder/payload.ts,
// ScenePayload v1.0): validation, normalisation and a plain-language
// description that both Claude and the image model can work from.

import { badRequest } from './lib/http.js'

export const SCENE_CATEGORIES = ['seating', 'table', 'storage', 'bed', 'lighting', 'rug', 'textiles', 'plants', 'other']
const OPENING_KINDS = ['window', 'door', 'radiator', 'socket']
const LIGHTING = ['morning', 'afternoon', 'evening', 'lamps']
const SHAPES = ['rect', 'l', 'studio']
const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/

/** The four room views a scene renders to. Yaw matches server/angles.js. */
export const SCENE_VIEWS = [
  { angleId: 'front', angleLabel: 'Front wall', wall: 'north', dir: [0, -1] },
  { angleId: 'right', angleLabel: 'Right wall', wall: 'east', dir: [1, 0] },
  { angleId: 'back', angleLabel: 'Back wall', wall: 'south', dir: [0, 1] },
  { angleId: 'left', angleLabel: 'Left wall', wall: 'west', dir: [-1, 0] },
]

/**
 * @returns {object} a cleaned copy of the payload
 * @throws HttpError 400 with a `fields` map
 */
export function validateScene(body) {
  const fields = {}
  const fail = (key, msg) => {
    if (!fields[key]) fields[key] = msg
  }
  const num = (v, key, min, max) => {
    const n = Number(v)
    if (typeof v === 'boolean' || v === null || v === '' || !Number.isFinite(n)) {
      fail(key, 'must be a number')
      return min
    }
    if (n < min || n > max) {
      fail(key, `must be between ${min} and ${max}`)
      return Math.min(max, Math.max(min, n))
    }
    return n
  }
  const str = (v, key, max, { required = true, fallback = '' } = {}) => {
    if (v === undefined || v === null || v === '') {
      if (required) fail(key, 'is required')
      return fallback
    }
    if (typeof v !== 'string') {
      fail(key, 'must be a string')
      return fallback
    }
    if (v.length > max) fail(key, `must be at most ${max} characters`)
    return v.trim().slice(0, max)
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Send the room scene as a JSON object.', { body: 'must be an object' })
  }

  if (body.version !== undefined && body.version !== '1.0') fail('version', 'unsupported version (expected "1.0")')
  if (body.units !== undefined && body.units !== 'm') fail('units', 'must be "m"')

  const style = str(body.style, 'style', 64)
  const locale = str(body.locale, 'locale', 16, { required: false, fallback: 'en' })
  const notes = str(body.notes, 'notes', 2000, { required: false })

  const r = body.room
  let room = null
  if (!r || typeof r !== 'object') fail('room', 'is required')
  else {
    room = {
      shape: SHAPES.includes(r.shape) ? r.shape : (fail('room.shape', `must be one of ${SHAPES.join(', ')}`), 'rect'),
      widthM: num(r.widthM, 'room.widthM', 1, 40),
      depthM: num(r.depthM, 'room.depthM', 1, 40),
      heightM: num(r.heightM, 'room.heightM', 1.8, 8),
      floorAreaM2: r.floorAreaM2 === undefined ? null : num(r.floorAreaM2, 'room.floorAreaM2', 0.5, 1600),
      perimeterM: r.perimeterM === undefined ? null : num(r.perimeterM, 'room.perimeterM', 1, 400),
      footprint: [],
    }
    if (!Array.isArray(r.footprint) || r.footprint.length < 3 || r.footprint.length > 32) {
      fail('room.footprint', 'must be an array of 3–32 [x, z] points')
    } else {
      room.footprint = r.footprint.map((p, i) => {
        if (!Array.isArray(p) || p.length !== 2) {
          fail(`room.footprint[${i}]`, 'must be [x, z]')
          return [0, 0]
        }
        return [num(p[0], `room.footprint[${i}]`, -1, 41), num(p[1], `room.footprint[${i}]`, -1, 41)]
      })
    }
    if (room.floorAreaM2 == null) room.floorAreaM2 = Math.round(polygonArea(room.footprint) * 100) / 100
  }

  const walls = []
  if (body.walls !== undefined) {
    if (!Array.isArray(body.walls) || body.walls.length > 24) fail('walls', 'must be an array of at most 24 walls')
    else
      body.walls.forEach((w, i) => {
        const k = `walls[${i}]`
        if (!w || typeof w !== 'object') return fail(k, 'must be an object')
        const openings = []
        if (w.openings !== undefined && (!Array.isArray(w.openings) || w.openings.length > 24)) {
          fail(`${k}.openings`, 'must be an array of at most 24 openings')
        } else {
          ;(w.openings || []).forEach((o, j) => {
            const ok = `${k}.openings[${j}]`
            if (!o || typeof o !== 'object') return fail(ok, 'must be an object')
            openings.push({
              kind: OPENING_KINDS.includes(o.kind) ? o.kind : (fail(`${ok}.kind`, `must be one of ${OPENING_KINDS.join(', ')}`), 'window'),
              offsetM: num(o.offsetM, `${ok}.offsetM`, 0, 40),
              widthM: num(o.widthM, `${ok}.widthM`, 0.01, 10),
              heightM: num(o.heightM, `${ok}.heightM`, 0.01, 8),
              sillM: num(o.sillM ?? 0, `${ok}.sillM`, 0, 8),
            })
          })
        }
        walls.push({
          id: typeof w.id === 'string' && ID_RE.test(w.id) ? w.id : (fail(`${k}.id`, 'must be a short id'), `w${i}`),
          lengthM: num(w.lengthM, `${k}.lengthM`, 0.05, 60),
          azimuthDeg: num(w.azimuthDeg ?? 0, `${k}.azimuthDeg`, 0, 360),
          interior: Boolean(w.interior),
          openings,
        })
      })
  }

  const items = []
  if (!Array.isArray(body.items)) fail('items', 'must be an array')
  else if (body.items.length > 200) fail('items', 'at most 200 pieces')
  else
    body.items.forEach((it, i) => {
      const k = `items[${i}]`
      if (!it || typeof it !== 'object') return fail(k, 'must be an object')
      items.push({
        id: typeof it.id === 'string' && ID_RE.test(it.id) ? it.id : (fail(`${k}.id`, 'must be a short id'), `i${i}`),
        catalogId:
          typeof it.catalogId === 'string' && ID_RE.test(it.catalogId) ? it.catalogId : (fail(`${k}.catalogId`, 'must be a short id'), 'other'),
        category: SCENE_CATEGORIES.includes(it.category) ? it.category : 'other',
        widthM: num(it.widthM, `${k}.widthM`, 0.02, 12),
        depthM: num(it.depthM, `${k}.depthM`, 0.02, 12),
        heightM: num(it.heightM, `${k}.heightM`, 0.005, 6),
        x: num(it.x, `${k}.x`, -1, 41),
        z: num(it.z, `${k}.z`, -1, 41),
        rotationDeg: num(it.rotationDeg ?? 0, `${k}.rotationDeg`, -360, 360),
        material: typeof it.material === 'string' ? it.material.slice(0, 32) : 'oak',
        unitPriceUzs: num(it.unitPriceUzs ?? 0, `${k}.unitPriceUzs`, 0, 10_000_000_000),
      })
    })

  const lightingPreset = body.lighting?.preset
  const lighting = LIGHTING.includes(lightingPreset) ? lightingPreset : 'afternoon'
  if (lightingPreset !== undefined && !LIGHTING.includes(lightingPreset)) {
    fail('lighting.preset', `must be one of ${LIGHTING.join(', ')}`)
  }

  const b = body.budget && typeof body.budget === 'object' ? body.budget : {}
  const limit = b.limit === undefined || b.limit === null ? 0 : num(b.limit, 'budget.limit', 0, 1e13)
  const currency = typeof b.currency === 'string' && /^[A-Z]{3}$/.test(b.currency) ? b.currency : body.currency || 'UZS'

  if (Object.keys(fields).length) throw badRequest('The room scene is not valid.', fields)

  return { version: '1.0', units: 'm', locale, style, notes, room, walls, items, lighting, budget: { currency, limit } }
}

function polygonArea(pts) {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    a += x1 * z2 - x2 * z1
  }
  return Math.abs(a) / 2
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']
const facing = (deg) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]

const LIGHT_TEXT = {
  morning: 'cool, bright morning daylight',
  afternoon: 'warm afternoon daylight',
  evening: 'low golden evening light',
  lamps: 'night-time, lit only by the room lamps',
}

const pretty = (id) =>
  String(id)
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()

/** Which part of the room a point sits in, in words. */
function whereIs(item, room) {
  const fx = item.x / room.widthM
  const fz = item.z / room.depthM
  const ns = fz < 0.33 ? 'north' : fz > 0.67 ? 'south' : ''
  const ew = fx < 0.33 ? 'west' : fx > 0.67 ? 'east' : ''
  return ns || ew ? `${ns}${ns && ew ? '-' : ''}${ew} side` : 'centre'
}

/** Group identical pieces into costed lines (catalogId + material). */
export function sceneLines(scene) {
  const map = new Map()
  for (const it of scene.items) {
    const key = `${it.catalogId}|${it.material}`
    const line = map.get(key)
    if (line) line.items.push(it)
    else map.set(key, { catalogId: it.catalogId, category: it.category, material: it.material, unitPrice: it.unitPriceUzs, items: [it] })
  }
  return [...map.values()]
}

export function describeScene(scene) {
  const { room } = scene
  const lines = []
  lines.push(
    `Room: ${room.shape === 'l' ? 'L-shaped' : room.shape === 'studio' ? 'studio' : 'rectangular'}, ${room.widthM} m east–west × ${room.depthM} m north–south, ceiling ${room.heightM} m, floor area ${room.floorAreaM2} m².`
  )
  for (const w of scene.walls) {
    if (!w.openings.length) continue
    const ops = w.openings
      .filter((o) => o.kind !== 'socket')
      .map((o) => `${o.kind} ${o.widthM}×${o.heightM} m at ${o.offsetM} m along the wall`)
    if (ops.length) lines.push(`Wall "${w.id}" (faces ${facing(w.azimuthDeg)}, ${w.lengthM} m${w.interior ? ', interior partition' : ''}): ${ops.join('; ')}.`)
  }
  if (scene.items.length) {
    lines.push('Furniture placed by the user (positions are fixed; describe them, do not move them):')
    for (const it of scene.items) {
      lines.push(
        `- ${pretty(it.catalogId)} (${it.category}), ${it.widthM}×${it.depthM}×${it.heightM} m, ${it.material} finish, ${whereIs(it, room)} of the room, rotated ${Math.round(it.rotationDeg)}°.`
      )
    }
  } else {
    lines.push('The room is empty: no furniture has been placed yet.')
  }
  lines.push(`Lighting: ${LIGHT_TEXT[scene.lighting]}.`)
  return lines.join('\n')
}

/** Prompt for a text-to-image model: one camera view of the scene. */
export function viewPrompt(scene, view, design) {
  const { room } = scene
  const visible = scene.items
    .filter((it) => {
      // Rough frustum test: in front of a camera standing against the opposite wall.
      const [dx, dz] = view.dir
      const cx = room.widthM / 2 - dx * (room.widthM / 2 - 0.3)
      const cz = room.depthM / 2 - dz * (room.depthM / 2 - 0.3)
      return (it.x - cx) * dx + (it.z - cz) * dz > 0.3
    })
    .map((it) => `${it.material} ${pretty(it.catalogId)} on the ${whereIs(it, room)}`)
  const wall = scene.walls.find((w) => w.id === view.wall)
  const openings = wall?.openings.filter((o) => o.kind === 'window' || o.kind === 'door').map((o) => o.kind) || []
  return [
    `Photorealistic interior photograph of a ${design?.styleName || scene.style} room, eye-level camera standing against the opposite wall looking ${view.wall}, 24mm lens.`,
    `The room is ${room.widthM} m wide, ${room.depthM} m deep, ${room.heightM} m high.`,
    openings.length ? `The wall straight ahead has: ${openings.join(', ')}.` : 'The wall straight ahead is solid.',
    visible.length ? `Visible furniture: ${visible.join('; ')}.` : 'Little furniture is visible from here.',
    design?.palette?.length ? `Palette: ${design.palette.map((p) => `${p.name} ${p.hex}`).join(', ')}.` : '',
    design?.materials?.length ? `Materials: ${design.materials.join(', ')}.` : '',
    `Lighting: ${LIGHT_TEXT[scene.lighting]}.`,
    'No people, no text, no watermark.',
  ]
    .filter(Boolean)
    .join(' ')
}
