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

## Changelog

**Active: no**

The workspace default (`agents/STANDARDS.md` §8) is that every project keeps a
changelog. This project switches it off, because the two things a changelog
entry needs do not exist here yet:

- There is no changelog file in the repo.
- There is no user-visible version indicator. Nothing in `index.html`,
  `js/app.js`, or `server.js` displays a version, and there is no
  `package.json` at the project root to hold one. `hexworld-v2/package.json`
  has no `version` field either.

A version bump is supposed to land in both the changelog and the visible
indicator; with neither present, entries would be unverifiable bookkeeping.

**Switch it on when** the game reaches a versioned state — i.e. when there is a
version string on screen to bump alongside the file. At that point create the
changelog, set `Active: yes`, and adopt the standard format: `X.YZ`, newest
first, each entry giving version, date, and what shipped. Docs-only and
agent-rule-only changes do not bump.

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
