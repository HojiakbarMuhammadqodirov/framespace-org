import { createContext, useContext, type ReactNode } from 'react'
import * as THREE from 'three'

import type { GeoCache } from './geometry'
import type { FurnitureMats } from './materials'

/**
 * Procedural furniture, modelled to real proportions.
 *
 * Conventions: metres; origin on the floor at the footprint centre; the piece
 * faces +Z and its width runs along X. Every model takes its material set
 * (`m`) explicitly and pulls geometry from the scene's `GeoCache`, so three
 * scenes (hero room, product viewer, room builder) share one modelling
 * vocabulary without sharing GPU objects across WebGL contexts.
 */

export const FurnitureGeoContext = createContext<GeoCache | null>(null)

export function useGeo(): GeoCache {
  const geo = useContext(FurnitureGeoContext)
  if (!geo) throw new Error('furniture models must render inside <FurnitureGeoContext.Provider>')
  return geo
}

type V3 = [number, number, number]

interface MProps {
  g: THREE.BufferGeometry
  m: THREE.Material
  p?: V3
  r?: V3
  s?: V3 | number
  cast?: boolean
  recv?: boolean
}

/** One mesh. Furniture both casts and receives: self-shadowing is most of
 * what makes a cushion read as sitting on a seat rather than floating. */
export function M({ g, m, p, r, s, cast = true, recv = true }: MProps) {
  return (
    <mesh
      geometry={g}
      material={m}
      position={p}
      rotation={r}
      scale={s}
      castShadow={cast}
      receiveShadow={recv}
    />
  )
}

/* ----------------------------------------------------------------- legs */

interface LegsProps {
  m: THREE.Material
  /** Leg height (floor to underside of the body). */
  h: number
  /** Half-spacing of the leg centres. */
  x: number
  z: number
  rTop?: number
  rBottom?: number
  /** Outward splay, radians. */
  splay?: number
}

/** Four tapered, slightly splayed legs — mid-century, not table-saw. */
export function TaperedLegs({ m, h, x, z, rTop = 0.022, rBottom = 0.013, splay = 0.07 }: LegsProps) {
  const geo = useGeo()
  if (h <= 0.005) return null
  const g = geo.leg(rTop, rBottom, h)
  const off = Math.sin(splay) * (h / 2)
  return (
    <>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          // Pivot about the top joint: the foot kicks outward, the joint stays put.
          <M
            key={`${sx}:${sz}`}
            g={g}
            m={m}
            p={[sx * (x + off), h / 2, sz * (z + off)]}
            r={[-sz * splay, 0, sx * splay]}
          />
        )),
      )}
    </>
  )
}

/* ---------------------------------------------------------------- seating */

export interface SofaProps {
  m: FurnitureMats
  w?: number
  d?: number
  h?: number
  legH?: number
  /** Seat cushions across the width; auto when omitted. */
  seats?: number
  /** Throw pillows: 0, 1 or 2. */
  pillows?: number
  /** Slimmer arms, splayed legs: lounge-chair proportions. */
  lounge?: boolean
}

