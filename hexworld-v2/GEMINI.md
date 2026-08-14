# HexWorld — Agent Instructions (GEMINI.md)

You are working on **HexWorld**, a self-contained hex world map demo (PixiJS)
with two generators: **Earth mode** (real country borders) and **Procedural
mode** (the v2 geologic engine). Read this file fully before changing
anything. `README.md` covers the human-facing overview; this file covers how
to work on it safely.

## Orientation (read in this order)

1. `README.md` — what the demo is, controls, the architecture map.
2. `docs/DESIGN-SPEC.md` — the approved design: the v2 geologic engine up
   front, the v1 Earth-demo spec as an appendix.
3. `docs/v2-spec.html` — the illustrated v2 spec + the per-milestone build
   log (open it in a browser; it records what landed in M1–M6 and why).
4. `src/core.js` — the pure lattice/Earth core. Then `src/procgen/worldgen.js`
   — the pipeline facade; it orchestrates every other procgen module.
5. `docs/IMPLEMENTATION-PLAN.md` — the v1 TDD plan (historical). Executing it
   task-by-task rebuilds the **Earth demo only**, not the v2 engine.

## Invariants — do not break

1. **`src/core.js` stays pure and dual-environment.** No DOM, no Pixi, no I/O,
   no `Date.now()`/`Math.random()`. All randomness flows through the injected
   `mulberry32(seed)`. It must keep working both as a browser global
   (`HexWorldCore`) and via node `require()` (UMD wrapper).
2. **Every `src/procgen/` module is likewise pure** (UMD-lite, zero-dep, no
   DOM/I/O). All procgen randomness comes from `mulberry32` **substreams
   salted off the world seed** (`N.substream(seed, "name")` / positional
   hashes) — never from a shared sequential stream, never from
   `Math.random()`. Climate and the ICM refine pass draw NO randomness at all.
3. **Determinism + RNG draw-order discipline.** Same
   `(mode, seed, sizeKey, clusterR, dials, theme)` ⇒ byte-identical world.
   `generateProcedural` replicates `core.generate`'s five main-stream draws in
   the same order so the hex lattice matches Earth mode at the same seed —
   preserve that draw order; noise/tectonics/hydrology randomness never
   touches the main stream. Rendering reads generated state; it never adds
   randomness.
4. **Identity defaults, three layers (all regression-pinned):**
   (a) Earth mode is byte-preserved — seed 1 medium ⇒ `totalLand === 1828`;
   (b) every procedural dial's default value ≡ omitting the option entirely;
   (c) the **terran theme is the identity** — `generateWorld` with terran is
   byte-identical to pre-theme `generateProcedural`, and `res.seed` stays
   USER-space (`themeSeed` hashes per-theme universes; it never draws).
5. **Hex-layout invariance across node modes.** Toggling Node 1/7/19 must not
   change which hexes exist — only their grouping. (That's why `generate()`
   draws the cluster lattice-shift RNG values on every call, even when
   `clusterR` is 0. Preserve that draw order.)
6. **Raw vs facade layering.** `generateProcedural` stays RAW and theme-less;
   themes, validation, and the seed+1 retry live only in the `generateWorld`
   facade (`opts.predicate` is the test seam). Engine tests target the raw
   layer; the app calls the facade.
7. **`characterOverride` is a climate-only lever** — landmass-level and
   terrain-invariant. It must NEVER change elevation/terrain; the A/B
   contract tests depend on that (site-level per-continent forcing would
   change relief and break them).
