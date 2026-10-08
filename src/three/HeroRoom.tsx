import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useSceneReducedMotion } from './Canvas'
import { CameraBreath } from './effects/CameraBreath'
import { DustMotes } from './effects/DustMotes'
import { LightShaft } from './effects/LightShaft'
import { detectSceneTier } from './effects/quality'
import { SoftEnvironment, ToneMapping } from './effects/Studio'
import { GeoCache } from './furniture/geometry'
import {
  art,
  books,
  ceramic,
  fabric,
  glow,
  leaf,
  matte,
  metal,
  rug,
  shade,
  syncSheen,
  wood,
  type FurnitureMats,
  type Tier,
} from './furniture/materials'
import {
  Armchair,
  Bookshelf,
  CoffeeTable,
  Curtain,
  FloorLamp,
  FurnitureGeoContext,
  M,
  Plant,
  Rug,
  Pendant,
  Sofa,
  TableLamp,
  WallArt,
  useGeo,
} from './furniture/models'
import { disposeMaterialDeep, getRugMotifMask, type RugPattern } from './materials/maps'

/* ------------------------------------------------------------------ styles */

export type RoomStyleKey = 'minimal' | 'japandi' | 'modernUzbek' | 'classic'

const COLOR_ROLES = [
  'wall',
  'wallLower',
  'ceiling',
  'floor',
  'rug',
  'rugPattern',
  'sofa',
  'cushion',
  'wood',
  'metal',
  'plant',
  'pot',
  'shade',
  'art',
  'accent',
  'glow',
] as const

type ColorRole = (typeof COLOR_ROLES)[number]

export interface RoomStyle {
  label: string
  colors: Record<ColorRole, string>
  /** Opacity of the rug motif. Minimal is nearly bare, Modern Uzbek is loud. */
  patternStrength: number
}

/** All four palettes are pulled out of the brand ramp in src/design/theme.ts. */
export const ROOM_STYLES: Record<RoomStyleKey, RoomStyle> = {
  minimal: {
    label: 'Minimal',
    patternStrength: 0.16,
    colors: {
      wall: '#F6F1E9',
      wallLower: '#EFE8DD',
      ceiling: '#FFFFFF',
      floor: '#E4D9CB',
      rug: '#EDE6DB',
      rugPattern: '#CFC1AE',
      sofa: '#E4D9CB',
      cushion: '#F6F1E9',
      wood: '#C9B49A',
      metal: '#8E8579',
      plant: '#6E7F63',
      pot: '#EFE8DD',
      shade: '#FFFFFF',
      art: '#D8CBBA',
      accent: '#C6552F',
      glow: '#FFFDF7',
    },
  },
  japandi: {
    label: 'Japandi',
    patternStrength: 0.34,
    colors: {
      wall: '#E9E2D6',
      wallLower: '#DDD3C4',
      ceiling: '#F3EEE5',
      floor: '#A67B5B',
      rug: '#CFC3B2',
      rugPattern: '#8E8272',
      sofa: '#B9AD9B',
      cushion: '#9C9384',
      wood: '#6B4A35',
      metal: '#3A342D',
      plant: '#5C6E55',
      pot: '#8C7A67',
      shade: '#EFE7DA',
      art: '#4A3529',
      accent: '#A9603F',
      glow: '#FBF3E6',
    },
  },
  modernUzbek: {
    label: 'Modern Uzbek',
    patternStrength: 0.88,
    colors: {
      wall: '#EFE2D2',
      wallLower: '#E2CDB6',
      ceiling: '#F6F1E9',
      floor: '#8A5E3F',
      rug: '#A8452F',
      rugPattern: '#E4D9CB',
      sofa: '#C08A63',
      cushion: '#C6552F',
      wood: '#5A3A27',
      metal: '#7A5A2E',
      plant: '#61764F',
      pot: '#B0542F',
      shade: '#F2E2CB',
      art: '#C6552F',
      accent: '#C6552F',
      glow: '#FFF0DA',
    },
  },
  classic: {
    label: 'Classic',
    patternStrength: 0.52,
    colors: {
      wall: '#D8CBB8',
      wallLower: '#4A3529',
      ceiling: '#EFE8DD',
      floor: '#5A3E2B',
      rug: '#6B4A35',
      rugPattern: '#A67B5B',
      sofa: '#4A3529',
      cushion: '#A67B5B',
      wood: '#2A1D16',
      metal: '#6E5B3A',
      plant: '#4E6B4A',
      pot: '#3A2A20',
      shade: '#E4D9CB',
      art: '#2A1D16',
      accent: '#B4832A',
      glow: '#FAEFDC',
    },
  },
}

