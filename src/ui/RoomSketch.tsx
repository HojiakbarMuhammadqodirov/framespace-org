/**
 * Stroke-only blueprint room, the house illustration style from brief §2.
 * Drawn rather than photographed, so it costs nothing to ship and it reads as
 * a technical drawing instead of stock imagery.
 *
 * `dressed` turns the empty shell into a furnished room — the two states are
 * what the landing's before/after compares.
 */
export function RoomSketch({
  dressed = false,
  tone = 'var(--clay-300)',
  accent = 'var(--accent)',
  showDimension = true,
  label,
}: {
  dressed?: boolean
  tone?: string
  accent?: string
  showDimension?: boolean
  label?: string
}) {
  return (
    <svg
      viewBox="0 0 400 300"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ display: 'block' }}
    >
      <rect width="400" height="300" fill="var(--bg-sunken)" />

      {/* shell: back wall, side walls, floor line */}
      <g stroke={tone} strokeWidth="1.25" fill="none">
        <path d="M40 210 L40 70 L360 70 L360 210" />
        <path d="M40 210 L360 210" />
        <path d="M40 70 L8 46 M360 70 L392 46" opacity="0.5" />
        {/* window on the right wall, with light spilling from it */}
        <rect x="250" y="96" width="78" height="62" />
        <path d="M289 96 L289 158" />
        {/* door on the left */}
        <rect x="64" y="104" width="52" height="106" />
        <circle cx="106" cy="158" r="2.5" />
        {/* radiator under the window */}
        <path d="M252 168 h74 M252 176 h74" opacity="0.55" />
      </g>

      {/* daylight wedge */}
      <path
        d="M250 158 L328 158 L300 210 L196 210 Z"
        fill={accent}
        opacity={dressed ? 0.07 : 0.04}
      />

      {dressed && (
        <g stroke={tone} strokeWidth="1.25" fill="none">
          {/* rug */}
          <ellipse cx="205" cy="196" rx="96" ry="22" opacity="0.6" />
          {/* sofa against the back wall */}
          <rect x="140" y="150" width="120" height="26" rx="4" fill={accent} fillOpacity="0.18" />
          <rect x="140" y="140" width="120" height="12" rx="4" />
          <path d="M148 176 v10 M252 176 v10" />
          {/* coffee table */}
          <rect x="176" y="186" width="56" height="7" rx="2" />
          <path d="M184 193 v9 M224 193 v9" />
          {/* shelving left of the window */}
          <rect x="300" y="120" width="44" height="76" />
          <path d="M300 146 h44 M300 172 h44" />
          <rect x="308" y="126" width="12" height="16" fill={accent} fillOpacity="0.3" />
          {/* floor lamp */}
          <path d="M124 196 v-40" />
          <path d="M114 156 h20 l-4 -14 h-12 z" />
          {/* plant */}
          <path d="M276 196 v-16" />
          <path d="M276 180 c-10 -4 -12 -14 -2 -16 M276 180 c10 -4 12 -14 2 -16" />
          {/* framed print */}
          <rect x="150" y="96" width="34" height="26" />
        </g>
      )}

      {showDimension && (
        <g>
          <g stroke="var(--hairline)" strokeWidth="1">
            <path d="M40 236 L360 236" />
            <path d="M40 230 L40 242 M360 230 L360 242" />
          </g>
          <text
            x="200"
            y="256"
            textAnchor="middle"
            fill="var(--text-muted)"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em' }}
          >
            3.40 m
          </text>
        </g>
      )}
    </svg>
  )
}
