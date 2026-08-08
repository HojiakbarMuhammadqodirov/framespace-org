// Demo mode. With no API keys set, the whole app still works end to end — the
// capture flow, the style picker, the budget maths, the results screen and the
// 360° view all behave exactly as they will with real keys. Only the pixels
// are fake: renders come back as generated SVG room illustrations in the
// palette of the style you picked.

import { angleById, RENDERABLE_ANGLE_IDS } from './angles.js'

const PALETTES = {
  Scandinavian: ['#F2EDE6', '#DCCFC0', '#8C7B6B', '#3E3833', '#A9B7A4'],
  Japandi: ['#EFE9E1', '#CFC3B4', '#7A6A58', '#2E2A26', '#8A8F7D'],
  Minimalist: ['#F6F5F3', '#E0DEDA', '#9B9892', '#33312E', '#BFBAB1'],
  'Mid-century modern': ['#EFE3D2', '#D89B63', '#8C5A34', '#2F2A24', '#5E7355'],
  Industrial: ['#DFDCD7', '#A8A29A', '#6B645C', '#2A2724', '#8A6A4F'],
  Bohemian: ['#F3E7D6', '#D9A05B', '#A6572F', '#3A2C22', '#7C8A5F'],
  'Modern luxe': ['#EDE9E4', '#C7B299', '#6E5B45', '#231F1C', '#3F5147'],
  Coastal: ['#F4F1EA', '#CFDCE0', '#7E9AA6', '#2C3A40', '#D8C9A9'],
}

function paletteFor(style) {
  return PALETTES[style] || PALETTES.Scandinavian
}

// Each wall gets a different arrangement. Four identical images would stitch
// into a panorama that looks broken — you turn 90° and nothing changes.
function furnitureFor(variant, palette) {
  const [, , mid, dark, accent] = palette

  const window_ = (x) => `
  <rect x="${x}" y="90" width="300" height="340" rx="6" fill="#ffffff" opacity="0.88"/>
  <rect x="${x}" y="90" width="300" height="340" rx="6" fill="none" stroke="${dark}" stroke-width="10" opacity="0.32"/>
  <line x1="${x + 150}" y1="90" x2="${x + 150}" y2="430" stroke="${dark}" stroke-width="6" opacity="0.28"/>`

  const sofa = (x) => `
  <rect x="${x + 20}" y="300" width="120" height="52" rx="14" fill="${accent}" opacity="0.85"/>
  <rect x="${x + 160}" y="300" width="120" height="52" rx="14" fill="${accent}" opacity="0.85"/>
  <rect x="${x}" y="330" width="420" height="140" rx="18" fill="${accent}"/>
  <rect x="${x + 30}" y="470" width="24" height="60" fill="${dark}" opacity="0.5"/>
  <rect x="${x + 366}" y="470" width="24" height="60" fill="${dark}" opacity="0.5"/>`

  const rug = (cx) => `<ellipse cx="${cx}" cy="620" rx="330" ry="86" fill="${mid}" opacity="0.4"/>`

  const table = (x) => `
  <rect x="${x}" y="470" width="200" height="18" rx="6" fill="${dark}" opacity="0.55"/>
  <rect x="${x + 12}" y="488" width="12" height="70" fill="${dark}" opacity="0.55"/>
  <rect x="${x + 176}" y="488" width="12" height="70" fill="${dark}" opacity="0.55"/>`

  const plant = (x) => `
  <circle cx="${x}" cy="510" r="38" fill="${accent}" opacity="0.7"/>
  <rect x="${x - 8}" y="540" width="16" height="100" fill="${dark}" opacity="0.5"/>`

  const shelving = (x) => `
  <rect x="${x}" y="150" width="230" height="320" fill="none" stroke="${dark}" stroke-width="9" opacity="0.55"/>
  <line x1="${x}" y1="256" x2="${x + 230}" y2="256" stroke="${dark}" stroke-width="9" opacity="0.55"/>
  <line x1="${x}" y1="362" x2="${x + 230}" y2="362" stroke="${dark}" stroke-width="9" opacity="0.55"/>
  <rect x="${x + 20}" y="196" width="46" height="60" fill="${accent}" opacity="0.75"/>
  <rect x="${x + 150}" y="300" width="56" height="62" fill="${mid}" opacity="0.8"/>`

  const door = (x) => `
  <rect x="${x}" y="140" width="200" height="330" fill="${mid}" opacity="0.45"/>
  <rect x="${x}" y="140" width="200" height="330" fill="none" stroke="${dark}" stroke-width="10" opacity="0.4"/>
  <circle cx="${x + 172}" cy="310" r="9" fill="${dark}" opacity="0.7"/>`

  const art = (x, y, w, h) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${mid}" opacity="0.5" stroke="${dark}" stroke-width="7"/>`

  switch (variant % 4) {
    case 0: // front wall — window right, sofa left
      return window_(620) + rug(330) + sofa(90) + table(560) + plant(860)
    case 1: // right wall — shelving, low table
      return shelving(120) + rug(560) + table(430) + plant(820) + art(430, 170, 150, 110)
    case 2: // back wall — the door you came through, gallery wall
      return door(640) + art(120, 170, 170, 130) + art(320, 200, 130, 100) + rug(420) + table(180)
    default: // left wall — window left, reading corner
      return window_(90) + rug(700) + plant(470) + table(600) + shelving(780)
  }
}

