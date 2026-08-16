# HexWorld — Hex World Map Lab

An interactive hex world map in a **single self-contained HTML file**, with two
generators behind one UI toggle:

- **Earth mode** — the original demo: Earth's land masses populated with
  selectable hexes, each owned by a real country (Natural Earth borders), with
  a seed system so coastlines and per-country hex counts differ per seed.
- **Procedural mode** (v2, Milestones 1–6) — a geologically plausible world
  from a seed: **supercontinent-breakup tectonics** (conjugate rift coastlines
  that visibly fit; active margins with mountain arcs, offshore trenches, and
  volcanic biomes; passive margins with pale shelf seas), signed elevation with
  a true percentile **sea level**, a wind-ordered **climate** with emergent
  rain shadows and desert belts, **rivers** that flow along hex edges from
  sources to real coastal mouths (or die honestly in endorheic salt lakes and
  salt flats), a Whittaker **biome** table polished by an MRF relaxation pass,
  hard **seed rejection** with surfaced reasons, and **six world themes**.

**Zero install to run:** open `index.html` in any modern browser. Everything
(PixiJS, world data, all generator code) is inlined — no network requests at
runtime. Current build ≈ 1.02MB (budget ≤ 1.3MB).

## Controls

| Control | What it does |
|---|---|
| Earth / Procedural | Mode toggle. Earth mode is byte-preserved from the original demo; same seed ⇒ same hex lattice in both modes |
| Seed slider (1–10) + custom input | Same seed always reproduces the same world; in procedural mode a rejected seed silently retries seed+1 and the stats bar says why |
| Theme (procedural) | Terran (Earthlike identity default) / Pangaea / Shattered Archipelago / Dune / Glacial / Primordial — each is a dial envelope + whole-world climate character + palette re-skin + its own acceptance rules, in its own hashed seed universe. Picking a theme re-seats the dials; any dial you touch afterwards wins |
| Ocean % (procedural) | Exact land fraction via a quantile sea level — delivered on every seed |
| Continents 1–7 (procedural) | Literally the tectonic fragment count. At 5+ the crowded chain snaps to a drift-less even fill — young-rift worlds with no active margins (so no volcanic biome there, by construction) |
| Advanced drawer (procedural) | Warp 0–150 (round blobs → craggy fjords; past 110 continents may merge — the deliberate Pangaea zone), Min lake 1–8, Mountains (vertical exaggeration), Rainfall ×, Aridity 0–200% (desert-belt strength + dry-character intensity — 0 gives lush island-jungle worlds, rain-shadow deserts stay), River density, River honesty (width curve), Sea level fine offset |
| Coarse / Medium / Fine | Resolution. Earth: ~530 / ~1,830 / ~5,930 playable land hexes. Procedural: ~2.0k / ~7.1k / ~22.7k cells — every cell is real data, ocean included |
| Node: 1 hex / 7 / 19 | Selection granularity: single hexes or clusters of ~7 / ~19; never changes which hexes exist |
| Hover / click | Highlight + tooltip / select + inspector panel (biome, °C, rainfall, river flux, fragment + margin in procedural mode) |
| Drag / wheel / pinch | Pan and zoom (touch supported) |

The legend is generated from the same palette that fills the map, so it always
matches. The UI is responsive down to 340px-wide screens: phones get a
full-bleed map with a bottom bar and bottom-sheet controls/legend; foldables
collapse the cards to pills; touch targets are 44px+.

Antarctica (Earth mode) renders as a muted silhouette and is not interactive.

## Development

Requires Node ≥ 20 (built on Node 24). No npm dependencies to install.

```bash
node --test               # 119 tests across 9 suites  [NOT `node --test test/` — breaks on Node 24]
node tools/build.mjs      # rebuild index.html from src/ (prints the size — keep it ≤ 1.3MB)
node tools/bake-data.mjs  # re-bake Earth-mode country data (network; output already committed)
```

## Architecture

```
src/core.js            Pure lattice + Earth-mode core (UMD: browser global HexWorldCore
                       + node module). Seeded RNG (mulberry32), equirectangular
                       projection (1800×850, ±85° lat), point-in-polygon country
                       assignment, pointy-top odd-r hex math, cluster sublattice
                       (det 7/19) node assignment. No DOM, no I/O — node-testable.
src/world-data.js      GENERATED — 177 countries {n,c,p:[{b:bbox,r:[flat rings]}]}, ~147KB.
src/procgen/           The v2 geologic engine — every module UMD-lite, pure, zero-dep,
                       seeded (no Math.random / Date.now anywhere):
  noise.js             mulberry32 substreams, simplex/fBm sampled on the map cylinder, fnv hash
  tectonics.js         supercontinent breakup: fragment chain, shared meandering rift
                       cracks (conjugate coasts), drift + rotation, active/passive margins,
                       ridge/trench/shelf shaping; continent characters live here
  climate.js           temperature (insolation − lapse) + rainfall (wind-belt moisture
                       advection with orographic uplift and subsidence drain)
  hydrology.js         corner-junction graph, priority-flood, flux accumulation,
                       rivers / open + salt lakes / salt flats, snowcaps
  biomes.js            Whittaker table (11 biomes) + water/surface/margin bands —
                       the single PALETTE source for fills, legend, and inspector
  refine.js            biome-boundary dither + Potts/MRF ICM polish (climate-anchored)
  validate.js          quality floors + per-theme predicates; seed+1 retry, reasons surfaced
  themes.js            six theme bundles; terran is the byte-identical identity;
                       hashed per-theme seed universes
  worldgen.js          the pipeline facade: generateProcedural (raw, theme-less) and
                       generateWorld (themes + validation) — the app calls the latter
src/app.js             Browser app: PixiJS rendering (batched fills/strokes), math-based
                       hit-testing, pan/zoom/pinch, DOM overlay UI, mode switch.
src/template.html      Page skeleton + CSS + injection tokens.
tools/build.mjs        Inlines pixi + data + core + procgen + app into index.html.
test/                  node:test suites (run before every build).
docs/                  DESIGN-SPEC.md (current spec), v2-spec.html (the illustrated
                       v2 spec + per-milestone build log).
CLAUDE.md              Agent-facing instructions (auto-loaded by Claude Code).
```

Key invariants (the full list lives in `CLAUDE.md`): the world is
**deterministic** — `(mode, seed, size, node mode, dials, theme)` fully
determines the map; Earth mode and every procedural default are byte-preserved;
toggling node mode never changes the hex layout.

## Credits & licenses

- Country borders: [Natural Earth](https://www.naturalearthdata.com/) 110m admin-0 (public domain).
- Rendering: [PixiJS](https://pixijs.com/) v8 (MIT), vendored in `vendor/pixi.min.js`.
- Built with Claude Code — design specs, TDD implementation plans, and the
  per-milestone build log are under `docs/`.
