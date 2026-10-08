# FrameSpace — Folder, Routing & Token Proposal

Step 1 deliverable (§0.3). **Nothing here is built yet — this is for your OK.**
Read `API-INVENTORY.md` first; the freeze list constrains everything below.

---

## 1. Folder structure

```
framespace-org/
├── server/                    ← FROZEN. New modules may be added beside these.
│   ├── index.js  claude.js  gemini.js  angles.js  demo.js
│   └── (later) auth.js  realtime.js  catalog.js
├── docs/
│   ├── API-INVENTORY.md       ← freeze list
│   └── ARCHITECTURE-PROPOSAL.md
└── src/
    ├── main.tsx                       app entry
    ├── router.tsx                     all routes, lazy boundaries
    │
    ├── api/                   ← FROZEN transport
    │   ├── client.js                  (= today's lib/api.js, moved, not rewritten)
    │   └── image.js                   (= today's lib/image.js)
    │
    ├── design/                ← Step 2 output
    │   ├── tokens.css                 CSS custom properties, light + dark
    │   ├── theme.ts                   the same values typed, for JS/WebGL
    │   ├── motion.ts                  easings, durations, variants
    │   └── fonts.css                  @font-face + preload
    │
    ├── ui/                    ← primitives only. No business logic, no fetch.
    │   ├── Button.tsx  Input.tsx  Select.tsx  Slider.tsx  Chip.tsx
    │   ├── Card.tsx  Dialog.tsx  Sheet.tsx  Tooltip.tsx  Skeleton.tsx
    │   ├── Cursor.tsx                 custom cursor + magnetic targets (§3)
    │   ├── Reveal.tsx                 scroll reveal wrapper
    │   ├── BeforeAfter.tsx            draggable divider
    │   ├── DimensionLine.tsx          "3.40 m" architectural decoration
    │   └── Logo.tsx                   the existing mark, animated only
    │
    ├── layouts/
    │   ├── PublicLayout.tsx           header + footer
    │   ├── AppLayout.tsx              user dashboard shell
    │   ├── BusinessLayout.tsx         phase 2
    │   └── MobileDock.tsx             fixed bottom bar with the camera button
    │
    ├── features/              ← one folder per flow; components + hooks + state
    │   ├── capture/                   flow A (mobile)
    │   ├── room-builder/              flow B (3D editor)
    │   ├── result/                    result page, before/after, PDF
    │   ├── live/                      "See by yourself" — modes A / B / C
    │   ├── catalog/                   3D furniture
    │   ├── projects/                  user dashboard, project model
    │   └── business/                  phase 2
    │
    ├── three/                 ← all WebGL. Nothing else imports three directly.
    │   ├── Canvas.tsx                 r3f canvas + IntersectionObserver pause
    │   ├── HeroRoom.tsx               landing centrepiece
    │   ├── ProductViewer.tsx          catalog item, rotates on hover
    │   ├── PanoSphere.tsx             Mode C (wraps the frozen-adjacent equirect)
    │   └── loaders.ts                 Draco/Meshopt/KTX2 setup
    │
    ├── pages/                 ← thin: compose layout + features, own the SEO head
    ├── i18n/
    │   ├── config.ts
    │   └── locales/{uz,ru,en}.json
    ├── store/                 ← zustand slices
    │   ├── project.ts  prefs.ts (lang, currency, theme)  session.ts
    │   └── persist.ts                 wraps the existing localStorage key
    └── lib/
        ├── equirect.js                moved as-is (Mode C substrate)
        ├── styles.ts                  the 8 style names = API contract + i18n keys
        ├── format.ts                  money (UZS/USD), metres
        └── cn.ts
```

**Two rules this structure enforces.** `three/` is the only place that imports
Three.js, so the 3D bundle stays code-split. `api/` is the only place that knows
a URL exists, so the freeze holds by construction.

---

## 2. Routing (`react-router`)

| Path | Page | Notes |
| --- | --- | --- |
| `/` | Landing | mobile dock + desktop WebGL hero |
| `/how-it-works` `/styles` `/gallery` `/pricing` `/about` `/faq` `/contact` | Public | `/contact` uses the existing `POST /api/contact` |
| `/catalog` `/catalog/:id` | 3D catalog | step 9 |
| `/for-business` | B2B pitch | dark `--clay-900` section |
| `/login` `/signup` | Auth | step 4 |
| `/legal/terms` `/legal/privacy` | Legal | |
| `/app` | Dashboard | |
| `/app/new` | Choose: photograph / upload / build in 3D | |
| `/app/capture` | Flow A, mobile only | desktop → QR handoff |
| `/app/room/:id` | Flow B, 3D editor | lazy chunk |
| `/app/projects/:id` | Result | |
| `/app/projects/:id/live` | See by yourself | lazy; mobile only |
| `/app/saved` `/app/settings` | | |
| `/business/*` | overview · products · orders-leads · analytics · branding · team | phase 2 |
| `/store/:slug` | Branded public catalog | phase 2 |
| `*` | 404 | |

