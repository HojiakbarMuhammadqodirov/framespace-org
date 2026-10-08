import type { ThreeEvent } from '@react-three/fiber'

/**
 * A press only becomes a drag once the pointer has travelled this far on
 * screen. Below it, a tap is a tap: it selects, and it never nudges a piece,
 * re-snaps it to the grid, or lands an undo step.
 */
export const DRAG_THRESHOLD_PX = 6

/**
 * Arms a drag on pointerdown and starts it only after real movement.
 *
 * Listens on the window, because the finger routinely leaves the mesh (and the
 * canvas) within the first few pixels. Releasing before the threshold simply
 * disarms. `start` is called at most once.
 */
export function armDrag(event: ThreeEvent<PointerEvent>, start: () => void) {
  const { clientX: x0, clientY: y0, pointerId } = event.nativeEvent

  const cleanup = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', cleanup)
    window.removeEventListener('pointercancel', cleanup)
  }

  function onMove(move: PointerEvent) {
    if (move.pointerId !== pointerId) return
    if (Math.hypot(move.clientX - x0, move.clientY - y0) < DRAG_THRESHOLD_PX) return
    cleanup()
    start()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', cleanup)
  window.addEventListener('pointercancel', cleanup)
}
