# HexWorld — Agent Instructions (CLAUDE.md)

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

## Invariants — do not break

**Full text and the citation rule: `.claude/REQUIREMENTS.md`.** That file is the
single source; this is the index. Every one of these must be cited by a test as
`// INV-n`, and `./scripts/gate.sh` fails the node when it is not.

| | Invariant |
|---|---|
| `INV-1` | `src/core.js` stays pure and dual-environment (no DOM/Pixi/IO, injected `mulberry32` only) |
| `INV-2` | Every `src/procgen/` module is likewise pure; randomness only via seed-salted substreams |
| `INV-3` | Determinism + RNG draw-order discipline — same inputs ⇒ byte-identical world |
| `INV-4` | Identity defaults, three layers: Earth byte-preserved, dial defaults ≡ omission, terran ≡ identity |
| `INV-5` | Hex-layout invariance across Node 1/7/19 — grouping changes, membership does not |
| `INV-6` | Raw vs facade layering — `generateProcedural` stays raw; themes/validation/retry live in `generateWorld` |
| `INV-7` | `characterOverride` is climate-only and terrain-invariant |
| `INV-8` | `PALETTE` in `biomes.js` is the single source; themes never invent a biome id |
| `INV-9` | The deliverable is one self-contained `index.html`, ≤ 1.3MB, no runtime requests |
| `INV-10` | Antarctica is unplayable in Earth mode |

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
