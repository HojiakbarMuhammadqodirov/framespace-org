import type { ReactNode } from 'react'

/**
 * Wraps the first whole-word occurrence of `word` in an italic serif <em>, so
 * a translated headline can carry the house italic without splitting the
 * sentence into fragments translators would have to reassemble. Falls back to
 * the plain text when the word is not in this language's sentence.
 */
export function emphasize(text: string, word?: string): ReactNode {
  if (!word) return text
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(^|[\\s«“"'(])(${escaped})(?=$|[\\s.,!?:;»”"')])`, 'u').exec(text)
  if (!match) return text
  const start = match.index + match[1].length
  return (
    <>
      {text.slice(0, start)}
      <em className="ed-em">{match[2]}</em>
      {text.slice(start + match[2].length)}
    </>
  )
}

/** Editorial atoms shared by the public pages. */
export const EDITORIAL_CSS = `
.ed-em { font-style: italic; font-weight: 400; color: var(--accent-ink); letter-spacing: -0.01em; }
.ed-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.ed-index {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--accent-ink);
}
.ed-h2 {
  font-family: var(--font-display);
  font-size: var(--step-4);
  line-height: var(--lh-display);
  letter-spacing: var(--tracking-display);
  color: var(--text-strong);
  font-weight: 400;
}
.ed-h3 {
  font-family: var(--font-display);
  font-size: var(--step-2);
  line-height: var(--lh-tight);
  letter-spacing: -0.015em;
  color: var(--text-strong);
  font-weight: 400;
}
.ed-body { color: var(--text-muted); font-size: var(--step-0); line-height: var(--lh-body); max-width: 46ch; }
.ed-section { padding-block: var(--section-y); }
.ed-cta {
  display: grid; gap: var(--s8); align-items: end;
  padding-block: var(--s16);
  border-top: 1px solid var(--border-strong);
}
@media (min-width: 900px) { .ed-cta { grid-template-columns: minmax(0, 1fr) auto; } }
.ed-cta__actions { display: flex; flex-wrap: wrap; gap: var(--s3); align-items: center; }
`

export function EditorialStyles() {
  return (
    <style href="fs-editorial" precedence="medium">
      {EDITORIAL_CSS}
    </style>
  )
}
