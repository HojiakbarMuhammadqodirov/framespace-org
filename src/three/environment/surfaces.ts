import * as THREE from 'three'

import { SURFACES, surfaceUrls, type SurfaceId } from './catalog'

/**
 * Real PBR surfaces (colour + normal + AO/roughness) for floors, walls,
 * ceilings, frames and doors.
 *
 * - Loading is lazy and cached per URL. Images decode off the main thread
 *   (ImageBitmap) where the browser does that reliably.
 * - A material never waits for a texture: it is built plain, and the maps are
 *   attached once they arrive (one program switch, then no further cost).
 * - UVs are WORLD metres, computed in the vertex shader: a 4 m wall and a
 *   12 cm reveal show boards and plaster at the same real size, segments of
 *   one wall line up, and nobody has to author UVs on a scaled unit box.
 * - Colour maps are tint-ready (see catalog.ts): the palette colour still
 *   decides the hue, and the shader divides the map's gain back out so the
 *   surface averages to exactly that colour.
 */

export type SurfaceSize = 1024 | 2048

export interface SurfaceMaps {
  id: SurfaceId
  map: THREE.Texture
  normalMap: THREE.Texture
  arm: THREE.Texture
}

/* ------------------------------------------------------------------ loading */

const textureCache = new Map<string, Promise<THREE.Texture>>()
const surfaceCache = new Map<string, Promise<SurfaceMaps>>()
const ready = new Map<string, SurfaceMaps>()

function useBitmaps(): boolean {
  if (typeof createImageBitmap === 'undefined' || typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // Same caution as three's GLTFLoader: Safari < 17 and old Firefox mishandle
  // the createImageBitmap options this relies on.
  const safari = /^((?!chrome|android).)*safari/i.test(ua)
  const safariVersion = safari ? Number(ua.match(/Version\/(\d+)/)?.[1] ?? 0) : 99
  const firefox = /firefox/i.test(ua)
  const firefoxVersion = firefox ? Number(ua.match(/Firefox\/(\d+)/)?.[1] ?? 0) : 999
  return safariVersion >= 17 && firefoxVersion >= 98
}

function loadTexture(src: string, color: boolean): Promise<THREE.Texture> {
  const cached = textureCache.get(src)
  if (cached) return cached
  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    const finish = (texture: THREE.Texture) => {
      texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.needsUpdate = true
      resolve(texture)
    }
    if (useBitmaps()) {
      const loader = new THREE.ImageBitmapLoader()
      // Normal and AO/roughness data must reach the GPU untouched.
      loader.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
      loader.load(
        src,
        (bitmap) => {
          const texture = new THREE.Texture(bitmap as unknown as HTMLImageElement)
          texture.flipY = false
          finish(texture)
        },
        undefined,
        reject,
      )
    } else {
      new THREE.TextureLoader().load(src, finish, undefined, reject)
    }
  })
  textureCache.set(src, promise)
  // A failed fetch may be retried by a later caller.
  promise.catch(() => textureCache.delete(src))
  return promise
}

function key(id: SurfaceId, size: SurfaceSize) {
  return `${id}@${Math.min(size, SURFACES[id].maxSize)}`
}

/** Starts (or joins) the download of one surface set. */
export function loadSurface(id: SurfaceId, size: SurfaceSize): Promise<SurfaceMaps> {
  const k = key(id, size)
  const cached = surfaceCache.get(k)
  if (cached) return cached
  const urls = surfaceUrls(id, size)
  const promise = Promise.all([
    loadTexture(urls.color, true),
    loadTexture(urls.normal, false),
    loadTexture(urls.arm, false),
  ]).then(([map, normalMap, arm]) => {
    const maps = { id, map, normalMap, arm }
    ready.set(k, maps)
    return maps
  })
  surfaceCache.set(k, promise)
  promise.catch(() => surfaceCache.delete(k))
  return promise
}

/** The surface set if it has already arrived, else null. Never fetches. */
export function peekSurface(id: SurfaceId, size: SurfaceSize): SurfaceMaps | null {
  return ready.get(key(id, size)) ?? null
}

/* ----------------------------------------------------------------- material */

export interface SurfaceOptions {
  /** Palette colour (sRGB hex). The figure rides on top of it. */
  color: THREE.ColorRepresentation
  /** Base roughness when no map is attached; multiplier once one is. */
  roughness?: number
  normalScale?: number
  aoIntensity?: number
  /** Physical gets a satin clearcoat (waxed boards). */
  clearcoat?: number
  clearcoatRoughness?: number
  envMapIntensity?: number
}

interface SurfaceState {
  gain: { value: number }
  surface: SurfaceId | null
}

const STATE = Symbol('surface')

type SurfaceMaterial = (THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial) & {
  [STATE]?: SurfaceState
}

/** World-metre UVs. Floors and ceilings use XZ, everything upright uses the
 *  horizontal axis along its face and world Y. */
