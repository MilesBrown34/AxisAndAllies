const test = require("node:test");
const assert = require("node:assert");
const B = require("../src/procgen/biomes.js");

test("palette: water bands + land biomes, unique ids, colors and labels everywhere", () => {
  assert.strictEqual(B.PALETTE.length,
    B.WATER_BANDS.length + B.SURFACE_BANDS.length + B.BIOMES.length
    + B.MARGIN_BANDS.length);
  assert.deepStrictEqual(B.SURFACE_BANDS.map((b) => b.id), ["lake", "saltflat"]);
  const ids = B.PALETTE.map((p) => p.id);
  assert.strictEqual(new Set(ids).size, ids.length, "duplicate palette id");
  for (const p of B.PALETTE) {
    assert.ok(typeof p.label === "string" && p.label.length > 0);
    assert.ok(Number.isInteger(p.color) && p.color >= 0 && p.color <= 0xffffff);
  }
});

test("depthBandOf: deep / ocean / shelf by depth", () => {
  assert.strictEqual(B.depthBandOf(-0.7), "deep");
  assert.strictEqual(B.depthBandOf(-0.3), "ocean");
  assert.strictEqual(B.depthBandOf(-0.05), "shelf");
});

test("classifyBiome: one representative point lands in every biome box", () => {
  const cases = [
    ["ice",        0.05, 0.50, 0.20], ["alpine",     0.60, 0.50, 0.90],
    ["tundra",     0.18, 0.40, 0.20], ["taiga",      0.35, 0.60, 0.20],
    ["steppe",     0.50, 0.20, 0.20], ["desert",     0.60, 0.05, 0.20],
    ["forest",     0.60, 0.50, 0.20], ["rainforest", 0.60, 0.80, 0.20],
    ["savanna",    0.85, 0.30, 0.10], ["tropforest", 0.85, 0.60, 0.10],
    ["jungle",     0.85, 0.90, 0.10],
  ];
  for (const [want, t, r, e] of cases) {
    assert.strictEqual(B.classifyBiome(t, r, e, false), want, `(${t},${r},${e})`);
  }
});

test("classifyBiome: gates beat boxes — cold wins over altitude, altitude over boxes", () => {
  assert.strictEqual(B.classifyBiome(0.05, 0.5, 0.9, false), "ice", "frozen peak is ice, not alpine");
  assert.strictEqual(B.classifyBiome(0.85, 0.9, 0.9, false), "alpine", "hot wet peak is still alpine");
});

test("classifyBiome: nearest-center fallback covers the cold-dry gap", () => {
  // t 0.24–0.30 with r < 0.12 is deliberately outside every box → nearest is steppe.
  assert.strictEqual(B.classifyBiome(0.27, 0.05, 0.20, false), "steppe");
});

test("classifyBiome: maritime moderation pulls coastal extremes toward the middle", () => {
  assert.strictEqual(B.classifyBiome(0.09, 0.40, 0.20, false), "ice");
  assert.strictEqual(B.classifyBiome(0.09, 0.40, 0.20, true), "tundra", "coast softens polar cold");
});

test("classifyBiome: extreme inputs stay in-table (clamp, no fallback surprises)", () => {
  assert.strictEqual(B.classifyBiome(1, 1, 0.2, false), "jungle");
  assert.strictEqual(B.classifyBiome(0, 0, 0, false), "ice");
});

test("M6: volcanic is a palette citizen but never a Whittaker outcome", () => {
  const ids = B.PALETTE.filter((b) => b.id === "volcanic");
  assert.strictEqual(ids.length, 1, "volcanic must appear in PALETTE exactly once");
  assert.strictEqual(B.MARGIN_BANDS[0].id, "volcanic");
  for (let t = 0.05; t < 1; t += 0.1) {
    for (let r = 0.05; r < 1; r += 0.1) {
      for (const elev of [0.2, 0.8]) {
        assert.notStrictEqual(B.classifyBiome(t, r, elev, false), "volcanic",
          "classifyBiome must never emit the terrain-derived volcanic gate");
      }
    }
  }
});
