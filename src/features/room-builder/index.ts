/** Public surface of the room-builder feature (brief §7). */
export { useBuilder, findCollisions, BUDGET_PRESETS, DEFAULT_BUDGET } from './store'
export { useBuilderShortcuts } from './useShortcuts'
export { CATALOG, CATALOG_GROUPS, MATERIAL_KEYS, MATERIAL_HEX, entryFor } from './catalog'
export { buildScenePayload, logScenePayload, SCENE_ENDPOINT, estimatedTotal } from './payload'
export { detectQuality, QUALITY } from './quality'
export * from './types'
export { renderScene, RenderSceneError, RENDER_SCENE_URL } from './api'
export { money, moneyShort, useMoneyFormat, UZS_PER_USD } from './format'
