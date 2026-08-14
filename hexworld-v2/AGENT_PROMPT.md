# Kickoff prompt for an AI coding agent

Paste the block below into your agent CLI (Gemini CLI, Claude Code, etc.)
after cloning the repo. Replace the final TASK line with what you actually
want done.

---

You are working in the HexWorld repo — a self-contained hex world map demo
(PixiJS, single-file `index.html`) with two generators: Earth mode (real
country borders) and Procedural mode (the v2 geologic engine: tectonics →
climate → hydrology → biomes → themes). Before doing ANYTHING else:

1. Read `GEMINI.md` in the repo root completely and follow its invariants
   and TDD workflow for every change.
2. Read `README.md` for the feature overview and architecture map.
3. Establish the baseline: run `node --test` (expect 119 passing tests, Node
   ≥ 20) and `node tools/build.mjs` (expect "built index.html — ~1.02MB";
   the budget is ≤ 1.3MB). Open `index.html` in a browser (or headless, per
   GEMINI.md) and confirm BOTH modes render with zero console errors —
   Earth mode shows the world map (seed 1 medium ⇒ 1,828 playable hexes),
   and Procedural mode generates a themed world (the `window.__hexworld.res`
   hook carries `fragments` when it's ready).

Rules of engagement:
- Test-first for core/procgen changes; `node --test` green before AND after.
- Never hand-edit `src/world-data.js` or `index.html` (both generated).
- Rebuild with `node tools/build.mjs` after any `src/` change — `index.html`
  is the deliverable.
- Respect the identity defaults: Earth mode, every procedural dial default,
  and the terran theme are byte-preserved — regression tests pin them.
- Verify UI changes in a real (headless) browser via the `window.__hexworld`
  hook described in GEMINI.md, and re-check the console is clean.
- The v1-demo rebuild plan (`docs/IMPLEMENTATION-PLAN.md`) covers Earth mode
  only; the v2 engine's design + build history is `docs/v2-spec.html`.

TASK: <describe the change you want here>