Language: `/uz` `/ru` `/en` prefixes with `hreflang`, default **uz**, detected
once and stored in `prefs`. The Express catch-all already serves `index.html` for
all of these — no server change needed.

Lazy boundaries: `/app/room/:id`, `/app/projects/:id/live`, `/catalog`, and
everything under `/business`.

---

## 3. Design tokens

Your palette from §2, unchanged, plus the derived values needed to build with it.

```css
:root {
  /* brand */
  --clay-900:#2A1D16;  --clay-700:#4A3529;  --clay-500:#6B4A35;
  --clay-300:#A67B5B;  --sand-200:#E4D9CB;  --paper:#F6F1E9;  --white:#FFF;
  --accent:#C6552F;    --ok:#4E6B4A;  --warn:#B4832A;  --err:#9E3A2B;

  /* accessible companions — see the contrast table below */
  --accent-ink:#B44D2B;   /* accent as TEXT, and CTA fills with normal-size labels */
  --warn-ink:#876220;     /* warn as TEXT */

  /* semantic (what components actually reference) */
  --bg:var(--paper);          --bg-raised:var(--white);
  --text:var(--clay-700);     --text-muted:#6B5A4D;   --text-inverse:var(--paper);
  --border:var(--sand-200);   --border-strong:rgba(42,29,22,.16);
  --focus:var(--accent);

  /* type */
  --font-display:"Cormorant",Georgia,serif;   /* Cyrillic — see Typography below */
  --font-ui:"Inter Tight",system-ui,sans-serif;
  --font-mono:"JetBrains Mono",ui-monospace,monospace;
  --step--1:.875rem; --step-0:1.0625rem; --step-1:1.25rem;
  --step-2:clamp(1.5rem,1.1rem + 1.6vw,2rem);
  --step-3:clamp(2rem,1.4rem + 2.8vw,3.25rem);
  --step-4:clamp(2.75rem,1.6rem + 5.2vw,5.5rem);
  --lh-tight:1.05; --lh-body:1.6; --tracking-display:-.02em;

  /* space — 4px base */
  --s1:.25rem; --s2:.5rem; --s3:.75rem; --s4:1rem; --s6:1.5rem;
  --s8:2rem; --s12:3rem; --s16:4rem; --s24:6rem; --s32:8rem;

  /* structure */
  --radius-sm:4px; --radius:8px; --radius-lg:16px; --radius-full:999px;
  --hairline:1px;
  --shadow-card:0 1px 2px rgba(42,29,22,.04), 0 8px 24px rgba(42,29,22,.06);

  /* motion */
  --ease:cubic-bezier(.22,1,.36,1);
  --d-fast:180ms; --d-base:260ms; --d-slow:420ms;
}

:root[data-theme="dark"] {
  --bg:var(--clay-900);  --bg-raised:#352418;
  --text:var(--paper);   --text-muted:rgba(246,241,233,.64);
  --border:rgba(246,241,233,.10);  --border-strong:rgba(246,241,233,.22);
  --accent:#CF6F4E;      --accent-ink:#CF6F4E;   /* the original #C6552F is 3.69:1 on
                                                    clay-900 — too dark for dark mode */
}
@media (prefers-reduced-motion:reduce){ :root{ --d-fast:0ms; --d-base:0ms; --d-slow:0ms; } }
```

**Contrast check (§11, WCAG AA).** Computed, not eyeballed. AA needs 4.5:1 for
normal text, 3:1 for large text (≥24px, or ≥19px bold) and for UI components.

| Pair | Ratio | Verdict |
| --- | --- | --- |
| `--clay-700` on `--paper` | 10.19 | ✅ body text |
| `--clay-500` on `--paper` | 7.03 | ✅ |
| `--text-muted` `#6B5A4D` on `--paper` | 5.85 | ✅ |
| `--clay-300` on `--paper` | 3.33 | ⚠️ borders, decoration, large text — **never body copy** |
| **`--accent` on `--paper`** | **3.94** | ❌ **fails normal text.** Fills, indicators, large text only |
| **`--paper` on `--accent`** | **3.94** | ❌ **fails** — so the primary CTA label fails at 16px |
| `--paper` on `--accent-ink` `#B44D2B` | 4.63 | ✅ **use this for the CTA fill** |
| `--accent-ink` on `--paper` | 4.63 | ✅ accent-coloured text |
| `--ok` on `--paper` | 5.30 | ✅ |
| `--err` on `--paper` | 6.04 | ✅ |
| `--warn` on `--paper` | 3.00 | ❌ non-text only → `--warn-ink` `#876220` = 4.92 ✅ |
| `--accent` on `--clay-900` | 3.69 | ❌ dark mode → `#CF6F4E` = 4.70 ✅ |
| `--paper` on `--clay-900` | 14.53 | ✅ |

