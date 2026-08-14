> *Copied from the original monorepo; host-specific hosting details have been generalized. Deploy the folder on any static host.*

# HexWorld — Design Spec

**Status:** v2 geologic engine **built and shipped** (Milestones 1–6, 2026-08-04);
v1 Earth demo preserved as Appendix A (it still specifies Earth mode).
**Type:** Standalone visual demo — one self-contained `index.html`, not coupled
to any game engine.

The authoritative, illustrated v2 spec — including the original design
conversation, the Q&A that locked each decision, and the per-milestone build
log — is **`v2-spec.html`** (open it in a browser). This file is the compact
engineering summary.

## Goal (v2)

Move from "which country polygon is this hex in" / Gaussian-blob continents to
a **geologically plausible procedural world**: real elevation with a true sea
level, climate with rain shadows, rivers that flow from sources to mouths (or
die honestly in deserts), biomes, themes, and a legend — deterministic per
seed, with no unusable seeds surfacing to the user.

## The pipeline (as built)

Each stage is a pure, seeded module under `src/procgen/`; `worldgen.js` is the
facade. Order: tectonics → elevation/sea → climate → hydrology → biomes →
refine → validate → themes.

1. **Tectonics (M6)** — worlds are made by **supercontinent breakup**: one
   landmass grows in pre-drift "plate space" as a chain of per-fragment equal
   Gaussians, cracks along a shared meandering rift network (both sides of a
   rift are cut by the same crack curve ⇒ **conjugate coastlines** that
   visibly fit), and the fragments drift apart on the wrapped map, drift
   budgeted by the wrap gap. Fragments carry plate anatomy: **leading edges
   are active margins** (coastal mountain arc + offshore trench) and trailing
   edges are **passive margins** (wide shallow shelf seas). The Continents
   slider (1–7) is literally the fragment count; at 5+ the crowded chain
   snaps to a drift-less even fill. Hexes carry `fragmentId` + `margin`;
   per-fragment **characters** (Alpine/Frozen/Arid/Temperate/Lush/Plains)
   scale relief and offset climate.
2. **Elevation + sea level (M1)** — signed elevation = tectonic crust +
   fBm mass/detail (detail amplitude rides the crust), domain-warped
   (Warp dial 0–150; past 110 continents may merge — the deliberate Pangaea
   zone), polar fade. **Sea level is a true quantile zero**: the Ocean %
   dial delivers the exact land fraction on every seed. Speck islands sink;
   landmasses are labeled by flood-fill.
3. **Climate (M2/M2.5)** — temperature = latitude insolation − mountain lapse
   (+ character offset). Rainfall from a wind-ordered moisture sweep in
   3-cell latitude belts (trades/westerlies/polar easterlies): parcels
   evaporate over ocean, rain out over land, dump on windward slopes with a
   60/40 leeward carry (orographic uplift only above a bump threshold —
   sub-range roughness must not bleed parcels dry), and **descending air
   genuinely drains column moisture** (scaling the deposit rate alone
   conserves total rain-out — the desert belt requires a true sink). A
   sea-breeze pass moistens ring-1/ring-2 coastal land. Rain shadows and
   ~28° desert belts are emergent, not painted. The **Aridity dial** (0–2,
   default 1) scales both belt terms (deposit suppression AND the column
   drain) plus dry-character intensity (`moist<1 → moist^arid`): 0 erases
   the horse-latitude deserts and neutralizes Arid landmasses (island-jungle
   worlds), 2 deepens both; rain-shadow deserts remain — they're earned.
4. **Hydrology (M3)** — rivers flow along hex **edges**: every grid vertex is
   a corner junction (each link is one hex edge, so mouths land exactly on
   the coastline). Priority-flood finds the water surface; each junction gets
   one seeded downhill outflow; the rainfall field accumulates as flux down
   the chains. The top flux slice becomes rivers, **width ∝ √flux**. Closed
   basins run an evaporation check: open lake, endorheic **salt lake**, or
   dry **salt flat** (starved basins cut their throughput downstream). Lakes
   leave the land ledger; cold high peaks get snowcaps.
5. **Biomes (M2)** — land is labeled by a Whittaker-style table over
   (temperature, rainfall): 11 biomes from ice cap through desert to tropical
   rainforest, plus alpine above the treeline, with a nearest-center fallback
   and maritime coastal moderation. Water/surface/margin bands (deep/ocean/
   shelf, lake/salt flat, **volcanic** at high active margins — M6) plus the
   biomes form the single `PALETTE` that drives fills, legend, and inspector.
6. **Refine (M4)** — biome boundaries are dithered (positional jitter on
   (t, r) before classification), then a **Potts/MRF ICM relaxation** over a
   designer-editable biome-affinity matrix absorbs speckle and buffers
   climate whiplash; a climate-fit anchor keeps rain shadows intact
   (regression-tested). Ice/alpine/water/volcanic are frozen.
7. **Validate (M4)** — every world must pass quality floors (river mouths,
   distinct biomes, requested continents present — the landmass check stands
   down in the Pangaea warp zone); a failing seed retries seed+1 (≤4 tries)
   and the stats bar reports exactly why. Themes may override floors and add
   their own declarative checks.
