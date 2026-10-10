# FrameSpace — where the rebuild stands

`npm run dev` → <http://localhost:5180/>

All ten steps of the brief have been built. 156 TypeScript files, 29 routes, three
languages. The pre-redesign app still runs untouched at `/legacy`.

---

## Verification

| Check | Result |
| --- | --- |
| `tsc --noEmit` | clean |
| `vite build` | clean — 58 chunks |
| Every route responds | 29 / 29 → 200 |
| Every page server-renders in uz / ru / en | **72 / 72**, no untranslated key leaked |
| Frozen files modified | **none** |

The two renders that first looked broken were checked and are correct:
`/catalog/:id` and `/store/:slug` with an unknown id render their designed 404;
`/app/projects/:id/live` holds one tick while `localStorage` is read, then
renders the full experience (4.5 kB of markup with a real project).

---

## Routes

**Public** `/` · `/how-it-works` · `/styles` · `/gallery` · `/pricing` · `/faq` ·
`/about` · `/contact` · `/catalog` · `/catalog/:id` · `/store/:slug` ·
`/legal/terms` · `/legal/privacy`

**Auth** `/login` · `/signup`

**App** `/app` · `/app/saved` · `/app/settings` · `/app/capture` ·
`/app/result/:id` (and `/app/projects/:id`) · `/app/projects/:id/live` ·
`/app/room/:id`

**Business** `/business` · `/products` · `/orders-leads` · `/analytics` ·
`/branding` · `/team`

**Internal** `/styleguide` · `/legacy`

---

## The design language

Warm beige and the brand orange, with the motion work from the polish pass on top.

```
#F6F1E9 paper   #FFFFFF raised   #EFE8DD sunken
#4A3529 text (10.19:1)   #2A1D16 strong (14.53:1)   #6B5A4D muted (5.85:1)
#C6552F accent   #B44D2B accent-ink   #4E6B4A ok   #B4832A warn   #9E3A2B err
```

**The palette's one trap:** paper on `#C6552F` is **3.94:1 and fails AA**, so
anything that reads as text — including a filled button's label — uses
`--accent-ink` `#B44D2B` at 4.63:1. The brand orange itself is for fills behind
large type, live indicators and non-text UI parts, where 3:1 is the bar. Dark
mode lifts the whole status set, because every light-mode colour is too dark to
sit on `#2A1D16`.

**Typeface is Geist.** Its `latin` subset was verified against the served CSS to
cover U+02BB / U+02BC — 387 strings of Uzbek copy depend on that character, and
a face without it breaks `oʻ` / `gʻ` mid-word.

**Structure:** double-bezel containers (a tray holding a plate, concentric
radii, hairline ring, one inset highlight), button-in-button CTAs, a floating
island nav with a morphing hamburger and staggered mask reveals, a floating
mobile dock, warm-tinted diffused shadows, a fixed film grain and two slow warm
light washes behind everything.

**No custom cursor.** It was built and then removed — the client did not want
the native pointer replaced.

### Motion

- **Route changes** play an ink wipe with the mark pulsing behind it; a thin
  accent bar tracks page scroll.
- **Headlines** rise word-by-word out of a mask. Split on words, never
  characters — a per-character split destroys Cyrillic shaping and tears the
  Uzbek `oʻ` digraph apart.
- **Landing is scroll-choreographed.** The hero is a pinned full-bleed stage:
  the room settles, type masks up, the whole thing parallaxes and dims as it
  leaves. How-it-works pins for 300vh and advances its three steps. The catalog
  strip's horizontal scroll is driven by vertical progress — and pauses the
  moment the region takes keyboard focus, so arrow keys are never fought. The
  AI explainer is scrubbed by scroll instead of a timer. "See by yourself"
  locks its phone into alignment as the section centres.
- **App and dashboard** use framer `layout` for filter reflow, `CountUp` on
  every metric, `scaleX` growth on bars (never `width`), `pathLength` draw-on
  for charts, and one-time skeleton→content morphs that do not replay on sort.
- `Tilt` (perspective lean + specular sweep) and `Magnetic` on cards and CTAs.
- Every one of these has a `prefers-reduced-motion` branch: the end state
  renders immediately, nothing is left invisible, pinned sections become plain
  stacked ones, and no auto-motion runs.

### The 3D

- **Contact shadows** under the furniture — the single biggest realism fix;
  baked once (`frames={1}`) because the furniture never moves.
- **Procedural materials**: wood grain, fabric weave and brushed-metal scratch
  drawn to a canvas as roughness maps and cached, so nothing is downloaded and
  the ~30 catalog viewers share one texture upload. Upholstery is
  `MeshPhysicalMaterial` with sheen.