export function Sofa({ m, w = 2.2, d = 0.92, h = 0.82, legH = 0.14, seats, pillows = 2, lounge = false }: SofaProps) {
  const geo = useGeo()
  const n = seats ?? (w > 1.7 ? 3 : w > 1.15 ? 2 : 1)
  const armW = lounge ? Math.min(0.12, w * 0.15) : THREE.MathUtils.clamp(w * 0.08, 0.13, 0.2)
  const armTop = Math.min(h - 0.12, legH + 0.48)
  const backD = lounge ? 0.16 : 0.2
  const baseH = 0.19
  const seatH = 0.17
  const seatY = legH + baseH
  const seatTop = seatY + seatH
  const seatW = (w - armW * 2) / n
  const seatD = d - backD - 0.015
  const backCushH = Math.max(0.24, h - seatTop + 0.05)

  return (
    <group>
      <TaperedLegs
        m={m.wood}
        h={legH}
        x={w / 2 - 0.09}
        z={d / 2 - 0.09}
        rTop={lounge ? 0.024 : 0.026}
        rBottom={0.014}
        splay={lounge ? 0.12 : 0.05}
      />
      {/* Deck / frame */}
      <M g={geo.block(w - armW * 1.6, baseH, d - 0.02, 0.025)} m={m.upholstery} p={[0, legH + baseH / 2, 0.005]} />
      {/* Back frame */}
      <M
        g={geo.block(w, h - legH, backD, 0.05)}
        m={m.upholstery}
        p={[0, legH + (h - legH) / 2, -d / 2 + backD / 2]}
      />
      {/* Arms */}
      {[-1, 1].map((s) => (
        <M
          key={s}
          g={geo.block(armW, armTop - legH, d, Math.min(armW * 0.45, 0.07), 0.006)}
          m={m.upholstery}
          p={[s * (w / 2 - armW / 2), legH + (armTop - legH) / 2, 0]}
        />
      ))}
      {/* Seat cushions, a hair apart so the seams read. */}
      {Array.from({ length: n }, (_, i) => (
        <M
          key={`s${i}`}
          g={geo.block(seatW - 0.008, seatH, seatD, 0.055, 0.02)}
          m={m.cushion}
          p={[-w / 2 + armW + seatW * (i + 0.5), seatY + seatH / 2, d / 2 - seatD / 2 + 0.008]}
        />
      ))}
      {/* Back cushions, leaning back a few degrees. */}
      {Array.from({ length: n }, (_, i) => (
        <M
          key={`b${i}`}
          g={geo.block(seatW - 0.012, backCushH, 0.17, 0.07, 0.03, 'z')}
          m={m.cushion}
          p={[-w / 2 + armW + seatW * (i + 0.5), seatTop + backCushH / 2 - 0.02, -d / 2 + backD + 0.06]}
          r={[-0.13, 0, 0]}
        />
      ))}
      {pillows > 0 &&
        [-1, 1].slice(0, pillows === 1 ? 1 : 2).map((s, i) => (
          <M
            key={`p${s}`}
            g={geo.block(lounge ? 0.4 : 0.46, lounge ? 0.3 : 0.44, 0.13, 0.06, 0.035, 'z')}
            m={i === 0 ? m.accent : m.pillow}
            p={[
              pillows === 1 ? 0 : s * (w / 2 - armW - 0.28),
              seatTop + (lounge ? 0.16 : 0.21),
              -d / 2 + backD + 0.2,
            ]}
            r={[-0.28, pillows === 1 ? 0 : -s * 0.22, s * 0.05]}
          />
        ))}
    </group>
  )
}

export function Armchair({ m, w = 0.84, d = 0.84, h = 0.8 }: { m: FurnitureMats; w?: number; d?: number; h?: number }) {
  return <Sofa m={m} w={w} d={d} h={h} legH={0.2} seats={1} pillows={1} lounge />
}

export function DiningChair({ m, w = 0.46, d = 0.5, h = 0.88 }: { m: FurnitureMats; w?: number; d?: number; h?: number }) {
  const geo = useGeo()
  const seatY = 0.45
  const legH = seatY - 0.03
  const postH = h - seatY + 0.02
  return (
    <group>
      <TaperedLegs m={m.wood} h={legH} x={w / 2 - 0.045} z={d / 2 - 0.045} rTop={0.018} rBottom={0.012} splay={0.045} />
      {/* Stretchers */}
      {[-1, 1].map((s) => (
        <M
          key={s}
          g={geo.block(0.016, 0.016, d - 0.1, 0.006)}
          m={m.wood}
          p={[s * (w / 2 - 0.05), 0.16, 0]}
        />
      ))}
      <M g={geo.block(w, 0.03, d, 0.01)} m={m.wood} p={[0, seatY - 0.015, 0]} />
      <M g={geo.block(w - 0.03, 0.05, d - 0.05, 0.022, 0.012)} m={m.cushion} p={[0, seatY + 0.02, 0.01]} />
      {/* Back posts rake back; a curved top rail ties them together. */}
      {[-1, 1].map((s) => (
        <M
          key={`post${s}`}
          g={geo.leg(0.013, 0.016, postH)}
          m={m.wood}
          p={[s * (w / 2 - 0.045), seatY + postH / 2 - 0.01, -d / 2 + 0.045 - 0.03]}
          r={[-0.12, 0, 0]}
        />
      ))}
      <M
        g={geo.block(w - 0.03, 0.13, 0.022, 0.01, 0.006, 'z')}
        m={m.wood}
        p={[0, h - 0.085, -d / 2 + 0.014]}
        r={[-0.12, 0, 0]}
      />
    </group>
  )
}

/* ----------------------------------------------------------------- tables */

