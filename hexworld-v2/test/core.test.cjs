const test = require("node:test");
const assert = require("node:assert");
const core = require("../src/core.js");

// One fake square country: lon/lat in [-20,20] — big enough to catch many hexes.
const BOXLAND = {
  countries: [{
    n: "Boxland", c: "Testia",
    p: [{ b: [-20, -20, 20, 20], r: [[-20, -20, 20, -20, 20, 20, -20, 20]] }],
  }],
};

test("mulberry32 is deterministic and seed-sensitive", () => {
  const a = core.mulberry32(42), b = core.mulberry32(42), c = core.mulberry32(43);
  const seqA = [a(), a(), a()], seqB = [b(), b(), b()], seqC = [c(), c(), c()];
  assert.deepStrictEqual(seqA, seqB);
  assert.notDeepStrictEqual(seqA, seqC);
  for (const v of seqA) assert.ok(v >= 0 && v < 1);
});

test("pointInRings: unit square with a hole", () => {
  const rings = [
    [0, 0, 10, 0, 10, 10, 0, 10],   // outer 10x10
    [4, 4, 6, 4, 6, 6, 4, 6],       // hole 2x2 in middle
  ];
  assert.ok(core.pointInRings(2, 2, rings), "inside outer");
  assert.ok(!core.pointInRings(5, 5, rings), "inside hole = outside");
  assert.ok(!core.pointInRings(11, 5, rings), "outside outer");
});

test("unproject maps canvas corners to lon/lat bounds", () => {
  assert.deepStrictEqual(core.unproject(0, 0), { lon: -180, lat: 85 });
  const c = core.unproject(core.WORLD.W, core.WORLD.H);
  assert.strictEqual(c.lon, 180);
  assert.strictEqual(c.lat, -85);
});

test("generate: all hexes land in Boxland, counts consistent", () => {
  const res = core.generate(BOXLAND, { seed: 1, hexSize: 8.8 });
  assert.ok(res.totalLand > 20, "expected a bunch of hexes, got " + res.totalLand);
  for (const hex of res.hexes.values()) {
    assert.strictEqual(hex.name, "Boxland");
    const { lon, lat } = core.unproject(hex.cx, hex.cy);
    assert.ok(lon >= -20 && lon <= 20 && lat >= -20 && lat <= 20, "hex center must be inside the square");
  }
  assert.strictEqual(res.countryCounts.get("Boxland"), res.totalLand);
  assert.strictEqual(res.continentCounts.get("Testia"), res.totalLand);
});

test("generate: same seed identical, different seeds vary hex count", () => {
  const a = core.generate(BOXLAND, { seed: 7, hexSize: 8.8 });
  const b = core.generate(BOXLAND, { seed: 7, hexSize: 8.8 });
  assert.strictEqual(a.totalLand, b.totalLand);
  assert.deepStrictEqual([...a.hexes.keys()], [...b.hexes.keys()]);
  const counts = new Set();
  for (let s = 1; s <= 6; s++) counts.add(core.generate(BOXLAND, { seed: s, hexSize: 8.8 }).totalLand);
  assert.ok(counts.size >= 2, "seeds 1..6 all produced identical hex counts — jitter not working");
});

test("generate: Antarctica flagged unplayable, excluded from counts", () => {
  const DATA = { countries: [
    BOXLAND.countries[0],
    { n: "South Pole", c: "Antarctica",
      p: [{ b: [-170, -84, 170, -62], r: [[-170, -84, 170, -84, 170, -62, -170, -62]] }] },
  ]};
  const res = core.generate(DATA, { seed: 1, hexSize: 8.8 });
  const ant = [...res.hexes.values()].filter((h) => h.continent === "Antarctica");
  const box = [...res.hexes.values()].filter((h) => h.name === "Boxland");
  assert.ok(ant.length > 0, "expected antarctic hexes");
  assert.ok(box.length > 0, "expected Boxland hexes");
  for (const h of ant) assert.strictEqual(h.playable, false);
  for (const h of box) assert.strictEqual(h.playable, true);
  assert.strictEqual(res.totalLand, box.length, "totalLand must count playable hexes only");
  assert.ok(!res.continentCounts.has("Antarctica"));
  assert.ok(!res.countryCounts.has("South Pole"));
  assert.strictEqual(res.unplayable, ant.length);
});

