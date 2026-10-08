import { memo, useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'

/**
 * Rendering polish shared by every furniture scene.
 *
 * - `ToneMapping` switches the renderer to Khronos PBR Neutral, the curve made
 *   for product imagery: highlights roll off like a photograph, but base
 *   colours stay true (ACES and AgX both shift the warm clay ramp). It is set
 *   from inside the scene so the shared `SceneCanvas` — which also hosts photo
 *   panoramas that must stay untouched — keeps its flat default.
 *
 * - `SoftEnvironment` is an image-based light built entirely from in-scene
 *   light cards (drei `Lightformer`) rendered once into a small cube map. No
 *   HDR file and no network: it is what gives cushions their soft wrap,
 *   wood its satin sheen and ceramic a believable reflection.
 */

export type ToneMode = 'neutral' | 'aces' | 'agx' | 'none'

const TONE: Record<ToneMode, THREE.ToneMapping> = {
  neutral: THREE.NeutralToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
  none: THREE.NoToneMapping,
}

export function ToneMapping({ mode = 'neutral', exposure = 1 }: { mode?: ToneMode; exposure?: number }) {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const prev = { mapping: gl.toneMapping, exposure: gl.toneMappingExposure }
    gl.toneMapping = TONE[mode]
    gl.toneMappingExposure = exposure
    invalidate()
    return () => {
      gl.toneMapping = prev.mapping
      gl.toneMappingExposure = prev.exposure
    }
  }, [gl, mode, exposure, invalidate])
  return null
}

export type EnvMood = 'studio' | 'daylight' | 'evening'

interface SoftEnvironmentProps {
  mood?: EnvMood
  /** Scales every material's image-based light. */
  intensity?: number
  /** Cube face size. 64 is plenty for diffuse-dominant furniture. */
  resolution?: number
}

const MOODS: Record<EnvMood, { base: string; key: string; fill: string; rim: string; floor: string; keyI: number }> = {
  studio: { base: '#2a2420', key: '#fff3e2', fill: '#f2e6d8', rim: '#ffe2c0', floor: '#6b5442', keyI: 3.2 },
  daylight: { base: '#2e2a26', key: '#fff8ee', fill: '#dfe8f2', rim: '#ffe6c8', floor: '#7a5e48', keyI: 3.6 },
  evening: { base: '#1f1814', key: '#ffd2a0', fill: '#a8b4c4', rim: '#ffb980', floor: '#4a3529', keyI: 2.4 },
}

function SoftEnvironmentImpl({ mood = 'studio', intensity = 1, resolution = 128 }: SoftEnvironmentProps) {
  const c = MOODS[mood]
  return (
    <Environment resolution={resolution} frames={1} environmentIntensity={intensity}>
      <color attach="background" args={[c.base]} />
      {/* Big soft key, high and to the front-left: the softbox. */}
      <Lightformer form="rect" intensity={c.keyI} color={c.key} position={[-4, 5, 4]} rotation-y={-Math.PI / 4} scale={[6, 4, 1]} target={[0, 0, 0]} />
      {/* Long overhead strip for the top-edge highlight on cushions and tops. */}
      <Lightformer form="rect" intensity={1.6} color={c.fill} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[8, 1.5, 1]} />
      {/* Cool fill from the right. */}
      <Lightformer form="rect" intensity={0.9} color={c.fill} position={[6, 2, 1]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} />
      {/* Warm rim from behind. */}
      <Lightformer form="ring" intensity={1.4} color={c.rim} position={[2, 3, -6]} scale={2.5} target={[0, 0, 0]} />
      {/* Floor bounce: a warm wash from below, the light a wooden floor returns. */}
      <Lightformer form="rect" intensity={0.55} color={c.floor} position={[0, -3, 0]} rotation-x={-Math.PI / 2} scale={[12, 12, 1]} />
    </Environment>
  )
}

/** Memoised: drei re-bakes the cube whenever its children change identity. */
export const SoftEnvironment = memo(SoftEnvironmentImpl)
