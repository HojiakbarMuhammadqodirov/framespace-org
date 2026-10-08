# Step 3 — Landing page: what was built

`npm run dev` → <http://localhost:5180/>. The design system is still at `/styleguide`; the
pre-redesign app still works at `/legacy`.

Built in parallel by three agents against a fixed token and i18n contract, then
assembled and verified here.

## The page, in order

| Section | Mobile | Desktop |
| --- | --- | --- |
| Hero | Draggable before/after (auto-wipes once), bottom camera dock | **Live WebGL room** you orbit with the mouse + four style chips that re-dress it; "Upload room photos" / "Build my room in 3D"; "Continue on phone" → QR dialog |
| How it works | 3 steps stacked | Asymmetric 12-col, blueprint alternates side each step |
| Catalog strip | Horizontal swipe | Hover a piece and it rotates; `data-cursor="Rotate"` |
| AI explainer | Stages tick in sequence | Photos in → 4 stages → 3 outputs on unequal spans |
| See by yourself | Full phone mock with heading tape + bubble level | Same, on a sunken surface, the largest block on the page |
| For business | Dark `data-surface="inverse"` section | 4 points in an editorial spread, not a card row |
| Pricing | 3 plans stacked | Middle plan dominant — 6 of 12 columns, raised, badged |
| FAQ | Accordion | Sticky heading left, questions right |
| Footer | Stacked | Large animated logo, 3 link columns |

All three languages throughout. Uzbek is the default.

## Things worth knowing

**The 3D room is real.** Floor, ceiling, walls with an actual window hole — the
daylight patch on the floor is a shadow-map cutout, not a painted decal. Sofa,
table, rug, lamp, shelf, plants, wall art: ~75 meshes from 5 shared geometries
and 18 shared materials. Orbit is clamped to ±35° azimuth so you cannot fly
behind the walls, auto-rotate is a slow sway that stops for good the moment you
touch it, and switching style lerps the material colours over 400 ms instead of
swapping them — no shader recompiles. Four palettes: Minimal, Japandi, Modern
Uzbek (terracotta, loud rug motif, suzani panel), Classic.

**Two performance bugs found and fixed during assembly:**

1. The 3D scene was mounting on phones. CSS `display: none` hides a component
   but does not stop React mounting it, so Three.js (719 kB) was being
   downloaded on mobile. It is now gated on a JS media query — phones never
   fetch it.
2. `qrcode` was sitting in the entry chunk for a dialog behind a click. Now its
   own 28 kB chunk, loaded on open.

**Chunking after the fixes:**

```
three.module   704 KB   desktop only, only when the hero mounts
index          484 KB   react + router + framer-motion + i18next + lenis + 3 locales
HeroScene      188 KB   desktop only
Landing         44 KB
QrHandoff       28 KB   on click only
Styleguide      16 KB
```

The 484 kB entry chunk (161 kB gzip) is the next thing to attack before the
Lighthouse pass — the three locale files are bundled together and could load on
demand.

**WebGL is not assumed.** No WebGL, or a context that fails to create, and the
hero falls back to the blueprint room drawing. Designed state, not a crash.

**Every route in the sitemap resolves.** `/how-it-works`, `/catalog`, `/styles`,
`/gallery`, `/pricing`, `/for-business`, `/about`, `/faq`, `/contact`, `/login`,
`/signup`, `/legal/*`, `/app`, `/app/new`, `/app/capture`, `/app/room/:id` — each
renders a placeholder naming the step of the rebuild that replaces it, so the
landing can be walked end to end without hitting a 404.

**SEO.** Per-page title and meta in the active language, canonical, hreflang for
all three plus x-default, Open Graph, and JSON-LD (SoftwareApplication + FAQPage
built from the real FAQ copy).

## Verification

| Check | Result |
| --- | --- |
| `tsc --noEmit` | clean |
| `vite build` | clean, chunks split as above |
| Landing server-renders in uz / ru / en | 55–56 kB of HTML each, **no untranslated keys leaked** |
| Section content present per language | hero, steps, catalog, ai, live, business, pricing, faq — all found in all three |
| Routes respond | `/`, `/styleguide`, `/pricing`, `/legacy` → 200 |

**Still not verified visually.** The Chrome extension in this environment will
not capture `localhost`, so no screenshots. Everything above proves it compiles,
splits and renders correct copy — not that it looks right. That needs your eyes.

## Open, carried forward

- **Deployment target** — unchanged from step 1. `/api/render` holds a 30 s
  connection and takes a 30 MB body; Vercel's serverless limits break it. Needed
  before step 4.
- **The logo is still a placeholder.** Send the SVG and it drops into
  `src/ui/Logo.tsx` — the draw-in animation is already wired.
- **Fonts still load from Google Fonts.** Self-hosting and per-script subsetting
  belongs with the Lighthouse pass.