function Bowl({ m, p, r = 0.12 }: { m: THREE.Material; p: V3; r?: number }) {
  const geo = useGeo()
  const g = geo.lathe('bowl', [
    [0.0, 0.0],
    [0.45, 0.0],
    [0.7, 0.12],
    [0.92, 0.38],
    [1.0, 0.55],
    [0.96, 0.56],
    [0.86, 0.4],
    [0.62, 0.18],
    [0.0, 0.1],
  ])
  return <M g={g} m={m} p={p} s={[r, r, r]} />
}

function Vase({ m, p, h = 0.3, stems }: { m: THREE.Material; p: V3; h?: number; stems?: THREE.Material }) {
  const geo = useGeo()
  const g = geo.lathe('vase', [
    [0.0, 0.0],
    [0.3, 0.0],
    [0.42, 0.08],
    [0.5, 0.3],
    [0.46, 0.55],
    [0.26, 0.78],
    [0.2, 0.9],
    [0.24, 1.0],
    [0.2, 1.0],
    [0.15, 0.9],
    [0.0, 0.88],
  ])
  return (
    <group position={p}>
      <M g={g} m={m} s={[h * 0.42, h, h * 0.42]} />
      {stems && (
        <>
          {[-0.35, 0.1, 0.45].map((a, i) => (
            <group key={a} position={[0, h * 0.85, 0]} rotation={[a * 0.4, i, a]}>
              <M g={geo.leg(0.0025, 0.003, h * 1.1)} m={stems} p={[0, h * 0.55, 0]} cast={false} />
              <M g={geo.sphere(0.018)} m={stems} p={[0, h * 1.1, 0]} s={[1, 2.2, 1]} />
            </group>
          ))}
        </>
      )}
    </group>
  )
}

function BookStack({ m, p, r = 0.2 }: { m: FurnitureMats; p: V3; r?: number }) {
  const geo = useGeo()
  return (
    <group position={p} rotation={[0, r, 0]}>
      <M g={geo.block(0.3, 0.032, 0.22, 0.004)} m={m.carcass} p={[0, 0.016, 0]} />
      <M g={geo.block(0.27, 0.026, 0.2, 0.004)} m={m.pillow} p={[0.01, 0.045, 0]} r={[0, 0.12, 0]} />
      <M g={geo.block(0.24, 0.022, 0.17, 0.004)} m={m.accent} p={[-0.01, 0.069, 0]} r={[0, -0.08, 0]} />
    </group>
  )
}

export function CoffeeTable({
  m,
  w = 1.1,
  d = 0.6,
  h = 0.42,
  decor = true,
}: {
  m: FurnitureMats
  w?: number
  d?: number
  h?: number
  decor?: boolean
}) {
  const geo = useGeo()
  const topT = 0.045
  return (
    <group>
      <M g={geo.block(w, topT, d, 0.02)} m={m.wood} p={[0, h - topT / 2, 0]} />
      <M g={geo.block(w - 0.14, 0.022, d - 0.14, 0.006)} m={m.wood} p={[0, 0.13, 0]} />
      <TaperedLegs m={m.wood} h={h - topT} x={w / 2 - 0.08} z={d / 2 - 0.08} rTop={0.022} rBottom={0.015} splay={0.06} />
      {decor && (
        <>
          <Bowl m={m.ceramic} p={[w * 0.2, h, 0.02]} r={0.13} />
          <BookStack m={m} p={[-w * 0.22, h, 0.02]} />
          <Vase m={m.ceramic} p={[-w * 0.22 + 0.04, h + 0.09, 0.0]} h={0.16} />
        </>
      )}
    </group>
  )
}

export function DiningTable({
  m,
  w = 1.6,
  d = 0.9,
  h = 0.75,
  decor = true,
}: {
  m: FurnitureMats
  w?: number
  d?: number
  h?: number
  decor?: boolean
}) {
  const geo = useGeo()
  const topT = 0.04
  return (
    <group>
      <M g={geo.block(w, topT, d, 0.014)} m={m.wood} p={[0, h - topT / 2, 0]} />
      <M g={geo.block(w - 0.18, 0.08, d - 0.18, 0.006)} m={m.wood} p={[0, h - topT - 0.04, 0]} />
      <TaperedLegs m={m.wood} h={h - topT} x={w / 2 - 0.11} z={d / 2 - 0.11} rTop={0.03} rBottom={0.019} splay={0.04} />
      {decor && (
        <>
          <Vase m={m.ceramic} p={[w * 0.12, h, -0.04]} h={0.3} stems={m.leaf} />
          <Bowl m={m.ceramic} p={[-w * 0.16, h, 0.05]} r={0.15} />
          {/* Linen runner */}
          <M g={geo.block(w * 0.62, 0.004, 0.32, 0.002)} m={m.linen} p={[0, h + 0.002, 0]} cast={false} />
        </>
      )}
    </group>
  )
}

