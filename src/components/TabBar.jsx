import { HomeIcon, NewsIcon, ArchiveIcon, MailIcon, CameraIcon } from './Icons.jsx'

// Two flat tabs on each side, and the camera raised into a circle in the
// middle — it is the one thing the app exists to do, so it gets its own colour
// and its own shape.

const LEFT = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'news', label: 'News', Icon: NewsIcon },
]

const RIGHT = [
  { id: 'archive', label: 'Archive', Icon: ArchiveIcon },
  { id: 'contact', label: 'Contact', Icon: MailIcon },
]

function Tab({ tab, active, onSelect }) {
  const { id, label, Icon } = tab
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-current={active ? 'page' : undefined}
      className={`flex h-full flex-col items-center justify-center gap-[5px] transition-colors ${
        active ? 'text-cream' : 'text-muted'
      }`}
    >
      <Icon />
      <span className="text-[10.5px] font-medium tracking-wide">{label}</span>
      <span
        className={`h-[3px] w-4 rounded-full transition-all ${
          active ? 'bg-clay' : 'bg-transparent'
        }`}
      />
    </button>
  )
}

export default function TabBar({ active, onSelect, onCapture, captureActive }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink-2/95 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative mx-auto grid h-[78px] max-w-lg grid-cols-5">
        {LEFT.map((tab) => (
          <Tab key={tab.id} tab={tab} active={active === tab.id} onSelect={onSelect} />
        ))}

        {/* Column 3 stays empty — the circle floats above it. */}
        <div aria-hidden="true" />

        {RIGHT.map((tab) => (
          <Tab key={tab.id} tab={tab} active={active === tab.id} onSelect={onSelect} />
        ))}

        <button
          type="button"
          onClick={onCapture}
          aria-label="Scan a room"
          className={`absolute left-1/2 top-0 flex h-[68px] w-[68px] -translate-x-1/2 -translate-y-[26px] items-center justify-center rounded-full border-4 border-ink-2 text-white shadow-[0_10px_30px_-6px_rgba(200,102,60,0.75)] transition-transform active:scale-[0.94] ${
            captureActive ? 'bg-clay-soft' : 'bg-clay'
          }`}
        >
          <CameraIcon />
        </button>
      </div>
    </nav>
  )
}
