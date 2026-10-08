import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { Seo } from '@/lib/seo'
import { ProductViewer } from '@/three/ProductViewer'
import { TextReveal } from '@/ui/TextReveal'
import { RevealGroup, RevealItem } from '@/ui/Reveal'
import { DimensionLine } from '@/ui/DimensionLine'
import { EASE } from '@/design/motion'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useSaved } from '@/store/projects'
import {
  CatalogChromeStyles,
  CtaLink,
  Eyebrow,
  Mono,
  Notice,
  StatusPip,
} from '@/features/catalog/chrome'
import {
  builderPieceFor,
  finishesFor,
  getProduct,
  relatedProducts,
  type FinishKey,
  type Product,
} from '@/features/catalog/data'
import { useCount, useMoney } from '@/features/catalog/money'
import { ProductGrid, ProductGridStyles } from '@/features/catalog/ProductGrid'
import { getStore } from '@/features/business/data'

/**
 * §9 — one piece, full bleed and orbitable.
 *
 * The page is built the way a furniture house builds one: a big 3D stage on
 * the left that stays put while the buy column scrolls beside it — title,
 * price, finish swatches, measurements, and the one action that matters,
 * "place in my room", which opens the 3D room builder with this piece already
 * standing in it. Below that, the spec sheet, an architectural elevation with
 * dimension lines (a sofa is a measurement before it is a photograph), and
 * pieces that sit well next to it.
 *
 * The finish swatches recolour the live model — `ProductViewer` cross-fades a
 * palette change instead of rebuilding materials, so a swatch tap is a dissolve,
 * not a flash.
 *
 * On a touch screen the stage does not grab the page: it scrolls like any
 * other block (`touch-action: pan-y`) until the visitor taps "Tap to rotate",
 * which hands the gestures to OrbitControls until they tap "Done". Below 900px
 * the price and the main action ride in a bar above the dock, because the buy
 * column is otherwise a long scroll away.
 */

