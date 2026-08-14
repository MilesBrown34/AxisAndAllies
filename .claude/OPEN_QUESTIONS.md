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
**Context:** No save/load path exists. `.active_convo` is agent runtime state,
not game state.
**Owner:** Miles
**Blocks:** nothing yet
**Target decision date:** unset
