# Axis And Allies Project

Browser-based tactical strategy game — Risk-like, with more depth. Territory
map, combat resolution, political and doctrine systems.

---

## Live links

- **Game:** https://milesbrown34.github.io/AxisAndAllies/
- **HexWorld v2 (current map generator):** https://milesbrown34.github.io/AxisAndAllies/hexworld-v2/
- **HexWorld v2 progress spec:** https://milesbrown34.github.io/AxisAndAllies/hexworld-v2/docs/v2-spec.html

Repo is public; GitHub Pages serves the repo root, so both the game and
`hexworld-v2/` are reachable directly.

---

## Stack

- **Server:** Node (`server.js`) — lightweight, serves the client
- **Client:** vanilla JS modules under `js/`, HTML/CSS at the root
- **Assets:** terrain textures and map images in `images/`

### Code map

| File | Responsibility |
|---|---|
| `js/app.js` | Entry point, wiring, game loop |
| `js/state.js` | Game state — largest module, the core model |
| `js/map.js` | Map rendering and territory geometry |
| `js/combat.js` | Combat resolution |
| `js/politics.js` | Political system |
| `js/doctrines.js` | Doctrine / upgrade system |
| `js/data/mapData.js` | Territory definitions |
| `js/data/unitData.js` | Unit stats |
| `js/data/cardData.js` | Card definitions |

`js/data/*` are data tables, not logic. Prefer changing data over changing code
when tuning balance.

---

## Reference material

- `A&A_40Anni_Rulebook_WEB.pdf` — the official Axis & Allies rulebook this
  project draws from.
- `civ5_map_architecture_deep_dive.md` — early research notes on Civ V's map
  architecture. Superseded as the active map-gen lineage by `hexworld-v2/`
  below, kept for historical context.
- `hexworld-v2/` — **the current map generator for this project.** Geologically
  plausible procedural world generation (tectonics, climate, hydrology,
  biomes, six themes). Self-contained `index.html`, zero install to run —
  see `hexworld-v2/README.md` and `hexworld-v2/docs/v2-spec.html` for the
  full build history. Not yet wired into `js/map.js` / `js/data/mapData.js`;
  that integration is still open.

These are reference, not requirements. Do not treat rulebook text as a
binding spec unless Miles has said so — this game is deliberately *not* a
straight reimplementation.

---

## Working rules

- Keep changes scoped to game logic, UI, and project structure. Do not touch
  unrelated parts of the workspace.
- `state.js` is central — changes there ripple. Read it before editing combat,
  politics, or doctrines.
- Match the existing vanilla-JS module style. No framework has been introduced;
  do not introduce one without asking.
- Balance changes are decisions worth recording — put them in
  `.claude/DECISIONS.md`.
- Do not commit or push unless Miles asks (see root `CLAUDE.md`).

---

## Context files

`.claude/quick-context.md`, `REQUIREMENTS.md`, `DECISIONS.md`,
`OPEN_QUESTIONS.md`, `TESTING.md`, and `knowledgebase/`.

`.agents/` holds the older Gemini/Copilot-era rules, kept for reference.
`.active_convo` is local runtime state and is gitignored.
