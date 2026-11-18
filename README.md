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

`npm run dev` starts both halves: the Vite frontend on **:5180** and the API on
**:8787**, with `/api` proxied across. Open <http://localhost:5180>.

Both ports can be moved without editing anything: `PORT` is the API port (read
by the server *and* by the Vite proxy, so they always agree) and `VITE_PORT` is
the dev-server port — e.g. `PORT=8797 VITE_PORT=5190 npm run dev` runs a second
copy beside the first.

To use it on your actual phone (which is the point — you need a camera), find
your machine's LAN address and open `http://<that-address>:5180` on the phone
over the same Wi-Fi. Vite is already bound to all interfaces.

> Camera capture requires a secure context. `localhost` counts; a bare LAN IP
> does not on iOS. If the camera button opens the photo library instead of the
> camera, put the dev server behind HTTPS (`ngrok http 5180`, or Vite's
> `--https` with a trusted cert) and use that URL.

### Demo mode

With no API keys set, the whole app still works end to end — capture, styles,
budget arithmetic, the results screen and the 3D view. Only the renders are
faked, as eye-level perspective SVG illustrations (floor boards, rug, soft
shadows, daylight, every placed piece of furniture) in your chosen palette, and
the design brief is written in the requested language (uz / ru / en). The
server prints `DEMO MODE` at boot so you know which you're in.

### Going live

| Key | Where to get it | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | <https://console.anthropic.com/settings/keys> | Claude reads the room, designs it, costs the furniture |
| `GEMINI_API_KEY` | <https://aistudio.google.com/apikey> | Gemini restyles each photograph |

Both go in `.env`. They never reach the browser — every model call is made by
the Node server.

Model IDs are overridable via `CLAUDE_MODEL` (default `claude-sonnet-5-5`) and
`GEMINI_IMAGE_MODEL` (default `gemini-3-pro-image-preview`). All server settings
are listed in `.env.example`.

## API

All responses are JSON. Errors are always `{ error, code?, fields? }` — never an
HTML page or a stack trace. Unknown `/api/*` routes return 404 JSON.

| Route | Body | Success |
| --- | --- | --- |
| `GET /api/health` | — | `{ ok, demoMode, providers, models, uptimeS }` |
| `GET /api/angles` | — | `{ angles, requiredAngleIds }` |
| `POST /api/auth/signup` | `{ name, email, password }` | 201 `{ user }` + `fs_session` cookie |
| `POST /api/auth/login` | `{ email, password }` | 200 `{ user }` + cookie |
| `POST /api/auth/logout` | — | 204, cookie cleared |
| `GET /api/auth/me` | — | 200 `{ user, usage }` (`user: null` for guests) |
| `GET /api/projects` | — (session) | `{ projects: Meta[], deleted: string[] }` |
| `GET /api/projects/:id` | — (session) | `{ project: Meta & { record, scene } }` |
| `PUT /api/projects/:id` | any of `{ title, roomType, style, status, createdAt, notes, budget, cover, record, scene }` | `{ project: Meta }` — upsert; omitted fields are kept |
| `DELETE /api/projects/:id` | — (session) | 204 |
| `GET /api/saved` · `PUT /api/saved` | `{ items }` | `{ items, updatedAt }` — the furniture shortlist |
| `POST /api/render` | `{ photos:[{angleId,data,mediaType}], style, budget?, notes?, locale? }` | `{ demoMode, style, locale, brief, renders, failures, elapsedMs }` |
| `POST /api/render-scene` | the 3D builder's `ScenePayload` (`src/features/room-builder/payload.ts`, includes `locale`) | same shape as `/api/render`, plus `warnings` |
| `POST /api/contact` | `{ name?, email, message }` | `{ ok: true }` |

**Language.** Both render routes take `locale` (`uz` | `ru` | `en`); without it
the server uses the first supported language in `Accept-Language`, then `uz`.
The response echoes the resolved `locale`. Every user-facing string in the brief
(summary, palette names and usage, materials, lighting, features, furniture
names, descriptions and placements, budget notes, `angleLabel`) and the
provider warnings come back in that language — from Claude when it is
configured, from `server/i18n.js` in demo mode. Image prompts stay in English.

`user` is `{ id, name, email, createdAt }`. Error codes: `validation` (400, with
a `fields` map), `invalid_json` (400), `invalid_credentials` (401),
`unauthenticated` (401), `quota_exceeded` (402), `email_taken` (409),
`project_limit` (409), `payload_too_large` (413), `rate_limited` (429, with
`Retry-After`), `provider_error` (502/422), `provider_busy` (503),
`provider_timeout` / `timeout` (504), `not_found` (404).

**Projects belong to the account.** The browser keeps the working copy (the
`framespace.projects.v1` archive, the capture slice, one
`framespace.room.<id>` scene per 3D room, the shortlist) and guests use only
that. For a signed-in account `src/store/sync.ts` mirrors every change to
`/api/projects` and `/api/saved`, lists projects made on other devices and
downloads one when it is opened, adopts what a guest made before signing up,
and wipes the device copy on sign-out. On the server each user gets
`DATA_DIR/projects/<userId>/index.json` (one metadata row per project, the
shortlist, delete tombstones) plus one `p_<projectId>.json` per project (design
brief, renders as data URLs, builder scene). Limits: `MAX_PROJECTS_PER_USER`
(default 200), 24 MB per project.