const CSS = `
.cdet { padding-bottom: var(--s32); }

.cdet__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
  padding-block: var(--s6) var(--s4);
  flex-wrap: wrap;
}
.cdet__back {
  display: inline-flex;
  align-items: center;
  gap: var(--s3);
  min-height: var(--tap);
  color: var(--text-muted);
  text-decoration: none;
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  transition: color var(--d-fast) var(--ease);
}
.cdet__back:hover { color: var(--text-strong); }
.cdet__back span:first-child { transition: transform var(--d-base) var(--ease); }
.cdet__back:hover span:first-child { transform: translateX(-3px); }

/* ---- hero: stage + buy column ----------------------------------------- */
.cdet__hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--s8);
  align-items: start;
}
@media (min-width: 1024px) {
  .cdet__hero {
    grid-template-columns: minmax(0, 1.55fr) minmax(340px, 1fr);
    gap: var(--s10);
  }
  .cdet__stageWrap { position: sticky; top: calc(var(--hdr-offset, 84px) + var(--s4)); }
}
@media (min-width: 1440px) {
  .cdet__hero { gap: var(--s16); grid-template-columns: minmax(0, 1.6fr) minmax(380px, 1fr); }
}

/* ---- the stage: tray + plate ------------------------------------------ */
.cdet__stage {
  --cdet-tray: var(--s2);
  padding: var(--cdet-tray);
  border-radius: var(--radius-3xl);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.cdet__plate {
  position: relative;
  height: clamp(340px, 58dvh, 560px);
  border-radius: calc(var(--radius-3xl) - var(--cdet-tray));
  background:
    radial-gradient(90% 70% at 50% 100%, color-mix(in srgb, var(--clay-300) 10%, transparent), transparent 70%),
    var(--bg-raised);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--white) 60%, transparent),
    inset 0 0 0 1px var(--hairline);
  overflow: hidden;
}
@media (min-width: 1024px) {
  .cdet__plate { height: clamp(460px, calc(100dvh - var(--hdr-offset, 84px) - var(--s12)), 820px); }
}
.cdet__plate::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    110% 74% at 22% 0%,
    color-mix(in srgb, var(--white) 30%, transparent) 0%,
    transparent 60%
  );
  pointer-events: none;
}
.cdet__canvas { position: absolute; inset: 0; }
.cdet__plate--touch { touch-action: pan-y; }
.cdet__plate--armed { touch-action: none; box-shadow: inset 0 0 0 2px var(--accent), inset 0 0 0 1px var(--hairline); }
.cdet__hint {
  position: absolute;
  z-index: 2;
  left: var(--s4);
  right: var(--s4);
  bottom: var(--s4);
  display: flex;
  gap: var(--s2);
  flex-wrap: wrap;
  align-items: flex-end;
  pointer-events: none;
}
.cdet__arm {
  pointer-events: auto;
  margin-inline-start: auto;
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  min-height: var(--tap);
  padding: 0 var(--s5);
  border: 0;
  border-radius: var(--radius-full);
  background: var(--bg-raised);
  box-shadow: inset 0 0 0 1px var(--border-strong), var(--shadow-card);
  color: var(--text-strong);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  cursor: pointer;
}
.cdet__arm--done { background: var(--accent-ink); color: var(--paper); box-shadow: none; }
.cdet__arm:active { transform: scale(0.98); }
.cdet__chip {
  padding: var(--s1) var(--s3);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-raised) 90%, transparent);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.cdet__badge { position: absolute; z-index: 2; top: var(--s4); right: var(--s4); }
.cdet__dims {
  position: absolute;
  z-index: 2;
  top: var(--s4);
  left: var(--s4);
  padding: var(--s1) var(--s3);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-raised) 90%, transparent);
  box-shadow: inset 0 0 0 1px var(--hairline);
}

/* ---- buy column ------------------------------------------------------- */
.cdet__info { display: grid; gap: var(--s6); min-width: 0; }
.cdet__kicker { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2) var(--s4); }
.cdet__brand {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.cdet__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2.1rem, 1.5rem + 2.4vw, 3.4rem);
  font-weight: 450;
  line-height: 1.04;
  letter-spacing: -0.02em;
  color: var(--text-strong);
  text-wrap: balance;
}
.cdet__rating {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2) var(--s3);
  margin-top: calc(var(--s3) * -1);
  font-size: var(--step--1);
  color: var(--text-muted);
}
.cdet__stars { color: var(--accent); letter-spacing: 0.08em; }
.cdet__rating b { color: var(--text-strong); font-weight: 600; font-variant-numeric: tabular-nums; }
.cdet__sep { width: 3px; height: 3px; border-radius: 50%; background: var(--text-faint); }

.cdet__priceRow { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--s2) var(--s4); }
.cdet__price {
  font-family: var(--font-ui);
  font-size: clamp(1.75rem, 1.4rem + 1.2vw, 2.25rem);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.025em;
  color: var(--text-strong);
  line-height: 1;
}
.cdet__was {
  font-size: var(--step-0);
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--text-muted) 60%, transparent);
}
.cdet__off {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 var(--s2);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-ink);
  font-size: var(--step--2);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* ---- finish swatches -------------------------------------------------- */
.cdet__opt { display: grid; gap: var(--s3); }
.cdet__optHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s3);
  font-size: var(--step--1);
  color: var(--text-muted);
}
.cdet__optHead b { color: var(--text-strong); font-weight: 600; }
.cdet__swatches { display: flex; flex-wrap: wrap; gap: var(--s2); margin: 0; padding: 0; list-style: none; }
.cdet__swatch {
  position: relative;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--hairline);
  cursor: pointer;
  transition: box-shadow var(--d-fast) var(--ease), transform var(--d-fast) var(--ease);
}
.cdet__swatch:active { transform: scale(0.96); }
.cdet__swatch[aria-checked='true'] { box-shadow: inset 0 0 0 2px var(--text-strong); }
.cdet__swatch:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.cdet__swatchDot {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--clay-900) 14%, transparent),
    inset 0 2px 3px color-mix(in srgb, var(--white) 35%, transparent);
}

/* ---- measures strip --------------------------------------------------- */
.cdet__measures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-radius: var(--radius-xl);
  box-shadow: inset 0 0 0 1px var(--hairline);
  overflow: hidden;
}
.cdet__measure { display: grid; gap: 2px; padding: var(--s3) var(--s4); }
.cdet__measure + .cdet__measure { border-inline-start: 1px solid var(--hairline); }
.cdet__measure span {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.cdet__measure b {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong);
}

/* ---- actions ---------------------------------------------------------- */
.cdet__actions { display: grid; gap: var(--s3); }
.cdet__actions .cat-cta { justify-content: space-between; width: 100%; min-height: 56px; font-size: var(--step-0); }
.cdet__note { font-size: var(--step--1); line-height: 1.5; color: var(--text-muted); margin: 0; }
.cdet__facts {
  display: grid;
  gap: var(--s3);
  padding: var(--s4) var(--s5);
  border-radius: var(--radius-xl);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.cdet__aux { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s3); }
.cdet__save {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  min-height: var(--tap);
  padding: 0 var(--s4);
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--border-strong);
  color: var(--text-strong);
  font-family: var(--font-ui);
  font-size: var(--step--1);
  font-weight: 500;
  cursor: pointer;
}
.cdet__save[aria-pressed='true'] { background: var(--text-strong); color: var(--bg); box-shadow: none; }
.cdet__save:active { transform: scale(0.98); }
.cdet__links { display: flex; flex-wrap: wrap; gap: 0 var(--s4); }
.cdet__seller {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap);
  color: var(--text-muted);
  font-size: var(--step--1);
  text-decoration: underline;
  text-decoration-color: var(--hairline);
  text-underline-offset: 3px;
}

/* ---- overview + specs ------------------------------------------------- */
.cdet__section { padding-top: var(--s24); }
.cdet__sectionHead { display: flex; gap: var(--s4); align-items: center; padding-block: var(--s8); }
.cdet__sectionHead::after { content: ''; flex: 1; height: 1px; background: var(--hairline); }
.cdet__overview { display: grid; gap: var(--s10); }
@media (min-width: 900px) {
  .cdet__overview { grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: var(--s16); }
}
.cdet__lead {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--step-2);
  font-weight: 400;
  line-height: 1.35;
  letter-spacing: -0.008em;
  color: var(--text-strong);
  max-width: 34ch;
  text-wrap: pretty;
}
.cdet__specs { margin: 0; }
.cdet__spec {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--s4);
  align-items: baseline;
  padding-block: var(--s4);
  border-top: 1px solid var(--hairline);
}
.cdet__spec:last-child { border-bottom: 1px solid var(--hairline); }
.cdet__spec dt {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.cdet__spec dd {
  margin: 0;
  text-align: end;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
}

/* ---- sticky buy bar: phones and small tablets ------------------------- */
.cdet-buybar { display: none; }
@media (max-width: 899px) {
  .cdet { padding-bottom: calc(var(--s32) + 72px); }
  .cdet-buybar {
    position: fixed;
    z-index: 40;
    left: var(--s4);
    right: var(--s4);
    bottom: calc(92px + var(--s2) + env(safe-area-inset-bottom, 0px));
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s3);
    max-width: 560px;
    margin-inline: auto;
    padding: var(--s2) var(--s2) var(--s2) var(--s5);
    border-radius: var(--radius-full);
    background: var(--bg-raised);
    box-shadow: inset 0 0 0 1px var(--hairline), var(--shadow-float);
    transition: transform var(--d-base) var(--ease-fluid), opacity var(--d-base) var(--ease-fluid);
  }
  .cdet-buybar[data-hidden='true'] { transform: translateY(16px); opacity: 0; pointer-events: none; }
  .cdet-buybar__price {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--step--1);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--text-strong);
  }
  .cdet-buybar .cat-cta { flex: 0 1 auto; min-width: 0; padding-left: var(--s4); gap: var(--s3); }
  .cdet-buybar .cat-cta > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
@media (hover: hover) and (pointer: fine) {
  .cdet__seller:hover { color: var(--text-strong); }
  .cdet__swatch:hover { box-shadow: inset 0 0 0 1px var(--border-strong); }
  .cdet__swatch[aria-checked='true']:hover { box-shadow: inset 0 0 0 2px var(--text-strong); }
}

/* ---- elevation drawing ------------------------------------------------ */
.cdet__drawTray {
  padding: var(--s2);
  border-radius: 2rem;
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.cdet__drawCore {
  border-radius: 1.5rem;
  background: var(--bg-raised);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--white) 55%, transparent),
    inset 0 0 0 1px var(--hairline);
  padding: var(--s8) var(--s6);
}
.cdet__drawGrid { display: grid; gap: var(--s8); grid-template-columns: minmax(0, 1fr); }
@media (min-width: 760px) { .cdet__drawGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

.cdet__related { padding-top: var(--s24); display: grid; gap: var(--s8); }
.cdet__relatedHead { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--s4); flex-wrap: wrap; }
.cdet__relatedTitle {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--step-3);
  font-weight: 450;
  letter-spacing: -0.018em;
  line-height: 1.08;
  color: var(--text-strong);
}

@media (max-width: 479px) {
  .cdet__measure { padding: var(--s3); }
  .cdet__swatch { width: 44px; height: 44px; }
  .cdet__swatchDot { width: 32px; height: 32px; }
}

@media (prefers-reduced-motion: reduce) {
  .cdet__back span:first-child { transition: none; }
  .cdet-buybar { transition: none; }
}
`

