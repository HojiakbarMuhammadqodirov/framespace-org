import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Matrix4, type Object3D } from 'three'

import { palette } from '@/design/theme'
import type { LiveModel } from './models'

/**
 * The WebXR scene: a hit-test reticle, and furniture anchored where you tap.
 *
 * Three things make this 6DoF rather than a sticker on the camera feed:
 *
 * 1. A hit-test source against the `viewer` reference space, so the reticle
 *    lies on the real floor plane the device has found.
 * 2. `XRHitTestResult.createAnchor()` on placement, so the runtime keeps the
 *    object where you put it as its understanding of the room improves.
 *    Anchors are optional in the spec, so a placement without one falls back
 *    to a frozen matrix — which drifts, and is still better than nothing.
 * 3. Matrices applied directly (`matrixAutoUpdate = false`), never decomposed
 *    into position/rotation props, so no React update is in the hot path.
 *
 * The geometry is placeholder. `models.ts` says exactly where the real assets
 * plug in; the footprints here are the real dimensions, so a swap changes what
 * you see and not where it sits.
 */

interface Placement {
  id: number
  model: LiveModel
  anchor: XRAnchor | null
  matrix: Matrix4
}

export interface ArSceneProps {
  session: XRSession
  model: LiveModel
  onPlacedCount: (count: number) => void
  onTracking: (tracking: boolean) => void
}

export function ArScene({ session, model, onPlacedCount, onTracking }: ArSceneProps) {
  const gl = useThree((state) => state.gl)
  const reticleRef = useRef<Object3D | null>(null)
  const hitSource = useRef<XRHitTestSource | null>(null)
  const lastHit = useRef<XRHitTestResult | null>(null)
  const [placements, setPlacements] = useState<Placement[]>([])
  const nextId = useRef(1)
  const modelRef = useRef(model)
  modelRef.current = model

  /* One hit-test source per session, against the viewer's own space. */
  useEffect(() => {
    let cancelled = false
    session
      .requestReferenceSpace('viewer')
      .then((space) => session.requestHitTestSource?.({ space }))
      .then((source) => {
        if (cancelled) {
          source?.cancel()
          return
        }
        hitSource.current = source ?? null
      })
      .catch(() => {
        hitSource.current = null
      })

    return () => {
      cancelled = true
      hitSource.current?.cancel()
      hitSource.current = null
    }
  }, [session])

  /* `select` is the XR tap. It must read the LAST hit, not re-run the test,
     because the pose that was under the reticle is the one the person aimed
     at — a fresh test a frame later lands somewhere slightly else. */
  useEffect(() => {
    const onSelect = () => {
      const hit = lastHit.current
      const refSpace = gl.xr.getReferenceSpace()
      if (!hit || !refSpace) return
      const pose = hit.getPose(refSpace)
      if (!pose) return

      const matrix = new Matrix4().fromArray(pose.transform.matrix)
      const entry: Placement = {
        id: nextId.current++,
        model: modelRef.current,
        anchor: null,
        matrix,
      }
      setPlacements((prev) => {
        const next = [...prev, entry]
        onPlacedCount(next.length)
        return next
      })

      // Anchors are an optional feature. Upgrade the placement in place if the
      // runtime grants one; otherwise the frozen matrix stands (and drifts).
      const pending = hit.createAnchor?.()
      if (pending) {
        pending
          .then((anchor) => {
            setPlacements((prev) => prev.map((p) => (p.id === entry.id ? { ...p, anchor } : p)))
          })
          .catch(() => {})
      }
    }

    session.addEventListener('select', onSelect)
    return () => session.removeEventListener('select', onSelect)
  }, [session, gl, onPlacedCount])

  const anchorRefs = useRef(new Map<number, Object3D>())
  const tracking = useRef<boolean | null>(null)

  /* `onTracking` drives a line of copy, not the scene. Only tell React when the
     answer actually changes — a setState per frame would re-render the whole
     overlay sixty times a second. */
  const reportTracking = (value: boolean) => {
    if (tracking.current === value) return
    tracking.current = value
    onTracking(value)
  }

  useFrame((_state, _delta, frame) => {
    const reticle = reticleRef.current
    const refSpace = gl.xr.getReferenceSpace()
    if (!frame || !refSpace) return

    const source = hitSource.current
    if (reticle && source) {
      const hits = frame.getHitTestResults(source)
      if (hits.length) {
        const pose = hits[0].getPose(refSpace)
        if (pose) {
          lastHit.current = hits[0]
          reticle.visible = true
          reticle.matrix.fromArray(pose.transform.matrix)
          reportTracking(true)
        }
      } else {
        reticle.visible = false
        lastHit.current = null
        reportTracking(false)
      }
    }

    // Anchored objects follow their anchor space every frame — that is what
    // stops them sliding when the runtime refines its map of the room.
    for (const placement of placements) {
      const mesh = anchorRefs.current.get(placement.id)
      if (!mesh) continue
      if (placement.anchor) {
        const pose = frame.getPose(placement.anchor.anchorSpace, refSpace)
        if (pose) mesh.matrix.fromArray(pose.transform.matrix)
      } else {
        mesh.matrix.copy(placement.matrix)
      }
    }
  })

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[1.4, 3, 1]} intensity={1.6} />

      <mesh ref={reticleRef} matrixAutoUpdate={false} visible={false}>
        <ringGeometry args={[0.07, 0.09, 40]} />
        <meshBasicMaterial color={palette.accent} toneMapped={false} />
      </mesh>

      {placements.map((placement) => (
        <group
          key={placement.id}
          matrixAutoUpdate={false}
          ref={(node) => {
            if (node) anchorRefs.current.set(placement.id, node)
            else anchorRefs.current.delete(placement.id)
          }}
        >
          <Placeholder model={placement.model} />
        </group>
      ))}
    </>
  )
}