**Allowance.** A signed-in account gets `FREE_MONTHLY_RENDERS` (default 3) live
generations per calendar month (UTC), counted in `DATA_DIR/usage.json` and
reported as `usage: { used, total, period, resetsAt }` beside `user` in every
auth answer and in each live render answer. At the limit `/api/render*` answers
402 `quota_exceeded` before any provider is called. Demo-mode renders and
results made only of fallback drawings are never counted. Guests are not tracked
server-side: their one free render is a browser counter, and the per-IP
`RENDER_RATE_LIMIT` is what bounds anonymous traffic.

**Accounts.** Stored in `server/data/auth.json` (override with `DATA_DIR`;
git-ignored), written atomically. Passwords are hashed with scrypt and a
per-user salt; sessions are random 256-bit tokens kept in an httpOnly,
SameSite=Lax cookie (Secure in production) and stored server-side only as a
SHA-256 hash, valid for 30 days. Sign-up and sign-in are rate-limited per IP and
per email.

**Hardening.** Per-route body limits (30 MB for `/api/render*`, 1 MB elsewhere),
a per-IP limit on `/api/render*` (`RENDER_RATE_LIMIT` per 10 min), request
deadlines, security headers, one log line per API request, retries with
exponential backoff on provider 429/5xx, and graceful shutdown on SIGINT/SIGTERM.
CORS is off unless `CORS_ORIGINS` is set (dev uses the Vite proxy).

**3D builder renders.** `/api/render-scene` keeps the user's furniture and
catalogue prices as the costed list. With a Claude key, Claude writes the
design, product descriptions and one text-to-image prompt per wall view; with a
Gemini key each view is generated from that prompt. Any view that fails is
replaced by a perspective drawing of the actual scene (`render.fallback: true`,
also listed in `failures`). In demo mode every view is that drawing: the real
footprint, windows, doors and furniture, in the style's palette and lighting.

## The 3D room builder

`/app/room/:id` — draw a room, furnish it, then generate a design from it.

- **Three views**: Plan (top-down, drag walls to resize), 3D (orbit from
  outside) and Inside (eye level, under the ceiling).
- **Room finishes**: wall paint (presets or any colour), an accent colour per
  wall (select a wall), seven floor coverings, ceiling colour.
- **Furniture**: 23 catalogue pieces. Every piece can be moved, rotated,
  resized (width / depth / height), re-finished, duplicated and deleted; undo
  and redo cover all of it. The scene saves itself per room.
- **Realistic vs simplified 3D**: capable devices load real modelled furniture
  (`public/models/*.glb`), drawn floor textures, soft shadows and a lit ceiling.
  Weak GPUs get the code-built versions with shadows off. The pill in the
  viewport switches between them; `?tier=high` / `?tier=low` forces one.
- Model sources, licences and how to add more: [docs/MODELS.md](docs/MODELS.md).

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
  index.js      Express app: routes, validation, budget recomputation, lifecycle
  auth.js       accounts + sessions (scrypt, httpOnly cookie, JSON store)
  projects.js   per-account projects, builder scenes and shortlist (JSON files)
  usage.js      per-account monthly generation allowance
  scene.js      3D builder scene validation and plain-language description
  sceneDemo.js  scene brief without keys (renders via roomSvg.js)
  roomSvg.js    demo renderer: one-point-perspective SVG room illustrations
  i18n.js       uz / ru / en copy for demo briefs and warnings, locale resolution
  palettes.js   per-style colour palettes
  claude.js     design briefs — vision + structured outputs (photos and scenes)
  gemini.js     image-to-image restyling and text-to-image scene views
  angles.js     the capture plan (shared with the frontend)
  demo.js       key-free fallback so the app is always clickable
  lib/          http helpers (errors, rate limit, headers, logging),
                retry/backoff, atomic JSON store
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

- A guest's projects live only in `localStorage`: per-device and capped by the
  browser's storage quota (the app evicts the oldest project rather than
  failing the save). A signed-in account's projects are also kept on the
  server, so an evicted one is still listed and re-downloaded when opened.
- Accounts, sessions, projects, the allowance counter and contact messages live
  in JSON files under `server/data/` (`DATA_DIR`) — fine for one process; move
  to a database before scaling out. **`DATA_DIR` must be a persistent disk**:
  on a host with an ephemeral filesystem every deploy would erase the accounts
  and their projects. Rate limits are in-memory per process for the same reason.
- Sync is last-write-wins per project slice (card fields / result / 3D plan).
  Two devices editing the same room at the same moment keep whichever saved
  last; there is no merge.
- A result's link opens for its owner (signed in) or, for a guest, in that
  browser only. There are no public share links; "Share" sends the image.
- Contact messages append to `server/data/messages.json`. Point it at email or
  a ticketing tool before you take real traffic.
- News content is authored in `src/screens/News.jsx`. Swap the array for a feed
  when you have one — the screen only cares about the shape.