/* ------------------------------------------------------ elevation drawing */

const STROKE = 'var(--clay-300)'
const HAIR = 'var(--hairline)'
const LABEL = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.12em',
} as const

/** Horizontal dimension line with witness ticks, the architectural way. */
function DimH({ x1, x2, y, text }: { x1: number; x2: number; y: number; text: string }) {
  return (
    <g>
      <path d={`M${x1} ${y} L${x2} ${y}`} stroke={HAIR} strokeWidth="1" />
      <path
        d={`M${x1} ${y - 4} L${x1} ${y + 4} M${x2} ${y - 4} L${x2} ${y + 4}`}
        stroke="var(--border-strong)"
        strokeWidth="1"
      />
      <text
        x={(x1 + x2) / 2}
        y={y + 14}
        textAnchor="middle"
        fill="var(--text-muted)"
        style={LABEL}
      >
        {text}
      </text>
    </g>
  )
}

/** Vertical dimension line. */
function DimV({ y1, y2, x, text }: { y1: number; y2: number; x: number; text: string }) {
  return (
    <g>
      <path d={`M${x} ${y1} L${x} ${y2}`} stroke={HAIR} strokeWidth="1" />
      <path
        d={`M${x - 4} ${y1} L${x + 4} ${y1} M${x - 4} ${y2} L${x + 4} ${y2}`}
        stroke="var(--border-strong)"
        strokeWidth="1"
      />
      <text
        x={x - 6}
        y={(y1 + y2) / 2}
        textAnchor="end"
        dominantBaseline="middle"
        fill="var(--text-muted)"
        style={LABEL}
      >
        {text}
      </text>
    </g>
  )
}

