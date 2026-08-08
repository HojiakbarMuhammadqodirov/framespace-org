# FrameSpace

A mobile web app. You photograph the room you already have — front wall, right,
back, left, plus the window and the floor — pick a style and, optionally, a
furniture budget. Claude reads the photos and designs the room; Gemini repaints
each of your own photographs in the new design; the results are stitched into a
360° view you can look around.

## Run it

```bash
npm install
cp .env.example .env      # optional — see Demo mode below
npm run dev
```

`npm run dev` starts both halves: the Vite frontend on **:5173** and the API on
**:8787**, with `/api` proxied across. Open <http://localhost:5173>.

To use it on your actual phone (which is the point — you need a camera), find
your machine's LAN address and open `http://<that-address>:5173` on the phone
over the same Wi-Fi. Vite is already bound to all interfaces.

> Camera capture requires a secure context. `localhost` counts; a bare LAN IP
> does not on iOS. If the camera button opens the photo library instead of the
> camera, put the dev server behind HTTPS (`ngrok http 5173`, or Vite's
> `--https` with a trusted cert) and use that URL.

### Demo mode

With no API keys set, the whole app still works end to end — capture, styles,
budget arithmetic, the results screen and the 3D view. Only the renders are
faked, as generated SVG room illustrations in your chosen palette. The server
prints `DEMO MODE` at boot so you know which you're in.

### Going live

| Key | Where to get it | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | <https://console.anthropic.com/settings/keys> | Claude reads the room, designs it, costs the furniture |
| `GEMINI_API_KEY` | <https://aistudio.google.com/apikey> | Gemini restyles each photograph |

Both go in `.env`. They never reach the browser — every model call is made by
the Node server.

Model IDs are overridable via `CLAUDE_MODEL` and `GEMINI_IMAGE_MODEL` if you
want to pin or swap either one.

## Production build

```bash
npm run build
npm start        # Express serves ./dist and the API on one port
```

## How the pipeline works

```
photos (4–8 angles, downscaled to 1280px on-device)
      │
      ▼
Claude  ─ reads every angle, cross-references the walls
        ─ estimates dimensions, lists what cannot move
        ─ designs palette / materials / lighting
        ─ costs furniture at average retail, under your ceiling
        ─ writes one image-edit prompt per angle
      │
      ▼
Gemini  ─ edits each original photograph with its prompt
        ─ 4 renders, run in parallel
      │
      ▼
Browser ─ stitches the renders into an equirectangular panorama
        ─ three.js sphere, drag or gyroscope to look around
```

**On the budget.** Claude is instructed to price every item at the midpoint of
its typical retail range and keep the list under your ceiling. The server does
not take that on trust: `estimatedTotal` shown in the app is recomputed from the
line items server-side, so the number you see always matches the list you see.
These are planning figures, not live listings.

**On the 3D view.** It is an approximation and the code says so. Four
perspective photographs are not a spherical capture — each render is placed in
the 90° sector it was shot from, cross-faded into its neighbours, with ceiling
and floor filled from the colours at the top and bottom of each image. It reads
convincingly as standing in the room and turning around. It is not
photogrammetry, and a true walk-through would need a different capture method.

## Layout

```
server/
  index.js      Express API, request validation, budget recomputation
  claude.js     design brief — vision + structured outputs
  gemini.js     image-to-image restyling, parallel across angles
  angles.js     the capture plan (shared with the frontend)
  demo.js       key-free fallback so the app is always clickable
src/
  App.jsx       screen state machine
  components/   TabBar (4 tabs + the camera circle), header, icons
  screens/      Landing, Capture, StylePicker, Rendering, Result,
                Panorama, News, Archive, Contact
  lib/          image downscaling, API client, localStorage archive,
                equirectangular stitching
```

`server/angles.js` is the single source of truth for the capture plan — the
frontend imports it directly rather than keeping its own copy, so adding an
angle is a one-line change that both halves pick up.

## Known limits

- The Archive lives in `localStorage`, which means it is per-device and capped
  by the browser's storage quota. Renders are large; the app evicts the oldest
  project rather than failing the save.
- Contact messages append to `server/data/messages.json`. Point it at email or
  a ticketing tool before you take real traffic.
- News content is authored in `src/screens/News.jsx`. Swap the array for a feed
  when you have one — the screen only cares about the shape.