8. **`PALETTE` in `biomes.js` is the single source** for map fills, the
   legend, and the inspector. Themes may relabel/recolor EXISTING ids
   (Dune's lake → "Oasis") — never invent a new biome id in a theme:
   widening the enum ripples into every test that partitions on it.
9. **The deliverable is one self-contained `index.html`** — no external
   requests at runtime. Anything new gets inlined by `tools/build.mjs`
   (`PROCGEN_ORDER` there is dependency order — keep it). Budget ≤ 1.3MB.
10. **Antarctica is unplayable** in Earth mode (`UNPLAYABLE_CONTINENTS` in
    core): rendered muted, excluded from interaction and playable stats.

## Workflow — TDD, in this order

```bash
node --test            # MUST be green before AND after your change (119 tests, 9 suites)
                       # NOTE: plain `node --test`; `node --test test/` breaks on Node 24
node tools/build.mjs   # rebuild index.html (only after tests are green)
```

- New core/procgen behavior ⇒ write a failing test FIRST (plain `node:test` +
  `assert`, CommonJS `.cjs` in `test/`), then implement to green.
- `src/world-data.js` is generated — never hand-edit; re-bake with
  `node tools/bake-data.mjs` (needs network) if you must change the data
  shape, and keep `test/data.test.cjs` green.
- UI/rendering changes have no unit harness — verify in a real browser
  (see below), and keep the browser console error-free.

## Browser verification (headless)

Serve the folder (`npx serve .` or any static server, or just open
`index.html` via `file://`) and drive it with Playwright/Puppeteer headless
Chromium. The page exposes a test hook:

```js
window.__hexworld
// getters: res, seed, sizeKey, nodeR, mode, oceanPct, continents, warp,
//          minLake, theme, advOpen, mountain, rainMult, arid, riverPct,
//          riverCheat, seaOffset, view: {x, y, s}
// Earth res:  { hexes: Map, countryCounts, continentCounts, totalLand, unplayable, clusters, geom, seed }
// Proc res adds: palette, biomeCounts, riverCount, fragments, rejections,
//                requestedSeed, theme; hexes carry fragmentId + margin
```

Recipe: wait for `#stats` to contain "land hexes", assert zero console
errors, then assert on `__hexworld.res`. **Always check the Earth-mode
regression first:** seed 1 medium ⇒ `totalLand === 1828` (coarse ≈ 531,
fine ≈ 5,931). Then click `button[data-mode="proc"]` and wait on
`!!window.__hexworld.res.fragments` for a generated procedural world.
Procedural cell counts (every cell is data, ocean included): coarse ≈ 2.0k,
medium ≈ 7.1k, fine ≈ 22.7k; a fine full regen is ≈ 0.5s in Node, ~1.3s wall
in-browser including the ~80ms slider debounce.

Driving the UI:

- Sliders: set `.value` and dispatch an `input` event via `page.evaluate` —
  works at every breakpoint (no visibility needed). Main bar: `seedSlider`,
  `oceanSlider`, `continentSlider`; Advanced drawer (`#advToggle` →
  `#advanced`): `warpSlider`, `minLakeSlider`, `mountainSlider`,
  `rainSlider`, `aridSlider`, `riverSlider`, `honestSlider`, `seaSlider`.
- Themes: `page.selectOption("#themeSel", "dune")`, wait on
  `__hexworld.res.theme === "dune"`. A theme switch RE-SEATS every dial to
  its envelope (by design).
- The responsive UI changes the click flow: ≤600px, controls/legend live in
  bottom sheets — `#btnWorld` / `#btnLegend` open them first (a map tap
  closes them; that's shipped behavior). 601–900px, the controls card boots
  collapsed to a pill — `#controlsToggle` expands it. Real clicks on hidden
  controls time out.
- GOTCHA: `page.evaluate("() => x")` treats the string as a plain EXPRESSION
  (the arrow is never invoked) — pass expression strings like
  `"!!window.__hexworld.res.fragments"`.

If headless Chromium is missing system libs (libnspr4/libnss3) and you lack
root: `apt-get download libnspr4 libnss3`, extract with `dpkg -x`, and run
node with `LD_LIBRARY_PATH` pointing at the extracted lib dir.

## Deliberately not done (YAGNI — needs a new approved spec, not a rainy day)

Spherical/Robinson projection, erosion simulation, seasonal climate, Web
Worker generation, wave-function-collapse detailing, sim/game coupling.

## Gotchas learned the hard way

- `node --test test/` (trailing-slash dir) fails on Node 24 — use `node --test`.
- Pixi Graphics: batch strokes (build the whole path, stroke once) and fill
  per-biome/per-country (one fill flush each) or fine mode crawls.
- Hit-testing is math (`pixelToCell`), NOT per-hex interactive display
  objects — do not add thousands of event targets.
- `</script>` inside inlined JS would terminate the script tag —
  `tools/build.mjs` escapes it; keep using `inject()` for new inlines.
- **Dials upstream of max-normalization can act ANTI-monotone** — a bigger
  amplitude raises the max and pushes everyone else down (the Mountains dial
  had to become an exponent on the already-normalized value). Same family: a
  monotone transform applied on both sides of a percentile cut is provably
  INERT — check every new dial's mechanism survives the downstream
  aggregation before shipping it.
- **Never domain-warp a partition.** Wiggling a Voronoi INPUT point shears
  the partition and pinches guard bands to zero; wiggle the SIGNED DISTANCE
  antisymmetrically instead (that's how the rift cracks meander while
  staying conjugate).
- **Widening an enum ripples.** Adding a water/biome kind touches every test
  that partitions on the old set — grep the partition predicate first and
  declare the amendments up front.
- **Kind-independent culls only.** The lake speck cull keys on terrain-derived
  footprints, never on rainfall-driven kinds — a kind-branch there made the
  water partition climate-dependent and broke terrain invariance (a contract
  test caught it).
- **Sinks must drain.** Scaling a deposit/extraction RATE conserves the
  integral and just moves it downstream — the desert belt only formed once
  subsidence genuinely REMOVED column moisture.
