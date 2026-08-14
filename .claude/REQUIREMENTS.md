# Axis And Allies Project — Requirements

**Requirements are decided and fixed.** Changing one is an explicit decision.
Undecided items belong in `OPEN_QUESTIONS.md`.

Status key: `FINAL` = settled · `PROVISIONAL` = in force but may be revisited

---

## Architecture

- [x] **Vanilla JS modules, no framework.** — `PROVISIONAL`
      Client code under `js/` uses plain ES modules. Introducing React/Vue/etc.
      is a decision that needs Miles's sign-off, not a refactor.
- [x] **Game data lives in `js/data/`, separate from logic.** — `FINAL`
      Territory, unit and card definitions are data tables. Tune balance by
      editing data, not logic.
- [x] **`js/state.js` is the single game-state model.** — `FINAL`
      Combat, politics and doctrines read and mutate through it.

## Design

- [x] **This is not a straight Axis & Allies reimplementation.** — `FINAL`
      The rulebook PDF and the Civ V architecture notes are *reference*. Rules
      are borrowed selectively and deliberately.
- [x] **Deliberately more complex than Risk.** — `FINAL`
      Politics and doctrine systems exist to add depth beyond territory capture.

---

## To be filled in

The following are genuinely undetermined — they were never specified in
Blueprint-v1 and should not be invented by an agent:

- Target map size / territory count ceiling
- Performance budget (frame time, turn resolution time)
- Multiplayer model — local hotseat, or networked
- Browser support floor
- Save/load and persistence expectations

Add them here as they get decided. Until then they live in `OPEN_QUESTIONS.md`.