export function Desk({ m, w = 1.4, d = 0.7, h = 0.75 }: { m: FurnitureMats; w?: number; d?: number; h?: number }) {
  const geo = useGeo()
  const topT = 0.035
  const drawerW = Math.min(0.45, w * 0.32)
  return (
    <group>
      <M g={geo.block(w, topT, d, 0.012)} m={m.wood} p={[0, h - topT / 2, 0]} />
      <M g={geo.block(drawerW, 0.12, d - 0.06, 0.006)} m={m.carcass} p={[w / 2 - drawerW / 2 - 0.05, h - topT - 0.06, 0]} />
      <M g={geo.block(0.1, 0.012, 0.012, 0.004)} m={m.metal} p={[w / 2 - drawerW / 2 - 0.05, h - topT - 0.06, d / 2 - 0.022]} />
      <TaperedLegs m={m.wood} h={h - topT} x={w / 2 - 0.06} z={d / 2 - 0.06} rTop={0.022} rBottom={0.015} splay={0.035} />
      <BookStack m={m} p={[-w * 0.3, h, -d * 0.18]} r={-0.15} />
      <Vase m={m.ceramic} p={[w * 0.12, h, -d * 0.25]} h={0.18} stems={m.leaf} />
    </group>
  )
}

/* -------------------------------------------------------------------- bed */

export function Bed({ m, w = 1.6, d = 2.0, h = 0.55 }: { m: FurnitureMats; w?: number; d?: number; h?: number }) {
  const geo = useGeo()
  const hbD = 0.1
  // The headboard is part of the footprint, so the bed body is d - hbD long.
  const bd = d - hbD
  const bz = hbD / 2
  const bw = w - 0.06
  const baseTop = Math.max(0.26, h - 0.24)
  const mattH = 0.22
  const mattTop = baseTop + mattH
  const channels = Math.max(4, Math.round(w / 0.2))
  const chW = w / channels
  const hbTop = Math.max(1.05, h + 0.55)
  return (
    <group>
      {/* Recessed plinth makes the bed float. */}
      <M g={geo.block(bw - 0.16, 0.05, bd - 0.16, 0.004)} m={m.metal} p={[0, 0.025, bz]} cast={false} />
      <M g={geo.block(bw, baseTop - 0.05, bd, 0.035)} m={m.upholstery} p={[0, 0.05 + (baseTop - 0.05) / 2, bz]} />
      <M g={geo.block(bw - 0.06, mattH, bd - 0.06, 0.06, 0.012)} m={m.linen} p={[0, baseTop + mattH / 2, bz]} />
      {/* Duvet with a fold-back at the head. */}
      <M
        g={geo.block(bw - 0.02, 0.07, bd * 0.68, 0.035, 0.018)}
        m={m.linen}
        p={[0, mattTop + 0.025, d / 2 - (bd * 0.68) / 2 - 0.01]}
      />
      <M
        g={geo.block(bw - 0.01, 0.08, 0.2, 0.04, 0.01)}
        m={m.linen}
        p={[0, mattTop + 0.045, d / 2 - bd * 0.68 + 0.09]}
      />
      {/* Throw across the foot. */}
      <M g={geo.block(bw, 0.028, 0.46, 0.013, 0.004)} m={m.accent} p={[0, mattTop + 0.075, d / 2 - 0.3]} />
      {/* Sleeping pillows propped on the headboard, accent cushion in front. */}
      {[-1, 1].map((s) => (
        <M
          key={s}
          g={geo.block(Math.min(0.66, w * 0.42), 0.42, 0.15, 0.065, 0.045, 'z')}
          m={m.pillow}
          p={[s * w * 0.23, mattTop + 0.19, -d / 2 + hbD + 0.13]}
          r={[-0.32, 0, 0]}
        />
      ))}
      <M
        g={geo.block(0.42, 0.3, 0.12, 0.05, 0.035, 'z')}
        m={m.accent}
        p={[w * 0.08, mattTop + 0.15, -d / 2 + hbD + 0.32]}
        r={[-0.25, -0.12, 0.04]}
      />
      {/* Channel-tufted headboard. */}
      {Array.from({ length: channels }, (_, i) => (
        <M
          key={`c${i}`}
          g={geo.block(chW - 0.006, hbTop - 0.2, hbD, Math.min(0.045, chW * 0.45))}
          m={m.upholstery}
          p={[-w / 2 + chW * (i + 0.5), 0.2 + (hbTop - 0.2) / 2, -d / 2 + hbD / 2]}
        />
      ))}
      <M g={geo.block(w - 0.04, 0.2, hbD * 0.6, 0.01)} m={m.metal} p={[0, 0.1, -d / 2 + hbD / 2]} cast={false} />
    </group>
  )
}

