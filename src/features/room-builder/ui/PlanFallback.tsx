import { useTranslation } from 'react-i18next'

import { FIXTURE_SIZE, buildWalls, footprint, wallPoint } from '../geometry'
import { metres } from '../format'
import { useBuilder } from '../store'

/**
 * What the viewport shows when the device has no WebGL.
 *
 * Not an apology box: the same plan, drawn as a stroke-only SVG from the same
 * model, so the dimension fields still do something useful.
 */
export function PlanFallback() {
  const { t } = useTranslation()
  const scene = useBuilder((s) => s.scene)
  const poly = footprint(scene.room)
  const walls = buildWalls(scene.room)

  const pad = 0.6
  const w = scene.room.width + pad * 2
  const d = scene.room.depth + pad * 2
  const path = poly.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x + pad} ${p.z + pad}`).join(' ') + ' Z'

  return (
    <div
      style={{
        display: 'grid',
        gap: 'var(--s5)',
        placeContent: 'center',
        placeItems: 'center',
        height: '100%',
        padding: 'var(--s6)',
        textAlign: 'center',
      }}
    >
      <svg
        viewBox={`0 0 ${w} ${d}`}
        width="100%"
        style={{ maxWidth: 420, maxHeight: '48%' }}
        fill="none"
        aria-hidden="true"
      >
        <path d={path} stroke="var(--clay-300)" strokeWidth={0.06} strokeLinejoin="round" />
        {scene.fixtures.map((fixture) => {
          const wall = walls.find((candidate) => candidate.id === fixture.wall)
          if (!wall) return null
          const size = FIXTURE_SIZE[fixture.kind]
          const a = wallPoint(wall, Math.max(0, fixture.t - size.w / 2))
          const b = wallPoint(wall, Math.min(wall.length, fixture.t + size.w / 2))
          return (
            <line
              key={fixture.id}
              x1={a.x + pad}
              y1={a.z + pad}
              x2={b.x + pad}
              y2={b.z + pad}
              stroke={fixture.kind === 'door' ? 'var(--accent)' : 'var(--clay-500)'}
              strokeWidth={0.1}
            />
          )
        })}
      </svg>

      <div style={{ display: 'grid', gap: 'var(--s3)', maxWidth: '44ch' }}>
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--step-2)',
            color: 'var(--text-strong)',
          }}
        >
          {t('builder.noWebgl.title')}
        </h3>
        <p className="rb-hint">{t('builder.noWebgl.body')}</p>
        <span className="rb-readout" style={{ justifyContent: 'center' }}>
          <span className="rb-readout__k">W</span>
          <span className="rb-readout__v">{metres(scene.room.width)} m</span>
          <span className="rb-readout__k">D</span>
          <span className="rb-readout__v">{metres(scene.room.depth)} m</span>
          <span className="rb-readout__k">H</span>
          <span className="rb-readout__v">{metres(scene.room.height)} m</span>
        </span>
      </div>
    </div>
  )
}
