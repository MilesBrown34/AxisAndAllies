# Axis And Allies Project — Decisions

Append-only record of architecture and design decisions. Newest at the top.
Do not delete entries — supersede them.

Format:

```
## <Title>
**Date:**
**Decision:**
**Rationale:**
**Alternatives considered:**
**Status:** FINAL | PROVISIONAL | SUPERSEDED by <entry>
```

---

## hexworld-v2 as the intended map generator
**Date:** 2026-08 (built 2026-08-03 → 2026-08-05; recorded 2026-08-15)
**Decision:** Build procedural world generation as a standalone lab
(`hexworld-v2/`) and adopt it as the project's intended map generator, replacing
the hardcoded ASCII `earthMap` blueprint in `js/state.js::generatePlanetMap()`.
**Not yet integrated** — the two trees are still fully independent.
**Rationale:** The live generator paints a fixed 120×60 Earth-shaped blueprint,
so every game uses the same world. Building generation outside the game let it
grow its own test suite (119 tests, determinism-asserting) without the game's
DOM and state coupling, and it ships as a runnable demo on its own.
**Alternatives considered:**
- Grow procedural generation inside `js/state.js` — rejected; no test seam,
  and the game's state model would have to churn alongside the algorithm.
- Keep the ASCII blueprint permanently — rejected; a fixed world caps replay
  value, and territory seeds are already coordinate-based, so they can move.
- Hand-author more blueprints — rejected as unbounded manual work.
**Status:** PROVISIONAL — adopted in intent, unproven in the game. The wiring
itself is unresolved; see "How does hexworld-v2 connect to the live game?" in
`OPEN_QUESTIONS.md`.

## Data-driven game content
**Date:** pre-2026-08 (recorded retroactively 2026-08-12)
**Decision:** Keep territory, unit and card definitions in `js/data/` as plain
data modules, separate from the systems that consume them.
**Rationale:** Balance tuning shouldn't require touching combat or map logic.
**Alternatives considered:** Inlining stats into the systems — rejected as it
makes balance passes risky.
**Status:** FINAL

## Civ V map architecture as a design reference
**Date:** pre-2026-08 (recorded retroactively 2026-08-12)
**Decision:** Study Civ V's map/territory architecture (see
`civ5_map_architecture_deep_dive.md`) as input to the map design rather than
copying Axis & Allies' board directly.
**Rationale:** The goal is a Risk-like game with more depth; a tile/territory
architecture with real adjacency semantics supports that better than a fixed
board.
**Alternatives considered:** Direct board reimplementation — rejected as too
constraining for the intended design.
**Status:** PROVISIONAL

---

*Reconstructed while applying Blueprint-v1 from the repository's own structure
and reference material. Dates are approximate. Correct anything that misstates
the actual intent.*
