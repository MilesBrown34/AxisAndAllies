# Axis And Allies Project

Browser-based tactical strategy game — Risk-like, with more depth. Territory
map, combat resolution, political and doctrine systems.

The **repo** is called "Axis And Allies", but the **game's internal name is
"Iron & Crowns"** (`index.html:6`, and the header comment of all nine JS
modules and `server.js`). Same project — don't go looking for a second one.

---

## Current state

**Two code trees live here. They are not two generations, and they are not
connected.**

| Tree | What it is |
|---|---|
| Root — `index.html`, `index.css`, `server.js`, `js/**` | The live game. `index.html:559` loads exactly one entry point, `js/app.js`. |
| `hexworld-v2/` | A self-contained map-generation lab. Own `package.json`, `src/`, `test/`, `tools/`. 119 tests pass. |

Nothing in the root tree references hexworld-v2, and hexworld-v2 never mentions
Axis & Allies or Iron & Crowns. `server.js` is a generic static server rooted at
`__dirname`, so it serves both — by accident, not by design. hexworld-v2 is a
**component-in-waiting**, not a replacement that has landed.

**The live game's world generation is `GameState.generatePlanetMap()` in
`js/state.js:60-328`.** It is not procedural: it paints a 120×60 hex grid from a
hardcoded ASCII-art `earthMap` blueprint (`js/state.js:107-168`, chars
`.gdfjmts` → sea/grassland/desert/forest/jungle/mountain/tundra), then assigns
each land hex to the nearest of the 26 territory seeds in `js/data/mapData.js`.
**This ASCII blueprint is what hexworld-v2 is a candidate to replace** — not
`js/map.js`, which is rendering only.

---

## Live links

- **Game:** https://milesbrown34.github.io/AxisAndAllies/
- **HexWorld v2:** https://milesbrown34.github.io/AxisAndAllies/hexworld-v2/
- **HexWorld v2 progress spec:** https://milesbrown34.github.io/AxisAndAllies/hexworld-v2/docs/v2-spec.html

Repo is public; GitHub Pages serves the repo root, so both trees are reachable
directly.

---

## Stack

- **Server:** Node (`server.js`) — zero-dependency static server on port 8080
- **Client:** vanilla ES modules under `js/`, HTML/CSS at the root
- **Assets:** terrain textures in `images/`

### Code map (root tree)

| File | Lines | Responsibility |
|---|---|---|
| `js/app.js` | 499 | Entry point, layout controller, wiring |
| `js/map.js` | 1183 | **Largest module.** Hybrid canvas/SVG renderer — hex paths, pan/zoom, hit-testing. No world generation. |
| `js/state.js` | 562 | Central game-state model, and world generation (`generatePlanetMap()`) |
| `js/combat.js` | 287 | Combat resolution |
| `js/politics.js` | 189 | Senate politics / commander bribery |
| `js/doctrines.js` | 147 | Doctrine and research system |
| `js/data/mapData.js` | 49 | 26 capital and region seeds (q/r coords, owner, type) |
| `js/data/unitData.js` | 104 | Unit stats and national upgrades |
| `js/data/cardData.js` | 107 | Crown card definitions |

`js/data/*` are data tables, not logic. Prefer changing data over changing code
when tuning balance.

---

## Reference material

- `A&A_40Anni_Rulebook_WEB.pdf` — the official Axis & Allies rulebook this
  project draws from.
- `civ5_map_architecture_deep_dive.md` — research notes on Civ V's map
  architecture. Superseded **as the map-generation lineage only** by
  `hexworld-v2/`. It is still the live reference for the renderer: `js/map.js:1`
  declares itself `CIV 5 HEX GRID STYLE`, and the Civ V decision in
  `.claude/DECISIONS.md` is `PROVISIONAL`, not superseded.
- `hexworld-v2/` — geologically plausible procedural world generation
  (tectonics, climate, hydrology, biomes, six themes). Zero install to run.
  See `hexworld-v2/README.md`, `hexworld-v2/CLAUDE.md` (determinism and RNG
  invariants — load-bearing), and `hexworld-v2/docs/v2-spec.html`.
  **Not yet wired into `js/state.js::generatePlanetMap()`.** See the entry in
  `.claude/OPEN_QUESTIONS.md` for what the integration would involve.

These are reference, not requirements. Do not treat rulebook text as a binding
spec unless Miles has said so — this game is deliberately *not* a straight
reimplementation.

---

## Working rules

- Keep changes scoped to game logic, UI, and project structure. Do not touch
  unrelated parts of the workspace.
- `state.js` is central — changes there ripple. Read it before editing combat,
  politics, or doctrines.
- Match the existing vanilla-JS module style. No framework has been introduced;
  do not introduce one without asking.
- Touching `hexworld-v2/src/procgen/**`? Its test suite must be green before
  **and** after. See `.claude/TESTING.md`.
- Balance changes are decisions worth recording — put them in
  `.claude/DECISIONS.md`.
- Do not commit or push unless Miles asks (see root `CLAUDE.md`).

---

## Context files

`.claude/REQUIREMENTS.md`, `DECISIONS.md`, `OPEN_QUESTIONS.md`, `TESTING.md`,
and `knowledgebase/` (loaded on demand, not every session).

Still undecided: the multiplayer model, how binding the rulebook is, map scale
and performance budget, save/load, and the hexworld-v2 integration. They are in
`.claude/OPEN_QUESTIONS.md` — don't invent answers to them.
