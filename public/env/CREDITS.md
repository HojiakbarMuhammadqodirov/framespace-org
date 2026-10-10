# Outdoor environments — credits and licence

All three skies are from **Poly Haven** (https://polyhaven.com) and are released
under **CC0 1.0 Universal** (public domain dedication): free for commercial use,
no attribution required. We credit them anyway.

| Folder   | Poly Haven asset   | Author(s)       | Source page                                   | Used for                          |
| -------- | ------------------ | --------------- | --------------------------------------------- | --------------------------------- |
| `day/`   | `suburban_garden`  | Dimitrios Savva (photography), Jarod Guest (processing) | https://polyhaven.com/a/suburban_garden | Hero room; builder morning/afternoon |
| `golden/`| `sunny_vondelpark` | Greg Zaal       | https://polyhaven.com/a/sunny_vondelpark      | Builder "evening" preset          |
| `dusk/`  | `twilight_sunset`  | Dimitrios Savva (photography), Jarod Guest (processing) | https://polyhaven.com/a/twilight_sunset | Builder "lamps only" preset |

Licence text: https://creativecommons.org/publicdomain/zero/1.0/ —
Poly Haven licence page: https://polyhaven.com/license

## What is in each folder (derived files, made from the 4k `.hdr`)

| File          | What it is                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| `bg-4k.webp`  | 4096×2048 equirect, ACES-tonemapped, sun kept. The view through windows (high tier). |
| `bg-2k.webp`  | 2048×1024 version of the same, for low-tier devices.                        |
| `env-1k.hdr`  | 1024×512 linear RGBE for image-based light (high tier). The sun is clamped out (the scene's shadow-casting directional light is the sun) and colour is partly desaturated — ground more than sky — because light reaching a room has bounced off its walls first. |
| `env-512.hdr` | 512×256 version of the same, for low-tier devices.                          |

Sizes: day 0.9 + 0.3 + 1.6 + 0.4 MB, golden 2.3 + 0.7 + 1.9 + 0.5 MB,
dusk 0.3 + 0.1 + 1.6 + 0.4 MB. A visitor downloads one backdrop and one HDR
for the sky in view, lazily, after first paint.

Measured sun directions (three.js equirect convention, radians, before
rotation) live in `src/three/environment/catalog.ts`.
