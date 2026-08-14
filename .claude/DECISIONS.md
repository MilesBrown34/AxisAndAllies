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
