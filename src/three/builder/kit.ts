/**
 * Shared geometry and material kit for the room-builder scene.
 *
 * Same idiom as HeroRoom: build the primitives once, hand them to every mesh,
 * never construct a material inside a render. A new material is a shader
 * recompile and a visible hitch, which in an editor happens on every drag.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import * as THREE from 'three'
import { QUALITY, type QualityTier } from '@/features/room-builder/quality'
import { GeoCache } from '../furniture/geometry'
import {
  createFurnitureMats,
  disposeFurnitureMats,
  type FurnitureMats,
} from '../furniture/materials'
import { disposeMaterialDeep } from '../materials/maps'
import { ROOM_STYLES } from '../HeroRoom'
import { STYLE_FINISH, type FinishStyle } from '../environment/catalog'
import {
  applySurface,
  createGlassMaterial,
  createShadowCasterMaterial,
  createSurfaceMaterial,
  loadSurface,
  peekSurface,
  surfaceOf,
} from '../environment/surfaces'

/**
 * The scene cannot read a CSS custom property, so it resolves them once at
 * build time and keeps the hex. Tokens stay the source of truth; the fallback
 * only matters before the stylesheet has landed.
 */
export function cssColor(token: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
    return value || fallback
  } catch {
    return fallback
  }
}

/**
 * Bumps whenever the resolved theme can have changed — a `data-theme` flip on
 * <html> or the OS scheme changing under an auto theme. Put it in the deps of
 * whatever resolves tokens, so the scene follows the page.
 */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const bump = () => setVersion((v) => v + 1)
    const observer = new MutationObserver(bump)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    mq?.addEventListener('change', bump)
    return () => {
      observer.disconnect()
      mq?.removeEventListener('change', bump)
    }
  }, [])
  return version
}

export function createBuilderGeometries(tier: QualityTier) {
  const seg = QUALITY[tier].segments
  return {
    box: new THREE.BoxGeometry(1, 1, 1),
    plane: new THREE.PlaneGeometry(1, 1),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, seg),
    sphere: new THREE.SphereGeometry(0.5, seg, Math.max(6, Math.round(seg * 0.6))),
    cone: new THREE.CylinderGeometry(0.34, 0.5, 1, seg, 1, true),
    ring: new THREE.TorusGeometry(0.5, 0.06, 6, Math.max(12, seg)),
    /** Unit cube wireframe, scaled per selection — one geometry for all outlines. */
    edges: new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
  }
}

export type BuilderGeo = ReturnType<typeof createBuilderGeometries>

/**
 * The shell materials. Floor, walls, frames and the door start plain in the
 * room's palette and put on real surfaces (Poly Haven, CC0) once those have
 * downloaded — see `dressBuilderShell`. The palette is the project's style
 * when it has one, so a Japandi project's room is a Japandi room.
 */
export function createBuilderMaterials(finish: FinishStyle = 'minimal') {
  const std = (color: string, roughness = 0.9, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness })

  const accent = cssColor('--accent', '#c6552f')
  const err = cssColor('--err', '#9e3a2b')
  const paper = cssColor('--paper', '#f6f1e9')
  const palette = ROOM_STYLES[finish].colors

  // Paper-white for the default room, as before; a style's own wall otherwise.
  const wallColor = finish === 'minimal' ? paper : palette.wall

  const groundShadow = new THREE.ShadowMaterial({ color: '#1d2416', opacity: 0.34 })
  groundShadow.depthWrite = false

  return {
    // Reflections of the sky are dimmed: indoors the boards mirror the room.
    floor: createSurfaceMaterial({ color: palette.floor, roughness: 0.6, envMapIntensity: 0.6 }),
    wall: createSurfaceMaterial({ color: wallColor, roughness: 0.93, normalScale: 0.6 }),
    /** Window frames, stools, casings: oak in the style's wood tone. */
    trim: createSurfaceMaterial({ color: palette.wood, roughness: 0.62, normalScale: 0.5 }),
    metal: std('#8e8579', 0.4, 0.3),
    glass: createGlassMaterial(),
    /** Stand-ins that only exist for the sun: hidden walls, the missing ceiling. */
    shadowCaster: createShadowCasterMaterial(),
    /** The house's shadow on the lawn outside. */
    groundShadow,
    lampGlow: new THREE.MeshBasicMaterial({ color: '#ffd3a0' }),
    /** Selection outline. Basic, so it stays legible under any lighting preset. */
    select: new THREE.LineBasicMaterial({ color: accent }),
    collide: new THREE.LineBasicMaterial({ color: err }),
    handle: std(accent, 0.45),
    socket: std(paper, 0.7),
    radiator: std(cssColor('--bg-raised', '#ffffff'), 0.55, 0.15),
    /** Door leaf: oak veneer, a shade deeper than the frames. */
    door: createSurfaceMaterial({ color: new THREE.Color(palette.wood).multiplyScalar(0.82).getStyle(), roughness: 0.6, normalScale: 0.4 }),
  }
}