test("pixelToCell inverts cellCenter", () => {
  const g = { size: 8.8, dx: 3.1, dy: -2.2, hexW: Math.sqrt(3) * 8.8, vs: 1.5 * 8.8 };
  for (const [col, row] of [[0, 0], [5, 3], [2, 7], [9, 4], [1, 1]]) {
    const { cx, cy } = core.cellCenter(col, row, g);
    assert.deepStrictEqual(core.pixelToCell(cx, cy, g), { col, row }, `cell ${col},${row}`);
  }
});

test("cluster lattice: R=1 tiles in exact 7s, R=2 in ~19s", () => {
  for (const [R, min, max] of [[1, 7, 7], [2, 17, 21]]) {
    const counts = new Map();
    for (let row = 0; row < 40; row++) {
      for (let col = 0; col < 40; col++) {
        const a = core.axialOf(col, row);
        const c = core.clusterCenterOf(a.q, a.r, R);
        const k = c.q + "," + c.r;
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    let interior = 0;
    for (const [k, n] of counts) {
      const [cq, cr] = k.split(",").map(Number);
      const off = core.offsetOf(cq, cr);
      if (off.col >= 8 && off.col < 32 && off.row >= 8 && off.row < 32) {
        interior++;
        assert.ok(n >= min && n <= max, `R=${R} cluster ${k} has size ${n}, want ${min}..${max}`);
      }
    }
    assert.ok(interior > 5, `expected interior clusters for R=${R}, got ${interior}`);
  }
});

test("generate: clusterR groups playable hexes into per-country nodes", () => {
  const TWO = { countries: [
    BOXLAND.countries[0],
    { n: "Boxland2", c: "Testia", p: [{ b: [20, -20, 60, 20], r: [[20, -20, 60, -20, 60, 20, 20, 20]] }] },
  ]};
  const r0 = core.generate(TWO, { seed: 3, hexSize: 8.8, clusterR: 0 });
  const r1 = core.generate(TWO, { seed: 3, hexSize: 8.8, clusterR: 1 });
  assert.strictEqual(r0.clusters, null);
  assert.deepStrictEqual([...r1.hexes.keys()], [...r0.hexes.keys()],
    "cluster mode must not change the hex layout");
  assert.ok(r1.clusters.size > 1);
  let sum = 0;
  for (const cl of r1.clusters.values()) {
    sum += cl.hexKeys.length;
    assert.ok(cl.hexKeys.length >= 1 && cl.hexKeys.length <= 7, "R=1 node exceeds 7 hexes");
    for (const k of cl.hexKeys) {
      assert.strictEqual(r1.hexes.get(k).name, cl.name, "cluster must not span countries");
    }
  }
  assert.strictEqual(sum, r1.totalLand, "every playable hex in exactly one cluster");
  assert.ok(r1.totalLand / r1.clusters.size > 2.5, "mean node size implausibly small");
});

test("neighbors: edge order + parity, symmetric", () => {
  // even row (2): E,SE,SW,W,NW,NE
  assert.deepStrictEqual(core.neighbors(4, 2),
    [[5, 2], [4, 3], [3, 3], [3, 2], [3, 1], [4, 1]]);
  // odd row
  assert.deepStrictEqual(core.neighbors(4, 3),
    [[5, 3], [5, 4], [4, 4], [3, 3], [4, 2], [5, 2]]);
  // symmetry: if B is a neighbor of A, A is a neighbor of B
  for (const [c, r] of core.neighbors(4, 2)) {
    assert.ok(core.neighbors(c, r).some(([c2, r2]) => c2 === 4 && r2 === 2));
  }
});
