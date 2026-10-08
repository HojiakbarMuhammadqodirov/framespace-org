import { useEffect } from 'react'

import { GRID } from './geometry'
import { useBuilder } from './store'

/**
 * Editor keys: Delete removes the selection, arrows nudge it, R rotates it,
 * Ctrl/Cmd+D duplicates it, Esc deselects, Ctrl/Cmd+Z / Shift+Z / Y walk the
 * history.
 *
 * Nothing fires while a text field has focus — typing "2.40" into a dimension
 * field must not delete the sofa.
 */
export function useBuilderShortcuts(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.closest?.('[role="dialog"]') ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }

      const state = useBuilder.getState()
      const mod = event.ctrlKey || event.metaKey
      // The generate sheet is modal: it owns the keyboard (and its own Escape).
      if (state.generateOpen) return
      if (event.altKey) return

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) state.redo()
        else state.undo()
        return
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        state.redo()
        return
      }

      if (mod && event.key.toLowerCase() === 'd') {
        if (state.selection?.kind !== 'item') return
        event.preventDefault()
        state.duplicateSelected()
        return
      }
      if (mod) return

      switch (event.key) {
        case 'Escape':
          state.select(null)
          return
        case 'r':
        case 'R':
          if (state.selection?.kind !== 'item') return
          event.preventDefault()
          state.rotateSelected(event.shiftKey ? -Math.PI / 12 : Math.PI / 12)
          return
        case 'Delete':
        case 'Backspace':
          if (!state.selection) return
          event.preventDefault()
          state.removeSelected()
          return
        default:
          break
      }

      if (!state.selection) return
      // Shift travels half a metre at a time; plain arrows move one grid unit.
      const step = event.shiftKey ? GRID * 5 : GRID
      const moves: Record<string, [number, number]> = {
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
      }
      const move = moves[event.key]
      if (!move) return
      event.preventDefault()
      state.nudge(move[0], move[1])
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