/** Front elevation: width × height, with the seat height called out. */
function FrontElevation({ product, unit }: { product: Product; unit: string }) {
  const { widthCm, heightCm, seatHeightCm } = product.dimensions
  const box = { x0: 52, x1: 188, yBase: 122 }
  const scale = Math.min((box.x1 - box.x0) / widthCm, 84 / heightCm)
  const w = widthCm * scale
  const h = heightCm * scale
  const x0 = box.x0 + ((box.x1 - box.x0) - w) / 2
  const y0 = box.yBase - h
  const seatY = seatHeightCm ? box.yBase - seatHeightCm * scale : null

  return (
    <svg viewBox="0 0 220 160" width="100%" style={{ display: 'block', height: 'auto' }} fill="none" aria-hidden="true">
      <g stroke={STROKE} strokeWidth="1.25" strokeLinejoin="round">
        <rect x={x0} y={y0} width={w} height={h} rx="3" />
        {seatY !== null && <path d={`M${x0} ${seatY} L${x0 + w} ${seatY}`} strokeDasharray="3 4" />}
        <path d={`M${x0 + w * 0.22} ${y0} L${x0 + w * 0.22} ${seatY ?? box.yBase}`} opacity="0.5" />
        <path d={`M${x0 + w * 0.78} ${y0} L${x0 + w * 0.78} ${seatY ?? box.yBase}`} opacity="0.5" />
      </g>
      <path d={`M24 ${box.yBase} L204 ${box.yBase}`} stroke={HAIR} strokeWidth="1" />
      <DimH x1={x0} x2={x0 + w} y={box.yBase + 14} text={`${widthCm} ${unit}`} />
      <DimV y1={y0} y2={box.yBase} x={x0 - 10} text={`${heightCm} ${unit}`} />
      {seatHeightCm && (
        <DimV y1={seatY as number} y2={box.yBase} x={x0 + w + 16} text={`${seatHeightCm} ${unit}`} />
      )}
    </svg>
  )
}

/** Plan: width × depth, seen from above. */
function PlanElevation({ product, unit }: { product: Product; unit: string }) {
  const { widthCm, depthCm } = product.dimensions
  const box = { x0: 52, x1: 188, y0: 34, y1: 122 }
  const scale = Math.min((box.x1 - box.x0) / widthCm, (box.y1 - box.y0) / depthCm)
  const w = widthCm * scale
  const d = depthCm * scale
  const x0 = box.x0 + ((box.x1 - box.x0) - w) / 2
  const y0 = box.y0 + ((box.y1 - box.y0) - d) / 2

  return (
    <svg viewBox="0 0 220 160" width="100%" style={{ display: 'block', height: 'auto' }} fill="none" aria-hidden="true">
      <g stroke={STROKE} strokeWidth="1.25" strokeLinejoin="round">
        <rect x={x0} y={y0} width={w} height={d} rx="3" />
        <path d={`M${x0} ${y0} L${x0 + w} ${y0 + d}`} strokeDasharray="2 5" opacity="0.45" />
        <path d={`M${x0 + w} ${y0} L${x0} ${y0 + d}`} strokeDasharray="2 5" opacity="0.45" />
      </g>
      <DimH x1={x0} x2={x0 + w} y={y0 + d + 16} text={`${widthCm} ${unit}`} />
      <DimV y1={y0} y2={y0 + d} x={x0 - 10} text={`${depthCm} ${unit}`} />
    </svg>
  )
}