/* ---------------------------------------------------------------- storage */

export function Wardrobe({ m, w = 1.8, d = 0.6, h = 2.1 }: { m: FurnitureMats; w?: number; d?: number; h?: number }) {
  const geo = useGeo()
  const plinth = 0.07
  const doors = Math.max(2, Math.round(w / 0.55))
  const dw = w / doors
  const bodyD = d - 0.05
  // Everything stays inside the footprint: the handles are the front plane.
  return (
    <group>
      <M g={geo.block(w - 0.06, plinth, bodyD - 0.06, 0.004)} m={m.metal} p={[0, plinth / 2, -0.05]} />
      <M g={geo.block(w, h - plinth, bodyD, 0.01)} m={m.carcass} p={[0, plinth + (h - plinth) / 2, -0.025]} />
      {Array.from({ length: doors }, (_, i) => (
        <M
          key={i}
          g={geo.block(dw - 0.006, h - plinth - 0.012, 0.022, 0.005)}
          m={m.carcass}
          p={[-w / 2 + dw * (i + 0.5), plinth + (h - plinth) / 2, d / 2 - 0.039]}
        />
      ))}
      {Array.from({ length: Math.floor(doors / 2) }, (_, i) => {
        const x = -w / 2 + dw * (i * 2 + 1)
        return [-1, 1].map((s) => (
          <M
            key={`${i}:${s}`}
            g={geo.leg(0.007, 0.007, 0.42)}
            m={m.metal}
            p={[x + s * 0.035, plinth + (h - plinth) * 0.5, d / 2 - 0.012]}
          />
        ))
      })}
    </group>
  )
}

export function Bookshelf({
  m,
  w = 0.9,
  d = 0.35,
  h = 1.8,
  decor = true,
}: {
  m: FurnitureMats
  w?: number
  d?: number
  h?: number
  decor?: boolean
}) {
  const geo = useGeo()
  const t = 0.025
  const levels = Math.max(3, Math.round(h / 0.38))
  const ys = Array.from({ length: levels + 1 }, (_, i) => 0.05 + ((h - 0.05 - t) * i) / levels)
  const inner = w - t * 2
  return (
    <group>
      {[-1, 1].map((s) => (
        <M key={s} g={geo.block(t, h, d, 0.004)} m={m.carcass} p={[s * (w / 2 - t / 2), h / 2, 0]} />
      ))}
      {ys.map((y) => (
        <M key={y} g={geo.block(inner, t, d - 0.01, 0.003)} m={m.carcass} p={[0, y + t / 2, 0]} />
      ))}
      <M g={geo.block(inner, h - 0.05, 0.01, 0.002)} m={m.carcass} p={[0, 0.05 + (h - 0.05) / 2, -d / 2 + 0.006]} cast={false} />
      {decor &&
        ys.slice(0, -1).map((y, i) => {
          const top = y + t
          if (i % 3 === 0)
            return (
              <M key={i} g={geo.books(inner * 0.62, i + 2)} m={m.books} p={[-inner * 0.17, top, 0.01]} />
            )
          if (i % 3 === 1)
            return (
              <group key={i}>
                <Vase m={m.ceramic} p={[inner * 0.22, top, 0]} h={0.22} />
                <M g={geo.books(inner * 0.36, i + 7)} m={m.books} p={[-inner * 0.26, top, 0.01]} />
              </group>
            )
          return (
            <group key={i}>
              <Bowl m={m.ceramic} p={[-inner * 0.2, top, 0]} r={0.09} />
              <M g={geo.block(0.16, 0.12, 0.16, 0.01)} m={m.accent} p={[inner * 0.24, top + 0.06, 0]} />
            </group>
          )
        })}
    </group>
  )
}