/** Narrows a loose string (e.g. a chip id from the locale file) to a style key. */
export function toRoomStyleKey(value: string | undefined): RoomStyleKey {
  return value && value in ROOM_STYLES ? (value as RoomStyleKey) : 'japandi'
}

/* --------------------------------------------------------------- room shell */

type V3 = [number, number, number]

const ROOM = { w: 6.4, d: 6.0, h: 2.9 }
/** Window cut into the left wall; the daylight rig is aimed through it. */
const WIN = { z0: -1.5, z1: 0.5, y0: 0.85, y1: 2.3 }
const WIN_Z = (WIN.z0 + WIN.z1) / 2
const WIN_Y = (WIN.y0 + WIN.y1) / 2
const WALL_X = -ROOM.w / 2
const BACK_Z = -ROOM.d / 2

const LAMP: V3 = [1.35, 0, -1.9]

/** Orbit pivot and camera start: ~4 m out, 1.25 m up, about 21 deg to the right. */
const CAM_TARGET: V3 = [-0.25, 0.72, -1.25]
const CAM_POS: V3 = [1.2, 1.25, 2.55]
const BASE_AZ = Math.atan2(CAM_POS[0] - CAM_TARGET[0], CAM_POS[2] - CAM_TARGET[2])
const SWAY = 0.2
const RUG = { x: -0.25, z: -0.5, w: 3.7, d: 2.5 }

/** Rug motif per style; Minimal stays nearly bare, Modern Uzbek is loud. */
const RUG_PATTERN: Record<RoomStyleKey, RugPattern> = {
  minimal: 'stripe',
  japandi: 'border',
  modernUzbek: 'medallion',
  classic: 'border',
}

const WHITE = new THREE.Color('#ffffff')
/** Prints are pale: the art colour tints the paper, it does not ink it. */
const ART_LIFT = 0.45

/* ------------------------------------------------------------ shared assets */

function createGeometries() {
  return {
    plane: new THREE.PlaneGeometry(1, 1),
    box: new THREE.BoxGeometry(1, 1, 1),
  }
}

