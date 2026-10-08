// Demo-mode output for the 3D room builder. No API keys needed: the brief is
// derived from the scene itself (in the user's language) and each view is a
// real perspective illustration of the user's room — their footprint, their
// windows and doors, their furniture at their positions and finishes — drawn
// to SVG in the chosen style's palette and lighting preset (see roomSvg.js).

import { paletteFor } from './palettes.js'
import { renderRoomSvg } from './roomSvg.js'
import { SCENE_VIEWS, sceneLines, viewPrompt } from './scene.js'
import { angleLabel, materialName, money, pieceName, styleName, t } from './i18n.js'

const localeOf = (scene) => scene?.locale || 'uz'

function placementOf(it, room, locale) {
  const L = t(locale).scene
  const fx = it.x / room.widthM
  const fz = it.z / room.depthM
  const ns = fz < 0.33 ? 'north' : fz > 0.67 ? 'south' : ''
  const ew = fx < 0.33 ? 'west' : fx > 0.67 ? 'east' : ''
  if (!ns && !ew) return L.placementCentre
  return L.placement(L.dirs[ns && ew ? `${ns}-${ew}` : ns || ew])
}

/** Furniture lines straight from the scene — the user's own picks and prices. */
export function sceneFurniture(scene) {
  const locale = localeOf(scene)
  const L = t(locale).scene
  return sceneLines(scene).map((line) => {
    const first = line.items[0]
    const price = Math.round(line.unitPrice)
    return {
      name: pieceName(line.catalogId, locale),
      category: line.category,
      description: L.description(materialName(line.material, locale), first.widthM, first.depthM, first.heightM),
      typicalPriceLow: Math.round(price * 0.85),
      typicalPriceHigh: Math.round(price * 1.15),
      averagePrice: price,
      quantity: line.items.length,
      placement: line.items
        .map((it) => placementOf(it, scene.room, locale))
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(' '),
    }
  })
}

export function sceneExistingFeatures(scene) {
  const L = t(localeOf(scene)).scene
  const out = []
  for (const w of scene.walls) {
    for (const o of w.openings) {
      if (o.kind === 'socket') continue
      out.push(L.feature(L.kinds[o.kind] || o.kind, L.walls[w.id] || w.id, o.widthM))
    }
  }
  return out
}

export function demoSceneBrief(scene) {
  const locale = localeOf(scene)
  const T = t(locale)
  const L = T.scene
  const palette = paletteFor(scene.style)
  const furniture = sceneFurniture(scene)
  const total = furniture.reduce((s, f) => s + f.averagePrice * f.quantity, 0)
  const { limit, currency } = scene.budget
  const design = {
    styleName: scene.style,
    summary: L.summary(styleName(scene.style, locale), scene.room.widthM, scene.room.depthM, scene.items.length),
    palette: palette.map((hex, i) => ({ name: T.paletteNames[i], hex, usage: T.paletteUsage[i] })),
    materials: L.materials,
    lighting: scene.lighting === 'lamps' ? L.lightingLamps : L.lightingDay,
  }
  let notes = L.budgetNone
  if (limit) {
    notes = L.budgetLimit(money(total, currency, locale), money(limit, currency, locale))
    notes += total > limit ? L.budgetOver(money(total - limit, currency, locale)) : L.budgetLeft(money(limit - total, currency, locale))
  }
  return {
    demo: true,
    source: 'scene',
    room: {
      estimatedWidthM: scene.room.widthM,
      estimatedDepthM: scene.room.depthM,
      estimatedHeightM: scene.room.heightM,
      existingFeatures: sceneExistingFeatures(scene),
      lightingNotes: L.lightingNotes(L.presets[scene.lighting] || scene.lighting),
      confidence: 'high',
    },
    design,
    furniture,
    budget: {
      currency,
      limit,
      estimatedTotal: total,
      withinBudget: !limit || total <= limit,
      notes,
    },
    renderPrompts: SCENE_VIEWS.map((v) => ({
      angleId: v.angleId,
      angleLabel: angleLabel(v.angleId, locale, v.angleLabel),
      prompt: viewPrompt(scene, v, design),
    })),
    usage: { inputTokens: 0, outputTokens: 0 },
  }
}

/** Use the design's own palette when it has enough valid colours. */
function paletteOf(scene, design) {
  const hexes = (design?.palette || []).map((p) => p?.hex).filter((h) => /^#[0-9a-f]{6}$/i.test(String(h)))
  if (hexes.length >= 5) return hexes.slice(0, 5)
  return paletteFor(scene.style)
}

/** One SVG perspective render for one view. */
export function demoSceneRender(scene, angleId, design) {
  const view = SCENE_VIEWS.find((v) => v.angleId === angleId) || SCENE_VIEWS[0]
  return renderRoomSvg(scene, view, paletteOf(scene, design), { curtains: true, art: true })
}

export function demoSceneRenders({ scene, brief }) {
  return {
    renders: brief.renderPrompts.map((rp) => ({
      angleId: rp.angleId,
      angleLabel: rp.angleLabel,
      prompt: rp.prompt,
      image: demoSceneRender(scene, rp.angleId, brief.design),
    })),
    failures: [],
  }
}
