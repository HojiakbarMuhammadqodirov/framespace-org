import { useEffect, useState } from 'react'

// The render takes 30–90 seconds. Rather than a spinner, walk through what is
// actually happening so the wait reads as work rather than as a hang.

const STAGES = [
  { at: 0, label: 'Reading your photos', detail: 'Cross-referencing the walls to work out the layout.' },
  { at: 8, label: 'Measuring the room', detail: 'Estimating dimensions from door heights and sockets.' },
  { at: 18, label: 'Designing', detail: 'Palette, materials, lighting, and where each piece goes.' },
  { at: 30, label: 'Costing the furniture', detail: 'Average market prices, kept under your ceiling.' },
  { at: 44, label: 'Rendering your room', detail: 'Painting each angle you photographed.' },
  { at: 75, label: 'Nearly there', detail: 'Bigger rooms take a little longer.' },
]

export default function Rendering({ style, demoMode }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const active = STAGES.reduce((current, stage) => (seconds >= stage.at ? stage : current), STAGES[0])

  return (
    <div className="screen flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-10 h-24 w-24">
        <div className="absolute inset-0 animate-ping rounded-full bg-clay/20" />
        <div className="absolute inset-3 rounded-full border border-clay/40" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="display text-[22px] text-clay-soft">{seconds}s</span>
        </div>
      </div>

      <p className="eyebrow">{demoMode ? 'Demo render' : `Redesigning in ${style}`}</p>
      <h1 className="display mt-3 text-[28px]">{active.label}</h1>
      <p className="mt-3 max-w-[30ch] text-[13.5px] leading-relaxed text-muted">{active.detail}</p>

      <div className="mt-10 w-full max-w-xs space-y-2.5">
        {STAGES.slice(0, 5).map((stage) => {
          const done = seconds > (STAGES[STAGES.indexOf(stage) + 1]?.at ?? Infinity)
          const current = stage === active
          return (
            <div key={stage.label} className="flex items-center gap-3 text-left">
              <span
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  done ? 'bg-sage' : current ? 'bg-clay' : 'bg-line'
                }`}
              />
            </div>
          )
        })}
      </div>

      <p className="mt-8 text-[12px] text-muted">Keep this screen open — it usually takes under a minute.</p>
    </div>
  )
}