function createMaterials(style: RoomStyle, styleKey: RoomStyleKey, tier: Tier) {
  const c = style.colors

  const floorMat = wood(c.floor, tier, [3, 7])
  // Floors are satin, not mirror: kill most of the clearcoat on the boards.
  const floorPhysical = floorMat as Partial<THREE.MeshPhysicalMaterial>
  // A soft satin sheen, enough to pick up the window and ground the pieces.
  if (typeof floorPhysical.clearcoat === 'number') {
    floorPhysical.clearcoat = 0.4
    floorPhysical.clearcoatRoughness = 0.22
  }
  floorMat.roughness = 0.55

  const rugMat = rug(c.rug, 'plain', tier)
  const motif = new THREE.MeshStandardMaterial({
    color: c.rugPattern,
    roughness: 0.98,
    transparent: true,
    opacity: style.patternStrength,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  motif.alphaMap = getRugMotifMask(RUG_PATTERN[styleKey])

  const artMat = art(c.art)
  artMat.color.lerp(WHITE, ART_LIFT)

  const shadeMat = shade(c.shade, c.glow)
  shadeMat.emissiveIntensity = 0.55

  return {
    wall: matte(c.wall, 0.96),
    wallLower: matte(c.wallLower, 0.9),
    ceiling: matte(c.ceiling, 1),
    floor: floorMat,
    rug: rugMat,
    rugPattern: motif,
    sofa: fabric(c.sofa, tier, 5),
    cushion: fabric(c.cushion, tier, 4),
    wood: wood(c.wood, tier),
    metal: metal(c.metal),
    plant: leaf(c.plant),
    pot: ceramic(c.pot, tier),
    shade: shadeMat,
    art: artMat,
    accent: fabric(c.accent, tier, 4),
    glow: glow(c.glow),
    lampGlow: glow(c.glow),
    soil: matte('#3b2c22', 1),
    books: books(),
  }
}

type Geo = ReturnType<typeof createGeometries>
type Mats = ReturnType<typeof createMaterials>
type MatKey = keyof Mats

/** Which palette role each material follows during a style cross-fade. */
const MATERIAL_ROLE: Partial<Record<MatKey, ColorRole>> = {
  wall: 'wall',
  wallLower: 'wallLower',
  ceiling: 'ceiling',
  floor: 'floor',
  rug: 'rug',
  rugPattern: 'rugPattern',
  sofa: 'sofa',
  cushion: 'cushion',
  wood: 'wood',
  metal: 'metal',
  plant: 'plant',
  pot: 'pot',
  shade: 'shade',
  art: 'art',
  accent: 'accent',
  glow: 'glow',
  lampGlow: 'glow',
}

/** The hero's materials, under the names the furniture library paints with. */
function furnitureView(m: Mats): FurnitureMats {
  return {
    upholstery: m.sofa,
    cushion: m.sofa,
    pillow: m.cushion,
    accent: m.accent,
    wood: m.wood,
    carcass: m.wood,
    metal: m.metal,
    ceramic: m.pot,
    leaf: m.plant,
    soil: m.soil,
    linen: m.cushion,
    sheer: m.shade,
    shade: m.shade,
    glow: m.lampGlow,
    rug: m.rug,
    books: m.books,
    art: m.art,
  }
}

const KitContext = createContext<{ geo: Geo; mats: Mats; fm: FurnitureMats } | null>(null)

function useKit() {
  const kit = useContext(KitContext)
  if (!kit) throw new Error('HeroRoom parts must render inside <HeroRoom>')
  return kit
}

/* ------------------------------------------------------------- mesh helpers */

interface PartProps {
  mat: MatKey
  position: V3
  scale: V3
  rotation?: V3
  cast?: boolean
  receive?: boolean
}

function Box({ mat, position, scale, rotation, cast = true, receive = true }: PartProps) {
  const { geo, mats } = useKit()
  return (
    <mesh
      geometry={geo.box}
      material={mats[mat]}
      position={position}
      scale={scale}
      rotation={rotation}
      castShadow={cast}
      receiveShadow={receive}
    />
  )
}

function Panel({ mat, position, scale, rotation, cast = false, receive = true }: PartProps) {
  const { geo, mats } = useKit()
  return (
    <mesh
      geometry={geo.plane}
      material={mats[mat]}
      position={position}
      scale={scale}
      rotation={rotation}
      castShadow={cast}
      receiveShadow={receive}
    />
  )
}

/* ------------------------------------------------------------------- pieces */

function Shell() {
  return (
    <group>
      <Panel mat="floor" position={[0, 0, 0]} scale={[ROOM.w, ROOM.d, 1]} rotation={[-Math.PI / 2, 0, 0]} />
      <Panel mat="ceiling" position={[0, ROOM.h, 0]} scale={[ROOM.w, ROOM.d, 1]} rotation={[Math.PI / 2, 0, 0]} />
      <Panel mat="wall" position={[0, ROOM.h / 2, BACK_Z]} scale={[ROOM.w, ROOM.h, 1]} />
      {/* Wainscot as a real 2 cm board with a cap rail, not a coplanar decal. */}
      <Box mat="wallLower" position={[0, 0.55, BACK_Z + 0.01]} scale={[ROOM.w, 1.1, 0.02]} cast={false} />
      <Box mat="wood" position={[0, 1.11, BACK_Z + 0.02]} scale={[ROOM.w, 0.03, 0.035]} cast={false} />

      {/* The left wall is four panels so the window is a real hole: the daylight
          rig shines through the gap and the panels cast its shadow for free. */}
      <Panel
        mat="wall"
        position={[WALL_X, ROOM.h / 2, (BACK_Z + WIN.z0) / 2]}
        scale={[WIN.z0 - BACK_Z, ROOM.h, 1]}
        rotation={[0, Math.PI / 2, 0]}
        cast
      />
      <Panel
        mat="wall"
        position={[WALL_X, ROOM.h / 2, (WIN.z1 + ROOM.d / 2) / 2]}
        scale={[ROOM.d / 2 - WIN.z1, ROOM.h, 1]}
        rotation={[0, Math.PI / 2, 0]}
        cast
      />
      <Panel
        mat="wall"
        position={[WALL_X, WIN.y0 / 2, WIN_Z]}
        scale={[WIN.z1 - WIN.z0, WIN.y0, 1]}
        rotation={[0, Math.PI / 2, 0]}
        cast
      />
      <Panel
        mat="wall"
        position={[WALL_X, (WIN.y1 + ROOM.h) / 2, WIN_Z]}
        scale={[WIN.z1 - WIN.z0, ROOM.h - WIN.y1, 1]}
        rotation={[0, Math.PI / 2, 0]}
        cast
      />

      {/* Right wall: without it the open side read as a black void. */}
      <Panel
        mat="wall"
        position={[-WALL_X, ROOM.h / 2, 0]}
        scale={[ROOM.d, ROOM.h, 1]}
        rotation={[0, -Math.PI / 2, 0]}
      />
      <Box mat="wood" position={[-WALL_X - 0.012, 0.05, 0]} scale={[0.022, 0.1, ROOM.d]} cast={false} />

      {/* Skirting, held off the wall by a millimetre so it never z-fights. */}
      <Box mat="wood" position={[0, 0.05, BACK_Z + 0.032]} scale={[ROOM.w, 0.1, 0.022]} cast={false} />
      <Box mat="wood" position={[WALL_X + 0.012, 0.05, 0]} scale={[0.022, 0.1, ROOM.d]} cast={false} />
    </group>
  )
}

function Window() {
  const w = WIN.z1 - WIN.z0
  const h = WIN.y1 - WIN.y0
  return (
    <group>
      {/* Sky plane sits just outside the opening and is unlit, so it reads as light. */}
      <Panel
        mat="glow"
        position={[WALL_X - 0.14, WIN_Y, WIN_Z]}
        scale={[w + 0.1, h + 0.1, 1]}
        rotation={[0, Math.PI / 2, 0]}
        receive={false}
      />
      <Box mat="wood" position={[WALL_X + 0.05, WIN.y0 - 0.02, WIN_Z]} scale={[0.16, 0.04, w + 0.16]} cast={false} />
      <Box mat="wood" position={[WALL_X + 0.03, WIN.y1, WIN_Z]} scale={[0.1, 0.07, w + 0.1]} cast={false} />
      <Box mat="wood" position={[WALL_X + 0.03, WIN_Y, WIN.z0]} scale={[0.1, h, 0.07]} cast={false} />
      <Box mat="wood" position={[WALL_X + 0.03, WIN_Y, WIN.z1]} scale={[0.1, h, 0.07]} cast={false} />
      <Box mat="wood" position={[WALL_X + 0.03, WIN_Y, WIN_Z]} scale={[0.05, h, 0.04]} cast={false} />
      <Box mat="wood" position={[WALL_X + 0.03, WIN.y0 + h * 0.62, WIN_Z]} scale={[0.05, 0.035, w]} cast={false} />
    </group>
  )
}

function HeroRug() {
  const { geo, mats, fm } = useKit()
  return (
    <group position={[RUG.x, 0, RUG.z]}>
      <Rug m={fm} w={RUG.w} d={RUG.d} />
      {/* Motif layer: its own colour through an alpha mask, cross-faded on a
          style change. Polygon offset, not a visible gap, keeps it on top. */}
      <mesh
        geometry={geo.plane}
        material={mats.rugPattern}
        position={[0, 0.0125, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[RUG.w, RUG.d, 1]}
        receiveShadow
      />
    </group>
  )
}

/** Base intensity of the lamp's practical light, shared with the flicker. */
const LAMP_INTENSITY = 4.2

function HeroLamp() {
  const { fm } = useKit()
  const [x, , z] = LAMP
  const lightRef = useRef<THREE.PointLight>(null)
  const reduced = useSceneReducedMotion()

  useFrame(({ clock }) => {
    const light = lightRef.current
    if (!light) return
    if (reduced) {
      light.intensity = LAMP_INTENSITY
      return
    }
    // Two slow, off-beat sines instead of one: a single sine reads as
    // "pulsing", layering a second frequency reads as an imperceptible,
    // organic flicker.
    const t = clock.elapsedTime
    light.intensity = LAMP_INTENSITY + Math.sin(t * 1.7) * 0.08 + Math.sin(t * 5.3 + 1.7) * 0.03
  })

  return (
    <group position={[x, 0, z]}>
      <FloorLamp m={fm} h={1.74} lit={false} />
      <pointLight
        ref={lightRef}
        position={[0, 1.5, 0]}
        color="#FFD3A0"
        intensity={LAMP_INTENSITY}
        distance={4.6}
        decay={2}
      />
    </group>
  )
}

function HeroFurniture() {
  const { fm } = useKit()
  const geo = useGeo()
  return (
    <group>
      <group position={[-0.5, 0, -2.0]}>
        <Sofa m={fm} w={2.5} d={0.96} h={0.84} />
      </group>
      <group position={[-0.35, 0, -0.62]}>
        <CoffeeTable m={fm} w={1.32} d={0.7} h={0.4} />
      </group>
      {/* Lounge chair angled toward the sofa: the conversation group. */}
      <group position={[1.35, 0, -0.5]} rotation={[0, -0.95, 0]}>
        <Armchair m={fm} w={0.84} d={0.84} h={0.82} />
      </group>
      {/* Side table with a lamp at the sofa's left arm. */}
      <group position={[-2.1, 0, -1.95]}>
        <M g={geo.cyl(0.24, 0.24, 0.03)} m={fm.wood} p={[0, 0.535, 0]} />
        <M g={geo.leg(0.03, 0.045, 0.52)} m={fm.wood} p={[0, 0.26, 0]} />
        <M g={geo.cyl(0.18, 0.2, 0.02)} m={fm.wood} p={[0, 0.01, 0]} />
        <TableLamp m={fm} p={[0.02, 0.55, -0.02]} />
      </group>
      <group position={[2.45, 0, BACK_Z + 0.2]}>
        <Bookshelf m={fm} w={1.38} d={0.34} h={1.78} />
      </group>
      <group position={[-0.5, 1.92, BACK_Z]}>
        <WallArt m={fm} w={0.94} h={0.7} />
      </group>
      <group position={[2.4, 0, -1.25]}>
        <Plant m={fm} h={1.25} w={0.6} kind="fiddle" />
      </group>
      <group position={[-2.55, 0, -0.95]}>
        <Plant m={fm} h={0.95} w={0.5} kind="palm" />
      </group>
      {/* Linen curtains drawn back either side of the window. */}
      <group position={[WALL_X + 0.09, 0, WIN_Z]} rotation={[0, Math.PI / 2, 0]}>
        <Curtain m={fm} w={2.9} h={2.62} panel={0.17} />
      </group>
      {/* Pendant over the coffee table; the bulb glows, the lamp does the lighting. */}
      <group position={[-0.35, 0, -0.62]}>
        <Pendant m={fm} y={2.05} ceiling={ROOM.h} lit={false} />
      </group>
    </group>
  )
}

/** Per-style props. Deliberately small; the colour lerp does the heavy lifting. */
function StyleExtras({ styleKey }: { styleKey: RoomStyleKey }) {
  const { fm, mats } = useKit()
  const geo = useGeo()

  let content: ReactNode = null
  if (styleKey === 'minimal') {
    content = (
      <group position={[-2.3, 0, 0.7]}>
        <Plant m={fm} h={0.7} w={0.5} kind="bush" />
      </group>
    )
  } else if (styleKey === 'japandi') {
    content = (
      <>
        {/* Zabuton floor cushions by the window. */}
        <M g={geo.block(0.66, 0.12, 0.66, 0.05, 0.03)} m={mats.cushion} p={[-1.95, 0.06, 0.45]} r={[0, 0.4, 0]} />
        <M g={geo.block(0.6, 0.11, 0.6, 0.05, 0.03)} m={mats.accent} p={[-1.9, 0.17, 0.42]} r={[0, 0.15, 0]} />
      </>
    )
  } else if (styleKey === 'modernUzbek') {
    content = (
      <>
        {/* Suzani hanging: a framed textile with the rug's motif. */}
        <group position={[1.15, 1.85, BACK_Z + 0.03]}>
          <M g={geo.block(0.9, 1.15, 0.02, 0.006)} m={mats.accent} />
          <mesh geometry={geo.plane()} material={mats.rugPattern} position={[0, 0, 0.0115]} rotation={[0, 0, Math.PI / 2]} scale={[1.1, 0.86, 1]} />
        </group>
        <M g={geo.block(0.78, 0.15, 0.78, 0.06, 0.035)} m={mats.cushion} p={[-1.95, 0.075, 0.5]} r={[0, 0.35, 0]} />
      </>
    )
  } else {
    content = (
      <>
        {/* Upholstered ottoman in front of the lounge chair, and a second print. */}
        <M g={geo.block(0.6, 0.4, 0.5, 0.06, 0.02)} m={mats.sofa} p={[0.75, 0.2, 0.3]} r={[0, -0.5, 0]} />
        <group position={[0.85, 1.95, BACK_Z]}>
          <WallArt m={fm} w={0.5} h={0.62} />
        </group>
      </>
    )
  }

  return <PopIn key={styleKey}>{content}</PopIn>
}

/** Style props scale up over the same beat as the colour cross-fade. */
function PopIn({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const t = useRef(0)
  useFrame((_, delta) => {
    const g = ref.current
    if (!g || t.current >= 1) return
    t.current = Math.min(1, t.current + Math.min(delta, 0.1) / 0.4)
    const e = 1 - Math.pow(1 - t.current, 3)
    g.scale.setScalar(0.82 + 0.18 * e)
  })
  return (
    <group ref={ref} scale={0.82}>
      {children}
    </group>
  )
}

/* -------------------------------------------------------------- transitions */

function useStyleTransition(mats: Mats, style: RoomStyle, styleKey: RoomStyleKey, durationMs: number) {
  const anim = useRef({
    t: 1,
    from: new Map<MatKey, THREE.Color>(),
    to: {} as Partial<Record<ColorRole, THREE.Color>>,
    fromPattern: style.patternStrength,
    toPattern: style.patternStrength,
    nextMask: null as THREE.Texture | null,
  })
  const previous = useRef<RoomStyle | null>(null)

  useEffect(() => {
    if (previous.current === style) return
    const first = previous.current === null
    previous.current = style
    if (first) return // materials were already built from this palette

    const a = anim.current
    a.from.clear()
    for (const key of Object.keys(MATERIAL_ROLE) as MatKey[]) {
      a.from.set(key, (mats[key] as THREE.MeshStandardMaterial).color.clone())
    }
    for (const role of COLOR_ROLES) a.to[role] = new THREE.Color(style.colors[role])
    a.fromPattern = mats.rugPattern.opacity
    a.toPattern = style.patternStrength
    a.nextMask?.dispose()
    a.nextMask = getRugMotifMask(RUG_PATTERN[styleKey])
    a.t = 0
  }, [mats, style, styleKey])

  useEffect(
    () => () => {
      anim.current.nextMask?.dispose()
    },
    [],
  )

  useFrame((_, delta) => {
    const a = anim.current
    if (a.t >= 1) return
    a.t = Math.min(1, a.t + (Math.min(delta, 0.1) * 1000) / durationMs)
    const e = 1 - Math.pow(1 - a.t, 3)

    a.from.forEach((from, key) => {
      const role = MATERIAL_ROLE[key]
      const to = role ? a.to[role] : undefined
      if (!to) return
      const mat = mats[key] as THREE.MeshStandardMaterial
      mat.color.copy(from).lerp(to, e)
      if (key === 'art') mat.color.lerp(WHITE, ART_LIFT * e)
      syncSheen(mat)
    })
    // The motif fades out, swaps to the new drawing at the bottom, fades in.
    if (e < 0.5) {
      mats.rugPattern.opacity = a.fromPattern * (1 - e * 2)
    } else {
      if (a.nextMask) {
        mats.rugPattern.alphaMap?.dispose()
        mats.rugPattern.alphaMap = a.nextMask
        a.nextMask = null
      }
      mats.rugPattern.opacity = a.toPattern * (e * 2 - 1)
    }
  })
}

/* ------------------------------------------------------------------- camera */

function ViewControls({ autoRotate }: { autoRotate: boolean }) {
  const ref = useRef<OrbitControlsImpl>(null)
  const clock = useThree((s) => s.clock)
  const idleSince = useRef(-Infinity)
  const interacting = useRef(false)
  const phase = useRef(0)

  useFrame(({ clock }, delta) => {
    const c = ref.current
    if (!c || !autoRotate || interacting.current) return
    // Resume the sway a few seconds after the visitor lets go, easing in
    // from wherever they left the camera rather than jumping back.
    if (clock.elapsedTime - idleSince.current < 4) return
    phase.current += Math.min(delta, 0.1) * 0.16
    const want = BASE_AZ + Math.sin(phase.current) * SWAY
    const now = c.getAzimuthalAngle()
    c.setAzimuthalAngle(now + (want - now) * Math.min(1, delta * 0.8))
  })

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      target={CAM_TARGET}
      enablePan={false}
      enableZoom={false}
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.42}
      // There is no fourth wall and no right wall: the visitor may nudge the
      // view, never orbit round behind the set.
      minAzimuthAngle={BASE_AZ - 0.55}
      maxAzimuthAngle={BASE_AZ + 0.45}
      minPolarAngle={1.3}
      maxPolarAngle={1.73}
      onStart={() => {
        interacting.current = true
      }}
      onEnd={() => {
        interacting.current = false
        idleSince.current = clock.elapsedTime
        // Pick the phase up where the camera now stands.
        const a = ref.current?.getAzimuthalAngle() ?? 0
        phase.current = Math.asin(THREE.MathUtils.clamp((a - BASE_AZ) / SWAY, -1, 1))
      }}
    />
  )
}

/** Re-bakes the one-shot contact shadow after a style swap settles. */
function useShadowBakes(styleKey: RoomStyleKey, delayMs: number) {
  const [bakes, setBakes] = useState(1)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const id = window.setTimeout(() => setBakes((n) => n + 1), delayMs)
    return () => window.clearTimeout(id)
  }, [styleKey, delayMs])
  return bakes
}

