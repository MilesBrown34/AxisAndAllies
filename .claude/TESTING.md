# Axis And Allies Project — Testing & Validation

No automated test suite exists yet. These are the manual checks that should pass
before a change is considered done.

---

## Regression checklist

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

### Data integrity
- [ ] Every territory in `js/data/mapData.js` has valid adjacency references
- [ ] Every unit referenced by game logic exists in `js/data/unitData.js`
- [ ] Every card in `js/data/cardData.js` has a handler

---

## Known high-risk areas

| Area | Why it's risky |
|---|---|
| `js/state.js` | Central model — combat, politics and doctrines all mutate it |
| `js/data/mapData.js` adjacency | A bad reference breaks movement silently |
| `js/map.js` | Largest module (~40 KB); rendering and geometry are coupled |
| Combat ↔ state interaction | Losses applied twice or not at all are easy to miss |

---

## Not yet defined

Performance testing has no target to test against — no territory-count ceiling
or turn-resolution budget has been set. See `OPEN_QUESTIONS.md`
("Map scale and performance budget"). Until that is decided, treat performance
findings as observations, not failures.

Automated coverage is worth considering for the pure functions in `combat.js`
(damage/odds resolution), where a silent numeric error would be hardest to
notice by playing.
