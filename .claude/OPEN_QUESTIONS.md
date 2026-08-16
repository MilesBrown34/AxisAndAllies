# Axis And Allies Project — Open Questions

Undecided items under investigation. **Not requirements.** Nothing here binds
behavior until Miles promotes it to `REQUIREMENTS.md` or `DECISIONS.md`.

Format:

```
## <Question>
**Options:**
**Owner:**
**Blocks:**
**Target decision date:**
```

---

## How does hexworld-v2 connect to the live game?
**Context:** `hexworld-v2/` is adopted in intent as the map generator (see
`DECISIONS.md`) but is not wired in. The two trees share no code and no
references. The live game generates its world in
`js/state.js::generatePlanetMap()` (lines 60-328) by painting a 120×60 grid
from a hardcoded ASCII `earthMap` blueprint (lines 107-168), then assigning
each land hex to the nearest of the 26 seeds in `js/data/mapData.js`. Replacing
the blueprint means answering how a *generated* world gets 26 balanced,
recognisable territories — the seeds are currently hand-placed on Earth
geography (`Essen_Core`, `Rhine_Plains`, …) and named after real places, which a
random world cannot honour. It also crosses a module-format boundary:
hexworld-v2 is CommonJS/UMD-lite, the game is ES modules; and hexworld-v2's
resolutions (~2.0k / 7.1k / 22.7k cells) do not match the game's 7,200.
**Options:**
- Import `src/procgen/**` into the game and generate at boot — needs an ESM
  shim or a build step, plus a seed-placement algorithm to replace hand-placed
  seeds
- Bake worlds offline with `tools/` and ship a small set as data, keeping
  `js/data/mapData.js` hand-tuned per baked world
- Keep the ASCII blueprint as the default Earth map and offer generated worlds
  as a separate mode (mirrors hexworld-v2's own Earth/Procedural toggle)
- Drop the integration; leave hexworld-v2 as a standalone lab
**Owner:** Miles + Minerva (architect)
**Blocks:** any rework of `generatePlanetMap()`, the territory-seed model in
`js/data/mapData.js`, and whether hexworld-v2 keeps being maintained
**Target decision date:** unset

## Multiplayer model — local, or networked?
**Context:** `server.js` exists and serves the client, but there is no state
sync layer. Whether this is a hotseat game with a static file server or a real
networked game changes the architecture of `state.js` substantially.
**Options:**
- Local hotseat only — `server.js` stays a static server
- Networked with authoritative server — state moves server-side
- Networked peer-to-peer with sync
**Owner:** Miles + Minerva (architect)
**Blocks:** any significant `state.js` restructuring
**Target decision date:** unset

## How much of the Axis & Allies rulebook is binding?
**Context:** `A&A_40Anni_Rulebook_WEB.pdf` sits in the project, but the stated
intent is "similar to Risk but slightly more complicated," not a faithful port.
Without a line, every rules question becomes a judgment call.
**Options:**
- Rulebook is inspiration only — design freely
- Specific subsystems (combat odds, unit costs) track the rulebook; the rest is free
- Full fidelity
**Owner:** Miles
**Blocks:** combat and unit balance work
**Target decision date:** unset

## Map scale and performance budget
**Context:** No territory-count ceiling or turn-resolution time target has been
set, so there is nothing to test map or combat performance against.
**Options:** define a target territory count and a turn-resolution budget
**Owner:** Miles + Apollo (QA)
**Blocks:** `TESTING.md` performance checks
**Target decision date:** unset

## Persistence — is there a save game?
**Context:** No save/load path exists. Game state lives only in the
`GameState` instance in memory; a page reload starts a fresh game.
**Owner:** Miles
**Blocks:** nothing yet
**Target decision date:** unset
