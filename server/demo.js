// Demo mode. With no API keys set, the whole app still works end to end — the
// capture flow, the style picker, the budget maths, the results screen and the
// 360° view all behave exactly as they will with real keys. Only the pixels
// are fake: renders come back as perspective SVG illustrations of a furnished
// room in the palette of the style you picked, and the brief is written in the
// user's language (uz / ru / en).

import { angleById, RENDERABLE_ANGLE_IDS } from './angles.js'
import { CATALOGUE_COPY, angleLabel, money, styleName, t } from './i18n.js'
import { paletteFor } from './palettes.js'
import { mix, renderRoomSvg, shade } from './roomSvg.js'

export { paletteFor }

// Priority order: the budget walk keeps whatever still fits.
const CATALOGUE = [
  { key: 'sofa', category: 'seating', low: 620, high: 1400, qty: 1 },
  { key: 'chair', category: 'seating', low: 240, high: 620, qty: 1 },
  { key: 'coffeeTable', category: 'table', low: 130, high: 380, qty: 1 },
  { key: 'shelf', category: 'storage', low: 180, high: 520, qty: 1 },
  { key: 'rug', category: 'rug', low: 190, high: 560, qty: 1 },
  { key: 'floorLamp', category: 'lighting', low: 90, high: 260, qty: 1 },
  { key: 'pendant', category: 'lighting', low: 110, high: 340, qty: 1 },
  { key: 'curtains', category: 'textiles', low: 80, high: 240, qty: 2 },
  { key: 'prints', category: 'wall-decor', low: 60, high: 200, qty: 3 },
  { key: 'plant', category: 'plants', low: 45, high: 130, qty: 2 },
  { key: 'paint', category: 'paint-and-finishes', low: 120, high: 300, qty: 1 },
]

// Catalogue prices are USD. Demo responses convert them into the requested
// currency at rough rates and round to steps people actually see on price tags,
// so a sofa in UZS reads as millions of soʻm, not "1 010".
const USD_RATES = { USD: 1, EUR: 0.92, GBP: 0.79, UZS: 12700, RUB: 92, KZT: 480, TRY: 34, AED: 3.67, CNY: 7.2, INR: 84, JPY: 150 }
const ROUND_STEP = { UZS: 10000, RUB: 100, KZT: 1000, JPY: 100, INR: 10, TRY: 10 }

export function convertUsd(amount, currency = 'USD') {
  const code = String(currency).toUpperCase()
  const rate = USD_RATES[code] ?? 1
  const step = ROUND_STEP[code] ?? 1
  return Math.max(step, Math.round((amount * rate) / step) * step)
}

function costed(limit, currency, locale) {
  const items = []
  const keys = new Set()
  let total = 0
  for (const item of CATALOGUE) {
    const low = convertUsd(item.low, currency)
    const high = convertUsd(item.high, currency)
    const average = convertUsd((item.low + item.high) / 2, currency)
    const line = average * item.qty
    if (limit && total + line > limit) continue
    const copy = CATALOGUE_COPY[item.key]
    items.push({
      name: copy.name[locale],
      category: item.category,
      description: copy.description[locale],
      typicalPriceLow: low,
      typicalPriceHigh: high,
      averagePrice: average,
      quantity: item.qty,
      placement: copy.placement[locale],
    })
    keys.add(item.key)
    total += line
  }
  return { items, total, keys }
}

// Which catalogue pieces made the cut, per brief — the renders draw only those.
const BRIEF_KEYS = new WeakMap()

export function demoBrief({ photos, style, budget, notes, locale = 'uz' }) {
  const T = t(locale)
  const L = T.photo
  const palette = paletteFor(style)
  const limit = budget?.limit || 0
  const currency = budget?.currency || 'USD'
  const { items, total, keys } = costed(limit, currency, locale)

  const renderable = photos.filter((p) => RENDERABLE_ANGLE_IDS.includes(p.angleId)).slice(0, 4)

  const brief = {
    demo: true,
    room: {
      estimatedWidthM: 3.8,
      estimatedDepthM: 4.4,
      estimatedHeightM: 2.6,
      existingFeatures: L.features,
      lightingNotes: L.lightingNotes,
      confidence: 'low',
    },
    design: {
      styleName: style,
      summary: L.summary(styleName(style, locale)),
      palette: palette.map((hex, i) => ({ name: T.paletteNames[i], hex, usage: T.paletteUsage[i] })),
      materials: T.materials,
      lighting: L.lighting,
    },
    furniture: items,
    budget: {
      currency,
      limit,
      estimatedTotal: total,
      withinBudget: !limit || total <= limit,
      notes: limit ? L.budgetWithin(money(total, currency, locale), money(limit, currency, locale)) : L.budgetNone,
    },
    renderPrompts: renderable.map((p) => {
      const angle = angleById(p.angleId)
      return {
        angleId: p.angleId,
        angleLabel: angleLabel(p.angleId, locale, angle?.label),
        prompt: `Restyle this ${angle ? angle.label.toLowerCase() : p.angleId} view in a ${style} scheme.${notes ? ` User note: ${notes}` : ''}`,
      }
    }),
    usage: { inputTokens: 0, outputTokens: 0 },
  }
  BRIEF_KEYS.set(brief, keys)
  return brief
}

