import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import { SceneCanvas, useSceneReducedMotion } from './Canvas'
import { detectSceneTier, type SceneTier } from './effects/quality'
import { SoftEnvironment, ToneMapping } from './effects/Studio'
import { GeoCache } from './furniture/geometry'
import { PRODUCT_REAL_MODEL, REAL_MODELS, RealOrProcedural, type RealModelId } from './furniture/real'
import { disposeMaterialDeep } from './materials/maps'
import {
  createFurnitureMats,
  disposeFurnitureMats,
  lacquer,
  shade,
  syncSheen,
  type FurnitureMats,
  type FurniturePalette,
} from './furniture/materials'
import {
  Armchair,
  Bed,
  Bookshelf,
  CoffeeTable,
  Curtain,
  DiningTable,
  Divider,
  FloorLamp,
  FlutedPanel,
  FurnitureGeoContext,
  PaintSet,
  Pendant,
  Plant,
  Rug,
  Sideboard,
  Sofa,
} from './furniture/models'

/**
 * One piece of furniture on a turntable — the viewer behind every catalog card
 * and the full-bleed stage on `/catalog/:id`.
 *
 * ## Real models first, procedural behind them
 *
 * Most product kinds now load a real, freely licensed, photo-textured glTF
 * model (`./furniture/real.tsx`, `PRODUCT_REAL_MODEL`; credits in
 * `public/models/furniture/CREDITS.md`). The pipeline that produced them is
 * `scripts/furniture/build-models.mjs`:
 *
 *   glTF 2.0  ->  dedup / prune / weld  ->  WebP textures (1024, sofa 2048)
 *             ->  Meshopt geometry (EXT_meshopt_compression)  ->  .glb
 *
 * decoded with drei's `useGLTF` and three-stdlib's inline Meshopt decoder —
 * no decoder download, no CDN. The parsed glTF is cached per URL and shared by
 * every card on the page; each viewer clones the scene graph only.
 *
 * The procedural piece from the shared furniture library in `./furniture` —
 * rounded, puffed cushions with analytic normals, tapered splayed legs,
 * lathed ceramics, fluted doors, phyllotaxis foliage — is the Suspense and
 * error fallback, and is still the whole model for kinds with no good free
 * model yet (bed, floor lamp, rug, curtain, wall panel, paint set). Its
 * colours are lerped rather than rebuilt (a new material means a shader
 * recompile and a visible hitch); upholstered real models follow the same
 * cross-fade by copying the upholstery colour. The light is a baked
 * Lightformer environment plus one key — no HDR download.
 */

/* ------------------------------------------------------------------ public */

export type ProductModelKey =
  | 'sofa'
  | 'armchair'
  | 'diningTable'
  | 'coffeeTable'
  | 'shelf'
  | 'sideboard'
  | 'bed'
  | 'pendant'
  | 'floorLamp'
  | 'rug'
  | 'curtain'
  | 'wallPanel'
  | 'planter'
  | 'paintSet'
  | 'divider'

/** The six colour roles every stand-in model paints itself with. */
export interface ProductPalette {
  body: string
  accent: string
  wood: string
  metal: string
  fabric: string
  neutral: string
}

export const PRODUCT_MODEL_KEYS: ProductModelKey[] = [
  'sofa',
  'armchair',
  'diningTable',
  'coffeeTable',
  'shelf',
  'sideboard',
  'bed',
  'pendant',
  'floorLamp',
  'rug',
  'curtain',
  'wallPanel',
  'planter',
  'paintSet',
  'divider',
]

/* --------------------------------------------------------------- materials */

type V3 = [number, number, number]

const COLOR_ROLES = ['body', 'accent', 'wood', 'metal', 'fabric', 'neutral'] as const
type ColorRole = (typeof COLOR_ROLES)[number]

type MatKey = keyof FurnitureMats

/** Fixed tones for roles a catalog palette does not describe. */
const FIXED = { leaf: '#5F7052', glow: '#FFF1DA', books: '#ffffff' }

