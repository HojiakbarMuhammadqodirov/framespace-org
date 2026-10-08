/** Public surface of the capture feature. */
export { CaptureStyles, Bezel, ArrowButton, Eyebrow, Notice, Rise, StepRail } from './Chrome'
export { CompassRing } from './CompassRing'
export { useCaptureFlow } from './useCaptureFlow'
export type { CaptureFlow } from './useCaptureFlow'
export { ANGLES, ANGLE_ORDER, REQUIRED_ANGLE_IDS, RECOMMENDED_ANGLE_IDS, angleById } from './contract'
export {
  cacheRecord,
  clearRecords,
  duplicateRecord,
  forgetRecord,
  getRecord,
  isSaved,
  listRecords,
  newProjectId,
  persistRecord,
  variantsOf,
} from './store'
export type {
  AngleId,
  CaptureRecord,
  CaptureStep,
  DesignBrief,
  FurnitureItem,
  RenderResponse,
  Shot,
  ShotMeta,
} from './types'
