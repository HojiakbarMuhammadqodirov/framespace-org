// Line icons, drawn on a 24px grid at 1.6 stroke so they read at 22px on a
// phone without turning into mush.

const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function HomeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 10.2 12 3.6l8.5 6.6V20a1 1 0 0 1-1 1h-4.6v-6H9.1v6H4.5a1 1 0 0 1-1-1z" />
    </svg>
  )
}

export function NewsIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5h11a1 1 0 0 1 1 1v13H5a1 1 0 0 1-1-1z" />
      <path d="M16 9h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3" />
      <path d="M7 8.5h5M7 12h5M7 15.5h3" />
    </svg>
  )
}

export function ArchiveIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 6.5h17v3h-17z" />
      <path d="M5 9.5v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
      <path d="M10 13h4" />
    </svg>
  )
}

export function MailIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.8 7 7.5 5.6a1.2 1.2 0 0 0 1.4 0L20.2 7" />
    </svg>
  )
}

export function CameraIcon(props) {
  return (
    <svg {...base} width={26} height={26} strokeWidth={1.7} {...props}>
      <path d="M4 8h3.2l1.4-2.2h6.8L16.8 8H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.4" r="3.6" />
    </svg>
  )
}

export function CubeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="m12 3 8 4.4v9.2L12 21l-8-4.4V7.4z" />
      <path d="m4 7.4 8 4.4 8-4.4M12 11.8V21" />
    </svg>
  )
}

export function CheckIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="m5 12.5 4.6 4.5L19 7.5" />
    </svg>
  )
}

export function ChevronIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="m9 5.5 7 6.5-7 6.5" />
    </svg>
  )
}

export function BackIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M19 12H5.5M11 5.5 4.5 12l6.5 6.5" />
    </svg>
  )
}

export function RetryIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4.5h-4.5" />
    </svg>
  )
}

export function TrashIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 7h15M9.5 7V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
      <path d="M6.5 7v11.8a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V7" />
      <path d="M10.5 11v5M13.5 11v5" />
    </svg>
  )
}