/**
 * Which catalog colour drives each furniture role. `null` = fixed colour.
 * Cushions share the frame's fabric (as on a real sofa); throw pillows take
 * the lighter `fabric`, bedding and ceramics the `neutral`.
 */
function roleSources(model: ProductModelKey): Record<MatKey, ColorRole | null> {
  return {
    upholstery: 'body',
    cushion: 'body',
    pillow: 'fabric',
    accent: 'accent',
    wood: 'wood',
    carcass: 'body',
    metal: 'metal',
    ceramic: 'neutral',
    leaf: model === 'planter' ? 'body' : null,
    soil: null,
    linen: model === 'bed' ? 'neutral' : 'fabric',
    sheer: 'fabric',
    shade: 'neutral',
    glow: null,
    rug: 'body',
    books: null,
    art: 'body',
  }
}

function createProductMats(palette: ProductPalette, model: ProductModelKey, tier: SceneTier): FurnitureMats {
  const src = roleSources(model)
  const col = (key: MatKey, fallback: string) => {
    const role = src[key]
    return role ? palette[role] : fallback
  }
  const fp: FurniturePalette = {
    upholstery: col('upholstery', palette.body),
    cushion: col('cushion', palette.body),
    pillow: col('pillow', palette.fabric),
    accent: col('accent', palette.accent),
    wood: col('wood', palette.wood),
    carcass: col('carcass', palette.body),
    metal: col('metal', palette.metal),
    ceramic: col('ceramic', palette.neutral),
    leaf: col('leaf', FIXED.leaf),
    linen: col('linen', palette.neutral),
    rug: col('rug', palette.body),
    art: col('art', palette.body),
    glow: FIXED.glow,
  }
  const set = createFurnitureMats(fp, tier, 'medallion')
  // Case goods in the catalogue are painted or stained, not raw boards.
  disposeMaterialDeep(set.carcass)
  set.carcass = lacquer(fp.carcass, tier)
  disposeMaterialDeep(set.sheer)
  set.sheer = shade(col('sheer', palette.fabric), FIXED.glow)
  const lamp = model === 'floorLamp' || model === 'pendant'
  ;(set.shade as THREE.MeshStandardMaterial).color.set(col('shade', palette.neutral))
  ;(set.shade as THREE.MeshStandardMaterial).emissiveIntensity = lamp ? 0.42 : 0
  return set
}

type ColorMat = THREE.Material & { color: THREE.Color }

/** Cross-fades the palette instead of rebuilding materials (see file header). */
function usePaletteTransition(
  mats: FurnitureMats,
  palette: ProductPalette,
  model: ProductModelKey,
  durationMs: number,
) {
  const anim = useRef({
    t: 1,
    from: {} as Partial<Record<ColorRole, THREE.Color>>,
    to: {} as Partial<Record<ColorRole, THREE.Color>>,
    start: new Map<MatKey, THREE.Color>(),
  })
  const previous = useRef<ProductPalette | null>(null)
  const invalidate = useThree((state) => state.invalidate)
  const sources = useMemo(() => roleSources(model), [model])

  useEffect(() => {
    const prev = previous.current
    previous.current = palette
    if (!prev) return
    if (COLOR_ROLES.every((role) => prev[role] === palette[role])) return

    const a = anim.current
    a.start.clear()
    for (const key of Object.keys(sources) as MatKey[]) {
      if (!sources[key]) continue
      a.start.set(key, (mats[key] as ColorMat).color.clone())
    }
    for (const role of COLOR_ROLES) a.to[role] = new THREE.Color(palette[role])
    a.t = 0
    // The canvas renders on demand; the cross-fade asks for its own frames.
    invalidate()
  }, [mats, palette, invalidate, sources])

  useFrame((_, delta) => {
    const a = anim.current
    if (a.t >= 1) return
    a.t = Math.min(1, a.t + (Math.min(delta, 1 / 30) * 1000) / durationMs)
    if (a.t < 1) invalidate()
    const e = 1 - Math.pow(1 - a.t, 3)
    a.start.forEach((from, key) => {
      const role = sources[key]
      const to = role ? a.to[role] : undefined
      if (!to) return
      const mat = mats[key] as ColorMat
      mat.color.copy(from).lerp(to, e)
      syncSheen(mat)
    })
  })
}

