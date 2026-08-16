# Axis And Allies

Browser-based tactical strategy game — Risk-like, with more depth. Territory
map, combat resolution, political and doctrine systems. Deliberately *not* a
straight reimplementation of the board game it's inspired by.

The game's internal name is **Iron & Crowns**.

## Live links

- **Game:** https://milesbrown34.github.io/AxisAndAllies/
- **HexWorld v2 (map-generation lab):** https://milesbrown34.github.io/AxisAndAllies/hexworld-v2/
- **HexWorld v2 progress spec:** https://milesbrown34.github.io/AxisAndAllies/hexworld-v2/docs/v2-spec.html

## Two code trees

- **Root** — `index.html`, `server.js`, `js/**`. The live game. Node static
  server, vanilla ES modules, single entry point `js/app.js`.
- **`hexworld-v2/`** — a self-contained procedural world-generation lab
  (tectonics, climate, hydrology, biomes, themes). Own `package.json` and a
  119-test suite. Zero install to run: open `hexworld-v2/index.html`.

They are **not connected yet.** `server.js` serves both only because it is a
generic static server rooted at the repo.

The live game's world generation is `GameState.generatePlanetMap()` in
`js/state.js`, which paints hexes from a hardcoded ASCII `earthMap` blueprint
and grows 26 territories from the seeds in `js/data/mapData.js`. **That
blueprint is what hexworld-v2 is a candidate to replace** — not `js/map.js`,
which is the renderer. The integration is still an open question; see
`.claude/OPEN_QUESTIONS.md`.

## Running it

```bash
node server.js                    # game at http://localhost:8080
cd hexworld-v2 && npm test        # 119 tests
```

See `CLAUDE.md` for the full agent-facing project context.
