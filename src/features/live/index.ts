/**
 * "See by yourself" — brief §9. Three modes with automatic fallback.
 *
 * Public surface of the feature. `LiveExperience` is the only thing a page
 * needs; everything else is exported because the styleguide, a future catalog
 * AR viewer and the tests all have a legitimate reason to reach for one piece
 * of it.
 */

export { LiveExperience } from './LiveExperience'
export type { LiveExperienceProps } from './LiveExperience'

export { ModePanorama } from './ModePanorama'
export { ModeAugmented } from './ModeAugmented'
export { ModeRestyle } from './ModeRestyle'

export { AlignmentDeck } from './AlignmentDeck'
export { BubbleLevel } from './BubbleLevel'
export { HeadingTape } from './HeadingTape'
export { NudgeDial } from './NudgeDial'
export { GhostAnchor } from './GhostAnchor'
export { DesktopHandoff } from './DesktopHandoff'
export { LiveIntro } from './LiveIntro'
export { LiveNotice } from './LiveNotice'
export { LiveTopBar } from './LiveTopBar'
export { Cluster, Readout, IconButton, LiveChromeStyles } from './Chrome'

export { useLiveOrientation, useLiveReadout } from './useLiveOrientation'
export type { LiveOrientation, LiveReadout } from './useLiveOrientation'
export { useAlignment, HEADING_TOLERANCE, PITCH_TOLERANCE } from './useAlignment'
export type { Alignment } from './useAlignment'
export { useLiveCapabilities } from './capabilities'
export { useStage } from './useStage'
export { useEquirect } from './useEquirect'

export { planPanorama, anchorGhost, ANCHOR_ANGLE_ID, YAW_BY_ANGLE } from './renders'
export type { PanoramaPlan } from './renders'
export { LIVE_MODELS, modelById, hasAssets } from './models'
export type { LiveModel } from './models'

export {
  RestyleConnection,
  RestyleError,
  isRestyleConfigured,
  mintRestyleSession,
  restyleEndpoint,
  FREE_SESSION_SECONDS,
  FREE_SESSION_RANGE,
} from './realtime'
export type { RestyleSession, RestylePlan, RestyleErrorCode } from './realtime'

export * from './orientation'
export type {
  LiveModeId,
  LiveProject,
  LiveRender,
  LiveFrame,
  LiveCapabilities,
  HeadingSource,
  MotionPermission,
} from './types'
