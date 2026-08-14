# Axis And Allies

Browser-based tactical strategy game — Risk-like, with more depth. Territory
map, combat resolution, political and doctrine systems. Deliberately *not* a
straight reimplementation of the board game it's inspired by.

## Live links

- **Game:** https://milesbrown34.github.io/AxisAndAllies/
- **HexWorld v2 — current map generator:** https://milesbrown34.github.io/AxisAndAllies/hexworld-v2/
- **HexWorld v2 progress spec:** https://milesbrown34.github.io/AxisAndAllies/hexworld-v2/docs/v2-spec.html

## Stack

- **Server:** Node (`server.js`)
- **Client:** vanilla JS modules under `js/`
- **Map generation:** `hexworld-v2/` — procedural, tectonics/climate/hydrology-driven world generation. Not yet wired into the live game's `js/map.js`.

See `CLAUDE.md` for the full agent-facing project context.
