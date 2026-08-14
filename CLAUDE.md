# Axis And Allies Project

Browser-based tactical strategy game — Risk-like, with more depth. Territory
map, combat resolution, political and doctrine systems.

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
- `civ5_map_architecture_deep_dive.md` — research notes on Civ V's map
  architecture, informing the hex/territory design.

Both are reference, not requirements. Do not treat rulebook text as a binding
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
- Balance changes are decisions worth recording — put them in
  `.claude/DECISIONS.md`.
- Do not commit or push unless Miles asks (see root `CLAUDE.md`).

---

## Context files

`.claude/quick-context.md`, `REQUIREMENTS.md`, `DECISIONS.md`,
`OPEN_QUESTIONS.md`, `TESTING.md`, and `knowledgebase/`.

`.agents/` holds the older Gemini/Copilot-era rules, kept for reference.
`.active_convo` is local runtime state and is gitignored.
