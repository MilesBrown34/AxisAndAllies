# Axis And Allies Quick Context

**What it is:** Browser strategy game — Risk-like with more depth. Territory map,
combat, politics and doctrine systems.

**Stack:** Node (`server.js`) serving vanilla JS modules under `js/`

**Key files:**
- `js/state.js` — central game-state model (everything mutates through it)
- `js/map.js` — map rendering and territory geometry (largest module)
- `js/combat.js` · `js/politics.js` · `js/doctrines.js` — game systems
- `js/data/` — territory, unit and card definitions (tune balance here, not in logic)

**Reference (not spec):** `A&A_40Anni_Rulebook_WEB.pdf`,
`civ5_map_architecture_deep_dive.md`

**Undecided:** multiplayer model, how binding the rulebook is, map scale target.
See `OPEN_QUESTIONS.md` — don't invent answers to these.

**See also:** `../CLAUDE.md` for working rules.