export function Sideboard({
  m,
  w = 1.4,
  d = 0.45,
  h = 0.72,
  legH = 0.14,
  decor = true,
}: {
  m: FurnitureMats
  w?: number
  d?: number
  h?: number
  legH?: number
  decor?: boolean
}) {
  const geo = useGeo()
  const bodyH = h - legH - 0.025
  return (
    <group>
      <TaperedLegs m={m.wood} h={legH} x={w / 2 - 0.08} z={d / 2 - 0.07} rTop={0.022} rBottom={0.014} splay={0.06} />
      <M g={geo.block(w, bodyH, d - 0.04, 0.012)} m={m.carcass} p={[0, legH + bodyH / 2, -0.02]} />
      <M g={geo.block(w, 0.025, d, 0.008)} m={m.wood} p={[0, h - 0.0125, 0]} />
      {/* Fluted doors: the light rakes across them. */}
      <M g={geo.flutes(w - 0.06, bodyH - 0.05, 0.015)} m={m.carcass} p={[0, legH + bodyH / 2, d / 2 - 0.04]} />
      {[-1, 1].map((s) => (
        <M key={s} g={geo.sphere(0.012)} m={m.metal} p={[s * 0.04, legH + bodyH * 0.55, d / 2 - 0.014]} />
      ))}
      {decor && (
        <>
          <TableLamp m={m} p={[-w * 0.3, h, -0.02]} />
          <Vase m={m.ceramic} p={[w * 0.28, h, 0]} h={0.26} stems={m.leaf} />
          <BookStack m={m} p={[w * 0.05, h, 0.02]} r={0.1} />
        </>
      )}
    </group>
  )
}

export function TableLamp({ m, p }: { m: FurnitureMats; p: V3 }) {
  const geo = useGeo()
  const base = geo.lathe('lampbase', [
    [0.0, 0.0],
    [0.55, 0.0],
    [0.9, 0.18],
    [1.0, 0.45],
    [0.8, 0.75],
    [0.25, 0.95],
    [0.18, 1.0],
    [0.0, 1.0],
  ])
  return (
    <group position={p}>
      <M g={base} m={m.ceramic} s={[0.09, 0.22, 0.09]} />
      <M g={geo.leg(0.006, 0.006, 0.12)} m={m.metal} p={[0, 0.28, 0]} />
      <M g={geo.cyl(0.1, 0.14, 0.17, true)} m={m.shade} p={[0, 0.38, 0]} />
    </group>
  )
}

/* -------------------------------------------------------------- soft goods */

export function Rug({ m, w = 2.4, d = 1.7, fringe = true }: { m: FurnitureMats; w?: number; d?: number; fringe?: boolean }) {
  const geo = useGeo()
  return (
    <group>
      <M g={geo.block(w, 0.012, d, 0.004)} m={m.rug} p={[0, 0.006, 0]} cast={false} />
      {fringe && <M g={geo.fringe(w, d)} m={m.linen} cast={false} />}
    </group>
  )
}

export function Curtain({
  m,
  w = 2.1,
  h = 2.42,
  panel = 0.42,
}: {
  m: FurnitureMats
  w?: number
  h?: number
  /** Width of each drawn-back panel as a fraction of the rod. */
  panel?: number
}) {
  const geo = useGeo()
  const panelW = w * panel
  const dropH = h - 0.08
  return (
    <group>
      <M g={geo.leg(0.014, 0.014, w + 0.2)} m={m.metal} p={[0, h, 0]} r={[0, 0, Math.PI / 2]} />
      {[-1, 1].map((s) => (
        <M key={s} g={geo.sphere(0.03)} m={m.metal} p={[s * (w / 2 + 0.11), h, 0]} />
      ))}
      {[-1, 1].map((s) => (
        <M key={`p${s}`} g={geo.curtain(panelW, dropH)} m={m.sheer} p={[s * (w / 2 - panelW / 2), h - 0.03 - dropH / 2, 0.04]} />
      ))}
    </group>
  )
}

/* --------------------------------------------------------------- lighting */