/* ------------------------------------------------------------------ models */

type ModelFn = (props: { m: FurnitureMats }) => ReactNode

const MODELS: Record<ProductModelKey, ModelFn> = {
  sofa: ({ m }) => <Sofa m={m} w={2.2} d={0.94} h={0.84} />,
  armchair: ({ m }) => <Armchair m={m} w={0.84} d={0.86} h={0.8} />,
  diningTable: ({ m }) => <DiningTable m={m} w={1.9} d={0.92} h={0.75} />,
  coffeeTable: ({ m }) => <CoffeeTable m={m} w={1.1} d={0.6} h={0.42} />,
  shelf: ({ m }) => <Bookshelf m={m} w={1.1} d={0.34} h={1.92} />,
  sideboard: ({ m }) => <Sideboard m={m} w={1.66} d={0.46} h={0.82} legH={0.18} />,
  bed: ({ m }) => <Bed m={m} w={1.7} d={2.06} h={0.55} />,
  pendant: ({ m }) => <Pendant m={m} y={1.2} ceiling={2.24} intensity={2.4} />,
  floorLamp: ({ m }) => <FloorLamp m={m} h={1.72} intensity={2.6} />,
  rug: ({ m }) => <Rug m={m} w={2.4} d={1.7} />,
  curtain: ({ m }) => <Curtain m={m} w={2.1} h={2.42} />,
  wallPanel: ({ m }) => (
    <group position={[0, 1.05, 0]}>
      <FlutedPanel m={m} w={1.3} h={1.0} />
    </group>
  ),
  planter: ({ m }) => <Plant m={m} h={1.24} w={0.6} kind="fiddle" />,
  paintSet: ({ m }) => <PaintSet m={m} />,
  divider: ({ m }) => <Divider m={m} />,
}

/** Camera framing per model, in metres. `target` is the orbit pivot height. */
const FRAMES: Record<ProductModelKey, { radius: number; height: number; target: number }> = {
  sofa: { radius: 3.6, height: 1.35, target: 0.45 },
  armchair: { radius: 2.2, height: 1.05, target: 0.42 },
  diningTable: { radius: 3.4, height: 1.5, target: 0.45 },
  coffeeTable: { radius: 2.2, height: 1.0, target: 0.26 },
  shelf: { radius: 3.8, height: 1.6, target: 0.96 },
  sideboard: { radius: 3.2, height: 1.3, target: 0.52 },
  bed: { radius: 4.6, height: 2.0, target: 0.45 },
  pendant: { radius: 2.2, height: 1.5, target: 1.45 },
  floorLamp: { radius: 3.2, height: 1.4, target: 0.9 },
  rug: { radius: 3.2, height: 2.3, target: 0.02 },
  curtain: { radius: 4.3, height: 1.7, target: 1.2 },
  wallPanel: { radius: 2.6, height: 1.2, target: 1.05 },
  planter: { radius: 2.3, height: 1.0, target: 0.58 },
  paintSet: { radius: 1.5, height: 0.75, target: 0.14 },
  divider: { radius: 3.8, height: 1.5, target: 0.92 },
}

/**
 * Model bounds in metres: footprint (w x d) and vertical span y0..y1, decor
 * included. Framing is computed from these, never hand-tuned per aspect.
 */
