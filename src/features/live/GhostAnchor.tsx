/**
 * The ghost: the anchor wall's photograph, laid over the live view at ~35%.
 *
 * This is the part that makes alignment possible at all. Numbers tell you the
 * compass is 12° out; a translucent photograph of your own wall tells you
 * which way to turn without reading anything.
 *
 * It is `pointer-events: none` and `aria-hidden` — the on-screen instruction
 * and the `aria-live` alignment status carry the same information for anyone
 * who cannot see it.
 */

const CSS = `
.fsl-ghost {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--d-slow) var(--ease);
  z-index: 2;
}
.fsl-ghost[data-on='true'] { opacity: 0.35; }
.fsl-ghost img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* A hard-edged photograph fights the render underneath it. Feathering the
     border lets the two read as one image in the middle, where you aim. */
  -webkit-mask-image: radial-gradient(120% 90% at 50% 46%, black 38%, transparent 96%);
  mask-image: radial-gradient(120% 90% at 50% 46%, black 38%, transparent 96%);
}
.fsl-ghost__corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border: 1px solid var(--accent);
  opacity: 0.55;
}
.fsl-ghost__corner[data-at='tl'] { top: 12%; left: 8%; border-right: 0; border-bottom: 0; }
.fsl-ghost__corner[data-at='tr'] { top: 12%; right: 8%; border-left: 0; border-bottom: 0; }
.fsl-ghost__corner[data-at='bl'] { bottom: 12%; left: 8%; border-right: 0; border-top: 0; }
.fsl-ghost__corner[data-at='br'] { bottom: 12%; right: 8%; border-left: 0; border-top: 0; }
@media (prefers-reduced-motion: reduce) {
  .fsl-ghost { transition: none; }
}
`

export interface GhostAnchorProps {
  src: string | null
  on: boolean
  /** Draw the corner brackets — off once the person is inside tolerance. */
  frame?: boolean
}

export function GhostAnchor({ src, on, frame = true }: GhostAnchorProps) {
  if (!src) return null
  return (
    <>
      <style href="fs-live-ghost" precedence="medium">
        {CSS}
      </style>
      <div className="fsl-ghost" data-on={on} aria-hidden="true">
        <img src={src} alt="" decoding="async" />
        {frame
          ? (['tl', 'tr', 'bl', 'br'] as const).map((at) => (
              <span key={at} className="fsl-ghost__corner" data-at={at} />
            ))
          : null}
      </div>
    </>
  )
}