8. **Themes (M5)** — six bundles: Terran (the **byte-identical identity**),
   Pangaea, Shattered Archipelago, Dune, Glacial, Primordial (a just-broken
   3-fragment world, leading edges volcanic). A theme = dial envelope +
   whole-world climate character + palette re-skin (existing ids only) + its
   own acceptance predicate, in its own hashed seed universe (`res.seed`
   stays user-space). User-touched dials always beat the envelope.

## UI (as built)

Main bar: Earth|Procedural mode toggle, Theme select, Seed (slider 1–10 +
free input), Ocean %, Continents 1–7, size (Coarse/Medium/Fine ≈ 2.0k/7.1k/
22.7k procedural cells), Node 1/7/19. **Advanced drawer:** Warp, Min lake
(1–8 — basins smaller than the dial never pool), Mountains (vertical
exaggeration exponent — raw amplitude is eaten by normalization), Rainfall ×,
Aridity (belt + dry-character strength), River density, River honesty (width
curve; selection is honest by construction), Sea level fine offset. Legend + stats strip (with rejection
reasons); hover tooltip + click inspector (biome, °C, rain, flux, fragment,
margin). Responsive to 340px: bottom bar + sheets on phones, collapsible
pills on foldables, 44px+ touch targets.

## Determinism contract

`(mode, seed, sizeKey, clusterR, dials, theme)` ⇒ byte-identical world. The
procedural generator replicates the Earth core's five main-stream RNG draws so
the hex lattice matches Earth mode at the same seed; all procgen randomness
comes from salted substreams or positional hashes. Identity defaults are
regression-pinned at three layers: Earth mode byte-preserved, every dial
default ≡ omitted, terran theme ≡ pre-theme output.

## Verification

119 node:test tests across 9 suites (`node --test` — plain, no dir arg on
Node 24), then `tools/build.mjs` (single-file build, budget ≤ 1.3MB), then
headless-browser checks via the `window.__hexworld` hook (see `GEMINI.md`
for getters, baselines, and the responsive click flow).

## Out of scope (YAGNI — parked without a new approved spec)

Spherical/Robinson projection, erosion simulation, seasonal climate, Web
Worker generation, wave-function-collapse detailing, game/sim coupling,
multiplayer/actions logic.

---

# Appendix A — v1 Earth Demo Spec (2026-08-03, historical; still specifies Earth mode)

**Status:** Approved by Art (design conversation, 2026-08-03); built via
`IMPLEMENTATION-PLAN.md` (which rebuilds the Earth demo only).

## Goal

A Civ5 "Yet (not) Another Earth"–style real-world hex map in the browser: the
Earth's land masses populated with individually hoverable/selectable hexes,
each assigned to a real country, with a tuneable seed system so hex counts and
coastlines differ per seed — demonstrating map-to-map variety.

## Deliverable

One **self-contained HTML file** (PixiJS 8 inlined, world data embedded — no
external requests), deployable on any static host.

## Data

- Source: Natural Earth **110m admin-0 countries** GeoJSON (fetched once at
  build time from the natural-earth-vector GitHub repo).
- Stripped/baked to `{name, continent, rings}` per country, coordinates
  quantized; ~147KB embedded. ~177 countries; the continent property drives
  grouping/stats.

## Generation model (runtime, in-browser)

- Equirectangular projection (plate carrée), latitude clipped to ~±85°.
- Civ5-style **pointy-top hexes, offset rows** over the projected map.
- A hex is a **land hex** iff its center lies inside a country polygon
  (point-in-polygon with per-country bounding-box prefilter); the hex inherits
  that country. Ocean cells are not drawn as tiles (flat ocean background).
- **Seed** (any integer) drives: grid origin offset (dx, dy up to one hex
  spacing) and ±8% hex-size jitter. Same resolution + different seed ⇒
  different coastline rasterization and different per-country hex counts.
- **Size control:** Coarse / Medium / Fine (~530 / ~1,830 / ~5,930 playable
  land hexes as built; regeneration < 1s at Fine).
- Rendering: hexes filled with a per-country color (seeded categorical
  palette); edges between different countries and coastline edges drawn
  darker, Civ-style; per-hex grid overlay.

## Iteration 2 (2026-08-03, Art's visual feedback)

- **Per-hex grid overlay** — every internal hex edge drawn (subtle dark line),
  so individual hexes are identifiable inside a country, not just at borders.
- **Antarctica unplayable** — rendered as a muted slate silhouette; excluded
  from hover/click/stats (`UNPLAYABLE_CONTINENTS` in core; hexes carry
  `playable`). Stats list it as "(unplayable)".
- **Node clustering** — "Node" control (1 hex / 7 / 19): playable hexes group
  into per-country nodes via nearest-center assignment on the cluster
  sublattice (basis u=(2R+1,−R), v=(R,R+1); det 7 / 19). Hover/select/actions
  target the whole node; node boundaries drawn as light internal lines; seed
  also shifts the cluster lattice. Hex layout is identical across node modes
  at the same seed.
- **Pinch-to-zoom** — two-pointer pinch (mobile) alongside wheel zoom;
  `touch-action: none` on the canvas.

## Alternatives considered

- **Pre-baked variants** (offline hex assignment for 10 seeds × 3 sizes,
  embedded JSON): rejected — bigger file, exactly 30 fixed maps, re-bake on
  every tuning change; runtime generation is fast enough (~15k point tests
  with bbox prefilter).