export function FloorLamp({
  m,
  h = 1.72,
  lit = true,
  intensity = 3,
}: {
  m: FurnitureMats
  h?: number
  lit?: boolean
  intensity?: number
}) {
  const geo = useGeo()
  const base = geo.lathe('lampfoot', [
    [0.0, 0.0],
    [1.0, 0.0],
    [1.0, 0.25],
    [0.85, 0.6],
    [0.12, 1.0],
    [0.0, 1.0],
  ])
  const shadeH = 0.32
  const shadeY = h - shadeH / 2
  return (
    <group>
      <M g={base} m={m.metal} s={[0.17, 0.05, 0.17]} />
      <M g={geo.leg(0.0105, 0.012, h - shadeH * 0.5 - 0.05)} m={m.metal} p={[0, 0.05 + (h - shadeH * 0.5 - 0.05) / 2, 0]} />
      <M g={geo.cyl(0.17, 0.21, shadeH, true)} m={m.shade} p={[0, shadeY, 0]} />
      <M g={geo.torus(0.21, 0.004)} m={m.metal} p={[0, shadeY - shadeH / 2, 0]} r={[Math.PI / 2, 0, 0]} cast={false} />
      <M g={geo.sphere(0.045)} m={m.glow} p={[0, shadeY - 0.04, 0]} cast={false} recv={false} />
      {lit && (
        <pointLight
          position={[0, shadeY - 0.06, 0]}
          color="#ffcf98"
          intensity={intensity}
          distance={4.8}
          decay={2}
        />
      )}
    </group>
  )
}

export function Pendant({
  m,
  y = 1.2,
  ceiling = 2.25,
  lit = true,
  intensity = 2.2,
}: {
  m: FurnitureMats
  y?: number
  ceiling?: number
  lit?: boolean
  intensity?: number
}) {
  const geo = useGeo()
  const dome = geo.lathe('dome', [
    [0.05, 1.0],
    [0.2, 0.98],
    [0.55, 0.82],
    [0.85, 0.5],
    [1.0, 0.04],
    [1.0, 0.0],
    [0.96, 0.0],
    [0.95, 0.04],
    [0.8, 0.48],
    [0.5, 0.78],
    [0.18, 0.94],
    [0.05, 0.95],
  ])
  const cord = ceiling - y - 0.2
  return (
    <group>
      <M g={geo.cyl(0.07, 0.07, 0.03)} m={m.metal} p={[0, ceiling - 0.015, 0]} cast={false} />
      <M g={geo.leg(0.004, 0.004, cord)} m={m.metal} p={[0, y + 0.2 + cord / 2, 0]} cast={false} />
      <M g={dome} m={m.metal} p={[0, y, 0]} s={[0.24, 0.2, 0.24]} />
      <M g={geo.sphere(0.05)} m={m.glow} p={[0, y + 0.04, 0]} cast={false} recv={false} />
      {lit && <pointLight position={[0, y - 0.02, 0]} color="#ffd3a0" intensity={intensity} distance={3.6} decay={2} />}
    </group>
  )
}

/* ------------------------------------------------------------------ plant */

export type PlantKind = 'fiddle' | 'palm' | 'bush'

export function Plant({
  m,
  h = 1.1,
  w = 0.55,
  kind = 'fiddle',
}: {
  m: FurnitureMats
  h?: number
  w?: number
  kind?: PlantKind
}) {
  const geo = useGeo()
  const potH = Math.min(0.42, h * 0.3)
  const potR = Math.min(w * 0.36, 0.22)
  const pot = geo.lathe('pot', [
    [0.0, 0.0],
    [0.72, 0.0],
    [0.8, 0.04],
    [0.92, 0.6],
    [1.0, 0.92],
    [1.04, 1.0],
    [0.96, 1.0],
    [0.9, 0.94],
    [0.0, 0.9],
  ])
  const crown = h - potH * 0.9
  return (
    <group>
      <M g={pot} m={m.ceramic} s={[potR, potH, potR]} />
      <M g={geo.cyl(potR * 0.88, potR * 0.88, 0.01)} m={m.soil} p={[0, potH * 0.9, 0]} cast={false} />
      {kind === 'fiddle' && (
        <M g={geo.leg(0.008, 0.014, crown * 0.75)} m={m.wood} p={[0, potH * 0.9 + crown * 0.375, 0]} />
      )}
      <M g={geo.foliage(kind)} m={m.leaf} p={[0, potH * 0.88, 0]} s={[crown * (w / 0.55) * 0.95, crown, crown * (w / 0.55) * 0.95]} />
    </group>
  )
}

/* ------------------------------------------------------------------- wall */

export function WallArt({ m, w = 0.8, h = 1.0 }: { m: FurnitureMats; w?: number; h?: number }) {
  const geo = useGeo()
  return (
    <group>
      <M g={geo.block(w, h, 0.03, 0.004)} m={m.wood} p={[0, 0, 0.015]} />
      <mesh geometry={geo.plane()} material={m.linen} position={[0, 0, 0.0305]} scale={[w - 0.04, h - 0.04, 1]} receiveShadow />
      <mesh geometry={geo.plane()} material={m.art} position={[0, 0, 0.031]} scale={[w - 0.16, h - 0.16, 1]} receiveShadow />
    </group>
  )
}

