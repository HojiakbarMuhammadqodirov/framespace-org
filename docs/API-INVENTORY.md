# FrameSpace — API Inventory & Freeze List

Status: **Step 1 of the redesign brief (§0 / §12.1).** No UI code written yet.
Generated from commit `2b8e469` (working tree clean).

The rule this document exists to enforce: **every file listed under "FROZEN"
below must not be deleted, renamed, or rewritten.** New features call these
endpoints or add new code *beside* them. If a task appears to require editing a
frozen file, work stops and we discuss it first.

---

## 1. What actually exists right now

The brief describes the stack as "React + TypeScript + Tailwind, Three.js,
Zustand, Express, Vercel". The repository differs in four ways that affect the
plan — flagged here rather than silently assumed:

| Brief says | Repo actually has |
| --- | --- |
| TypeScript | **JavaScript only.** Every file is `.js` / `.jsx`. No `tsconfig.json`, no `typescript` dependency. |
| Zustand | **Not installed.** All state is `useState` inside `src/App.jsx` — one project at a time, held in memory. |
| Vercel deployment | **No `vercel.json`, no serverless functions.** Express serves the API *and* the built `dist/` on one port (`npm start`). |
| Routing | **No router.** Navigation is a `tab` + `flow` string switch in `src/App.jsx`. The URL never changes. |

What *is* true and stays: React 19, Tailwind v4 (via `@tailwindcss/vite`),
Three.js 0.182, Express 5, Vite 7.

Also absent today, and therefore *new* work rather than redesign: auth, user
accounts, any database, any furniture/product catalog, any 3D model storage, any
business/dashboard endpoint, any realtime video pipeline.

---

## 2. FROZEN — the API layer

### 2.1 Server: provider SDK calls, keys, routes

| File | Lines | What it holds | Why frozen |
| --- | --- | --- | --- |
| `server/index.js` | 174 | Express app; all four routes; the budget-recompute step; static `dist/` serving; `PORT` | Every endpoint contract lives here |
| `server/claude.js` | 296 | `@anthropic-ai/sdk` client, `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, the `DESIGN_SCHEMA` structured-output schema, the system prompt, server-side-fallback beta handling | Provider SDK + the design contract the whole app depends on |
| `server/gemini.js` | 113 | `@google/genai` client, `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL`, `GEOMETRY_GUARD`, parallel `renderAll` | Provider SDK call path |
| `server/angles.js` | 76 | `ANGLES`, `REQUIRED_ANGLE_IDS`, `RENDERABLE_ANGLE_IDS`, `angleById()` | Shared contract — imported by **both** server and client |
| `server/demo.js` | 206 | Keyless demo brief + SVG placeholder renders | Guarantees the app runs with no keys; the fallback contract |
| `.env.example` | 21 | The documented env-var surface | The key contract |
| `vite.config.js` | — | `server.proxy['/api']` → `http://localhost:8787` **(that block only)** | Breaking it breaks every call in dev |

### 2.2 Client: the API transport

| File | Lines | Why frozen |
| --- | --- | --- |
| `src/lib/api.js` | 37 | The only module that talks to `/api/*`. Request shaping (`captures` → `photos[]`) is a contract, not UI. |
| `src/lib/image.js` | 52 | Produces the exact `{ base64, mediaType }` shape `/api/render` validates. The 1280px / q0.85 downscale is tuned to the 30 MB body limit. |

> **Cross-boundary import — keep it.** `src/screens/Capture.jsx:4` imports
> `ANGLES, REQUIRED_ANGLE_IDS` from `../../server/angles.js` directly. The new
> frontend must keep importing that same file (an alias like `@contract` is
> fine) — **not** copy the angle list into the client, or the two drift apart.

### 2.3 Environment variables — do not rename

```
ANTHROPIC_API_KEY      # required for live briefs; absent => demo mode
CLAUDE_MODEL           # optional, default: claude-opus-5
GEMINI_API_KEY         # required for live renders; absent => demo mode
GEMINI_IMAGE_MODEL     # optional, default: gemini-3-pro-image-preview
PORT                   # default 8787
```

