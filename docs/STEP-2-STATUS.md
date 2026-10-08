# Step 2 — Design system: what was built

Review it at **`/styleguide`** (`npm run dev`, then <http://localhost:5180/styleguide>).

The working product is untouched and still lives at **`/`**. Nothing was removed.

---

## Assumptions taken

Step 1 ended with three open questions. None of them blocked the design system,
so rather than stop, each was resolved with a default that is cheap to reverse.
Say the word on any of them and I will change it.

| Question | What I did | How to reverse |
| --- | --- | --- |
| `--accent` fails AA as text (3.94:1) | Added `--accent-ink` `#B44D2B` (4.63:1). `--accent` stays the brand colour for fills, indicators and large type; `--accent-ink` carries anything that reads as text, including every button label. Dark mode lifts the whole status set — `#C6552F` is only 3.69:1 on `--clay-900`. | One line in `tokens.css` |
| The logo does not exist in the repo | Built `src/ui/Logo.tsx` as a **placeholder** frame mark with the §3 draw-in animation, clearly commented as a stand-in. | Replace the two `<rect>` elements, keep the `pathLength` props |
| Deployment target | Not touched — it does not affect the design system. Still open before step 4. | — |

Two more calls made while building:

- **Display face is `Cormorant Garamond`, not Fraunces.** Of the three serifs in
  the brief, it is the only one that ships Cyrillic; a Russian headline in
  Fraunces or Instrument Serif would fall back mid-page. `Inter Tight` sits
  second in the stack so the Uzbek `oʻ / gʻ` (U+02BB) still renders if the serif
  lacks it. **Please check those two lines on the live styleguide** — section 03
  prints all three scripts side by side for exactly this reason.
- **Fonts load from Google Fonts for now.** They get self-hosted and subset per
  script before the Lighthouse pass in step 3.

## Files added

```
tsconfig.json                     allowJs, non-strict — frozen .js keeps working
src/design/tokens.css             all tokens, light + dark + [data-surface=inverse]
src/design/base.css               base layer, 12-col grid, type classes, skeletons
src/design/components.css         button/chip/field/card/nav/cursor/dimension/before-after
src/design/motion.ts              §3 as framer-motion variants, reduced-motion safe
src/design/theme.ts               the same tokens typed, + a WCAG contrast function
src/i18n/config.ts + locales/{uz,ru,en}.json
src/store/prefs.ts                zustand: lang, currency (UZS default), theme
src/ui/{Button,Field,Card,Chip,Reveal,Cursor,DimensionLine,Logo,BeforeAfter,Skeleton}.tsx
src/pages/Styleguide.tsx          the review page
src/router.tsx  src/main.tsx      react-router, lazy routes, page transitions
src/lib/cn.ts
```

## Files changed (none frozen)

- `index.html` — new entry (`main.tsx`), font links, `lang="uz-Latn-UZ"`, light `theme-color`.
- `vite.config.js` — added `resolve.alias` for `@` and `@contract`. **The
  `server.proxy['/api']` block was not touched.**
- `src/index.css` — moved the dark `body` surface into `.legacy-root`. Needed
  because unlayered CSS beats layered CSS, so the old `body` rule would have
  overridden the entire new token layer. The legacy screens keep every class
  they use and still render on their dark surface.
- `src/main.jsx` — deleted, replaced by `src/main.tsx`.

Frozen files touched: **none.**

## Verification

| Check | Result |
| --- | --- |
| `tsc --noEmit` | clean |
| `vite build` | clean — 3D stays split out (`Panorama` chunk, 493 kB, loaded on demand) |
| Every module transforms in dev | 200, no transform errors |
| Styleguide server-renders | renders, 31.5 kB of HTML, all 10 primitives present, Uzbek by default |
| Legacy app still renders | renders, all legacy classes intact |

**Not verified visually.** The Chrome extension available here refuses to
capture `localhost`, so I could not take screenshots. The checks above prove it
builds, type-checks and renders without throwing — they do not prove it *looks*
right. That part needs your eyes on `/styleguide`.

## What section 02 of the styleguide shows

The contrast audit computes every ratio live from `theme.ts` rather than quoting
numbers, so the table cannot drift from the tokens. Current verdicts on
`--paper`: `clay-900` 14.53, `clay-700` 10.19, `clay-500` 7.03, `accent-ink`
4.63, `err` 6.04, `ok` 5.30, `warn-ink` 4.92 — all pass. `clay-300` 3.33 and
`accent` 3.94 are marked large-text-only; `warn` 3.00 is marked fail for text.
