import { Suspense, lazy, type CSSProperties, type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/cn'
import { ViewportGate } from '@/features/catalog'
import type { ProductModelKey, ProductPalette } from '@/three/ProductViewer'

/* three.js stays in its own chunk: pages only pull it once a plinth is near
   the viewport. */
const ProductViewer = lazy(() => import('@/three/ProductViewer'))

/**
 * One live 3D piece on a gallery plinth — the "photograph" of every public
 * page. There is no photography in this repo, and we never fake it: where an
 * editorial site would put a still, FrameSpace puts the procedural furniture
 * the product itself renders, on the same warm turntable as the catalog.
 *
 * `caption` sits bottom-left in mono like a museum label; `tag` top-left.
 */
export function Plinth({
  model,
  palette,
  label,
  caption,
  tag,
  aspect = '4 / 5',
  spin = true,
  spinSpeed = 0.26,
  interactive = false,
  shadows = true,
  tone = 'raised',
  className,
  style,
  children,
}: {
  model: ProductModelKey
  palette: ProductPalette
  /** Accessible name of the piece. */
  label: string
  caption?: ReactNode
  tag?: ReactNode
  aspect?: string
  spin?: boolean
  spinSpeed?: number
  interactive?: boolean
  shadows?: boolean
  tone?: 'raised' | 'sunken' | 'inverse'
  className?: string
  style?: CSSProperties
  /** Overlay content (e.g. a dimension line) drawn above the canvas. */
  children?: ReactNode
}) {
  const reduced = useReducedMotion()

  return (
    <div className={cn('pl', `pl--${tone}`, className)} style={style}>
      <PlinthStyles />
      <div className="pl__plate" style={{ aspectRatio: aspect }}>
        <ViewportGate className="pl__canvas" placeholder={<PlinthStill />} enterMargin="240px">
          <Suspense fallback={<PlinthStill />}>
            <ProductViewer
              model={model}
              palette={palette}
              spin={spin && !reduced}
              spinSpeed={spinSpeed}
              interactive={interactive}
              shadows={shadows}
              label={label}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
          </Suspense>
        </ViewportGate>
        {tag && <span className="pl__tag">{tag}</span>}
        {children}
        {caption && <div className="pl__cap">{caption}</div>}
      </div>
    </div>
  )
}

/** The still state while three.js loads: a stroke elevation, never a spinner. */
function PlinthStill() {
  return (
    <svg className="pl__still" viewBox="0 0 200 150" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <g stroke="var(--clay-300)" strokeWidth="1" strokeLinejoin="round" opacity="0.7">
        <path d="M54 104 L54 66 Q54 58 63 58 L137 58 Q146 58 146 66 L146 104" />
        <path d="M54 86 L146 86" />
        <path d="M62 104 L62 114 M138 104 L138 114" />
      </g>
      <path d="M30 122 L170 122" stroke="var(--hairline)" strokeWidth="1" />
    </svg>
  )
}

const CSS = `
.pl { margin: 0; position: relative; }
.pl__plate {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  border-radius: var(--radius-3xl);
  background:
    radial-gradient(75% 60% at 50% 38%, color-mix(in srgb, var(--white) 70%, transparent), transparent 72%),
    linear-gradient(180deg, var(--bg-raised) 0%, var(--bg-sunken) 100%);
  box-shadow: var(--shadow-ambient), inset 0 0 0 1px var(--hairline), var(--inset-hi);
}
.pl--sunken .pl__plate {
  background:
    radial-gradient(70% 55% at 50% 40%, color-mix(in srgb, var(--white) 45%, transparent), transparent 70%),
    var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.pl--inverse .pl__plate {
  background:
    radial-gradient(70% 55% at 50% 38%, rgba(246, 241, 233, 0.12), transparent 70%),
    var(--clay-900);
  box-shadow: var(--shadow-raised), inset 0 0 0 1px rgba(246, 241, 233, 0.08);
}
:root[data-theme='dark'] .pl__plate {
  background:
    radial-gradient(70% 55% at 50% 38%, rgba(246, 241, 233, 0.08), transparent 70%),
    var(--bg-raised);
}
/* The floor the piece stands on: a soft horizon, not a hard edge. */
.pl__plate::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 34%;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--clay-500) 7%, transparent));
}
.pl__canvas { position: absolute; inset: 0; z-index: 1; }
.pl__still { position: absolute; inset: 18% 14%; width: 72%; height: 64%; }
.pl__tag, .pl__cap {
  position: absolute;
  z-index: 2;
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
  pointer-events: none;
}
.pl--inverse .pl__tag, .pl--inverse .pl__cap { color: rgba(246, 241, 233, 0.66); }
.pl__tag { top: var(--s5); left: var(--s5); display: inline-flex; align-items: center; gap: var(--s2); }
.pl__tag::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
.pl__cap {
  left: var(--s5); right: var(--s5); bottom: var(--s5);
  display: flex; justify-content: space-between; gap: var(--s4); flex-wrap: wrap;
}
`

export function PlinthStyles() {
  return (
    <style href="fs-plinth" precedence="medium">
      {CSS}
    </style>
  )
}

/* -------------------------------------------------------------- palettes */

/** Warm house palettes for the pieces the public pages show. */
export const PIECE_PALETTES = {
  terracotta: { body: '#C2714B', accent: '#8E4A2E', wood: '#8A6244', metal: '#8E8579', fabric: '#E4D9CB', neutral: '#F0E7DA' },
  oat: { body: '#E2D6C3', accent: '#B9A88F', wood: '#B8956F', metal: '#9A9186', fabric: '#EFE6D8', neutral: '#FAF5EC' },
  walnut: { body: '#7A5136', accent: '#C6552F', wood: '#5A3A27', metal: '#8E8579', fabric: '#D8CBBA', neutral: '#EFE8DD' },
  moss: { body: '#5E6B52', accent: '#B4832A', wood: '#7A5A3E', metal: '#4A4540', fabric: '#D7D0BF', neutral: '#ECE6DA' },
} satisfies Record<string, ProductPalette>
