import { useCallback } from 'react'
import type { CanvasProps } from '@react-three/fiber'

import { SceneCanvas } from '@/three/Canvas'
import { HeroRoom, toRoomStyleKey } from '@/three/HeroRoom'
import { RoomSketch } from '@/ui/RoomSketch'

/**
 * Bridges the landing hero to the WebGL room. Lives in its own chunk so
 * Three.js never lands in the initial bundle, and falls back to the blueprint
 * drawing when the browser has no WebGL — a designed state, not a crash
 * (brief §11).
 *
 * `sceneFallback` is deliberately null: it renders inside the r3f Suspense
 * boundary, where a DOM element would not be a valid child. The DOM-level
 * skeleton belongs outside this component, and lives in hero/HeroDesktop.tsx.
 *
 * `transitionMs` is longer than HeroRoom's own default (400ms) so a style
 * chip swap reads as a deliberate re-dress of the room rather than a snap —
 * the brief's "make the switch feel deliberate."
 *
 * `onReady` fires once the shaders are compiled and one frame has had the
 * chance to land, so the caller can keep the film on screen until then
 * instead of cross-fading into a blank (or janking) canvas.
 */
export default function HeroScene({
  styleKey,
  autoRotate = true,
  onReady,
}: {
  styleKey: string
  autoRotate?: boolean
  onReady?: () => void
}) {
  const onCreated = useCallback<NonNullable<CanvasProps['onCreated']>>(
    ({ gl, scene, camera }) => {
      // Compiling up front moves the shader-link stall off the handover frame.
      try {
        gl.compile(scene, camera)
      } catch {
        // A failed precompile only costs the stall we were trying to avoid.
      }
      if (onReady) requestAnimationFrame(() => onReady())
    },
    [onReady]
  )

  return (
    <SceneCanvas
      style={{ width: '100%', height: '100%' }}
      fallback={<RoomSketch dressed label="FrameSpace 3D room" />}
      sceneFallback={null}
      onCreated={onCreated}
      // Orbit only, no zoom: keep wheel scrolling on Lenis over the hero.
      interactive={false}
    >
      <HeroRoom styleKey={toRoomStyleKey(styleKey)} autoRotate={autoRotate} transitionMs={650} />
    </SceneCanvas>
  )
}