Keys are read server-side only; the browser never sees them. `demoMode` is
computed once at boot as `!claudeConfigured() || !geminiConfigured()`.

---

## 3. Endpoint contracts

### `GET /api/health`

```jsonc
// 200
{ "ok": true, "demoMode": false,
  "providers": { "claude": true, "gemini": true },
  "models": { "claude": "claude-opus-5", "gemini": "gemini-3-pro-image-preview" } }
```

Consumed by `src/lib/api.js → getHealth()` → `App.jsx` → `Landing`, `Rendering`.
Never throws — on network failure the client fabricates a `demoMode: true` reply.

### `GET /api/angles`

```jsonc
// 200
{ "angles": [ { "id": "front", "label": "Front wall", "hint": "...", "required": true, "yaw": 0 } ],
  "requiredAngleIds": ["front", "right", "back", "left"] }
```

**Currently consumed by nobody** — the client imports `server/angles.js` at build
time instead. Live but unused. Keep it: it is the right source for a future
server-driven capture plan.

### `POST /api/render` — the main pipeline

Request (`express.json({ limit: '30mb' })`):

```jsonc
{ "photos": [ { "angleId": "front", "data": "<base64, no data: prefix>", "mediaType": "image/jpeg" } ],
  "style": "Japandi",                          // required, one of the 8 style names
  "budget": { "limit": 4000, "currency": "USD" },   // or null
  "notes": "free text" }
```

Validation (`validate()` in `server/index.js`), all → `400`:

- at least one photo; `style` non-empty
- **all four of `front`, `right`, `back`, `left` must be present**
- every photo needs `data` as a string and a known `angleId`

Success `200`:

```jsonc
{ "demoMode": false, "style": "Japandi",
  "brief": {
    "room":    { "estimatedWidthM", "estimatedDepthM", "estimatedHeightM",
                 "existingFeatures": [], "lightingNotes", "confidence": "low|medium|high" },
    "design":  { "styleName", "summary", "palette": [ { "name", "hex", "usage" } ],
                 "materials": [], "lighting" },
    "furniture": [ { "name", "category", "description", "typicalPriceLow",
                     "typicalPriceHigh", "averagePrice", "quantity", "placement" } ],
    "budget":  { "currency", "limit", "estimatedTotal", "withinBudget", "notes" },
    "renderPrompts": [ { "angleId", "angleLabel", "prompt" } ],
    "usage":   { "inputTokens", "outputTokens" }
  },
  "renders": [ { "angleId", "angleLabel", "prompt", "image": "data:image/png;base64,..." } ],
  "failures": [ { "angleId", "error" } ],
  "elapsedMs": 31840 }
```

Errors: `400` validation · `502` brief written but zero images came back · `500` thrown.

Behaviour the redesign has to be built around:

- **Synchronous.** One request, no job id, no polling. Wall time ~30 s live
  (4 renders in parallel), longer on a slow link. There is no resume.
- `furniture.category` is a **closed enum**: `seating, table, storage, bed,
  lighting, rug, textiles, wall-decor, plants, paint-and-finishes, other`.
- `budget.estimatedTotal` is **recomputed on the server** from the line items —
  the model's own total is discarded. Never recompute it on the client.
- Renders are capped at **4 angles**, drawn only from `RENDERABLE_ANGLE_IDS`
  (`front, right, back, left, corner, window`). Floor and ceiling inform the
  brief but are never rendered.
- Images return as **base64 data URLs inside the JSON**, not as file URLs.
- A per-angle failure does not fail the request; it lands in `failures[]`.

Consumed by `src/lib/api.js → requestRender()` → `App.jsx:runRender()`.

### `POST /api/contact`

Request `{ name, email, message }` — `email` and `message` required (`400` otherwise).
Appends to `server/data/messages.json` on the local filesystem. Returns `{ ok: true }`.
Consumed by `src/screens/Contact.jsx`.