function svgRender({ variant, palette }) {
  const [wall, floor, mid] = palette
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>
    <linearGradient id="light" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="62%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="fl" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${mid}"/>
      <stop offset="100%" stop-color="${floor}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="768" fill="${wall}"/>
  <rect y="470" width="1024" height="298" fill="url(#fl)"/>
  ${furnitureFor(variant, palette)}
  <rect width="1024" height="768" fill="url(#light)"/>
</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

const CATALOGUE = [
  { name: 'Three-seat sofa', category: 'seating', low: 620, high: 1400, qty: 1, placement: 'Along the longest clear wall, facing the window.' },
  { name: 'Lounge chair', category: 'seating', low: 240, high: 620, qty: 1, placement: 'Angled into the corner beside the window.' },
  { name: 'Coffee table', category: 'table', low: 130, high: 380, qty: 1, placement: 'Centred on the rug, 45cm from the sofa.' },
  { name: 'Open shelving unit', category: 'storage', low: 180, high: 520, qty: 1, placement: 'Against the back wall, left of the door.' },
  { name: 'Wool area rug 200×300', category: 'rug', low: 190, high: 560, qty: 1, placement: 'Under the front legs of the sofa and the coffee table.' },
  { name: 'Floor lamp', category: 'lighting', low: 90, high: 260, qty: 1, placement: 'Behind the lounge chair.' },
  { name: 'Ceiling pendant', category: 'lighting', low: 110, high: 340, qty: 1, placement: 'Replaces the existing fitting, centred.' },
  { name: 'Linen curtains', category: 'textiles', low: 80, high: 240, qty: 2, placement: 'Floor length, hung 15cm above the window frame.' },
  { name: 'Framed print set', category: 'wall-decor', low: 60, high: 200, qty: 3, placement: 'Gallery arrangement above the shelving.' },
  { name: 'Large potted plant', category: 'plants', low: 45, high: 130, qty: 2, placement: 'Flanking the window.' },
  { name: 'Wall paint + finishes', category: 'paint-and-finishes', low: 120, high: 300, qty: 1, placement: 'All four walls plus trim.' },
]

function costed(limit) {
  // Walk the catalogue in priority order and keep whatever still fits.
  const items = []
  let total = 0
  for (const item of CATALOGUE) {
    const average = Math.round((item.low + item.high) / 2)
    const line = average * item.qty
    if (limit && total + line > limit) continue
    items.push({
      name: item.name,
      category: item.category,
      description: 'Mid-market piece chosen to suit the room and the chosen style.',
      typicalPriceLow: item.low,
      typicalPriceHigh: item.high,
      averagePrice: average,
      quantity: item.qty,
      placement: item.placement,
    })
    total += line
  }
  return { items, total }
}

export function demoBrief({ photos, style, budget, notes }) {
  const palette = paletteFor(style)
  const limit = budget?.limit || 0
  const currency = budget?.currency || 'USD'
  const { items, total } = costed(limit)

  const renderable = photos.filter((p) => RENDERABLE_ANGLE_IDS.includes(p.angleId)).slice(0, 4)

  return {
    demo: true,
    room: {
      estimatedWidthM: 3.8,
      estimatedDepthM: 4.4,
      estimatedHeightM: 2.6,
      existingFeatures: [
        'Single large window on one wall',
        'Door in the corner of the back wall',
        'Radiator beneath the window',
        'Existing ceiling rose, centred',
      ],
      lightingNotes: 'Daylight enters from one side and falls across the floor. One central ceiling fitting.',
      confidence: 'low',
    },
    design: {
      styleName: style,
      summary: `A ${style.toLowerCase()} treatment that keeps the room's existing light and works around the window and radiator. Warm neutral walls, a grounding rug, and one strong seating gesture facing the daylight.`,
      palette: [
        { name: 'Walls', hex: palette[0], usage: 'All four walls and ceiling' },
        { name: 'Floor', hex: palette[1], usage: 'Flooring and larger timber pieces' },
        { name: 'Mid tone', hex: palette[2], usage: 'Shelving, frames, table legs' },
        { name: 'Anchor', hex: palette[3], usage: 'Trim, hardware, lighting stems' },
        { name: 'Accent', hex: palette[4], usage: 'Upholstery, cushions, plants' },
      ],
      materials: ['Matte emulsion walls', 'Oiled oak', 'Wool boucle', 'Linen', 'Blackened steel'],
      lighting: 'Layered: one pendant, one floor lamp behind the reading chair, warm 2700K throughout.',
    },
    furniture: items,
    budget: {
      currency,
      limit,
      estimatedTotal: total,
      withinBudget: !limit || total <= limit,
      notes: limit
        ? `Kept the list to ${total} ${currency} against your ${limit} ${currency} ceiling by pricing every piece at the midpoint of its normal retail range.`
        : 'No ceiling set, so every piece is priced at the midpoint of its normal retail range.',
    },
    renderPrompts: renderable.map((p) => {
      const angle = angleById(p.angleId)
      return {
        angleId: p.angleId,
        angleLabel: angle ? angle.label : p.angleId,
        prompt: `Restyle this ${angle ? angle.label.toLowerCase() : p.angleId} view in a ${style} scheme.${notes ? ` User note: ${notes}` : ''}`,
      }
    }),
    usage: { inputTokens: 0, outputTokens: 0 },
  }
}

export function demoRenders({ brief, style }) {
  const palette = paletteFor(style)
  return {
    renders: brief.renderPrompts.map((rp, i) => ({
      angleId: rp.angleId,
      angleLabel: rp.angleLabel,
      prompt: rp.prompt,
      image: svgRender({ variant: i, palette }),
    })),
    failures: [],
  }
}
