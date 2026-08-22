# HexWorld v2 — Requirements

**Requirements are decided and fixed.** Changing one is an explicit decision.
Undecided items belong in `OPEN_QUESTIONS.md`.

---

## Invariants

**These are the properties that must hold after every future change.** They are
the contract every role builds against: Minerva declares them, the coders build
to them, Vesta cannot refactor through one, Mars attacks them, Apollo pins each
with a test, Fama publishes them.

**Citation is mandatory and machine-checked.** Every invariant must be cited by
at least one test file, as a comment carrying its `INV-n` tag:

```js
// INV-3 — same (mode, seed, sizeKey, clusterR, dials, theme) ⇒ byte-identical world
test('procedural generation is deterministic for a fixed seed', () => { … });
```

`./scripts/gate.sh --node N-00X` greps `test/` for each `INV-n` the node
declares and **fails** when it finds none. An uncited invariant is a comment,
not a guarantee — this is the hole found on 2026-08-18, when 119 tests were
green and all ten invariants below were pinned by exactly zero of them.

---

### INV-1 — `src/core.js` stays pure and dual-environment
No DOM, no Pixi, no I/O, no `Date.now()`/`Math.random()`. All randomness flows
through the injected `mulberry32(seed)`. It must keep working both as a browser
global (`HexWorldCore`) and via node `require()` (UMD wrapper).

### INV-2 — every `src/procgen/` module is likewise pure
UMD-lite, zero-dep, no DOM/I/O. All procgen randomness comes from `mulberry32`
**substreams salted off the world seed** (`N.substream(seed, "name")` /
positional hashes) — never from a shared sequential stream, never from
`Math.random()`. Climate and the ICM refine pass draw NO randomness at all.

### INV-3 — determinism + RNG draw-order discipline
Same `(mode, seed, sizeKey, clusterR, dials, theme)` ⇒ byte-identical world.
`generateProcedural` replicates `core.generate`'s five main-stream draws in the
same order so the hex lattice matches Earth mode at the same seed — preserve
that draw order; noise/tectonics/hydrology randomness never touches the main
stream. Rendering reads generated state; it never adds randomness.

### INV-4 — identity defaults, three layers (all regression-pinned)
(a) Earth mode is byte-preserved — seed 1 medium ⇒ `totalLand === 1828`;
(b) every procedural dial's default value ≡ omitting the option entirely;
(c) the **terran theme is the identity** — `generateWorld` with terran is
byte-identical to pre-theme `generateProcedural`, and `res.seed` stays
USER-space (`themeSeed` hashes per-theme universes; it never draws).

### INV-5 — hex-layout invariance across node modes
Toggling Node 1/7/19 must not change which hexes exist — only their grouping.
(That's why `generate()` draws the cluster lattice-shift RNG values on every
call, even when `clusterR` is 0. Preserve that draw order.)

### INV-6 — raw vs facade layering
`generateProcedural` stays RAW and theme-less; themes, validation, and the
seed+1 retry live only in the `generateWorld` facade (`opts.predicate` is the
test seam). Engine tests target the raw layer; the app calls the facade.

### INV-7 — `characterOverride` is a climate-only lever
Landmass-level and terrain-invariant. It must NEVER change elevation/terrain;
the A/B contract tests depend on that (site-level per-continent forcing would
change relief and break them).

### INV-8 — `PALETTE` in `biomes.js` is the single source
For map fills, the legend, and the inspector. Themes may relabel/recolor
EXISTING ids (Dune's lake → "Oasis") — never invent a new biome id in a theme:
widening the enum ripples into every test that partitions on it.

### INV-9 — the deliverable is one self-contained `index.html`
No external requests at runtime. Anything new gets inlined by `tools/build.mjs`
(`PROCGEN_ORDER` there is dependency order — keep it). Budget ≤ 1.3MB.

### INV-10 — Antarctica is unplayable in Earth mode
`UNPLAYABLE_CONTINENTS` in core: rendered muted, excluded from interaction and
playable stats.