This is the one real problem the brief's palette has, and it lands on the most
important element: **a `--accent` button with 16px paper text is 3.94:1 and
fails AA.** The fix costs nothing visually — `--accent-ink` `#B44D2B` is the
same orange two steps darker. Proposal: `--accent` stays the brand colour for
fills behind large type, live indicators, the progress bar and 3D highlights;
`--accent-ink` carries anything that is text or needs to pass as text. Tell me
if you would rather keep `#C6552F` everywhere and accept the AA failure.

**Typography.** `Inter Tight` (UI) ships Cyrillic. Of the three display serifs
you listed, **`Cormorant` is the only one with Cyrillic** — `Fraunces` and
`Instrument Serif` are Latin / Latin-ext / Vietnamese only, so a Russian
headline in either would fall back to a different font mid-page. My
recommendation is therefore `Cormorant` (or `Literata` / `Playfair Display` if
you want more weight). The Uzbek `oʻ gʻ` modifier letter (U+02BB) has patchy
coverage in display faces — I will verify it against the actual font files in
Step 2 and, if it is missing, either switch face or map to U+2018. Self-hosted
woff2, subset per script, preloaded, `font-display: swap`.

**Motion tokens** live in `design/motion.ts` as framer-motion variants so §3 is
declared once: `reveal`, `stagger`, `buttonWipe`, `cardHover`, `pageWipe`,
`logoDraw`. Custom cursor and parallax are disabled under 1024px and under
`prefers-reduced-motion`.

---

## 4. Dependencies to add

`react-router` · `framer-motion` · `@react-three/fiber` + `@react-three/drei` ·
`react-i18next` + `i18next` · `zod` · `zustand` · `lenis` · `typescript` +
`@types/*`.

TypeScript goes in as **`allowJs: true`, non-strict at first** — the frozen
`server/*.js` and `src/lib/api.js` stay JavaScript and keep working untouched.
New code is written in `.ts`/`.tsx`. No migration of frozen files, ever.

---

## 5. Taglines (§1 asked for 3 in each language)

| # | UZ | RU | EN |
| --- | --- | --- | --- |
| 1 | Xonangiz. 3D da. Hech narsa sotib olishdan oldin. | Ваша комната. В 3D. До того, как вы что-то купите. | Your room. In 3D. Before you buy anything. |
| 2 | Avval ko'ring — keyin sotib oling. | Сначала увидеть. Потом купить. | See it first. Then buy it. |
| 3 | Xonangizni suratga oling — yangisini ko'ring. | Сфотографируйте комнату — увидьте новую. | Photograph your room. Meet the new one. |

My pick: **#1** for the hero (it states the product and the promise in one line),
**#2** as the short form for the mobile dock and OG titles.

---

## 6. What Step 2 will produce, once you approve

A `/styleguide` route showing: the full token set in light and dark, the type
scale in all three languages, every button/input/card/chip state, the custom
cursor, each motion primitive triggered on demand, and the i18n switcher. One
page you can review before any product screen gets built.

---

## 7. Open questions — I need your answer on these

1. **Where does this deploy?** The brief says Vercel, but `/api/render` (30 s
   open connection, 30 MB body) and `/api/contact` (writes a local file) do not
   survive Vercel's serverless model. Either a persistent Node host, or we plan
   a job-queue rework as new code beside the frozen route.
2. **The logo — I don't have it.** §2 says the mark from
   `frame-space-taupe.vercel.app` stays exactly as it is, but this repo contains
   no logo file at all (no `public/`, no SVG; the landing just renders the word
   "FrameSpace" as text). Send me the SVG, or tell me to pull it off the live
   site — I can't animate a mark I haven't got.
3. **`--accent` at 3.94:1** — accept the fix (`--accent-ink` for text/CTA) or
   keep `#C6552F` everywhere and drop the AA claim in §11? See §3.

Taken as already decided from the brief, not re-asked: **B2C first.** Steps 2–9
ship before anything under `/business`; `/for-business` is a pitch page only.
