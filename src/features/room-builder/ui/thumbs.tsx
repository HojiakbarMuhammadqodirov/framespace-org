import type { ReactNode } from 'react'

import type { PieceKind } from '../catalog'

/**
 * Catalogue thumbnails: small three-quarter drawings of each piece in its
 * default finish. Flat fills with one shade and one highlight per surface —
 * enough form to recognise a sofa from a sideboard at 120px, no assets to load.
 */

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `rgb(${r}, ${g}, ${b})`
}

const DARK = '#3a2a20'

export function PieceThumb({ kind, color }: { kind: PieceKind; color: string }) {
  const base = color
  const top = shade(color, 0.22)
  const side = shade(color, -0.22)
  const deep = shade(color, -0.4)

  const shadow = <ellipse cx="50" cy="56" rx="38" ry="4" fill="rgba(42,29,22,0.14)" />

  let body: ReactNode
  switch (kind) {
    case 'sofa':
      body = (
        <>
          {shadow}
          <rect x="16" y="50" width="3" height="6" fill={DARK} />
          <rect x="81" y="50" width="3" height="6" fill={DARK} />
          <rect x="14" y="22" width="72" height="18" rx="6" fill={side} />
          <rect x="12" y="36" width="76" height="15" rx="4" fill={base} />
          <rect x="22" y="33" width="27" height="9" rx="3.5" fill={top} />
          <rect x="51" y="33" width="27" height="9" rx="3.5" fill={top} />
          <rect x="8" y="30" width="10" height="21" rx="4" fill={deep} />
          <rect x="82" y="30" width="10" height="21" rx="4" fill={deep} />
        </>
      )
      break
    case 'armchair':
      body = (
        <>
          <ellipse cx="50" cy="56" rx="24" ry="3.5" fill="rgba(42,29,22,0.14)" />
          <rect x="33" y="49" width="3" height="7" fill={DARK} />
          <rect x="64" y="49" width="3" height="7" fill={DARK} />
          <rect x="32" y="14" width="36" height="26" rx="8" fill={side} />
          <rect x="30" y="36" width="40" height="14" rx="4" fill={base} />
          <rect x="37" y="32" width="26" height="9" rx="3.5" fill={top} />
          <rect x="26" y="28" width="9" height="22" rx="4" fill={deep} />
          <rect x="65" y="28" width="9" height="22" rx="4" fill={deep} />
        </>
      )
      break
    case 'chair':
      body = (
        <>
          <ellipse cx="50" cy="57" rx="16" ry="3" fill="rgba(42,29,22,0.14)" />
          <rect x="38" y="10" width="24" height="22" rx="3" fill={side} />
          <rect x="40" y="13" width="20" height="3" rx="1.5" fill={top} />
          <rect x="39" y="38" width="2.6" height="19" fill={deep} />
          <rect x="58.4" y="38" width="2.6" height="19" fill={deep} />
          <path d="M35 35h30l-3 6H38z" fill={base} />
          <rect x="35" y="33" width="30" height="3" rx="1.5" fill={top} />
        </>
      )
      break
    case 'lowTable':
      body = (
        <>
          {shadow}
          <rect x="20" y="40" width="3" height="16" fill={deep} />
          <rect x="77" y="40" width="3" height="16" fill={deep} />
          <rect x="28" y="40" width="2.6" height="12" fill={side} />
          <rect x="70" y="40" width="2.6" height="12" fill={side} />
          <path d="M24 32h52l8 6H16z" fill={top} />
          <rect x="16" y="38" width="68" height="4" rx="1" fill={base} />
        </>
      )
      break
    case 'diningTable':
      body = (
        <>
          {shadow}
          <rect x="17" y="27" width="3" height="29" fill={deep} />
          <rect x="80" y="27" width="3" height="29" fill={deep} />
          <rect x="27" y="27" width="2.6" height="24" fill={side} />
          <rect x="71" y="27" width="2.6" height="24" fill={side} />
          <path d="M22 18h56l9 6H13z" fill={top} />
          <rect x="13" y="24" width="74" height="4" rx="1" fill={base} />
        </>
      )
      break
    case 'desk':
      body = (
        <>
          {shadow}
          <rect x="18" y="26" width="3" height="30" fill={DARK} />
          <rect x="79" y="26" width="3" height="30" fill={DARK} />
          <path d="M22 18h56l7 5H15z" fill={top} />
          <rect x="15" y="23" width="70" height="4" rx="1" fill={base} />
          <rect x="56" y="27" width="22" height="10" rx="1.5" fill={side} />
          <rect x="64" y="31" width="6" height="1.6" rx="0.8" fill={top} />
          <rect x="30" y="8" width="18" height="11" rx="1.2" fill={DARK} />
          <rect x="38" y="18" width="2" height="2" fill={DARK} />
        </>
      )
      break
    case 'bed':
      body = (
        <>
          <ellipse cx="50" cy="56" rx="42" ry="4" fill="rgba(42,29,22,0.14)" />
          <rect x="12" y="10" width="76" height="26" rx="4" fill={deep} />
          <path d="M14 30h72l8 18H6z" fill="#f4efe7" />
          <path d="M10 38h80l4 10H6z" fill={base} />
          <rect x="6" y="48" width="88" height="6" rx="2" fill={side} />
          <rect x="20" y="25" width="26" height="8" rx="3.5" fill="#fbf8f3" />
          <rect x="54" y="25" width="26" height="8" rx="3.5" fill="#fbf8f3" />
        </>
      )
      break
    case 'wardrobe':
      body = (
        <>
          <ellipse cx="50" cy="57" rx="28" ry="3" fill="rgba(42,29,22,0.14)" />
          <rect x="25" y="4" width="50" height="52" rx="2" fill={base} />
          <rect x="25" y="4" width="50" height="3" fill={top} />
          <rect x="49.4" y="7" width="1.2" height="49" fill={side} />
          <rect x="45" y="26" width="1.6" height="9" rx="0.8" fill={DARK} />
          <rect x="53.4" y="26" width="1.6" height="9" rx="0.8" fill={DARK} />
          <rect x="72" y="4" width="3" height="52" fill={side} />
        </>
      )
      break
    case 'shelf':
      body = (
        <>
          <ellipse cx="50" cy="57" rx="26" ry="3" fill="rgba(42,29,22,0.14)" />
          <rect x="27" y="4" width="3" height="52" fill={side} />
          <rect x="70" y="4" width="3" height="52" fill={side} />
          {[4, 17, 30, 43, 53].map((y) => (
            <rect key={y} x="27" y={y} width="46" height="3" fill={base} />
          ))}
          <rect x="33" y="8" width="4" height="9" fill="#a85a3c" />
          <rect x="38" y="9" width="3" height="8" fill="#6e7f63" />
          <rect x="42" y="8" width="4" height="9" fill="#d9c7a8" />
          <rect x="56" y="22" width="9" height="8" rx="4" fill="#c9a87c" />
          <rect x="34" y="35" width="3" height="8" fill="#3f5147" />
          <rect x="38" y="34" width="4" height="9" fill="#c6552f" />
          <rect x="58" y="46" width="10" height="7" rx="1" fill="#e4d9cb" />
        </>
      )
      break
    case 'sideboard':
      body = (
        <>
          {shadow}
          <rect x="18" y="48" width="3" height="8" fill={DARK} />
          <rect x="79" y="48" width="3" height="8" fill={DARK} />
          <rect x="14" y="24" width="72" height="25" rx="2" fill={base} />
          <rect x="14" y="24" width="72" height="3" fill={top} />
          <rect x="37.6" y="27" width="1" height="22" fill={side} />
          <rect x="61.6" y="27" width="1" height="22" fill={side} />
          {[26, 50, 74].map((x) => (
            <rect key={x} x={x - 3} y="36" width="6" height="1.6" rx="0.8" fill={DARK} />
          ))}
          <rect x="62" y="12" width="9" height="12" rx="4" fill="#efe8dd" />
        </>
      )
      break
    case 'rug':
      body = (
        <>
          <path d="M22 22h56l16 26H6z" fill={base} />
          <path d="M27 26h46l11 18H16z" fill="none" stroke={top} strokeWidth="1.6" />
          <path d="M50 29l8 6-8 6-8-6z" fill={deep} />
          <path d="M6 48h88v2.5H6z" fill={side} />
        </>
      )
      break
    case 'floorLamp':
      body = (
        <>
          <ellipse cx="50" cy="57" rx="12" ry="2.5" fill="rgba(42,29,22,0.16)" />
          <ellipse cx="50" cy="55" rx="9" ry="2.5" fill={DARK} />
          <rect x="49" y="18" width="2" height="37" fill={DARK} />
          <path d="M38 22l5-16h14l5 16z" fill={top} />
          <path d="M38 22h24" stroke={side} strokeWidth="1.4" />
          <ellipse cx="50" cy="24" rx="16" ry="4" fill="rgba(255,214,150,0.35)" />
        </>
      )
      break
    case 'plant':
      body = (
        <>
          <ellipse cx="50" cy="57" rx="14" ry="2.5" fill="rgba(42,29,22,0.16)" />
          <path d="M50 36c-12-6-18-18-14-28 6 4 12 14 14 28z" fill="#6e7f63" />
          <path d="M50 36c12-6 18-18 14-28-6 4-12 14-14 28z" fill="#5d6d53" />
          <path d="M50 36c-4-10-2-24 0-30 2 6 4 20 0 30z" fill="#7d9070" />
          <path d="M50 38c-14-2-22-8-24-14 8 0 18 6 24 14z" fill="#5d6d53" />
          <path d="M50 38c14-2 22-8 24-14-8 0-18 6-24 14z" fill="#6e7f63" />
          <path d="M40 38h20l-3 18H43z" fill={base} />
          <rect x="39" y="36" width="22" height="4" rx="1.5" fill={top} />
        </>
      )
      break
    default:
      body = (
        <>
          {shadow}
          <rect x="25" y="20" width="50" height="34" rx="3" fill={base} />
        </>
      )
  }

  return (
    <svg viewBox="0 0 100 62" fill="none" aria-hidden="true" focusable="false">
      {body}
    </svg>
  )
}