/* --------------------------------------------------------------------- room */

export interface HeroRoomProps {
  styleKey?: RoomStyleKey
  /** Forced off under prefers-reduced-motion regardless of this value. */
  autoRotate?: boolean
  /** Colour cross-fade duration in ms when `styleKey` changes. */
  transitionMs?: number
}

function disposeMats(m: Mats) {
  const seen = new Set<THREE.Material>()
  Object.values(m).forEach((mat) => {
    if (seen.has(mat)) return
    seen.add(mat)
    disposeMaterialDeep(mat)
  })
}

/** Carries the live (possibly mid-cross-fade) look from one set to another. */
function copyLook(from: Mats, to: Mats) {
  for (const key of Object.keys(MATERIAL_ROLE) as MatKey[]) {
    ;(to[key] as THREE.MeshStandardMaterial).color.copy((from[key] as THREE.MeshStandardMaterial).color)
    syncSheen(to[key])
  }
  to.rugPattern.opacity = from.rugPattern.opacity
}

/**
 * Builds the full-quality material set after the first frames, compiles its
 * programs asynchronously against the live scene's lights, then hands it
 * over. Also flips `rich` on for the deferred extras.
 */
function useRefinement({
  enabled,
  draft,
  latest,
  onReady,
  onRich,
}: {
  enabled: boolean
  draft: Mats
  latest: { current: { style: RoomStyle; key: RoomStyleKey } }
  onReady: (m: Mats) => void
  onRich: () => void
}) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const ref = useRef({ onReady, onRich, draft })
  ref.current = { onReady, onRich, draft }

  useEffect(() => {
    let cancelled = false
    let built: Mats | null = null
    const idle = (fn: () => void, ms: number) => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
      const t = window.setTimeout(() => (w.requestIdleCallback ? w.requestIdleCallback(fn, { timeout: 800 }) : fn()), ms)
      return () => window.clearTimeout(t)
    }

    const cancelRich = idle(() => {
      if (!cancelled) ref.current.onRich()
    }, 900)
    if (!enabled) {
      return () => {
        cancelled = true
        cancelRich()
      }
    }

    const cancelRefine = idle(async () => {
      if (cancelled) return
      built = createMaterials(latest.current.style, latest.current.key, 'high')
      const box = new THREE.BoxGeometry(0.01, 0.01, 0.01)
      const temp = new THREE.Scene()
      Object.values(built).forEach((m) => temp.add(new THREE.Mesh(box, m)))
      try {
        await gl.compileAsync(temp, camera, scene)
      } catch {
        // A failed pre-compile only costs the hitch we meant to avoid.
      }
      box.dispose()
      if (cancelled) {
        disposeMats(built)
        return
      }
      copyLook(ref.current.draft, built)
      ref.current.onReady(built)
      built = null
      invalidate()
    }, 1400)

    return () => {
      cancelled = true
      cancelRich()
      cancelRefine()
      if (built) disposeMats(built)
    }
    // Runs once per mount; the scene objects are stable for a canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
}