export function FlutedPanel({ m, w = 1.3, h = 1.0 }: { m: FurnitureMats; w?: number; h?: number }) {
  const geo = useGeo()
  return (
    <group>
      <M g={geo.block(w, h, 0.03, 0.004)} m={m.carcass} p={[0, 0, 0.015]} />
      <M g={geo.flutes(w - 0.02, h - 0.02, 0.018)} m={m.wood} p={[0, 0, 0.03]} />
    </group>
  )
}

/* -------------------------------------------------------------------- misc */

export function Divider({ m }: { m: FurnitureMats }) {
  const geo = useGeo()
  const leaves: Array<{ x: number; ry: number }> = [
    { x: -0.6, ry: 0.36 },
    { x: 0, ry: -0.2 },
    { x: 0.6, ry: 0.32 },
  ]
  const H = 1.8
  const W = 0.56
  return (
    <group>
      {leaves.map((leafPos) => (
        <group key={leafPos.x} position={[leafPos.x, 0, 0]} rotation={[0, leafPos.ry, 0]}>
          {[-1, 1].map((s) => (
            <M key={s} g={geo.block(0.035, H, 0.035, 0.008)} m={m.wood} p={[s * (W / 2 - 0.0175), H / 2 + 0.02, 0]} />
          ))}
          {[0.08, H - 0.02].map((y) => (
            <M key={y} g={geo.block(W, 0.035, 0.035, 0.008)} m={m.wood} p={[0, y, 0]} />
          ))}
          <mesh geometry={geo.plane()} material={m.sheer} position={[0, H / 2 + 0.04, 0]} scale={[W - 0.07, H - 0.13, 1]} castShadow />
          {Array.from({ length: 6 }, (_, i) => (
            <M key={`sl${i}`} g={geo.block(W - 0.07, 0.012, 0.012, 0.004)} m={m.wood} p={[0, 0.28 + i * 0.27, 0.012]} />
          ))}
        </group>
      ))}
    </group>
  )
}

export function PaintSet({ m }: { m: FurnitureMats }) {
  const geo = useGeo()
  const can = geo.lathe('can', [
    [0.0, 0.0],
    [0.96, 0.0],
    [1.0, 0.03],
    [1.0, 0.95],
    [0.96, 1.0],
    [0.0, 1.0],
  ])
  const cans: Array<{ x: number; z: number; label: keyof FurnitureMats; s: number }> = [
    { x: -0.24, z: 0.08, label: 'upholstery', s: 1 },
    { x: 0.03, z: -0.1, label: 'accent', s: 1.15 },
    { x: 0.27, z: 0.1, label: 'cushion', s: 0.85 },
  ]
  return (
    <group>
      <M g={geo.block(0.96, 0.05, 0.6, 0.008)} m={m.wood} p={[0, 0.025, 0]} />
      {cans.map((c) => (
        <group key={c.x} position={[c.x, 0.05, c.z]} scale={c.s}>
          <M g={can} m={m.metal} s={[0.1, 0.24, 0.1]} />
          <M g={geo.cyl(0.1015, 0.1015, 0.13)} m={m[c.label]} p={[0, 0.115, 0]} />
          <M g={geo.torus(0.07, 0.004, Math.PI)} m={m.metal} p={[0, 0.24, 0]} r={[0, 0, 0]} />
        </group>
      ))}
      <group position={[0.36, 0.08, 0.22]} rotation={[0, 0.5, Math.PI / 2 - 0.15]}>
        <M g={geo.leg(0.008, 0.01, 0.2)} m={m.wood} />
        <M g={geo.block(0.05, 0.06, 0.014, 0.005)} m={m.linen} p={[0, -0.13, 0]} />
      </group>
    </group>
  )
}

/** A soft studio pedestal: rounded plinth some catalog plates stand on. */
export function Plinth({ m, w, d, children }: { m: THREE.Material; w: number; d: number; children?: ReactNode }) {
  const geo = useGeo()
  return (
    <group>
      <M g={geo.block(w, 0.04, d, 0.02)} m={m} p={[0, 0.02, 0]} />
      <group position={[0, 0.04, 0]}>{children}</group>
    </group>
  )
}
