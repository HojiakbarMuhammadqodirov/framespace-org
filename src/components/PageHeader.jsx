import { BackIcon } from './Icons.jsx'

export default function PageHeader({ eyebrow, title, subtitle, onBack, right }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/85 px-5 pb-4 pt-[calc(env(safe-area-inset-top)+16px)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-start gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="mt-1 -ml-1 rounded-full p-2 text-muted transition-colors active:text-cream"
          >
            <BackIcon />
          </button>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
          <h1 className="display text-[26px] font-normal">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}
