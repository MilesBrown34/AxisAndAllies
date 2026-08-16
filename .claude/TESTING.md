# Axis And Allies Project — Testing & Validation

Coverage is split the same way the repo is:

| Tree | Coverage |
|---|---|
| `hexworld-v2/` | **Automated.** 9 suites, 119 tests, all passing. |
| Root game (`js/**`, `index.html`, `server.js`) | **Manual only.** No automated suite exists yet. |

---

## hexworld-v2 — automated suite

```bash
cd hexworld-v2
npm test                      # → 119 pass, 0 fail
```

`npm test` runs plain `node --test`. Equivalent direct forms:

```bash
node --test                   # what npm test runs
node --test "test/*.cjs"      # explicit glob, quoted
```

**Gotcha:** `node --test test/` (directory with a trailing slash) fails with
`MODULE_NOT_FOUND` on Node 24. Documented in `hexworld-v2/CLAUDE.md:136`.

The suite covers `src/procgen/` — `tectonics`, `climate`, `hydrology`, `biomes`,
`refine`, `themes`, `procgen`, `core`, `data`. It is a determinism harness as
much as a correctness one: several tests assert byte-for-byte reproducibility
per `(opts, seed, theme)`.

**It must be green before AND after any change under `hexworld-v2/src/`.** Run
it; it takes ~18s. The RNG and determinism invariants it protects are described
in `hexworld-v2/CLAUDE.md` — read that before touching generation code.

Note `hexworld-v2/index.html` and `hexworld-v2/src/world-data.js` are build
artifacts (`npm run build`, `npm run bake`). Never hand-edit them.

---

## Root game — manual regression checklist

These are the manual checks that should pass before a root-tree change is
considered done.

### Boot
- [ ] `node server.js` starts without error
- [ ] The page loads with no console errors
- [ ] Map renders with correct terrain textures

### Core loop
- [ ] A full turn can be completed end to end
- [ ] Unit movement respects territory adjacency
- [ ] Combat resolves and applies losses to `state.js` correctly
- [ ] Territory ownership updates after a successful attack

### Systems
- [ ] Politics system state advances without desyncing from `state.js`
- [ ] Doctrine effects apply and persist across turns
- [ ] Card effects resolve correctly

### World generation
- [ ] All 26 seeds in `js/data/mapData.js` receive hexes — no empty territory
- [ ] Land/sea coastlines still match the `earthMap` blueprint
      (`js/state.js:107-168`) after any edit to it
- [ ] Every char used in `earthMap` has an entry in `charToBiome`

### Data integrity
- [ ] Every territory in `js/data/mapData.js` has valid adjacency references
- [ ] Every unit referenced by game logic exists in `js/data/unitData.js`
- [ ] Every card in `js/data/cardData.js` has a handler

---

## Known high-risk areas

| Area | Why it's risky |
|---|---|
| `js/state.js` | Central model — combat, politics and doctrines all mutate it |
| `js/state.js:60-328` `generatePlanetMap()` | World generation. Editing the ASCII `earthMap` silently reshapes every territory. |
| `js/data/mapData.js` seeds/adjacency | A bad reference breaks movement silently |
| `js/map.js` | Largest module (1183 lines / ~41 KB); rendering and geometry are coupled |
| Combat ↔ state interaction | Losses applied twice or not at all are easy to miss |

---

## Not yet defined

Performance testing has no target to test against — no territory-count ceiling
or turn-resolution budget has been set. See `OPEN_QUESTIONS.md`
("Map scale and performance budget"). Until that is decided, treat performance
findings as observations, not failures.

The root game has no automated coverage. It is worth considering for the pure
functions in `combat.js` (damage/odds resolution), where a silent numeric error
would be hardest to notice by playing. hexworld-v2's suite shows the pattern
works here — `node --test`, `.cjs`, no test framework dependency.
