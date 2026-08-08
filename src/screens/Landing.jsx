import { CameraIcon, CubeIcon, ChevronIcon } from '../components/Icons.jsx'
import { STYLES } from '../lib/styles.js'

const STEPS = [
  {
    n: '01',
    title: 'Photograph every side',
    body: 'The app walks you round the room — front wall, right, back, left, then the window and the floor. Four sides minimum, because one photo cannot tell where the light comes from.',
  },
  {
    n: '02',
    title: 'Choose a look, set a ceiling',
    body: 'Pick a style. Add a furniture budget if you have one, and every piece proposed will be priced at the average of its normal retail range, totalling under your number.',
  },
  {
    n: '03',
    title: 'See it, then walk it',
    body: 'Four renders come back — your room, your windows, your light, restyled. Open the 3D view to look around it.',
  },
]

export default function Landing({ health, onStart, onOpenNews }) {
  return (
    <div className="screen">
      <section className="relative overflow-hidden px-5 pb-10 pt-[calc(env(safe-area-inset-top)+40px)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-16 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #c8663c 0%, transparent 68%)' }}
        />
        <div className="relative mx-auto max-w-lg">
          <p className="eyebrow rise">FrameSpace</p>
          <h1 className="display rise mt-4 text-[42px] font-normal">
            Your room,
            <br />
            <span className="italic text-clay-soft">as it could be.</span>
          </h1>
          <p className="rise mt-5 max-w-[34ch] text-[15px] leading-relaxed text-muted">
            Photograph the room you already have. Choose a style and, if you want, a budget. Get it
            back redesigned — same walls, same windows, same daylight, everything else new.
          </p>

          <button type="button" onClick={onStart} className="btn btn-primary rise mt-7 w-full">
            <CameraIcon width={20} height={20} />
            Scan my room
          </button>

          {health && health.demoMode && (
            <p className="mt-3 rounded-xl border border-line bg-ink-2 px-4 py-3 text-[12.5px] leading-relaxed text-muted">
              <span className="font-semibold text-cream">Demo mode.</span> No API keys are set, so
              renders come back as illustrated placeholders. Everything else is live — add your keys
              to <span className="font-mono text-[11.5px] text-cream">.env</span> for real ones.
            </p>
          )}
        </div>
      </section>

      <section className="px-5 pb-10">
        <div className="mx-auto max-w-lg">
          <h2 className="eyebrow mb-4">How it works</h2>
          <ol className="space-y-3">
            {STEPS.map((step) => (
              <li key={step.n} className="card p-5">
                <div className="flex gap-4">
                  <span className="display mt-0.5 text-[20px] text-clay">{step.n}</span>
                  <div>
                    <h3 className="text-[15.5px] font-semibold">{step.title}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{step.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pb-10">
        <div className="mx-auto max-w-lg px-5">
          <h2 className="eyebrow mb-4">Styles you can pick from</h2>
        </div>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
          {STYLES.map((style) => (
            <div key={style.name} className="card w-[168px] shrink-0 overflow-hidden">
              <div className="flex h-20">
                {style.swatch.map((hex) => (
                  <div key={hex} className="flex-1" style={{ background: hex }} />
                ))}
              </div>
              <div className="p-3.5">
                <p className="text-[13.5px] font-semibold">{style.name}</p>
                <p className="mt-1 text-[11.5px] leading-snug text-muted">{style.blurb}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-4">
        <div className="mx-auto max-w-lg space-y-3">
          <div className="card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-3 text-sage">
              <CubeIcon />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold">A 360° view of the result</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                Your renders are stitched into a sphere you can look around by dragging — or by
                turning your phone.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenNews}
            className="card flex w-full items-center gap-4 p-5 text-left transition-transform active:scale-[0.99]"
          >
            <div className="min-w-0 flex-1">
              <p className="eyebrow mb-1">News</p>
              <p className="text-[14.5px] font-semibold">What rooms are doing this season</p>
            </div>
            <ChevronIcon className="shrink-0 text-muted" />
          </button>
        </div>
      </section>
    </div>
  )
}