const WORLD_UV_VERTEX = /* glsl */ `
{
  vec4 surfWorld = modelMatrix * vec4( transformed, 1.0 );
  vec3 surfN = normalize( mat3( modelMatrix ) * objectNormal );
  vec2 surfUv;
  if ( abs( surfN.y ) > 0.5 ) {
    surfUv = vec2( surfWorld.x, -surfWorld.z );
  } else {
    vec3 surfT = normalize( cross( vec3( 0.0, 1.0, 0.0 ), surfN ) );
    surfUv = vec2( dot( surfWorld.xyz, surfT ), surfWorld.y );
  }
  #ifdef USE_MAP
    vMapUv = ( mapTransform * vec3( surfUv, 1.0 ) ).xy;
  #endif
  #ifdef USE_NORMALMAP
    vNormalMapUv = ( normalMapTransform * vec3( surfUv, 1.0 ) ).xy;
  #endif
  #ifdef USE_ROUGHNESSMAP
    vRoughnessMapUv = ( roughnessMapTransform * vec3( surfUv, 1.0 ) ).xy;
  #endif
  #ifdef USE_AOMAP
    vAoMapUv = ( aoMapTransform * vec3( surfUv, 1.0 ) ).xy;
  #endif
}
`

function patch(material: SurfaceMaterial, state: SurfaceState) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.surfaceGain = state.gain
    // By project_vertex both `transformed` and `objectNormal` exist; the
    // block overrides the UV varyings uv_vertex already wrote.
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `${WORLD_UV_VERTEX}\n#include <project_vertex>`)
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float surfaceGain;\nvoid main() {')
      .replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n#ifdef USE_MAP\n  diffuseColor.rgb /= surfaceGain;\n#endif',
      )
  }
  material.customProgramCacheKey = () => 'fs-surface-worlduv'
}

/**
 * A plain material that will wear a real surface once its maps arrive.
 * Standard unless a clearcoat is asked for (waxed boards): physical is only
 * worth its heavier shader where it adds something.
 */
export function createSurfaceMaterial(options: SurfaceOptions): THREE.MeshStandardMaterial {
  const base = {
    color: options.color,
    roughness: options.roughness ?? 0.85,
    metalness: 0,
    envMapIntensity: options.envMapIntensity ?? 1,
  }
  const material = (
    options.clearcoat
      ? new THREE.MeshPhysicalMaterial({
          ...base,
          clearcoat: options.clearcoat,
          clearcoatRoughness: options.clearcoatRoughness ?? 0.3,
        })
      : new THREE.MeshStandardMaterial(base)
  ) as SurfaceMaterial
  material.normalScale.setScalar(options.normalScale ?? 1)
  material.aoMapIntensity = options.aoIntensity ?? 1
  const state: SurfaceState = { gain: { value: 1 }, surface: null }
  material[STATE] = state
  patch(material, state)
  return material
}

export interface ApplyOptions {
  /** Multiplier on the surface's measured mean roughness. */
  sheen?: number
  /** Anisotropic filtering for floors seen at grazing angles. */
  anisotropy?: number
  /** Extra scale on the real-world tile size (1 = true size). */
  scale?: number
}

/**
 * Dresses a surface material in a loaded set. Textures are cloned (sharing
 * one GPU upload) so each material keeps its own repeat; the previous clones
 * are disposed. Recompiles only when the material had no maps before.
 */
export function applySurface(material: THREE.MeshStandardMaterial, maps: SurfaceMaps, options: ApplyOptions = {}) {
  const m = material as SurfaceMaterial
  const state = m[STATE]
  if (!state) return
  const def = SURFACES[maps.id]
  const repeat = 1 / (def.meters * (options.scale ?? 1))
  const dress = (source: THREE.Texture) => {
    const t = source.clone()
    t.repeat.set(repeat, repeat)
    if (def.rotate) t.rotation = Math.PI / 2
    t.anisotropy = options.anisotropy ?? 4
    t.needsUpdate = true
    return t
  }
  const hadMaps = Boolean(m.map)
  m.map?.dispose()
  m.normalMap?.dispose()
  if (m.roughnessMap && m.roughnessMap !== m.aoMap) m.roughnessMap.dispose()
  m.aoMap?.dispose()

  m.map = dress(maps.map)
  m.normalMap = dress(maps.normalMap)
  const arm = dress(maps.arm)
  m.roughnessMap = arm
  m.aoMap = arm
  // Roughness map (G) × material.roughness: aim the mean at `sheen` × measured.
  const target = THREE.MathUtils.clamp(def.roughness * (options.sheen ?? 1), 0.05, 1)
  m.roughness = THREE.MathUtils.clamp(target / Math.max(0.05, def.roughness), 0, 4)
  state.gain.value = def.gain
  state.surface = maps.id
  if (!hadMaps) m.needsUpdate = true
}

/** Which surface a material currently wears, if any. */
export function surfaceOf(material: THREE.Material): SurfaceId | null {
  return (material as SurfaceMaterial)[STATE]?.surface ?? null
}

/* -------------------------------------------------------------------- glass */

/**
 * Clear window glass without a transmission pass: the pane adds only its
 * Fresnel reflection (sky, sun glint) over whatever is behind it and takes a
 * few percent of that light away. Physically that is all clear float glass
 * does at a window, and it costs one transparent quad.
 */
export function createGlassMaterial(): THREE.MeshPhysicalMaterial {
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#000000',
    roughness: 0.04,
    metalness: 0,
    ior: 1.52,
    specularIntensity: 1,
    envMapIntensity: 1.4,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  // result = reflection + behind × (1 − opacity)
  glass.blending = THREE.CustomBlending
  glass.blendEquation = THREE.AddEquation
  glass.blendSrc = THREE.OneFactor
  glass.blendDst = THREE.OneMinusSrcAlphaFactor
  return glass
}

/** Shadow-only stand-in: invisible to the camera, solid to the sun. */
export function createShadowCasterMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}
