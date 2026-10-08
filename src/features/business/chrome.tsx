import {
  Suspense,
  lazy,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { EASE } from '@/design/motion'
import { cn } from '@/lib/cn'
import { detectSceneTier } from '@/three/effects/quality'
import { ViewportGate } from '@/features/catalog/chrome'
import type { Product } from '@/features/catalog/data'
import { BUSINESS, LEADS, VENDOR_PRODUCTS } from './data'
import { useSavedBranding } from './local'

/**
 * Dashboard chrome: the shell (sidebar on wide screens, a sticky tab rail on
 * narrow ones), panels, KPI tiles, the sparkline, the live 3D thumbnail, form
 * primitives and the empty state.
 *
 * Same design system as the consumer side — same tokens, same double bezel,
 * same easing — but one notch denser, because a vendor is here to scan rows,
 * not to be sold to. Numbers are always mono + tabular figures; titles are the
 * display serif; everything else is the UI sans.
 *
 * One hoisted `<style href="fs-biz-chrome">` for the whole area.
 *
 * Phones: tables marked `biz-table--stack` turn each row into a labelled card
 * below 720px (every `<td>` carries its column name in `data-label`).
 */

const CSS = `
.biz {
  min-height: 100dvh;
  padding-bottom: var(--s24);
  background: var(--bg);
  font-family: var(--font-ui);
}
.biz__frame { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; }
@media (min-width: 1100px) {
  .biz__frame { grid-template-columns: 240px minmax(0, 1fr); gap: var(--s10); }
}

/* ---- sidebar (≥1100px) ------------------------------------------------- */
.biz-side { display: none; }
@media (min-width: 1100px) {
  .biz-side {
    display: grid;
    align-content: start;
    gap: var(--s5);
    position: sticky;
    top: var(--hdr-offset);
    align-self: start;
    padding-block: var(--s8) var(--s6);
    max-height: calc(100dvh - var(--hdr-offset));
    overflow-y: auto;
    scrollbar-width: none;
  }
  .biz-side::-webkit-scrollbar { display: none; }
}
.biz-ident { display: flex; align-items: center; gap: var(--s3); min-width: 0; }
.biz-ident__mono {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--accent);
  color: var(--on-accent);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  box-shadow: var(--inset-hi);
}
.biz-ident__text { display: grid; gap: 2px; min-width: 0; }
.biz-ident__name {
  font-family: var(--font-display);
  font-size: var(--step-1);
  line-height: 1.15;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.biz-ident__sub {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.biz-side__nav { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
.biz-side__label {
  padding: 0 var(--s3);
  margin-bottom: var(--s1);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-faint);
}
.biz-side__link {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--s3);
  min-height: 40px;
  padding: 0 var(--s3);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  text-decoration: none;
  font-size: var(--step--1);
  font-weight: 500;
  transition: color var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease);
}
.biz-side__link svg { flex: 0 0 auto; opacity: 0.8; }
.biz-side__link[aria-current='page'] {
  background: var(--bg-raised);
  color: var(--text-strong);
  box-shadow: inset 0 0 0 1px var(--hairline), var(--inset-hi);
}
.biz-side__link[aria-current='page'] svg { color: var(--accent); opacity: 1; }
.biz-side__link[aria-current='page']::before {
  content: '';
  position: absolute;
  left: -10px;
  top: 10px;
  bottom: 10px;
  width: 2px;
  border-radius: 2px;
  background: var(--accent);
}
.biz-count {
  margin-inline-start: auto;
  min-width: 22px;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  font-family: var(--font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--text-muted);
}
.biz-count--hot { background: var(--accent); color: var(--on-accent); box-shadow: none; }
.biz-side__card {
  display: grid;
  gap: var(--s3);
  padding: var(--s4);
  border-radius: var(--radius-2xl);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.biz-meter { height: 6px; border-radius: var(--radius-full); background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--hairline); overflow: hidden; }
.biz-meter > span { display: block; height: 100%; border-radius: inherit; background: var(--accent); transform-origin: left center; }
.biz-side__store {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  min-height: 40px;
  padding: 0 var(--s3);
  border-radius: var(--radius-lg);
  color: var(--text-strong);
  text-decoration: none;
  font-size: var(--step--1);
  font-weight: 500;
  box-shadow: inset 0 0 0 1px var(--border-strong);
  transition: background-color var(--d-fast) var(--ease);
}
.biz-side__url { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.04em; color: var(--text-muted); font-weight: 400; }

/* ---- narrow top: ident + sticky tab rail (<1100px) ---------------------- */
.biz-mtop { padding-block: var(--s6) var(--s3); display: flex; align-items: center; justify-content: space-between; gap: var(--s4); }
.biz-mtop__store {
  display: inline-flex; align-items: center; gap: var(--s2);
  min-height: var(--tap); padding: 0 var(--s4);
  border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px var(--border-strong);
  color: var(--text-strong); text-decoration: none;
  font-size: var(--step--1); font-weight: 500; white-space: nowrap;
}
.biz-rail {
  position: sticky;
  top: var(--hdr-offset);
  z-index: 18;
  padding-block: var(--s2);
  margin-inline: calc(var(--gutter) * -1);
  padding-inline: var(--gutter);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.biz-rail__nav {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  overflow-x: auto;
  scrollbar-width: none;
  scroll-snap-type: x proximity;
}
.biz-rail__nav::-webkit-scrollbar { display: none; }
.biz-rail__tab {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  min-height: 40px;
  padding: 0 var(--s4);
  border-radius: var(--radius-full);
  color: var(--text-muted);
  text-decoration: none;
  font-size: var(--step--1);
  font-weight: 500;
  white-space: nowrap;
  scroll-snap-align: center;
  transition: color var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease);
}
.biz-rail__tab[aria-current='page'] {
  background: var(--bg-raised);
  color: var(--text-strong);
  box-shadow: inset 0 0 0 1px var(--hairline), var(--inset-hi);
}
.biz-rail__tab[aria-current='page'] svg { color: var(--accent); }
@media (min-width: 1100px) { .biz-mtop, .biz-rail { display: none; } }

/* ---- page head --------------------------------------------------------- */
.biz__main { min-width: 0; padding-top: var(--s4); }
@media (min-width: 1100px) { .biz__main { padding-top: var(--s8); } }
.biz__head { padding-block: var(--s6) var(--s6); display: grid; gap: var(--s3); }
.biz__crumb {
  display: flex; align-items: center; gap: var(--s2);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.biz__crumb b { font-weight: 400; color: var(--accent-ink); }
.biz__title {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: var(--step-3);
  line-height: var(--lh-tight);
  letter-spacing: -0.02em;
  color: var(--text-strong);
  text-wrap: balance;
}
.biz__lead { color: var(--text-muted); max-width: 64ch; font-size: var(--step-0); line-height: 1.55; margin: 0; }
.biz__headRow { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--s5); flex-wrap: wrap; }
.biz__headText { display: grid; gap: var(--s3); min-width: 0; flex: 1 1 420px; }
.biz__actions { display: flex; gap: var(--s3); flex-wrap: wrap; }
.biz__badges { display: flex; gap: var(--s2); flex-wrap: wrap; align-items: center; }
.biz__body { display: grid; gap: var(--s5); }

/* ---- panel: the double bezel, one notch tighter ------------------------ */
.biz-panel {
  --biz-tray: var(--s1);
  --biz-radius: 1.375rem;
  min-width: 0;
  padding: var(--biz-tray);
  border-radius: var(--biz-radius);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.biz-panel__core {
  height: 100%;
  border-radius: calc(var(--biz-radius) - var(--biz-tray));
  background: var(--bg-raised);
  box-shadow: var(--inset-hi), inset 0 0 0 1px var(--hairline);
  overflow: hidden;
}
.biz-panel__pad { padding: var(--s5); }
.biz-panel__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3) var(--s4);
  padding: var(--s5) var(--s5) var(--s3);
}
.biz-panel__titles { display: grid; gap: 2px; min-width: 0; }
.biz-panel__title {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: var(--step-1);
  line-height: 1.25;
  color: var(--text-strong);
}
.biz-panel__sub { font-size: var(--step--1); color: var(--text-muted); }
.biz-panel--lift { transition: transform var(--d-base) var(--ease-fluid); }
@media (hover: hover) and (pointer: fine) {
  .biz-panel--lift:hover { transform: translateY(-2px); }
  .biz-panel--lift:hover .biz-panel__core { box-shadow: var(--inset-hi), inset 0 0 0 1px var(--border-strong); }
}

/* ---- KPI tile ---------------------------------------------------------- */
.biz-kpis { display: grid; gap: var(--s4); grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (min-width: 900px) { .biz-kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (max-width: 420px) { .biz-kpis--wrap { grid-template-columns: minmax(0, 1fr); } }
.biz-metric { display: grid; gap: var(--s3); padding: var(--s5); min-width: 0; }
.biz-metric__key {
  display: flex; align-items: center; gap: var(--s2);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.biz-metric__value {
  font-family: var(--font-mono);
  font-size: clamp(1.25rem, 1.05rem + 0.8vw, 1.6rem);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  color: var(--text-strong);
  line-height: 1.05;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.biz-metric__foot { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--s3); min-width: 0; }
.biz-metric__foot svg { flex: 0 1 auto; min-width: 0; max-width: 55%; height: auto; }
.biz-metric__note { font-size: var(--step--1); color: var(--text-muted); }
.biz-metric--primary { padding: var(--s8) var(--s6) var(--s6); gap: var(--s4); }
.biz-metric--primary .biz-metric__value {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: var(--step-5);
  letter-spacing: -0.02em;
}
.biz-metric--primary .biz-metric__key { color: var(--accent-ink); }
.biz-metric--primary .biz-metric__foot svg { max-width: 70%; }

.biz-delta {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  background: var(--bg-sunken);
  white-space: nowrap;
}
.biz-delta--up { color: var(--ok); background: color-mix(in srgb, var(--ok) 12%, transparent); }
.biz-delta--down { color: var(--err); background: color-mix(in srgb, var(--err) 12%, transparent); }

/* Visually hidden, still read aloud. */
.biz-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* ---- data table -------------------------------------------------------- */
.biz-table__scroll { overflow-x: auto; overscroll-behavior-x: contain; }
.biz-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--step--1);
  font-variant-numeric: tabular-nums;
}
.biz-table thead th {
  text-align: start;
  padding: var(--s3) var(--s4);
  background: var(--bg-raised);
  border-bottom: 1px solid var(--hairline);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 400;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
  white-space: nowrap;
}
.biz-table th:first-child, .biz-table td:first-child { padding-inline-start: var(--s5); }
.biz-table th:last-child, .biz-table td:last-child { padding-inline-end: var(--s5); }
.biz-table th.biz-num, .biz-table td.biz-num { text-align: end; }
.biz-table td.biz-num { font-family: var(--font-mono); font-size: 12.5px; }
.biz-table tbody td {
  padding: var(--s3) var(--s4);
  border-bottom: 1px solid var(--hairline);
  color: var(--text);
  vertical-align: middle;
}
.biz-table tbody tr:last-child td { border-bottom: 0; }
.biz-table tbody tr { transition: background-color var(--d-fast) var(--ease); }
.biz-table__name { color: var(--text-strong); font-weight: 600; }
.biz-table__sub {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
.biz-table__sortable {
  display: inline-flex;
  align-items: center;
  gap: var(--s1);
  background: none;
  border: 0;
  padding: 4px 0;
  cursor: pointer;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  color: inherit;
}
.biz-table__sortable[data-active='true'] { color: var(--text-strong); }
.biz-table__arrow { font-size: 9px; width: 9px; display: inline-block; }

@media (max-width: 719px) {
  .biz-table--stack thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .biz-table--stack,
  .biz-table--stack tbody { display: block; }
  .biz-table--stack caption { display: block; }
  .biz-table--stack tbody tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--s3) var(--s4);
    padding: var(--s4);
    border-bottom: 1px solid var(--hairline);
  }
  .biz-table--stack tbody tr:last-child { border-bottom: 0; }
  .biz-table--stack tbody td,
  .biz-table--stack tbody td:first-child,
  .biz-table--stack tbody td:last-child {
    display: grid;
    align-content: start;
    justify-items: start;
    gap: 3px;
    min-width: 0;
    padding: 0;
    border: 0;
  }
  .biz-table--stack tbody td.biz-num { text-align: start; }
  .biz-table--stack tbody td[data-label]::before {
    content: attr(data-label);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: var(--tracking-mono);
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .biz-table--stack tbody td:not([data-label]) { grid-column: 1 / -1; justify-items: stretch; }
}

/* ---- pills ------------------------------------------------------------- */
.biz-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--text);
  white-space: nowrap;
}
.biz-pill__dot { width: 6px; height: 6px; flex: 0 0 auto; border-radius: var(--radius-full); background: var(--text-faint); }
.biz-pill--ok .biz-pill__dot { background: var(--ok); }
.biz-pill--warn .biz-pill__dot { background: var(--warn); }
.biz-pill--err .biz-pill__dot { background: var(--err); }
.biz-pill--accent .biz-pill__dot { background: var(--accent); }
.biz-pill--ok { background: color-mix(in srgb, var(--ok) 9%, var(--bg-raised)); }
.biz-pill--warn { background: color-mix(in srgb, var(--warn) 11%, var(--bg-raised)); }
.biz-pill--err { background: color-mix(in srgb, var(--err) 9%, var(--bg-raised)); }
.biz-pill--accent { background: color-mix(in srgb, var(--accent) 10%, var(--bg-raised)); }

/* ---- grids ------------------------------------------------------------- */
.biz-cols { display: grid; gap: var(--s5); grid-template-columns: minmax(0, 1fr); align-items: start; }
@media (min-width: 720px) { .biz-cols--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 980px) { .biz-cols--split { grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); } }
.biz-cols--stretch { align-items: stretch; }

/* ---- toolbar ----------------------------------------------------------- */
.biz-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s3);
  padding: var(--s4) var(--s5);
  border-bottom: 1px solid var(--hairline);
}
.biz-bar__spacer { flex: 1; }
.biz-search { position: relative; flex: 1 1 220px; min-width: 0; }
.biz-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
.biz-search .biz-input { width: 100%; padding-inline: 36px 36px; }
.biz-search__clear {
  position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
  display: grid; place-items: center; width: 32px; height: 32px;
  border: 0; border-radius: var(--radius-full); background: transparent;
  color: var(--text-muted); cursor: pointer;
}
.biz-input {
  min-height: 40px;
  padding: 0 var(--s4);
  border: 0;
  border-radius: var(--radius-lg);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  color: var(--text-strong);
  font-family: var(--font-ui);
  font-size: 16px;
  min-width: 0;
  transition: box-shadow var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease);
}
select.biz-input { padding-inline-end: var(--s8); }
textarea.biz-input { padding: var(--s3) var(--s4); line-height: 1.5; resize: vertical; min-height: 96px; }
.biz-input:focus-visible { outline: none; background: var(--bg-raised); box-shadow: inset 0 0 0 1.5px var(--focus), 0 0 0 4px var(--selection); }
.biz-input[aria-invalid='true'] { box-shadow: inset 0 0 0 1.5px var(--err); }
.biz-input::placeholder { color: var(--text-faint); }
.biz-seg {
  display: inline-flex;
  gap: 2px;
  max-width: 100%;
  padding: 3px;
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.biz-seg::-webkit-scrollbar { display: none; }
.biz-seg button {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  min-height: 34px;
  padding: 0 var(--s4);
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: var(--step--1);
  font-weight: 500;
  cursor: pointer;
  transition: color var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease),
    transform var(--d-fast) var(--ease);
}
.biz-seg button:active { transform: scale(0.97); }
.biz-seg button[aria-pressed='true'] {
  background: var(--bg-raised);
  color: var(--text-strong);
  box-shadow: inset 0 0 0 1px var(--hairline), var(--inset-hi);
}
.biz-seg__n { font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted); font-variant-numeric: tabular-nums; }

/* ---- form primitives --------------------------------------------------- */
.biz-field { display: grid; gap: 6px; min-width: 0; }
.biz-label { font-size: var(--step--1); font-weight: 600; color: var(--text-strong); }
.biz-hint { font-size: 12px; color: var(--text-muted); }
.biz-error { display: flex; gap: 6px; align-items: baseline; font-size: 12.5px; color: var(--err); }
.biz-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--s2);
  min-height: 40px; padding: 0 var(--s4);
  border: 0; border-radius: var(--radius-full);
  background: var(--bg-raised);
  box-shadow: inset 0 0 0 1px var(--border-strong);
  color: var(--text-strong);
  font-family: var(--font-ui); font-size: var(--step--1); font-weight: 600;
  text-decoration: none; white-space: nowrap; cursor: pointer;
  transition: background-color var(--d-fast) var(--ease), transform var(--d-fast) var(--ease), opacity var(--d-fast) var(--ease);
}
.biz-btn:active:not(:disabled) { transform: scale(0.97); }
.biz-btn:disabled, .biz-btn[aria-disabled='true'] { opacity: 0.45; cursor: not-allowed; }
.biz-btn--primary { background: var(--accent-ink); color: var(--on-accent); box-shadow: var(--inset-hi); }
.biz-btn--ghost { background: transparent; box-shadow: none; color: var(--text-muted); }
.biz-btn--icon { width: 40px; padding: 0; }
.biz-save { display: inline-flex; align-items: center; gap: var(--s2); font-size: 12.5px; color: var(--text-muted); min-height: 24px; }
.biz-save--ok { color: var(--ok); }
.biz-save--err { color: var(--err); }
.biz-spin { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid currentColor; border-right-color: transparent; animation: biz-spin 0.7s linear infinite; }
@keyframes biz-spin { to { transform: rotate(360deg); } }

/* ---- avatar ------------------------------------------------------------ */
.biz-avatar {
  display: grid; place-items: center; flex: 0 0 auto;
  width: 36px; height: 36px; border-radius: var(--radius-full);
  font-family: var(--font-ui); font-size: 12px; font-weight: 700; letter-spacing: 0.02em;
  color: var(--text-strong);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.biz-avatar--lg { width: 48px; height: 48px; font-size: 15px; }

/* ---- 3D thumbnail ------------------------------------------------------ */
.biz-thumb {
  position: relative;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background:
    radial-gradient(120% 90% at 50% 18%, var(--bg-raised) 0%, var(--bg-sunken) 78%);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.biz-thumb__canvas, .biz-thumb__canvas > * { position: absolute; inset: 0; width: 100%; height: 100%; }
.biz-thumb__static { position: absolute; inset: 12%; width: 76%; height: 76%; }

/* ---- empty state ------------------------------------------------------- */
.biz-empty { display: grid; justify-items: center; text-align: center; gap: var(--s3); padding: var(--s12) var(--s5); }
.biz-empty__art { color: var(--clay-300); margin-bottom: var(--s2); }
.biz-empty__title { font-family: var(--font-display); font-size: var(--step-1); color: var(--text-strong); }
.biz-empty__body { font-size: var(--step--1); color: var(--text-muted); max-width: 40ch; margin: 0; }

/* ---- demo note: one per area, dismissible, quiet ----------------------- */
.biz-demo {
  display: inline-flex;
  align-items: center;
  gap: var(--s3);
  max-width: 100%;
  margin-top: var(--s2);
  padding: 4px 4px 4px var(--s4);
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  font-size: 12.5px;
  color: var(--text-muted);
}
.biz-demo__dot { flex: 0 0 auto; width: 6px; height: 6px; border-radius: 50%; background: var(--warn); }
.biz-demo__text { min-width: 0; }
.biz-demo__text strong { color: var(--text-strong); font-weight: 600; margin-inline-end: 6px; }
.biz-demo__close {
  flex: 0 0 auto;
  display: grid; place-items: center;
  width: 30px; height: 30px;
  border: 0; border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.biz-note { display: flex; gap: var(--s3); align-items: flex-start; margin: 0; padding: var(--s3) var(--s4); border-radius: var(--radius-lg); background: var(--bg-sunken); box-shadow: inset 0 0 0 1px var(--hairline); font-size: var(--step--1); color: var(--text-muted); }
.biz-note__mark { flex: 0 0 auto; margin-top: 0.45em; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }

@media (pointer: coarse) {
  .biz-input, .biz-seg button, .biz-btn, .biz-side__link { min-height: var(--tap); }
  .biz-btn--icon { width: var(--tap); }
  .biz-demo__close { width: 40px; height: 40px; }
}

@media (hover: hover) and (pointer: fine) {
  .biz-side__link:hover:not([aria-current='page']) { color: var(--text-strong); background: color-mix(in srgb, var(--bg-sunken) 70%, transparent); }
  .biz-side__store:hover { background: var(--bg-sunken); }
  .biz-rail__tab:hover { color: var(--text-strong); }
  .biz-table tbody tr:hover { background: color-mix(in srgb, var(--bg-sunken) 55%, transparent); }
  .biz-table__sortable:hover { color: var(--text-strong); }
  .biz-seg button:hover:not([aria-pressed='true']) { color: var(--text-strong); }
  .biz-demo__close:hover, .biz-search__clear:hover { background: var(--bg-hover); color: var(--text-strong); }
  .biz-input:hover:not(:focus-visible) { box-shadow: inset 0 0 0 1px var(--border-strong); }
  .biz-btn:hover:not(:disabled) { background: var(--bg-sunken); }
  .biz-btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--accent-ink) 88%, var(--text-strong)); }
}

@media (prefers-reduced-motion: reduce) {
  .biz-rail { backdrop-filter: none; background: var(--bg); }
  .biz-side__link, .biz-rail__tab, .biz-seg button, .biz-table tbody tr, .biz-panel--lift, .biz-btn { transition: none; }
  .biz-panel--lift:hover { transform: none; }
  .biz-spin { animation-duration: 2s; }
}
`

export function BusinessChromeStyles() {
  return (
    <style href="fs-biz-chrome" precedence="medium">
      {CSS}
    </style>
  )
}

/* ------------------------------------------------------------------- time */

/** The demo dashboard's frozen "now" — every relative time is measured here. */
export const DEMO_NOW = Date.UTC(2026, 8, 21, 8, 0, 0)

/** Same grouping-locale choice as `money.ts`. */
export function localeFor(lang: string): string {
  const short = lang.slice(0, 2)
  if (short === 'ru') return 'ru-RU'
  if (short === 'en') return 'en-US'
  return 'uz-UZ'
}

export function relativeTime(iso: string, lang: string): string {
  const hours = Math.round((new Date(iso).getTime() - DEMO_NOW) / 3_600_000)
  try {
    const rtf = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: 'auto' })
    if (Math.abs(hours) < 1) return rtf.format(0, 'hour')
    return Math.abs(hours) < 24 ? rtf.format(hours, 'hour') : rtf.format(Math.round(hours / 24), 'day')
  } catch {
    return iso.slice(0, 10)
  }
}

