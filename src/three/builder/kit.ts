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
import { getContactShadowTexture, getOutsideViewTexture } from '../materials/floors'
import { disposeMaterialDeep } from '../materials/maps'

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

export function createBuilderMaterials() {
  const std = (color: string, roughness = 0.9, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness })

  const accent = cssColor('--accent', '#c6552f')
  const err = cssColor('--err', '#9e3a2b')
  const paper = cssColor('--paper', '#f6f1e9')
  const sand = cssColor('--sand-200', '#e4d9cb')
  const clay500 = cssColor('--clay-500', '#6b4a35')
  const clay900 = cssColor('--clay-900', '#2a1d16')

  // The covering itself (boards, tile, carpet…) is applied by the room shell
  // from `scene.surfaces.floor`; this is only the material it paints onto.
  const floor = std(sand, 0.66)

  // Joinery — frames, doors, skirting — is painted off-white, the way it is in
  // nearly every finished interior. It also keeps a dark accent wall readable.
  const joinery = '#f3efe8'

  const glass = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
  // Shared, cached texture: never disposed with the kit.
  glass.map = getOutsideViewTexture()

  // The pool of shade where a piece meets the floor (see Furniture.tsx).
  const contact = new THREE.MeshBasicMaterial({
    color: '#1c120c',
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    toneMapped: false,
  })
  contact.alphaMap = null
  contact.map = getContactShadowTexture()

  return {
    floor,
    contact,
    wall: std(paper, 0.99),
    trim: std(joinery, 0.6),
    skirting: std(joinery, 0.55),
    ceiling: new THREE.MeshStandardMaterial({ color: '#fbfaf7', roughness: 1, side: THREE.DoubleSide }),
    /** Plan-view accents (grip pills) keep the brand's clay rather than white. */
    grip: std(clay500, 0.72),
    metal: std('#8e8579', 0.35, 0.85),
    glass,
    lampGlow: new THREE.MeshBasicMaterial({ color: '#ffd3a0' }),
    /** Selection outline. Basic, so it stays legible under any lighting preset. */
    select: new THREE.LineBasicMaterial({ color: accent }),
    collide: new THREE.LineBasicMaterial({ color: err }),
    handle: std(accent, 0.45),
    socket: std(paper, 0.7),
    radiator: std(cssColor('--bg-raised', '#ffffff'), 0.55, 0.15),
    door: std(joinery, 0.5),
    doorPanel: std('#e7e1d7', 0.55),
    screen: std(clay900, 0.25, 0.1),
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
  // The floor and glass maps are module-level caches shared across kits;
  // detach them first so a theme flip does not dispose what the next kit reuses.
  mats.floor.map = null
  mats.floor.bumpMap = null
  mats.floor.roughnessMap = null
  mats.glass.map = null
  mats.contact.map = null
  Object.values(mats).forEach((m) => disposeMaterialDeep(m))
}

export function disposeKit(kit: BuilderKit) {
  disposeGeometries(kit.geo)
  disposeMaterials(kit.mats)
  kit.fgeo.dispose()
  disposeFurnitureMats(kit.fmats)
}