const BOUNDS: Record<ProductModelKey, { w: number; d: number; y0: number; y1: number }> = {
  sofa: { w: 2.2, d: 0.94, y0: 0, y1: 0.9 },
  armchair: { w: 0.84, d: 0.86, y0: 0, y1: 0.82 },
  diningTable: { w: 1.9, d: 0.92, y0: 0, y1: 1.08 },
  coffeeTable: { w: 1.1, d: 0.6, y0: 0, y1: 0.58 },
  shelf: { w: 1.1, d: 0.34, y0: 0, y1: 1.92 },
  sideboard: { w: 1.66, d: 0.46, y0: 0, y1: 1.36 },
  bed: { w: 1.7, d: 2.06, y0: 0, y1: 1.1 },
  pendant: { w: 0.5, d: 0.5, y0: 1.0, y1: 2.24 },
  floorLamp: { w: 0.42, d: 0.42, y0: 0, y1: 1.74 },
  rug: { w: 2.55, d: 1.7, y0: 0, y1: 0.02 },
  curtain: { w: 2.3, d: 0.2, y0: 0, y1: 2.46 },
  wallPanel: { w: 1.3, d: 0.06, y0: 0.55, y1: 1.55 },
  planter: { w: 0.7, d: 0.7, y0: 0, y1: 1.26 },
  paintSet: { w: 0.96, d: 0.6, y0: 0, y1: 0.36 },
  divider: { w: 1.9, d: 0.75, y0: 0, y1: 1.82 },
}

const FOV = 32
/** Breathing room around the silhouette, per side. */
const MARGIN = 1.12

/**
 * Camera distance that fits the model in BOTH the vertical and horizontal
 * field of view for this aspect, through a full turntable revolution: the
 * horizontal half-extent is half the footprint diagonal, the widest the piece
 * ever gets while spinning. Elevation comes from the per-model FRAMES pitch.
 */
function fitDistance(b: { w: number; d: number; y0: number; y1: number }, aspect: number, pitch: number): number {
  const rH = Math.hypot(b.w, b.d) / 2
  const hh = Math.max(0.01, (b.y1 - b.y0) / 2)
  const vHalf = THREE.MathUtils.degToRad(FOV / 2)
  const hHalf = Math.atan(Math.tan(vHalf) * Math.max(0.2, aspect))
  // Projected half-extents seen from `pitch` above the horizon.
  const ex = rH
  const ey = hh * Math.cos(pitch) + rH * Math.sin(pitch)
  // The near side of the piece is closer than the pivot; part of rH in depth.
  const near = rH * 0.6
  const dH = near + (ex * MARGIN) / Math.tan(hHalf)
  const dV = near * Math.cos(pitch) + (ey * MARGIN) / Math.tan(vHalf)
  return Math.max(dH, dV)
}

/**
 * Real-model target box per key (metres): the same dimensions the procedural
 * stand-in is built at, so the swap does not move the camera or the shadow.
 * `y1` replaces the bounds' top where the stand-in carried decor (a vase on
 * the sideboard, a centrepiece on the table) that the photographed model has
 * not — the frame then hugs what is really there.
 */
const REAL_BOX: Partial<Record<ProductModelKey, { w: number; d: number; h: number; top?: number; y1: number }>> = {
  sofa: { w: 2.2, d: 0.94, h: 0.84, y1: 0.86 },
  // Uniform 'footprint' fit: the chair keeps its own proportions (~0.9 m tall).
  armchair: { w: 0.84, d: 0.86, h: 0.8, y1: 0.92 },
  diningTable: { w: 1.9, d: 0.92, h: 0.75, y1: 0.77 },
  coffeeTable: { w: 1.1, d: 0.6, h: 0.42, y1: 0.44 },
  shelf: { w: 1.1, d: 0.34, h: 1.92, y1: 1.92 },
  sideboard: { w: 1.66, d: 0.46, h: 0.82, y1: 0.84 },
  planter: { w: 0.6, d: 0.6, h: 1.24, y1: 1.26 },
  pendant: { w: 0.5, d: 0.5, h: 1.24, top: 2.24, y1: 2.24 },
  divider: { w: 1.9, d: 0.75, h: 1.82, y1: 1.84 },
}