export function formatPercent(value: number, lang: string, digits = 1): string {
  try {
    return new Intl.NumberFormat(localeFor(lang), {
      style: 'percent',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value)
  } catch {
    return `${(value * 100).toFixed(digits)}%`
  }
}

export function formatDate(iso: string, lang: string, withTime = false): string {
  try {
    return new Intl.DateTimeFormat(localeFor(lang), {
      day: 'numeric',
      month: 'short',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      timeZone: 'Asia/Tashkent',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

/* ------------------------------------------------------------------ icons */

export type IconName =
  | 'overview'
  | 'products'
  | 'leads'
  | 'analytics'
  | 'branding'
  | 'team'
  | 'external'
  | 'search'
  | 'close'
  | 'plus'
  | 'check'
  | 'grid'
  | 'rows'
  | 'phone'
  | 'send'
  | 'upload'
  | 'cube'
  | 'alert'

const ICON_PATHS: Record<IconName, ReactNode> = {
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="2" />
      <rect x="13.5" y="11" width="7" height="9.5" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  products: (
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </>
  ),
  cube: (
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </>
  ),
  leads: (
    <>
      <path d="M3.5 13.5 6 5.5h12l2.5 8v5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-5Z" />
      <path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 19.5h16" />
      <path d="m5 15 4.5-5 3.5 3 6-7" />
      <circle cx="19" cy="6" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  branding: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.8 0-1.4-1.4-1.6-1.4-2.9 0-1 .8-1.8 1.8-1.8h2.1a3.5 3.5 0 0 0 3.5-3.5c0-3.9-3.6-7-8-7Z" />
      <circle cx="7.8" cy="11" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.6-3 2.9-4.8 5.5-4.8s4.9 1.8 5.5 4.8" />
      <path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.9c1.6.6 2.7 2.2 3 4.6" />
    </>
  ),
  external: <path d="M7 17 17 7M9 7h8v8" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  rows: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  phone: (
    <path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" />
  ),
  send: <path d="M20.5 3.5 3.5 10.5l7 3 3 7 7-17ZM10.5 13.5l4-4" />,
  upload: (
    <>
      <path d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5" />
      <circle cx="12" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
}

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

/* -------------------------------------------------------------------- nav */

const TABS = [
  { id: 'overview', to: '/business', end: true, icon: 'overview' },
  { id: 'products', to: '/business/products', end: false, icon: 'products' },
  { id: 'leads', to: '/business/orders-leads', end: false, icon: 'leads' },
  { id: 'analytics', to: '/business/analytics', end: false, icon: 'analytics' },
  { id: 'branding', to: '/business/branding', end: false, icon: 'branding' },
  { id: 'team', to: '/business/team', end: false, icon: 'team' },
] as const

export type BusinessTab = (typeof TABS)[number]['id']

const NEW_LEADS = LEADS.filter((lead) => lead.status === 'new').length

function tabCount(id: BusinessTab): { n: number; hot: boolean } | null {
  if (id === 'products') return { n: VENDOR_PRODUCTS.length, hot: false }
  if (id === 'leads') return NEW_LEADS ? { n: NEW_LEADS, hot: true } : null
  return null
}

/* ------------------------------------------------------------------ shell */

export function BusinessShell({
  title,
  lead,
  actions,
  children,
  badges,
}: {
  title: string
  lead?: string
  actions?: ReactNode
  badges?: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const { pathname } = useLocation()
  const [branding] = useSavedBranding()
  const rail = useRef<HTMLElement>(null)

  const current = TABS.find((tab) => (tab.end ? pathname === tab.to : pathname.startsWith(tab.to)))
  const quotaPct = BUSINESS.modelQuotaUsed / BUSINESS.modelQuotaTotal

  // Keep the active tab of the phone rail in view on arrival.
  useEffect(() => {
    const nav = rail.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return
    nav.scrollLeft = Math.max(0, active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2)
  }, [pathname])

  const rise = {
    initial: reduced ? false : ({ opacity: 0, y: 10 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.5, ease: EASE },
  }

  const ident = (
    <span className="biz-ident">
      <span
        className="biz-ident__mono"
        aria-hidden="true"
        style={{ borderRadius: branding.corner === 'sharp' ? 4 : 12 }}
      >
        {branding.monogram}
      </span>
      <span className="biz-ident__text">
        <span className="biz-ident__name">{branding.displayName}</span>
        <span className="biz-ident__sub">
          {BUSINESS.city} · {t(`business.plan.${BUSINESS.plan}`)}
        </span>
      </span>
    </span>
  )

  return (
    <div className="biz">
      <BusinessChromeStyles />

      <div className="fs-container biz__frame">
        <aside className="biz-side">
          {ident}

          <nav aria-label={t('business.nav.label')}>
            <p className="biz-side__label">{t('business.nav.workspace')}</p>
            <ul className="biz-side__nav">
              {TABS.map((tab) => {
                const count = tabCount(tab.id)
                return (
                  <li key={tab.id}>
                    <NavLink to={tab.to} end={tab.end} className="biz-side__link">
                      <Icon name={tab.icon} />
                      <span>{t(`business.nav.${tab.id}`)}</span>
                      {count && (
                        <span className={cn('biz-count', count.hot && 'biz-count--hot')}>
                          {count.n}
                          {count.hot && <span className="biz-sr"> {t('business.nav.newSuffix')}</span>}
                        </span>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="biz-side__card">
            <span className="biz-metric__key">{t('business.overview.quota.title')}</span>
            <div
              className="biz-meter"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={BUSINESS.modelQuotaTotal}
              aria-valuenow={BUSINESS.modelQuotaUsed}
              aria-label={t('business.overview.quota.title')}
            >
              <span style={{ transform: `scaleX(${quotaPct})` }} />
            </div>
            <span className="biz-metric__note">
              {t('business.overview.quota.used', {
                used: BUSINESS.modelQuotaUsed,
                total: BUSINESS.modelQuotaTotal,
              })}
            </span>
          </div>

          <Link className="biz-side__store" to={`/store/${BUSINESS.slug}`}>
            <span style={{ display: 'grid', gap: 2 }}>
              <span>{t('business.overview.actions.viewStore')}</span>
              <span className="biz-side__url">/store/{BUSINESS.slug}</span>
            </span>
            <Icon name="external" size={16} />
          </Link>
        </aside>

        <div className="biz__main">
          <div className="biz-mtop">
            {ident}
            <Link className="biz-mtop__store" to={`/store/${BUSINESS.slug}`}>
              {t('business.nav.store')}
              <Icon name="external" size={14} />
            </Link>
          </div>
          <div className="biz-rail">
            <nav ref={rail} className="biz-rail__nav" aria-label={t('business.nav.label')}>
              {TABS.map((tab) => {
                const count = tabCount(tab.id)
                return (
                  <NavLink key={tab.id} to={tab.to} end={tab.end} className="biz-rail__tab">
                    <Icon name={tab.icon} size={16} />
                    {t(`business.nav.${tab.id}`)}
                    {count?.hot && (
                      <span className="biz-count biz-count--hot">
                        {count.n}
                        <span className="biz-sr"> {t('business.nav.newSuffix')}</span>
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </nav>
          </div>

          <motion.header className="biz__head" {...rise}>
            <div className="biz__crumb">
              <span>{t('business.meta.title')}</span>
              <span aria-hidden="true">/</span>
              <b>{current ? t(`business.nav.${current.id}`) : title}</b>
            </div>
            <div className="biz__headRow">
              <div className="biz__headText">
                <h1 className="biz__title">{title}</h1>
                {lead && <p className="biz__lead">{lead}</p>}
              </div>
              {actions && <div className="biz__actions">{actions}</div>}
            </div>
            <div className="biz__badges">
              {badges}
              <DemoNote />
            </div>
          </motion.header>

          <motion.div
            className="biz__body"
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.55, ease: EASE, delay: reduced ? 0 : 0.06 }}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- demo note */

const DEMO_KEY = 'framespace.business.demoBanner.dismissed'

/**
 * Every number in this area is sample data. That is said once, quietly, in
 * the page head — not as a warning on every panel — and dismissing it is
 * remembered in this browser only.
 */
function DemoNote() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DEMO_KEY) === '1'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  return (
    <span className="biz-demo" role="note">
      <span className="biz-demo__dot" aria-hidden="true" />
      <span className="biz-demo__text">
        <strong>{t('business.demoBanner.title')}</strong>
        {t('business.demoBanner.body')}
      </span>
      <button
        type="button"
        className="biz-demo__close"
        aria-label={t('business.demoBanner.dismiss')}
        title={t('business.demoBanner.dismiss')}
        onClick={() => {
          setDismissed(true)
          try {
            window.localStorage.setItem(DEMO_KEY, '1')
          } catch {
            /* private mode: dismissed for this visit only */
          }
        }}
      >
        <Icon name="close" size={14} />
      </button>
    </span>
  )
}

/* -------------------------------------------------------- segmented scroll */

/**
 * Keeps the pressed option of a scrollable `.biz-seg` in view — on a 360px
 * screen the last option would otherwise sit off the edge with no hint it
 * exists. Scrolls the group only, never the page.
 */
export function useSegScroll<T extends HTMLElement = HTMLDivElement>(active: unknown) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const group = ref.current
    const pressed = group?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!group || !pressed || group.scrollWidth <= group.clientWidth) return
    const start = pressed.offsetLeft - group.offsetLeft
    const end = start + pressed.offsetWidth
    if (start < group.scrollLeft || end > group.scrollLeft + group.clientWidth) {
      group.scrollLeft = Math.max(0, start - (group.clientWidth - pressed.offsetWidth) / 2)
    }
  }, [active])
  return ref
}

/* ----------------------------------------------------------------- panels */

export function Panel({
  title,
  sub,
  aside,
  children,
  flush,
  lift,
  className,
  style,
  id,
}: {
  title?: ReactNode
  sub?: ReactNode
  aside?: ReactNode
  children: ReactNode
  /** Skip the inner padding — tables and toolbars bring their own. */
  flush?: boolean
  /** A hair of lift on hover — for tiles, never for forms. */
  lift?: boolean
  className?: string
  style?: CSSProperties
  id?: string
}) {
  const headingId = useId()
  return (
    <section
      id={id}
      className={cn('biz-panel', lift && 'biz-panel--lift', className)}
      style={style}
      aria-labelledby={title ? headingId : undefined}
    >
      <div className="biz-panel__core">
        {title && (
          <header className="biz-panel__head">
            <div className="biz-panel__titles">
              <h2 className="biz-panel__title" id={headingId}>
                {title}
              </h2>
              {sub && <p className="biz-panel__sub" style={{ margin: 0 }}>{sub}</p>}
            </div>
            {aside}
          </header>
        )}
        {flush ? children : <div className="biz-panel__pad">{children}</div>}
      </div>
    </section>
  )
}

/** Change against the previous period. Zero is neutral, not "up". */
export function Delta({ value }: { value: number }) {
  const { t } = useTranslation()
  const shown = Math.abs(value).toFixed(1)
  const flat = Number(shown) === 0
  const up = value > 0
  return (
    <span className={cn('biz-delta', !flat && (up ? 'biz-delta--up' : 'biz-delta--down'))}>
      <span aria-hidden="true">{flat ? '–' : up ? '↑' : '↓'}</span>
      {!flat && <span className="biz-sr">{up ? t('business.delta.up') : t('business.delta.down')} </span>}
      {shown}%
    </span>
  )
}

export type Tone = 'muted' | 'ok' | 'warn' | 'err' | 'accent'

export function Pill({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('biz-pill', tone !== 'muted' && `biz-pill--${tone}`)}>
      <span className="biz-pill__dot" aria-hidden="true" />
      {children}
    </span>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="biz-note" role="note">
      <span className="biz-note__mark" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="biz-empty" role="status">
      <svg className="biz-empty__art" width="72" height="48" viewBox="0 0 72 48" fill="none" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round">
          <path d="M14 34V18q0-4 4-4h36q4 0 4 4v16" />
          <path d="M14 27h44M22 14v13M50 14v13M18 34v5M54 34v5" />
        </g>
        <path d="M4 43h64" stroke="var(--hairline)" />
      </svg>
      <span className="biz-empty__title">{title}</span>
      {body && <p className="biz-empty__body">{body}</p>}
      {action}
    </div>
  )
}

/** Initials on a colour derived from the name — stable, never random. */
export function Avatar({ name, large }: { name: string; large?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const hues = ['--clay-300', '--sand-200', '--accent-soft', '--ink-500']
  const tint = hues[hash % hues.length]
  return (
    <span
      className={cn('biz-avatar', large && 'biz-avatar--lg')}
      aria-hidden="true"
      style={{ background: `color-mix(in srgb, var(${tint}) 38%, var(--bg-raised))` }}
    >
      {initials}
    </span>
  )
}

/** Inline save/validation state next to a form's buttons. */
export function SaveState({
  state,
  children,
}: {
  state: 'idle' | 'saving' | 'saved' | 'error' | 'dirty'
  children?: ReactNode
}) {
  return (
    <span
      className={cn('biz-save', state === 'saved' && 'biz-save--ok', state === 'error' && 'biz-save--err')}
      role="status"
      aria-live="polite"
    >
      {state === 'saving' && <span className="biz-spin" aria-hidden="true" />}
      {state === 'saved' && <Icon name="check" size={15} />}
      {state === 'error' && <Icon name="alert" size={15} />}
      {state === 'dirty' && <span className="biz-pill__dot" style={{ background: 'var(--warn)' }} aria-hidden="true" />}
      {children}
    </span>
  )
}

/* -------------------------------------------------------------- sparkline */

/**
 * A sparkline with a soft area under it. No axes, no legend — it exists to
 * show direction next to a number, and a grid of them has to stay cheap.
 * `animate` draws the stroke in once on first view (path length, never a
 * width/height tween); reduced motion gets the settled line.
 */
export function Sparkline({
  points,
  width = 120,
  height = 34,
  tone = 'muted',
  animate = false,
  area = true,
}: {
  points: number[]
  width?: number
  height?: number
  tone?: 'muted' | 'accent'
  animate?: boolean
  area?: boolean
}) {
  const reduced = useReducedMotion()
  const gradient = `biz-spark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const color = tone === 'accent' ? 'var(--accent)' : 'var(--clay-300)'

  const geo = useMemo(() => {
    if (points.length < 2) return null
    const min = Math.min(...points)
    const max = Math.max(...points)
    const span = max - min || 1
    const step = (width - 4) / (points.length - 1)
    const xy = points.map((value, i) => [2 + i * step, height - 3 - ((value - min) / span) * (height - 8)] as const)
    // Monotone-ish smoothing: cubic segments through midpoints.
    let d = `M${xy[0][0].toFixed(1)} ${xy[0][1].toFixed(1)}`
    for (let i = 1; i < xy.length; i += 1) {
      const [px, py] = xy[i - 1]
      const [x, y] = xy[i]
      const mx = (px + x) / 2
      d += ` C${mx.toFixed(1)} ${py.toFixed(1)} ${mx.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
    }
    const last = xy[xy.length - 1]
    return { d, fill: `${d} L${last[0].toFixed(1)} ${height} L2 ${height} Z`, last }
  }, [points, width, height])

  if (!geo) return null

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true">
      {area && (
        <>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={geo.fill} fill={`url(#${gradient})`} />
        </>
      )}
      {animate && !reduced ? (
        <motion.path
          d={geo.d}
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.4 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true, margin: '-10% 0px' }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      ) : (
        <path d={geo.d} stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      )}
      <circle cx={geo.last[0]} cy={geo.last[1]} r="2.6" fill="var(--accent)" />
      <circle cx={geo.last[0]} cy={geo.last[1]} r="5" fill="var(--accent)" opacity="0.15" />
    </svg>
  )
}

/* ------------------------------------------------------------ metric tile */

export function Metric({
  label,
  value,
  note,
  delta,
  trend,
  primary,
}: {
  label: ReactNode
  value: ReactNode
  note?: string
  delta?: number
  trend?: number[]
  primary?: boolean
}) {
  return (
    <div className={cn('biz-metric', primary && 'biz-metric--primary')}>
      <span className="biz-metric__key">{label}</span>
      <span className="biz-metric__value">{value}</span>
      <div className="biz-metric__foot">
        <span style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
          {typeof delta === 'number' && <Delta value={delta} />}
          {note && <span className="biz-metric__note">{note}</span>}
        </span>
        {trend && (
          <Sparkline
            points={trend}
            tone={primary ? 'accent' : 'muted'}
            width={primary ? 220 : 96}
            height={primary ? 56 : 32}
            animate
          />
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- 3D thumbnail */

const ProductViewer = lazy(() => import('@/three/ProductViewer'))

/** Weak GPU, few cores or Data Saver: the thumbnail stays a drawing. */
function prefersStatic(): boolean {
  if (typeof navigator === 'undefined') return true
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (connection?.saveData) return true
  return detectSceneTier() === 'low'
}

function ThumbStatic() {
  return (
    <svg className="biz-thumb__static" viewBox="0 0 200 150" fill="none" aria-hidden="true">
      <g stroke="var(--clay-300)" strokeWidth="2.5" strokeLinejoin="round">
        <path d="M44 108 L44 62 Q44 54 54 54 L146 54 Q156 54 156 62 L156 108" />
        <path d="M44 86 L156 86" />
        <path d="M54 108 L54 118 M146 108 L146 118" />
      </g>
    </svg>
  )
}

/**
 * A live, lazily-loaded 3D plate for a catalog product, sized by its parent.
 *
 * Canvases are expensive and browsers cap WebGL contexts at ~16 per page, so
 * this gate is deliberately tight: a canvas mounts just before it scrolls in
 * and unmounts a few hundred pixels after it leaves. `SceneCanvas` itself also
 * stops the frame loop the moment it is off screen.
 */
export function Thumb3D({
  product,
  spin = false,
  accent,
  offset = 0,
  className,
  style,
  label,
}: {
  product: Product | undefined
  spin?: boolean
  accent?: string
  offset?: number
  className?: string
  style?: CSSProperties
  label?: string
}) {
  const [armed] = useState(() => !prefersStatic())
  const palette = product ? (accent ? { ...product.palette, accent } : product.palette) : null

  return (
    <div className={cn('biz-thumb', className)} style={style}>
      {product && palette && armed ? (
        <ViewportGate
          className="biz-thumb__canvas"
          enterMargin="120px"
          exitMargin="360px"
          placeholder={<ThumbStatic />}
        >
          <Suspense fallback={<ThumbStatic />}>
            <ProductViewer
              model={product.model}
              palette={palette}
              spin={spin}
              spinSpeed={0.5}
              offset={offset}
              rootMargin="40px"
              style={{ width: '100%', height: '100%' }}
              label={label}
            />
          </Suspense>
        </ViewportGate>
      ) : (
        <ThumbStatic />
      )}
    </div>
  )
}
