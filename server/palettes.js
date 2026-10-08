// Colour palettes per design style: [walls, floor, mid tone, anchor, accent].
// Used by the demo briefs and the demo SVG renders.

export const PALETTES = {
  Scandinavian: ['#F2EDE6', '#DCCFC0', '#8C7B6B', '#3E3833', '#A9B7A4'],
  Japandi: ['#EFE9E1', '#CFC3B4', '#7A6A58', '#2E2A26', '#8A8F7D'],
  Minimalist: ['#F6F5F3', '#E0DEDA', '#9B9892', '#33312E', '#BFBAB1'],
  'Mid-century modern': ['#EFE3D2', '#D89B63', '#8C5A34', '#2F2A24', '#5E7355'],
  Industrial: ['#DFDCD7', '#A8A29A', '#6B645C', '#2A2724', '#8A6A4F'],
  Bohemian: ['#F3E7D6', '#D9A05B', '#A6572F', '#3A2C22', '#7C8A5F'],
  'Modern luxe': ['#EDE9E4', '#C7B299', '#6E5B45', '#231F1C', '#3F5147'],
  Coastal: ['#F4F1EA', '#CFDCE0', '#7E9AA6', '#2C3A40', '#D8C9A9'],
}

const PALETTE_KEYS = Object.fromEntries(Object.keys(PALETTES).map((k) => [k.toLowerCase().replace(/[^a-z]/g, ''), k]))

export function paletteFor(style) {
  if (PALETTES[style]) return PALETTES[style]
  const key = PALETTE_KEYS[String(style || '').toLowerCase().replace(/[^a-z]/g, '')]
  return key ? PALETTES[key] : PALETTES.Scandinavian
}