/** Footprint of the soft floor shadow (x, z), metres. */
const FOOTPRINT: Record<ProductModelKey, [number, number]> = {
  sofa: [2.4, 1.1],
  armchair: [1.0, 1.0],
  diningTable: [2.1, 1.1],
  coffeeTable: [1.3, 0.8],
  shelf: [1.3, 0.55],
  sideboard: [1.9, 0.7],
  bed: [2.0, 2.4],
  pendant: [0.9, 0.9],
  floorLamp: [0.6, 0.6],
  rug: [2.6, 1.9],
  curtain: [2.3, 0.4],
  wallPanel: [1.4, 0.3],
  planter: [0.7, 0.7],
  paintSet: [1.1, 0.75],
  divider: [2.0, 0.9],
}

/* ------------------------------------------------------------ ground plate */

let shadowCanvas: HTMLCanvasElement | null = null

/**
 * A 128px radial-gradient alpha map, drawn once per page. Each viewer wraps it
 * in its own texture (one per WebGL context, disposed with the viewer). A real
 * soft shadow needs a depth pass per canvas, which is exactly the cost a grid
 * of these must not pay; the detail stage adds real contact shadows.
 */
function makeShadowTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  if (!shadowCanvas) {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(0,0,0,0.55)')
    gradient.addColorStop(0.35, 'rgba(0,0,0,0.32)')
    gradient.addColorStop(0.7, 'rgba(0,0,0,0.09)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    shadowCanvas = canvas
  }
  return new THREE.CanvasTexture(shadowCanvas)
}

function FakeContactShadow({ size }: { size: [number, number] }) {
  const { geo } = useKit()
  const material = useMemo(() => {
    const map = makeShadowTexture()
    return map
      ? new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity: 0.9, toneMapped: false })
      : null
  }, [])
  useEffect(() => () => {
    material?.map?.dispose()
    material?.dispose()
  }, [material])
  if (!material) return null
  return (
    <mesh
      geometry={geo.plane()}
      material={material}
      position={[0, 0.001, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[size[0] * 1.25, size[1] * 1.35, 1]}
      renderOrder={-1}
    />
  )
}

/* ---------------------------------------------------------------- rotation */

/**
 * Eases the turntable up to speed on hover and back down on leave — it never
 * snaps, and it never springs back to the front, because the visitor is meant
 * to be able to stop the piece where they want it.
 */
function Turntable({ spin, speed, children }: { spin: boolean; speed: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const current = useRef(0)
  const reduced = useSceneReducedMotion()
  const invalidate = useThree((state) => state.invalidate)

  // Demand-rendered: a spin request has to start the loop itself.
  useEffect(() => {
    if (spin && !reduced) invalidate()
  }, [spin, reduced, invalidate])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const target = spin && !reduced ? speed : 0
    // Clamp the step: after a tab switch delta can be seconds long.
    const dt = Math.min(delta, 1 / 30)
    current.current += (target - current.current) * Math.min(1, dt * 3.2)
    if (Math.abs(current.current) < 0.0004 && target === 0) {
      current.current = 0
      return
    }
    g.rotation.y += current.current * dt
    // Keep frames coming only while spinning or easing down.
    invalidate()
  })

  return <group ref={group}>{children}</group>
}

function ViewControls({ target, radius }: { target: number; radius: number }) {
  const ref = useRef<OrbitControlsImpl>(null)
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      target={[0, target, 0]}
      enablePan={false}
      enableZoom
      enableDamping
      dampingFactor={0.07}
      rotateSpeed={0.5}
      zoomSpeed={0.5}
      minDistance={radius * 0.55}
      maxDistance={radius * 1.5}
      // No under-the-floor views and no top-down: the piece always reads as
      // standing on something.
      minPolarAngle={0.5}
      maxPolarAngle={1.5}
    />
  )
}

/* ----------------------------------------------------------------- lighting */