- **Real furniture models.** Sofa, armchairs, dining chair, coffee/dining
  table, desk, shelf, sideboard, plant, pendant and screen are now
  photo-textured glTF models (Poly Haven CC0 + Khronos sample assets; one is
  CC BY 4.0 — see `public/models/furniture/CREDITS.md`), 12 files / 6.0 MB,
  WebP textures + Meshopt geometry, built by `scripts/furniture/build-models.mjs`.
  `src/three/furniture/real.tsx` loads them with drei `useGLTF` (Meshopt
  decoder is inline, no CDN), scales each into the catalogue's w×d×h, and
  keeps the procedural piece as the Suspense/error fallback. Upholstery follows
  the chosen finish; wood/stone/metal keep their scanned textures. Bed,
  wardrobe, rug and floor lamp remain procedural (no good free model yet).
- **Atmosphere**: dust motes in the window beam, a light shaft, imperceptible
  lamp flicker, and a camera "breath" driven through `fov` rather than position
  (OrbitControls' damped update would overwrite a position write).
- Depth fog at the back of the room is warm brown, not near-black: the page
  around the viewport is beige, and a sooty fade there reads as a hole punched
  in the frame rather than distance.
- Low-tier devices drop shadow-map size and mote count and skip the shaft.
- **The room palettes stay warm and true.** Minimal, Japandi, Modern Uzbek and
  Classic are product *content* — someone choosing Japandi has to see Japandi.

## Performance

```
three.module   704 KB   3D routes only
index          496 KB   160.8 KB gzip
Canvas         156 KB
RoomBuilder     88 KB
Live            68 KB
Capture         56 KB
```

Two real bugs were found and fixed during integration:

1. **The 3D hero was mounting on phones.** CSS `display: none` hides a component
   but does not stop React mounting it, so Three.js was downloading on mobile.
   Now gated on a JS media query.
2. **Feature translations sat in the entry bundle** — ~100 KB of copy for
   screens most visitors never open. They now load with their route chunk, which
   Suspense already covers, so no screen paints before its copy exists. Entry
   dropped 596 → 496 KB.

Also: WebGL pauses when its canvas leaves the viewport, `qrcode` loads on click
only, and every 3D route is its own chunk.

---

## What is honestly not finished, and why

None of these are bugs. `server/` is frozen and has exactly four routes —
`/api/health`, `/api/angles`, `/api/render`, `/api/contact` — so anything needing
a fifth was built up to the seam and stopped there, in the open.

| Gap | What exists | What it needs |
| --- | --- | --- |
| **Auth is not real** | Full UI, zod validation, guest allowance. Session is localStorage scaffolding, and both forms say so in words | An auth endpoint + session tokens |
| **"Leave and we'll notify you"** (§6.8) | Honest staged progress driven by elapsed time, a `beforeunload` guard, and a plain warning that leaving loses the result | A job queue + status endpoint |
| **No cancel during generation** | — | `requestRender()` takes no `AbortSignal`; offering a cancel button would be a lie |
| **3D builder "Generate"** | Serialises the full scene payload, logs it, shows a sheet naming the missing route and the four gaps | `POST /api/render-scene` |
| **"See by yourself" Mode A** (live AI restyle) | Full UI and WebRTC client pipeline, gated behind a "not connected" state | `VITE_LIVE_RESTYLE_URL` + a server module minting short-lived session tokens. Contract documented at the top of `src/features/live/realtime.ts` |
| **Mode B (WebXR AR)** | Real `immersive-ar` session, hit-test, anchors; sofa and table use the real `.glb` models, the lamp a placeholder | `.usdz` files for iOS Quick Look; a floor-lamp model |
| **Catalog & business data** | Typed local demo data shaped exactly like an API response | A product database, model storage, analytics |
| **Share links** | Copy a URL that resolves on this device only, and the UI says that | Object storage + a share endpoint |

**Modes C and B of "See by yourself" are live.** The panorama stitches the four
renders by `yaw`, maps them inside a sphere, and drives the camera from a device
quaternion with `screen.orientation.angle` compensation and slerp smoothing. It
works offline.

---

## Two things only you can supply

1. **The logo.** `src/ui/Logo.tsx` is a placeholder mark. Send the SVG; the
   draw-in and the cursor reaction are already wired around it.
2. **Photography.** This repository contains no image assets, none can be
   downloaded, and the connected image account has 0 credits. Every visual is a
   drawn blueprint SVG or real 3D. `BeforeAfter` and the gallery take real
   photographs straight into their existing slots.

## Still open from step 1

**Where does this deploy?** `/api/render` holds a connection ~30 s and accepts a
30 MB body; Vercel's serverless limits break both, and `/api/contact` writes to
the local filesystem. A persistent Node host runs the current code unchanged.

**Answer (free tiers):** frontend stays static on Vercel; the API runs on
Render's free web service (`render.yaml`); accounts, sessions, render quotas,
contact messages and client error reports go to Neon/Supabase Postgres when
`DATABASE_URL` is set. Vercel rewrites `/api/*` to Render (`vercel.json`), so
cookies stay first-party. Renders need an account, are capped per user per day
and globally per day whenever an AI key is set. Step-by-step in README →
*Deploying for free*.