/* ------------------------------------------------------- placeholder forms */

/**
 * Stand-ins with the right footprint. Clay-toned so they read as "ours" rather
 * than as debug boxes, and deliberately simple — the job here is to check
 * scale and position, which a box does honestly and a bad model does not.
 */
function Placeholder({ model }: { model: LiveModel }) {
  const [w, h, d] = model.size

  if (model.placeholder === 'seat') {
    return (
      <group>
        <mesh position={[0, h * 0.34, 0]} castShadow>
          <boxGeometry args={[w, h * 0.46, d]} />
          <meshStandardMaterial color={palette.clay500} roughness={0.85} />
        </mesh>
        <mesh position={[0, h * 0.7, -d / 2 + 0.09]}>
          <boxGeometry args={[w, h * 0.6, 0.18]} />
          <meshStandardMaterial color={palette.clay700} roughness={0.9} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[(side * (w - 0.16)) / 2, h * 0.56, 0]}>
            <boxGeometry args={[0.16, h * 0.5, d]} />
            <meshStandardMaterial color={palette.clay700} roughness={0.9} />
          </mesh>
        ))}
      </group>
    )
  }

  if (model.placeholder === 'table') {
    return (
      <group>
        <mesh position={[0, h, 0]}>
          <boxGeometry args={[w, 0.05, d]} />
          <meshStandardMaterial color={palette.clay300} roughness={0.6} />
        </mesh>
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz]) => (
          <mesh
            key={`${sx}:${sz}`}
            position={[(sx * (w - 0.1)) / 2, h / 2, (sz * (d - 0.1)) / 2]}
          >
            <cylinderGeometry args={[0.022, 0.022, h, 12]} />
            <meshStandardMaterial color={palette.clay700} roughness={0.7} />
          </mesh>
        ))}
      </group>
    )
  }

  return (
    <group>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[w / 2, w / 2, 0.04, 24]} />
        <meshStandardMaterial color={palette.clay700} roughness={0.8} />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.016, 0.016, h, 12]} />
        <meshStandardMaterial color={palette.clay700} roughness={0.7} />
      </mesh>
      <mesh position={[0, h - 0.12, 0]}>
        <coneGeometry args={[0.2, 0.26, 24, 1, true]} />
        <meshStandardMaterial color={palette.sand200} roughness={0.5} />
      </mesh>
    </group>
  )
}