### Catch-all `GET /^(?!\/api\/).*/`

Serves `dist/index.html` — the SPA fallback. **Client-side routing is already
supported**; adding a real router needs no server change.

---

## 4. Client data & device APIs — not frozen, but contract-adjacent

| File | Role | Redesign note |
| --- | --- | --- |
| `src/lib/storage.js` | `localStorage` key `framespace.projects.v1`, max 12 projects, evicts oldest on quota error | Data-URL renders are heavy; this is the only persistence today. Keep the key and migrate — don't clobber it. |
| `src/lib/styles.js` | The 8 `STYLES` with swatches; `CURRENCIES` (UZS already present); `formatMoney()` | Style **names are part of the API contract** — `style` is sent verbatim to Claude and keys `PALETTES` in `demo.js`. Translate the label for display; send the English name. |
| `src/lib/equirect.js` | Stitches 4 renders into a 4096×2048 equirectangular canvas by `yaw` sector with cross-fade | Exactly the substrate "See by yourself" **Mode C** needs. Reuse, don't rewrite. |
| `src/screens/Panorama.jsx` | Three.js sphere + `deviceorientation` listener | Prior art for Mode C. No iOS `requestPermission()` call yet. |
| `src/screens/Capture.jsx` | `<input type="file" accept="image/*" capture="environment">` | **No live camera stream and no compass/heading capture today.** Brief §6 (guided compass ring, heading/pitch metadata, blur check) is all new. |

---

## 5. Gaps between the brief and the backend

Everything below needs **new** server code. None of it requires editing a frozen
file — new routes go in new modules mounted alongside the existing ones.

| Brief section | Needs | Frozen file touched? |
| --- | --- | --- |
| §4 auth, `/login`, `/signup` | Auth provider, sessions, user store | No — new module |
| §4 guest mode (1 free generation) | Quota / rate-limit middleware | No — new middleware; `/api/render` itself unchanged |
| §6 capture metadata (heading, pitch) | `/api/render` takes no metadata fields today; unknown keys are **ignored, not rejected** | No — metadata can ride along, or go to a new endpoint |
| §7 3D room builder → generate | Scene JSON → brief. `/api/render` *requires* photos and all four walls, so a scene-based request **cannot** reuse it | No — new `/api/render-scene` beside it |
| §8 PDF export, share links, OG images | New endpoints + object storage | No |
| §9 Mode A realtime restyle | Decart key, short-lived session-token minting, plan limits | No — new `server/realtime.js` |
| §9 Mode C panorama | Nothing new — `equirect.js` + existing renders already do it | No |
| §10 3D catalog, business dashboards | Product DB, glTF storage, analytics | No |

### Two structural risks to settle before Step 3

1. **Vercel vs. the Express server.** `/api/render` holds a connection open for
   ~30 s and accepts up to 30 MB of body. Vercel's serverless functions cap body
   size well below that and time out long before a 4-render job finishes; and
   `/api/contact` writes to the local filesystem, which does not persist on
   serverless. Deploying as-is to Vercel breaks the main flow. A persistent Node
   host (Railway / Fly / Render / a VPS) runs the current code unchanged.
2. **Synchronous render vs. "you can leave, we'll notify you" (§6.8).** That
   promise needs a job queue plus a status endpoint. New code beside
   `/api/render`, not a change to it — but it is a Step-5 decision.

---

## 6. Freeze list — copy/paste summary

```
FROZEN (do not edit, rename, or delete)
  server/index.js
  server/claude.js
  server/gemini.js
  server/angles.js
  server/demo.js
  .env.example
  src/lib/api.js
  src/lib/image.js
  vite.config.js  -> the server.proxy['/api'] block only

FREE TO REPLACE (UI layer)
  src/App.jsx   src/main.jsx   index.html   src/index.css
  src/components/*   src/screens/*
  src/lib/storage.js   src/lib/styles.js   src/lib/equirect.js
      ^ port/rewrite freely, but keep the exports and the localStorage key
```