/**
 * A `DimensionLine` that draws itself on: it scales in from the hinge on the
 * left, once, the first time it scrolls into view — so the measurement reads
 * as being taken rather than just appearing.
 */
function DrawnDimension({
  value,
  unit,
  label,
  delay = 0,
}: {
  value: string
  unit: string
  label: string
  delay?: number
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      style={{ transformOrigin: '0% 50%' }}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: reduced ? 0 : 0.5, ease: EASE, delay: reduced ? 0 : delay }}
    >
      <DimensionLine value={value} unit={unit} label={label} />
    </motion.div>
  )
}

/* -------------------------------------------------------------- not found */

function Missing() {
  const { t } = useTranslation()
  return (
    <div className="fs-container" style={{ paddingBlock: 'var(--s24)' }}>
      <span className="fs-label">404</span>
      <h1 className="fs-display" style={{ marginTop: 'var(--s4)' }}>
        {t('catalog.detail.missing')}
      </h1>
      <p style={{ marginTop: 'var(--s6)' }}>
        <Link className="fs-btn fs-btn--secondary" to="/catalog">
          {t('catalog.detail.back')}
        </Link>
      </p>
    </div>
  )
}


/* ------------------------------------------------------------------- page */

export function CatalogItem() {
  const { id } = useParams()
  const { t } = useTranslation()
  const money = useMoney()
  const count = useCount()
  const reduced = useReducedMotion()
  const coarse = useMediaQuery('(pointer: coarse)')
  const [orbiting, setOrbiting] = useState(false)
  // Touch only: the stage owns gestures between "Tap to rotate" and "Done".
  const [armed, setArmed] = useState(false)
  const [finish, setFinish] = useState<FinishKey | null>(null)

  const product = useMemo(() => getProduct(id), [id])
  const related = useMemo(() => (product ? relatedProducts(product.id, 3) : []), [product])
  const finishes = useMemo(() => (product ? finishesFor(product) : []), [product])

  const saved = useSaved((state) => (product ? state.items.some((item) => item.id === product.id) : false))
  const save = useSaved((state) => state.save)
  const unsave = useSaved((state) => state.remove)

  // Hide the phone buy bar while the real actions are on screen.
  const buyPanel = useRef<HTMLDivElement>(null)
  const [buyInView, setBuyInView] = useState(false)
  useEffect(() => {
    const el = buyPanel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setBuyInView(entry.isIntersecting), {
      threshold: 0.25,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [product])

  // A new piece starts released, in its own finish.
  useEffect(() => {
    setArmed(false)
    setOrbiting(false)
    setFinish(null)
  }, [id])

  if (!product) return <Missing />

  const name = t(`catalog.products.${product.nameKey}.name`)
  const blurb = t(`catalog.products.${product.nameKey}.blurb`)
  const unit = t('catalog.detail.cm')
  const current = finishes.find((f) => f.key === finish) ?? finishes[0]
  const palette = current?.palette ?? product.palette
  const { widthCm, depthCm, heightCm } = product.dimensions

  const rise = {
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-10% 0px' },
    transition: { duration: reduced ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] as const },
  }

  // Fast entry choreography for the buy column: kicker, then the headline's
  // own word-cascade, then the price and actions stagger in after it.
  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.36, ease: EASE, delay: reduced ? 0 : delay },
  })

  // Pieces the builder can draw open it with the piece already in the room;
  // the rest (curtains, paint, wall panels) go to the photo flow.
  const piece = builderPieceFor(product)
  const photoTo = `/app/capture?product=${encodeURIComponent(product.slug)}`
  const placeTo = piece
    ? `/app/room/new?add=${encodeURIComponent(piece)}&from=${encodeURIComponent(product.slug)}`
    : photoTo
  const placeLabel = piece ? t('catalog.detail.placeInRoom') : t('catalog.detail.placeCta')
  const contactTo = `/contact?product=${encodeURIComponent(product.slug)}`
  // Only some makers have a public store page yet; for the rest, the seller
  // link is a catalog search for their brand rather than a 404.
  const sellerTo = getStore(product.vendorSlug)
    ? `/store/${product.vendorSlug}`
    : `/catalog?q=${encodeURIComponent(product.brand)}`
  const interactive = coarse ? armed : true
  const off =
    product.compareAtUzs && product.compareAtUzs > product.priceUzs
      ? Math.round((1 - product.priceUzs / product.compareAtUzs) * 100)
      : 0

  const toggleSave = () => {
    if (saved) {
      unsave(product.id)
      return
    }
    save({
      id: product.id,
      name,
      category: product.category,
      style: product.style,
      price: product.priceUzs,
      currency: 'UZS',
    })
  }

  const specs: Array<{ key: string; value: string }> = [
    { key: 'brand', value: product.brand },
    { key: 'category', value: t(`catalog.categories.${product.category}`) },
    { key: 'style', value: t(`catalog.styles.${product.style}`) },
    { key: 'room', value: product.rooms.map((r) => t(`catalog.rooms.${r}`)).join(' · ') },
    {
      key: 'materials',
      value: product.materialKeys.map((m) => t(`catalog.materials.${m}`)).join(' · '),
    },
    { key: 'colour', value: t(`catalog.colors.${product.colorKey}`) },
    { key: 'weight', value: `${product.weightKg} ${t('catalog.detail.kg')}` },
    { key: 'lead', value: t('catalog.card.leadTime', { days: product.leadTimeDays }) },
    { key: 'rating', value: `${product.rating.toFixed(1)} / 5 · ${count(product.reviews)}` },
    { key: 'sku', value: product.id.toUpperCase() },
  ]

  const fullStars = Math.round(product.rating)

  return (
    <div className="cdet">
      <style href="fs-cat-detail" precedence="medium">
        {CSS}
      </style>
      <CatalogChromeStyles />
      <ProductGridStyles />

      <Seo
        title={`${name} — ${t('catalog.meta.title')}`}
        description={blurb}
        path={`/catalog/${product.slug}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name,
          description: blurb,
          brand: { '@type': 'Brand', name: product.brand },
          sku: product.id.toUpperCase(),
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating.toFixed(1),
            reviewCount: product.reviews,
          },
          offers: {
            '@type': 'Offer',
            price: String(product.priceUzs),
            priceCurrency: 'UZS',
            availability: product.inStock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/PreOrder',
          },
        }}
      />

      <div className="fs-container">
        <div className="cdet__bar">
          <Link className="cdet__back" to="/catalog">
            <span aria-hidden="true">←</span>
            <span>{t('catalog.detail.back')}</span>
          </Link>
          <Mono label={t('catalog.detail.sku')} value={product.id.toUpperCase()} />
        </div>

        <div className="cdet__hero">
          <div className="cdet__stageWrap">
            <motion.div
              className="cdet__stage"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: reduced ? 0 : 0.55, ease: EASE }}
            >
              <div
                className={
                  coarse
                    ? armed
                      ? 'cdet__plate cdet__plate--armed'
                      : 'cdet__plate cdet__plate--touch'
                    : 'cdet__plate'
                }
                data-cursor={t('catalog.detail.dragHint')}
                onPointerDown={() => {
                  if (interactive) setOrbiting(true)
                }}
              >
                <span className="cdet__dims">
                  <Mono
                    label={t('catalog.detail.measures')}
                    value={`${widthCm} × ${depthCm} × ${heightCm} ${unit}`}
                  />
                </span>
                <span className="cdet__badge">
                  <StatusPip status={product.modelStatus}>
                    {t(`catalog.card.model.${product.modelStatus}`)}
                  </StatusPip>
                </span>

                <div className="cdet__canvas">
                  <ProductViewer
                    model={product.model}
                    palette={palette}
                    interactive={interactive}
                    shadows
                    spin={!orbiting && !armed && !reduced}
                    spinSpeed={0.18}
                    style={{ width: '100%', height: '100%' }}
                    label={name}
                  />
                </div>

                <span className="cdet__hint">
                  {!coarse && (
                    <>
                      <span className="cdet__chip">
                        <Mono value={t('catalog.detail.rotateHint')} />
                      </span>
                      <span className="cdet__chip">
                        <Mono value={t('catalog.detail.zoomHint')} />
                      </span>
                    </>
                  )}
                  {coarse && armed && (
                    <span className="cdet__chip">
                      <Mono value={t('catalog.detail.rotateHintTouch')} />
                    </span>
                  )}
                  {coarse && (
                    <button
                      type="button"
                      className={armed ? 'cdet__arm cdet__arm--done' : 'cdet__arm'}
                      aria-pressed={armed}
                      onClick={() => {
                        setArmed((value) => !value)
                        setOrbiting(false)
                      }}
                    >
                      {armed ? t('catalog.detail.done') : t('catalog.detail.tapToRotate')}
                    </button>
                  )}
                </span>
              </div>
            </motion.div>
          </div>

          <div className="cdet__info">
            <motion.div className="cdet__kicker" {...fadeUp(0)}>
              <Eyebrow>{t(`catalog.categories.${product.category}`)}</Eyebrow>
              <span className="cdet__brand">{product.brand}</span>
            </motion.div>

            <TextReveal
              as="h1"
              className="cdet__title"
              text={name}
              duration={0.5}
              stagger={0.035}
              delay={0.06}
            />

            <motion.div className="cdet__rating" {...fadeUp(0.16)}>
              <span className="cdet__stars" aria-hidden="true">
                {'★'.repeat(fullStars)}
                <span style={{ opacity: 0.28 }}>{'★'.repeat(Math.max(0, 5 - fullStars))}</span>
              </span>
              <b>{product.rating.toFixed(1)}</b>
              <span>{t('catalog.detail.reviews', { count: product.reviews })}</span>
              <span className="cdet__sep" aria-hidden="true" />
              <span>
                {t('catalog.detail.placements')}: <b>{count(product.placements)}</b>
              </span>
            </motion.div>

            <motion.div style={{ display: 'grid', gap: 'var(--s2)' }} {...fadeUp(0.2)}>
              <span className="fs-label">{t('catalog.detail.price')}</span>
              <div className="cdet__priceRow">
                <span className="cdet__price">{money.price(product.priceUzs)}</span>
                {product.compareAtUzs && off > 0 && (
                  <>
                    <span className="cdet__was">{money.price(product.compareAtUzs)}</span>
                    <span className="cdet__off">{t('catalog.detail.off', { pct: off })}</span>
                  </>
                )}
              </div>
            </motion.div>

            {finishes.length > 1 && (
              <motion.div className="cdet__opt" {...fadeUp(0.24)}>
                <div className="cdet__optHead">
                  <span>
                    {t('catalog.detail.finish')}: <b>{t(`catalog.finishes.${current.key}`)}</b>
                  </span>
                </div>
                <ul className="cdet__swatches" role="radiogroup" aria-label={t('catalog.detail.finish')}>
                  {finishes.map((option) => {
                    const label = t(`catalog.finishes.${option.key}`)
                    const checked = option.key === current.key
                    return (
                      <li key={option.key}>
                        <button
                          type="button"
                          role="radio"
                          className="cdet__swatch"
                          aria-checked={checked}
                          aria-label={label}
                          title={label}
                          onClick={() => setFinish(option.key)}
                        >
                          <span
                            className="cdet__swatchDot"
                            style={{
                              background: `linear-gradient(135deg, ${option.palette.body} 0 52%, ${option.palette.wood} 52% 100%)`,
                            }}
                          />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </motion.div>
            )}

            <motion.div className="cdet__measures" {...fadeUp(0.28)}>
              {[
                { key: 'width', value: widthCm },
                { key: 'depth', value: depthCm },
                { key: 'height', value: heightCm },
              ].map((m) => (
                <div className="cdet__measure" key={m.key}>
                  <span>{t(`catalog.detail.${m.key}`)}</span>
                  <b>
                    {m.value} {unit}
                  </b>
                </div>
              ))}
            </motion.div>

            <motion.div className="cdet__actions" ref={buyPanel} {...fadeUp(0.32)}>
              <CtaLink to={placeTo} glyph="⌖">
                {placeLabel}
              </CtaLink>
              <p className="cdet__note">
                {piece ? t('catalog.detail.placeInRoomNote') : t('catalog.detail.placeNote')}
              </p>
              {piece && (
                <CtaLink to={photoTo} quiet glyph="◐">
                  {t('catalog.detail.tryOnPhoto')}
                </CtaLink>
              )}
            </motion.div>

            <motion.div className="cdet__facts" {...fadeUp(0.36)}>
              <StatusPip status={product.inStock ? 'ready' : 'processing'}>
                {product.inStock
                  ? t('catalog.detail.inStockShort')
                  : t('catalog.card.leadTime', { days: product.leadTimeDays })}
              </StatusPip>
              <Mono
                label={t('catalog.detail.spec.lead')}
                value={t('catalog.card.leadTime', { days: product.leadTimeDays })}
              />
              <Mono label={t('catalog.detail.views')} value={count(product.views)} />
            </motion.div>

            <motion.div className="cdet__aux" {...fadeUp(0.4)}>
              <button type="button" className="cdet__save" aria-pressed={saved} onClick={toggleSave}>
                <span aria-hidden="true">{saved ? '♥' : '♡'}</span>
                {saved ? t('catalog.detail.saved') : t('catalog.detail.save')}
              </button>
              <span className="cdet__links">
                <Link className="cdet__seller" to={sellerTo}>
                  {t('catalog.detail.seller', { brand: product.brand })}
                </Link>
                <Link className="cdet__seller" to={contactTo}>
                  {t('catalog.detail.contact')}
                </Link>
              </span>
            </motion.div>
          </div>
        </div>

        <motion.section className="cdet__section" {...rise}>
          <hr className="fs-rule-strong" />
          <div className="cdet__sectionHead">
            <Eyebrow>{t('catalog.detail.overview')}</Eyebrow>
          </div>
          <div className="cdet__overview">
            <p className="cdet__lead">{blurb}</p>
            <RevealGroup>
              <dl className="cdet__specs" aria-label={t('catalog.detail.specsTitle')}>
                {specs.map((spec) => (
                  <RevealItem className="cdet__spec" key={spec.key}>
                    <dt>{t(`catalog.detail.spec.${spec.key}`)}</dt>
                    <dd>{spec.value}</dd>
                  </RevealItem>
                ))}
              </dl>
            </RevealGroup>
          </div>
        </motion.section>

        <motion.section className="cdet__section" {...rise}>
          <hr className="fs-rule-strong" />
          <div className="cdet__sectionHead">
            <Eyebrow>{t('catalog.detail.dimensions')}</Eyebrow>
          </div>

          <div className="cdet__drawTray">
            <div className="cdet__drawCore">
              <div className="cdet__drawGrid">
                <figure style={{ margin: 0, display: 'grid', gap: 'var(--s4)' }}>
                  <FrontElevation product={product} unit={unit} />
                  <figcaption style={{ display: 'grid', gap: 'var(--s2)' }}>
                    <span className="fs-label">{t('catalog.detail.front')}</span>
                    <DrawnDimension
                      value={String(widthCm)}
                      unit={unit}
                      label={`${t('catalog.detail.width')}: ${widthCm} ${unit}`}
                    />
                    <DrawnDimension
                      value={String(heightCm)}
                      unit={unit}
                      label={`${t('catalog.detail.height')}: ${heightCm} ${unit}`}
                      delay={0.08}
                    />
                  </figcaption>
                </figure>
                <figure style={{ margin: 0, display: 'grid', gap: 'var(--s4)' }}>
                  <PlanElevation product={product} unit={unit} />
                  <figcaption style={{ display: 'grid', gap: 'var(--s2)' }}>
                    <span className="fs-label">{t('catalog.detail.plan')}</span>
                    <DrawnDimension
                      value={String(widthCm)}
                      unit={unit}
                      label={`${t('catalog.detail.width')}: ${widthCm} ${unit}`}
                    />
                    <DrawnDimension
                      value={String(depthCm)}
                      unit={unit}
                      label={`${t('catalog.detail.depth')}: ${depthCm} ${unit}`}
                      delay={0.08}
                    />
                  </figcaption>
                </figure>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 'var(--s8)' }}>
            <Notice>{t('catalog.notice.modelData')}</Notice>
          </div>
        </motion.section>

        {related.length > 0 && (
          <motion.section className="cdet__related" {...rise}>
            <hr className="fs-rule-strong" />
            <div className="cdet__relatedHead">
              <h2 className="cdet__relatedTitle">{t('catalog.detail.similar')}</h2>
              <CtaLink to="/catalog" quiet>
                {t('catalog.detail.back')}
              </CtaLink>
            </div>
            <ProductGrid products={related} layout="uniform" />
          </motion.section>
        )}
      </div>

      <div
        className="cdet-buybar"
        data-hidden={buyInView}
        aria-hidden={buyInView || undefined}
        inert={buyInView}
      >
        <span className="cdet-buybar__price">{money.price(product.priceUzs)}</span>
        <CtaLink to={placeTo} glyph="⌖">
          {placeLabel}
        </CtaLink>
      </div>
    </div>
  )
}

export default CatalogItem
