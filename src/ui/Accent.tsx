import { Fragment, type ReactNode } from 'react'

/**
 * Headline accents. Copy marks the words to set in Playfair italic with
 * asterisks — `"Your room, in 3D. *Before you buy a thing.*"` — so the
 * translator, not the component, decides which words carry the emphasis in
 * each language.
 */

export type AccentPart = { text: string; accent: boolean }

/** The headline with its markers removed: for aria-label, <title>, meta. */
export function plainText(text: string): string {
  return text.replace(/\*/g, '')
}

/** Words, each made of one or more parts (punctuation can sit right after an
 *  accented run, e.g. `*3D*,`). Splits on spaces only, never inside a word,
 *  so Cyrillic shaping and the Uzbek `oʻ` digraph stay intact. */
export function accentWords(text: string): AccentPart[][] {
  const out: AccentPart[][] = []
  let current: AccentPart[] | null = null
  text.split('*').forEach((segment, si) => {
    const accent = si % 2 === 1
    segment.split(' ').forEach((piece, pi) => {
      if (pi > 0) current = null
      if (!piece) return
      if (!current) {
        current = []
        out.push(current)
      }
      current.push({ text: piece, accent })
    })
  })
  return out
}

export function renderParts(parts: AccentPart[]): ReactNode {
  return parts.map((part, i) =>
    part.accent ? <em key={i}>{part.text}</em> : <Fragment key={i}>{part.text}</Fragment>
  )
}

/** Static rendering of an accented headline. */
export function Accent({ text }: { text: string }) {
  if (!text.includes('*')) return <>{text}</>
  return (
    <>
      {text.split('*').map((segment, i) =>
        i % 2 === 1 ? <em key={i}>{segment}</em> : <Fragment key={i}>{segment}</Fragment>
      )}
    </>
  )
}