export type BuilderMats = ReturnType<typeof createBuilderMaterials>

/**
 * The furniture library's shared roles for the builder (everything a piece
 * does NOT take from its own finish: pillows, ceramics, foliage, metal...).
 */
export function createBuilderFurnitureMats(tier: QualityTier): FurnitureMats {
  return createFurnitureMats(
    {
      upholstery: '#e4d9cb',
      cushion: '#e4d9cb',
      pillow: '#efe8dd',
      accent: '#c6552f',
      wood: '#a67b5b',
      carcass: '#c9a87c',
      metal: '#8e8579',
      ceramic: '#f2ece1',
      leaf: '#5f7052',
      linen: '#f3eee5',
      rug: '#c6552f',
      art: '#a67b5b',
      glow: '#ffe2b8',
    },
    tier,
    'border',
  )
}

export interface BuilderKit {
  geo: BuilderGeo
  mats: BuilderMats
  tier: QualityTier
  /** Procedural furniture geometry cache (disposed with the kit). */
  fgeo: GeoCache
  /** Shared furniture roles; each piece overrides one with its finish. */
  fmats: FurnitureMats
}

export const KitContext = createContext<BuilderKit | null>(null)

export function useKit(): BuilderKit {
  const kit = useContext(KitContext)
  if (!kit) throw new Error('builder scene parts must render inside <BuilderScene>')
  return kit
}

export function disposeGeometries(geo: BuilderGeo) {
  Object.values(geo).forEach((g) => g.dispose())
}

export function disposeMaterials(mats: BuilderMats) {
  Object.values(mats).forEach((m) => disposeMaterialDeep(m))
}

export function disposeKit(kit: BuilderKit) {
  disposeGeometries(kit.geo)
  disposeMaterials(kit.mats)
  kit.fgeo.dispose()
  disposeFurnitureMats(kit.fmats)
}

/* ------------------------------------------------------------ real surfaces */

const floorSize = (tier: QualityTier) => (tier === 'high' ? 2048 : 1024)

/** Starts (or joins) the downloads a builder room's shell needs. */
export function loadBuilderFinish(finish: FinishStyle, tier: QualityTier) {
  return Promise.all([
    loadSurface(STYLE_FINISH[finish].floor, floorSize(tier)),
    loadSurface('plaster', 1024),
    loadSurface('veneer-oak', 1024),
  ])
}

/** Puts every surface that has already arrived on the shell. Idempotent. */
export function dressBuilderShell(mats: BuilderMats, finish: FinishStyle, tier: QualityTier, anisotropy: number) {
  const spec = STYLE_FINISH[finish]
  const floor = peekSurface(spec.floor, floorSize(tier))
  if (floor && surfaceOf(mats.floor) !== floor.id) {
    applySurface(mats.floor, floor, { sheen: spec.floorSheen, anisotropy })
  }
  const plaster = peekSurface('plaster', 1024)
  if (plaster && !surfaceOf(mats.wall)) applySurface(mats.wall, plaster, { anisotropy: 4 })
  const veneer = peekSurface('veneer-oak', 1024)
  if (veneer) {
    if (!surfaceOf(mats.trim)) applySurface(mats.trim, veneer, { anisotropy: 4, scale: 0.5 })
    if (!surfaceOf(mats.door)) applySurface(mats.door, veneer, { anisotropy: 4, sheen: 1.1 })
  }
}
