import { useEffect, useMemo, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js'

import type { SceneTier } from '../effects/quality'
import { SKIES, type SkyId } from './catalog'

/**
 * The world outside the room: a real photographed sky (Poly Haven, CC0) used
 * twice — as image-based light for every material, and as the view through
 * the windows.
 *
 * Two files per sky, chosen per device tier:
 * - a small linear HDR with the sun clamped out, for lighting (the scene's
 *   directional light is the sun, because it is the one that casts shadows);
 * - a tonemapped WebP equirect for what the eye sees, sun and all.
 *
 * Nothing suspends. Until the files arrive the scene keeps whatever `fallback`
 * renders (the procedural studio light), and the sky swaps in when ready.
 * Decoded textures and their prefiltered (PMREM) versions are cached for the
 * page's life, so switching back to a sky is instant.
 */

export type SkyBackground = 'sphere' | 'ground' | 'none'

export interface GroundProjection {
  /** Height of the photographer's camera above the ground, in metres. */
  height: number
  /** Radius of the projected world. Keep it inside the camera's far plane. */
  radius: number
  /** Where the ground disc is centred (the room's centre). */
  center?: [number, number]
}

export interface OutdoorEnvironmentProps {
  sky: SkyId
  tier: SceneTier
  /** Y rotation applied to both light and backdrop (see `skyRotationFor`). */
  rotation?: number
  background?: SkyBackground
  ground?: GroundProjection
  /** Brightness of the visible sky. 1 = as photographed. */
  backgroundIntensity?: number
  /** Leave undefined when something else animates `scene.environmentIntensity`. */
  environmentIntensity?: number
  /** Rendered until the sky's lighting is ready (e.g. <SoftEnvironment />). */
  fallback?: ReactNode
}

/* ------------------------------------------------------------------- caches */

const hdrCache = new Map<string, Promise<THREE.DataTexture>>()
const ldrCache = new Map<string, Promise<THREE.Texture>>()
const pmremCache = new WeakMap<THREE.WebGLRenderer, Map<string, THREE.Texture>>()

function loadHDR(url: string) {
  let p = hdrCache.get(url)
  if (!p) {
    p = new HDRLoader().setDataType(THREE.HalfFloatType).loadAsync(url) as Promise<THREE.DataTexture>
    hdrCache.set(url, p)
    p.catch(() => hdrCache.delete(url))
  }
  return p
}

function loadLDR(url: string) {
  let p = ldrCache.get(url)
  if (!p) {
    p = new THREE.TextureLoader().loadAsync(url).then((texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      texture.colorSpace = THREE.SRGBColorSpace
      // The backdrop is magnified through a window; mip-mapping a 2:1 image
      // only blurs it further.
      texture.generateMipmaps = false
      texture.minFilter = THREE.LinearFilter
      return texture
    })
    ldrCache.set(url, p)
    p.catch(() => ldrCache.delete(url))
  }
  return p
}

function prefiltered(gl: THREE.WebGLRenderer, url: string, hdr: THREE.DataTexture) {
  let perRenderer = pmremCache.get(gl)
  if (!perRenderer) {
    perRenderer = new Map()
    pmremCache.set(gl, perRenderer)
  }
  let env = perRenderer.get(url)
  if (!env) {
    const generator = new THREE.PMREMGenerator(gl)
    env = generator.fromEquirectangular(hdr).texture
    generator.dispose()
    perRenderer.set(url, env)
  }
  return env
}

/** Warms the HTTP cache for a sky the visitor is likely to pick next. */
export function prefetchSky(sky: SkyId, tier: SceneTier) {
  void loadHDR(SKIES[sky].environment[tier]).catch(() => {})
  void loadLDR(SKIES[sky].background[tier]).catch(() => {})
}

/* ---------------------------------------------------------------- component */

export function OutdoorEnvironment({
  sky,
  tier,
  rotation = 0,
  background = 'sphere',
  ground,
  backgroundIntensity = 1,
  environmentIntensity,
  fallback = null,
}: OutdoorEnvironmentProps) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  const def = SKIES[sky]

  const [env, setEnv] = useState<{ url: string; texture: THREE.Texture } | null>(null)
  const [backdrop, setBackdrop] = useState<{ url: string; texture: THREE.Texture } | null>(null)

  const envUrl = def.environment[tier]
  const bgUrl = def.background[tier]

  useEffect(() => {
    let live = true
    loadHDR(envUrl)
      .then((hdr) => {
        if (!live) return
        setEnv({ url: envUrl, texture: prefiltered(gl, envUrl, hdr) })
      })
      .catch(() => {
        // Offline or blocked: the fallback light simply stays.
      })
    return () => {
      live = false
    }
  }, [envUrl, gl])

  useEffect(() => {
    if (background === 'none') return
    let live = true
    loadLDR(bgUrl)
      .then((texture) => {
        if (live) setBackdrop({ url: bgUrl, texture })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [bgUrl, background])

  // Lighting. Rotation follows the sun even before the new sky has loaded.
  useEffect(() => {
    if (!env) return
    const previous = scene.environment
    scene.environment = env.texture
    invalidate()
    return () => {
      if (scene.environment === env.texture) scene.environment = previous ?? null
    }
  }, [env, scene, invalidate])

  useEffect(() => {
    scene.environmentRotation.set(0, rotation, 0)
    scene.backgroundRotation.set(0, rotation, 0)
    if (environmentIntensity !== undefined) scene.environmentIntensity = environmentIntensity
    scene.backgroundIntensity = backgroundIntensity
    invalidate()
  }, [scene, rotation, environmentIntensity, backgroundIntensity, invalidate])

  // Spherical backdrop: the plain scene background.
  useEffect(() => {
    if (background !== 'sphere' || !backdrop) return
    const previous = scene.background
    scene.background = backdrop.texture
    invalidate()
    return () => {
      if (scene.background === backdrop.texture) scene.background = previous ?? null
    }
  }, [background, backdrop, scene, invalidate])

  // Ground-projected backdrop: the room stands on the photographed lawn.
  const skybox = useMemo(() => {
    if (background !== 'ground' || !backdrop || !ground) return null
    const mesh = new GroundedSkybox(backdrop.texture, ground.height, ground.radius, tier === 'low' ? 48 : 96)
    const material = mesh.material as THREE.MeshBasicMaterial
    // A photograph: already tonemapped, never fogged, never lit.
    material.toneMapped = false
    material.fog = false
    mesh.renderOrder = -1000
    mesh.frustumCulled = false
    mesh.raycast = () => {}
    return mesh
  }, [background, backdrop, ground?.height, ground?.radius, tier]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (!skybox) return
      skybox.geometry.dispose()
      ;(skybox.material as THREE.Material).dispose()
    },
    [skybox],
  )

  useEffect(() => {
    if (!skybox) return
    const material = skybox.material as THREE.MeshBasicMaterial
    material.color.setScalar(backgroundIntensity)
    invalidate()
  }, [skybox, backgroundIntensity, invalidate])

  return (
    <>
      {!env && fallback}
      {skybox && ground && (
        <primitive
          object={skybox}
          // The flat floor of the projection sits a few millimetres under y=0.
          position={[ground.center?.[0] ?? 0, ground.height - 0.012, ground.center?.[1] ?? 0]}
          rotation={[0, rotation, 0]}
        />
      )}
    </>
  )
}

export default OutdoorEnvironment
