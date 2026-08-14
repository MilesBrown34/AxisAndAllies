const test = require("node:test");
const assert = require("node:assert");
const core = require("../src/core.js");
const B = require("../src/procgen/biomes.js");
const R = require("../src/procgen/refine.js");

// Synthetic labeled worlds: n×n, climate from climFn {t, r, elev?}; border = ocean.
// Labels start from classifyBiome — exactly like worldgen's labeling stage.
function makeLabeled(n, climFn) {
  const hexes = new Map();
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const edge = col === 0 || row === 0 || col === n - 1 || row === n - 1;
      const c = climFn(col, row);
      const h = {
        col, row, water: edge ? "ocean" : "none",
        elevation: edge ? -0.5 : (c.elev === undefined ? 0.3 : c.elev),
        temperature: c.t, rainfall: c.r, coastal: false,
      };
      h.biome = h.water !== "none" ? B.depthBandOf(h.elevation)
        : B.classifyBiome(h.temperature, h.rainfall, h.elevation, h.coastal);
      hexes.set(core.cellKey(col, row), h);
    }
  }
  return hexes;
}

test("affinity: identity 1, symmetric, unlisted 0, keys sorted and well-formed", () => {
  assert.strictEqual(R.affinityOf("desert", "desert"), 1);
  assert.strictEqual(R.affinityOf("desert", "jungle"), R.affinityOf("jungle", "desert"));
  assert.ok(R.affinityOf("desert", "jungle") < 0, "desert|jungle must be hostile");
  assert.strictEqual(R.affinityOf("tundra", "savanna"), 0);
  const ids = new Set(B.PALETTE.map((b) => b.id));
  for (const k of Object.keys(R.AFFINITY_PAIRS)) {
    const [x, y] = k.split("|");
    assert.ok(ids.has(x) && ids.has(y), "unknown biome in AFFINITY_PAIRS: " + k);
    assert.ok(x < y, "unsorted AFFINITY_PAIRS key: " + k);
  }
});

test("dither: positional — deterministic, bounded, seed- and key-sensitive", () => {
  const a = R.ditherAt(5, "3,4"), b = R.ditherAt(5, "3,4");
  assert.deepStrictEqual(a, b);
  assert.ok(Math.abs(a.dt) <= R.REFINE.DITHER && Math.abs(a.dr) <= R.REFINE.DITHER);
  assert.notDeepStrictEqual(R.ditherAt(5, "3,5"), a);
  assert.notDeepStrictEqual(R.ditherAt(6, "3,4"), a);
});

test("refine: speckle noise is absorbed by the neighborhood", () => {
  const hexes = makeLabeled(16, () => ({ t: 0.55, r: 0.5 }));   // uniform forest
  const specks = [[4, 4], [7, 9], [10, 5], [12, 12], [6, 13]]
    .map(([c, r]) => core.cellKey(c, r));
  for (const k of specks) hexes.get(k).biome = "desert";
  const changed = R.refineBiomes(hexes, 7);
  assert.ok(changed >= 4, "refine barely acted: " + changed + " relabels");
  let desert = 0;
  for (const h of hexes.values()) if (h.biome === "desert") desert++;
  assert.ok(desert <= 1, desert + " desert specks survived a uniform forest");
});

test("refine: a sharp wet/dry divide survives — the desert side is not eroded away", () => {
  const n = 20;
  const hexes = makeLabeled(n, (col) => ({ t: 0.55, r: col < n / 2 ? 0.06 : 0.5 }));
  const count = (id) => {
    let c = 0;
    for (const h of hexes.values()) if (h.biome === id) c++;
    return c;
  };
  const before = count("desert");
  assert.ok(before > 30, "setup: the dry half must classify desert, got " + before);
  R.refineBiomes(hexes, 7);
  const after = count("desert");
  assert.ok(after >= before * 0.7,
    "refine erased the rain shadow: " + before + " -> " + after);
});

test("refine: ice and alpine gates are frozen — never overwritten, never assigned", () => {
  const hexes = makeLabeled(14, (col, row) => {
    if (col === 7 && row === 7) return { t: 0.55, r: 0.5, elev: 0.9 };   // alpine gate
    if (col === 3 && row === 3) return { t: 0.05, r: 0.5 };              // ice gate
    return { t: 0.55, r: 0.5 };
  });
  assert.strictEqual(hexes.get(core.cellKey(7, 7)).biome, "alpine");
  assert.strictEqual(hexes.get(core.cellKey(3, 3)).biome, "ice");
  R.refineBiomes(hexes, 7);
  assert.strictEqual(hexes.get(core.cellKey(7, 7)).biome, "alpine", "alpine overwritten");
  assert.strictEqual(hexes.get(core.cellKey(3, 3)).biome, "ice", "ice overwritten");
  for (const h of hexes.values()) {
    if (h.water !== "none") continue;
    if (h.col === 7 && h.row === 7) continue;
    if (h.col === 3 && h.row === 3) continue;
    assert.notStrictEqual(h.biome, "ice", "refine ASSIGNED a gate label");
    assert.notStrictEqual(h.biome, "alpine", "refine ASSIGNED a gate label");
  }
});

test("refine: deterministic across runs; sweeps 0 is a strict no-op", () => {
  const build = () => makeLabeled(16, (col, row) =>
    ({ t: 0.3 + 0.4 * (row / 16), r: 0.1 + 0.8 * (col / 16) }));
  const a = build(), b = build(), c = build();
  R.refineBiomes(a, 7);
  R.refineBiomes(b, 7);
  assert.deepStrictEqual(
    [...a.values()].map((h) => h.biome), [...b.values()].map((h) => h.biome));
  const before = [...c.values()].map((h) => h.biome);
  assert.strictEqual(R.refineBiomes(c, 7, { sweeps: 0 }), 0);
  assert.deepStrictEqual([...c.values()].map((h) => h.biome), before);
});

test("M6: volcanic is frozen — never overwritten, never assigned", () => {
  const hexes = makeLabeled(15, (col, row) => {
    if (col === 7 && row === 7) return { t: 0.55, r: 0.5, elev: 0.5 };
    return { t: 0.5, r: 0.5 };
  });
  hexes.get(core.cellKey(7, 7)).biome = "volcanic";
  R.refineBiomes(hexes, 1, { sweeps: 4 });
  assert.strictEqual(hexes.get(core.cellKey(7, 7)).biome, "volcanic", "volcanic overwritten");
  for (const h of hexes.values()) {
    if (h.water !== "none") continue;
    if (h.col === 7 && h.row === 7) continue;
    assert.notStrictEqual(h.biome, "volcanic", "refine ASSIGNED volcanic");
  }
});