function Rig({ shadows, tier }: { shadows: boolean; tier: SceneTier }) {
  return (
    <>
      <ToneMapping mode="neutral" exposure={1.0} />
      <SoftEnvironment mood="studio" intensity={0.85} resolution={tier === 'low' ? 32 : shadows ? 128 : 64} />
      {/* Low hemisphere: the environment does most of the fill now. */}
      <hemisphereLight args={['#F2ECE0', '#3a2a1c', 0.28]} />
      <directionalLight
        position={[3.2, 5.4, 3.6]}
        intensity={1.5}
        color="#FFF3E2"
        castShadow={shadows}
        shadow-mapSize={tier === 'low' ? [512, 512] : [2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
        shadow-radius={5}
        shadow-camera-near={0.5}
        shadow-camera-far={18}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      {/* Warm rim from behind-left so the silhouette separates from the plate. */}
      <directionalLight position={[-4.2, 2.6, -3.4]} intensity={0.55} color="#FFE2C0" />
    </>
  )
}

/* ------------------------------------------------------------------- scene */

export interface ProductSceneProps {
  model: ProductModelKey
  palette: ProductPalette
  spin?: boolean
  interactive?: boolean
  /** Real shadow maps. Off for cards, on for the detail stage. */
  shadows?: boolean
  spinSpeed?: number
  /** Extra yaw applied once, so a grid of cards is not a row of clones. */
  offset?: number
  /**
   * Which real model to load. Omitted: the default for `model`
   * (`PRODUCT_REAL_MODEL`). `null`: always the procedural stand-in.
   */
  variant?: RealModelId | null
}

interface Kit {
  geo: GeoCache
}

const KitContext = createContext<Kit | null>(null)

function useKit(): Kit {
  const kit = useContext(KitContext)
  if (!kit) throw new Error('Product parts must render inside <ProductScene>')
  return kit
}

/**
 * The scene only — use it when you already have a `SceneCanvas` open. Most
 * callers want `<ProductViewer>`, which brings its own.
 */
export function ProductScene({
  model: modelProp,
  palette,
  spin = false,
  interactive = false,
  shadows = false,
  spinSpeed = 0.34,
  offset = 0,
  variant,
}: ProductSceneProps) {
  const model: ProductModelKey = modelProp in MODELS ? modelProp : 'armchair'
  const frame = FRAMES[model]
  const Model = MODELS[model]
  const tier = useMemo(detectSceneTier, [])
  const realId = variant === undefined ? (PRODUCT_REAL_MODEL[model] ?? null) : variant
  const realBox = realId ? REAL_BOX[model] : undefined

  const geo = useMemo(() => new GeoCache(tier), [tier])
  const latest = useRef(palette)
  latest.current = palette
  // Rebuilt only when the model changes (a different role mapping); a palette
  // change is a colour cross-fade, never a shader recompile.
  const mats = useMemo(() => createProductMats(latest.current, model, tier), [model, tier])
  const kit = useMemo(() => ({ geo }), [geo])

  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => disposeFurnitureMats(mats), [mats])

  usePaletteTransition(mats, palette, model, 420)

  // 22° off-axis: a three-quarter view reads as an object, a head-on view
  // reads as a picture of an object. The camera stays put and `offset` turns
  // the piece instead, so a grid of cards is not a row of identical clones —
  // moving both would cancel out.
  const AZIMUTH = 0.38
  const aspect = useThree((s) => (s.size.height > 0 ? s.size.width / s.size.height : 1))
  const bounds = realBox ? { ...BOUNDS[model], y1: realBox.y1 } : BOUNDS[model]
  // Pitch is the per-model look-down angle; the pivot is the bounds' centre.
  const pitch = Math.atan2(frame.height - frame.target, frame.radius)
  const centreY = (bounds.y0 + bounds.y1) / 2
  const dist = fitDistance(bounds, aspect, pitch)
  const camera: V3 = [
    Math.sin(AZIMUTH) * Math.cos(pitch) * dist,
    centreY + Math.sin(pitch) * dist,
    Math.cos(AZIMUTH) * Math.cos(pitch) * dist,
  ]
  const realShadows = shadows && tier === 'high'

  return (
    <KitContext.Provider value={kit}>
      <FurnitureGeoContext.Provider value={geo}>
        <PerspectiveCamera makeDefault fov={FOV} near={0.05} far={Math.max(40, dist * 4)} position={camera} />
        {interactive ? <ViewControls target={centreY} radius={dist} /> : <CameraAim target={centreY} />}

        <Rig shadows={shadows} tier={tier} />

        <Turntable spin={spin} speed={spinSpeed}>
          <group rotation={[0, offset, 0]}>
            {realId && realBox ? (
              <RealOrProcedural
                id={realId}
                fallback={<Model m={mats} />}
                w={realBox.w}
                d={realBox.d}
                h={realBox.h}
                top={realBox.top}
                // Upholstery follows the palette's cross-fade live.
                tint={REAL_MODELS[realId].tintable ? (mats.upholstery as THREE.MeshStandardMaterial).color : null}
                castShadow={shadows}
              />
            ) : (
              <Model m={mats} />
            )}
          </group>
        </Turntable>

        {realShadows ? (
          <>
            <ContactShadows
              position={[0, 0.001, 0]}
              scale={Math.max(...FOOTPRINT[model]) * 2}
              blur={2.6}
              far={1.6}
              opacity={0.6}
              resolution={512}
              color="#1a120c"
            />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
              <planeGeometry args={[frame.radius * 4, frame.radius * 4]} />
              <shadowMaterial opacity={0.14} />
            </mesh>
          </>
        ) : (
          <>
            <FakeContactShadow size={FOOTPRINT[model]} />
            {shadows && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[frame.radius * 4, frame.radius * 4]} />
                <shadowMaterial opacity={0.12} />
              </mesh>
            )}
          </>
        )}
      </FurnitureGeoContext.Provider>
    </KitContext.Provider>
  )
}

