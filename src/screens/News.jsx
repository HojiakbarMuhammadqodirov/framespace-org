import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { ChevronIcon } from '../components/Icons.jsx'

// Editorial content written for the app. Swap this array for a CMS or an RSS
// feed later — the screen only cares about the shape.

const POSTS = [
  {
    id: 'quiet-materials',
    tag: 'Trend',
    date: 'This month',
    title: 'Quiet materials are doing the loud work',
    excerpt:
      'Limewash, unlacquered brass, raw plaster — finishes that change as light moves across them.',
    body: 'The shift away from flat, uniform surfaces is the clearest thing happening in interiors right now. A limewashed wall reads differently at 8am and 6pm; unlacquered brass takes fingerprints and keeps them. The appeal is not the material itself but the fact that it records time. If you are working to a budget, this is the cheapest lever you have: one wall in limewash costs less than a chair and changes a room more.',
    swatch: ['#EFE9E1', '#CFC3B4', '#8C7B6B'],
  },
  {
    id: 'one-good-light',
    tag: 'How to',
    date: 'This month',
    title: 'One good light beats four adequate ones',
    excerpt: 'Most rooms are over-lit from the ceiling and under-lit everywhere it matters.',
    body: 'A single central pendant flattens a room — everything gets the same amount of light from the same angle, which is why so many rooms photograph better than they feel. Layering fixes it: one pendant on a dimmer, one floor lamp at reading height beside the chair you actually sit in, and one low light near the floor. Keep every bulb at the same colour temperature, around 2700K. Mixed temperatures are the single most common reason a well-furnished room still feels wrong.',
    swatch: ['#F3E7D6', '#D9A05B', '#3A2C22'],
  },
  {
    id: 'buy-last',
    tag: 'Budget',
    date: 'Last month',
    title: 'Buy the rug last',
    excerpt: 'The order you buy in decides how much you waste.',
    body: 'Start with the piece that anchors the room and is hardest to replace — usually seating. Then storage, because it decides how much of the floor stays clear. Lighting third. The rug goes last, once you know where everything sits, because a rug bought early is almost always the wrong size. As a rule the front legs of the seating should sit on it; a rug that floats in the middle of the floor makes a room look smaller than bare boards would.',
    swatch: ['#F4F1EA', '#CFDCE0', '#7E9AA6'],
  },
  {
    id: 'small-rooms',
    tag: 'Guide',
    date: 'Last month',
    title: 'Small rooms do not want small furniture',
    excerpt: 'Six small things read as clutter. Two large ones read as intent.',
    body: 'The instinct in a small room is to scale everything down, and it backfires: more objects mean more edges, and edges are what make a space feel busy. One properly sized sofa and one full-height shelving unit will make a 12m² room feel larger than a two-seater, two side tables, a console and a nest of stools. The constraint that matters is circulation — leave 60cm to walk through and 45cm between seating and the coffee table, and let the furniture be as big as what is left allows.',
    swatch: ['#F6F5F3', '#E0DEDA', '#33312E'],
  },
]

function Post({ post }) {
  const [open, setOpen] = useState(false)
  return (
    <article className="card overflow-hidden">
      <div className="flex h-1.5">
        {post.swatch.map((hex) => (
          <div key={hex} className="flex-1" style={{ background: hex }} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full p-5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-ink-3 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-clay-soft">
            {post.tag}
          </span>
          <span className="text-[11.5px] text-muted">{post.date}</span>
        </div>
        <h2 className="display mt-3 text-[20px] leading-tight">{post.title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{post.excerpt}</p>

        {open && <p className="mt-4 text-[13.5px] leading-relaxed">{post.body}</p>}

        <span className="mt-4 flex items-center gap-1 text-[12.5px] font-semibold text-clay-soft">
          {open ? 'Show less' : 'Read'}
          <ChevronIcon
            width={15}
            height={15}
            className={`transition-transform ${open ? '-rotate-90' : ''}`}
          />
        </span>
      </button>
    </article>
  )
}

export default function News() {
  return (
    <div className="screen">
      <PageHeader
        eyebrow="News"
        title="What rooms are doing"
        subtitle="Short pieces on materials, light, and spending well — written to be useful before you scan."
      />
      <div className="mx-auto max-w-lg space-y-3 px-5 pt-5">
        {POSTS.map((post) => (
          <Post key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}