// ------------------------------------------------------------------ renders
// The photo flow has no geometry, so the demo draws one plausible room that
// matches the brief: a window with a radiator on the front wall, the door in a
// corner of the back wall, and the costed furniture where its placement says.

function demoScene(brief, palette, keys) {
  const W = Number(brief.room?.estimatedWidthM) || 3.8
  const D = Number(brief.room?.estimatedDepthM) || 4.4
  const RH = Number(brief.room?.estimatedHeightM) || 2.6
  const [, floor, mid, , accent] = palette
  const has = (k) => keys.has(k)
  const items = []
  const put = (k, it) => has(k) && items.push({ id: `${k}${items.length}`, ...it })
  put('rug', { catalogId: 'rug', x: 1.5, z: D / 2, rotationDeg: 90, widthM: 2.6, depthM: 1.8, heightM: 0.02, color: mix(accent, mid, 0.45) })
  put('sofa', { catalogId: 'sofa3', x: 0.5, z: D / 2, rotationDeg: 90, widthM: 2.1, depthM: 0.9, heightM: 0.82, color: mix(accent, '#efe8de', 0.35) })
  put('coffeeTable', { catalogId: 'coffeeTable', x: 1.6, z: D / 2, rotationDeg: 90, widthM: 1.1, depthM: 0.6, heightM: 0.42, color: mix(floor, '#b98d5f', 0.5) })
  put('chair', { catalogId: 'armchair', x: W - 0.9, z: 1.25, rotationDeg: 300, widthM: 0.82, depthM: 0.86, heightM: 0.78, color: shade(mid, 1.15) })
  put('floorLamp', { catalogId: 'floorLamp', x: W - 0.35, z: 1.85, rotationDeg: 0, widthM: 0.44, depthM: 0.44, heightM: 1.7, color: '#efe6d8' })
  put('shelf', { catalogId: 'shelf', x: 1.95, z: D - 0.2, rotationDeg: 180, widthM: 1.2, depthM: 0.35, heightM: 1.85, color: mix(mid, floor, 0.3) })
  if (has('plant')) {
    items.push({ id: 'plant-a', catalogId: 'plant', x: 0.45, z: 0.45, widthM: 0.6, depthM: 0.6, heightM: 1.2, color: '#6e7f63' })
    items.push({ id: 'plant-b', catalogId: 'plant', x: W - 0.4, z: 0.4, widthM: 0.5, depthM: 0.5, heightM: 0.95, color: '#7d8c62' })
  }
  return {
    room: { widthM: W, depthM: D, heightM: RH, footprint: [[0, 0], [W, 0], [W, D], [0, D]] },
    walls: [
      {
        id: 'north',
        lengthM: W,
        openings: [
          { kind: 'window', offsetM: W / 2, widthM: 1.6, heightM: 1.5, sillM: 0.8 },
          { kind: 'radiator', offsetM: W / 2, widthM: 1.0, heightM: 0.55, sillM: 0.14 },
        ],
      },
      { id: 'east', lengthM: D, openings: [] },
      { id: 'south', lengthM: W, openings: [{ kind: 'door', offsetM: W - 0.75, widthM: 0.9, heightM: 2.05, sillM: 0 }] },
      { id: 'west', lengthM: D, openings: [] },
    ],
    items,
    lighting: 'afternoon',
  }
}

function viewFor(angleId, scene) {
  const { widthM: W, depthM: D } = scene.room
  switch (angleId) {
    case 'right':
      return { dir: [1, 0] }
    case 'back':
      return { dir: [0, 1] }
    case 'left':
      return { dir: [-1, 0] }
    case 'corner':
      return { pos: [W - 0.3, D - 0.3], dir: [-(W - 0.6), -(D - 0.6)] }
    case 'window':
      return { pos: [W / 2, D * 0.62], dir: [0, -1] }
    default:
      return { dir: [0, -1] }
  }
}

export function demoRenders({ brief, style }) {
  const palette = paletteFor(style)
  const keys = BRIEF_KEYS.get(brief) || new Set(CATALOGUE.map((c) => c.key))
  const scene = demoScene(brief, palette, keys)
  const options = { curtains: keys.has('curtains'), art: keys.has('prints'), pendant: keys.has('pendant') ? [scene.room.widthM / 2, scene.room.depthM / 2] : null }
  return {
    renders: brief.renderPrompts.map((rp) => ({
      angleId: rp.angleId,
      angleLabel: rp.angleLabel,
      prompt: rp.prompt,
      image: renderRoomSvg(scene, viewFor(rp.angleId, scene), palette, options),
    })),
    failures: [],
  }
}