/** Points a non-interactive camera at the piece without OrbitControls. */
function CameraAim({ target }: { target: number }) {
  useFrame(({ camera }) => {
    camera.lookAt(0, target, 0)
  })
  return null
}

/* ------------------------------------------------------------------ viewer */

/** Stroke-only elevation shown when the browser has no WebGL. */
function ElevationFallback({ label }: { label?: string }) {
  return (
    <svg
      viewBox="0 0 200 150"
      width="100%"
      height="100%"
      fill="none"
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      <g stroke="var(--clay-300)" strokeWidth="1.25" strokeLinejoin="round">
        <path d="M44 108 L44 62 Q44 54 54 54 L146 54 Q156 54 156 62 L156 108" />
        <path d="M44 86 L156 86" />
        <path d="M62 54 L62 86 M138 54 L138 86" />
        <path d="M54 108 L54 118 M146 108 L146 118" />
      </g>
      <g stroke="var(--hairline)" strokeWidth="1">
        <path d="M24 130 L176 130" />
        <path d="M24 125 L24 135 M176 125 L176 135" />
      </g>
    </svg>
  )
}

export interface ProductViewerProps extends ProductSceneProps {
  className?: string
  style?: CSSProperties
  /** Accessible name for the plate: an image when still, a 3D control when interactive. */
  label?: string
  fallback?: ReactNode
  /** Freeze the frameloop even while on screen (a modal is open above it). */
  paused?: boolean
  /** IntersectionObserver margin handed to SceneCanvas. */
  rootMargin?: string
}

export function ProductViewer({
  className,
  style,
  label,
  fallback,
  paused,
  rootMargin = '160px',
  ...scene
}: ProductViewerProps) {
  return (
    <SceneCanvas
      className={className}
      style={style}
      paused={paused}
      rootMargin={rootMargin}
      // Still most of the time: frames only while spinning, fading or damping.
      // drei's OrbitControls invalidates on every change, damping included.
      frameloop="demand"
      interactive={Boolean(scene.interactive)}
      label={label}
      shadows={scene.shadows ? 'soft' : false}
      fallback={fallback ?? <ElevationFallback label={label} />}
      sceneFallback={null}
    >
      <ProductScene {...scene} />
    </SceneCanvas>
  )
}

export default ProductViewer

/** Narrows a loose string (an API field) to a model key. */
export function toProductModelKey(value: string | undefined | null): ProductModelKey {
  return value && value in MODELS ? (value as ProductModelKey) : 'armchair'
}
