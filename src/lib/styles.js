// The style menu. Each entry carries a three-colour swatch so the picker reads
// visually rather than as a list of words — you choose a look, not a label.

export const STYLES = [
  {
    name: 'Scandinavian',
    blurb: 'Pale woods, white walls, nothing shouting.',
    swatch: ['#F2EDE6', '#DCCFC0', '#8C7B6B'],
  },
  {
    name: 'Japandi',
    blurb: 'Low, quiet, warm. Japanese restraint on Nordic bones.',
    swatch: ['#EFE9E1', '#CFC3B4', '#7A6A58'],
  },
  {
    name: 'Minimalist',
    blurb: 'One material, one gesture, a lot of air.',
    swatch: ['#F6F5F3', '#E0DEDA', '#33312E'],
  },
  {
    name: 'Mid-century modern',
    blurb: 'Tapered legs, walnut, a burnt-orange note.',
    swatch: ['#EFE3D2', '#D89B63', '#8C5A34'],
  },
  {
    name: 'Industrial',
    blurb: 'Raw concrete, blackened steel, honest bulbs.',
    swatch: ['#DFDCD7', '#8A6A4F', '#2A2724'],
  },
  {
    name: 'Bohemian',
    blurb: 'Layered rugs, rattan, plants everywhere.',
    swatch: ['#F3E7D6', '#D9A05B', '#7C8A5F'],
  },
  {
    name: 'Modern luxe',
    blurb: 'Deep tones, brass, stone, weight.',
    swatch: ['#EDE9E4', '#C7B299', '#3F5147'],
  },
  {
    name: 'Coastal',
    blurb: 'Bleached linen, sea glass, morning light.',
    swatch: ['#F4F1EA', '#CFDCE0', '#7E9AA6'],
  },
]

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'UZS', 'AED', 'INR', 'JPY']

export function formatMoney(amount, currency) {
  const value = Number(amount) || 0
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${Math.round(value).toLocaleString()} ${currency}`
  }
}