export function HeroRoom({ styleKey = 'japandi', autoRotate = true, transitionMs = 400 }: HeroRoomProps) {
  const reducedMotion = useSceneReducedMotion()
  const safeKey: RoomStyleKey = styleKey in ROOM_STYLES ? styleKey : 'japandi'
  const style = ROOM_STYLES[safeKey]
  const tier = useMemo(detectSceneTier, [])

  const geo = useMemo(createGeometries, [])
  const cache = useMemo(() => new GeoCache(tier), [tier])
  // Progressive first paint. The room opens on a cheap 'low' material set
  // (MeshStandard everywhere: a handful of quick programs), and only once
  // that frame is on screen are the physical materials (sheen, clearcoat,
  // bump) built, compiled off the critical path with `compileAsync`
  // (KHR_parallel_shader_compile where available) and swapped in. Shader
  // compilation, not texture or geometry generation, is what used to hold
  // the hero back for seconds on ANGLE/D3D.
  const latest = useRef({ style, key: safeKey })
  latest.current = { style, key: safeKey }
  const draft = useMemo(() => createMaterials(latest.current.style, latest.current.key, 'low'), [])
  const [refined, setRefined] = useState<Mats | null>(null)
  const mats = refined ?? draft
  const [rich, setRich] = useState(false)
  useRefinement({ enabled: tier === 'high', draft, latest, onReady: setRefined, onRich: () => setRich(true) })
  const fm = useMemo(() => furnitureView(mats), [mats])
  const kit = useMemo(() => ({ geo, mats, fm }), [geo, mats, fm])

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      cache.dispose()
    },
    [geo, cache],
  )
  useEffect(() => () => disposeMats(mats), [mats])

  useStyleTransition(mats, style, safeKey, transitionMs)
  const bakes = useShadowBakes(safeKey, Math.max(450, transitionMs))

  return (
    <KitContext.Provider value={kit}>
      <FurnitureGeoContext.Provider value={cache}>
        {/* Eye level, three-quarter from the front right, close enough that the
            sofa group fills the card. The pivot sits above the group's centre
            so the composition rides in the upper-middle, clear of the style
            switcher over the bottom fifth of the frame. */}
        <PerspectiveCamera makeDefault fov={37} near={0.1} far={40} position={CAM_POS} />
        <ViewControls autoRotate={autoRotate && !reducedMotion} />
        <CameraBreath />

        <ToneMapping mode="neutral" exposure={1.3} />
        <SoftEnvironment mood="daylight" intensity={0.95} resolution={tier === 'low' ? 32 : 64} />


        {/* Sky-lit top, warm floor-bounce bottom. The environment carries most
            of the fill now, so this stays low. */}
        <hemisphereLight args={['#FFF6EA', '#D9C3A8', 0.95]} />
        <directionalLight
          position={[-6.5, 4.4, 1.4]}
          intensity={3.4}
          color="#FFF1DC"
          castShadow
          shadow-mapSize={tier === 'low' ? [512, 512] : [2048, 2048]}
          shadow-bias={-0.0002}
          shadow-normalBias={0.03}
          shadow-radius={4}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
        />
        {/* Unshadowed fill from the open side, so front faces are not muddy. */}
        <directionalLight position={[3, 2.6, 6]} intensity={0.75} color="#FFF4E6" />
        {/* Ceiling bounce: daylight off a pale floor lifts the top of the room. */}
        <pointLight position={[0, ROOM.h - 0.35, -0.8]} intensity={2.2} distance={7} decay={1.6} color="#FFF0DE" />

        <Shell />
        <Window />
        <HeroRug />
        <HeroFurniture />
        <HeroLamp />
        <StyleExtras styleKey={safeKey} />

        {/* Grounding pass: baked once, and once more after each style swap
            settles, instead of every frame. */}
        {/* The extras (blur passes, additive sprites) wait until the room
            itself is on screen. */}
        {rich && (
          <>
            <ContactShadows
              position={[0, 0.016, -1.1]}
              scale={[6.4, 4.6]}
              blur={2.2}
              far={1.2}
              opacity={0.62}
              resolution={tier === 'low' ? 256 : 512}
              frames={bakes}
              color="#140d07"
            />
            <DustMotes center={[-1.6, 1.0, -0.8]} size={[1.8, 1.1, 1.3]} count={tier === 'low' ? 70 : 200} />
            {tier !== 'low' && (
              <LightShaft origin={[-3.15, 1.575, -0.5]} target={[0.2, 0.05, -1.5]} width={1.7} opacity={0.07} />
            )}
          </>
        )}
      </FurnitureGeoContext.Provider>
    </KitContext.Provider>
  )
}

export default HeroRoom
