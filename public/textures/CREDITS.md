# PBR surfaces — credits and licence

Every texture set here is from **Poly Haven** (https://polyhaven.com) and is
released under **CC0 1.0 Universal** (public domain dedication): free for
commercial use, no attribution required. We credit the authors anyway.

| Folder               | Poly Haven asset      | Author(s)                              | Real size | Used for |
| -------------------- | --------------------- | -------------------------------------- | --------- | -------- |
| `floor-light-oak/`   | `laminate_floor_02`   | Dario Barresi, Charlotte Baglioni      | 1.70 m    | Minimal floor (and the builder default) |
| `floor-oak/`         | `oak_wood_planks`     | Dimitrios Savva                        | 1.20 m    | Japandi floor |
| `floor-walnut/`      | `wood_floor`          | Dimitrios Savva                        | 1.70 m    | Modern Uzbek floor |
| `floor-herringbone/` | `herringbone_parquet` | Jenelle van Heerden, Sergej Majboroda  | 3.40 m    | Classic floor |
| `plaster/`           | `white_stucco`        | Amal Kumar                             | 2.00 m    | Walls, ceiling, painted wainscot |
| `veneer-oak/`        | `oak_veneer_01`       | Jenelle van Heerden                    | 1.83 m    | Window frames, stools, casings, doors |

Source pages: `https://polyhaven.com/a/<asset>` ·
Licence: https://creativecommons.org/publicdomain/zero/1.0/ ·
https://polyhaven.com/license

## Files and how they were made

From Poly Haven's 2k (floors) or 1k PNG/JPG maps:

- `color-<size>.webp` — **tint-ready detail map**, not the original albedo.
  Each channel is divided by its own linear mean and rescaled so the 99.5th
  percentile fits 8 bits (that scale is the `gain` in
  `src/three/environment/catalog.ts`; the shader divides it back out). The
  room palette's colour therefore still decides the hue — someone choosing
  Japandi sees the Japandi palette — while the boards keep their real grain,
  knots and plank-to-plank variation.
- `normal-<size>.webp` — OpenGL-convention normal map (Poly Haven `nor_gl`).
- `arm-1024.webp` — AO (R), roughness (G), metalness (B), Poly Haven `arm`.

Floors ship at 2048 (high-tier devices) and 1024 (low tier); everything else
at 1024. Total ≈ 6.2 MB on disk; a room downloads one floor set plus plaster
and veneer (≈ 1.1–2.3 MB) after first paint.

UVs are generated in world metres in the shader, so `Real size` above is the
on-screen size of one texture tile: planks are as wide as real planks.
