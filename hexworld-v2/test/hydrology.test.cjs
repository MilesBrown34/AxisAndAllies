const test = require("node:test");
const assert = require("node:assert");
const core = require("../src/core.js");
const Hy = require("../src/procgen/hydrology.js");

const G = { size: 10, hexW: Math.sqrt(3) * 10, vs: 15, dx: 0, dy: 0 };

// Synthetic worlds: n×n grid, elevFn decides elevation; ≤0 ⇒ ocean. Land rain 0.4.
function makeWorld(n, elevFn, rain) {
  const hexes = new Map();
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const { cx, cy } = core.cellCenter(col, row, G);
      const elevation = elevFn(col, row);
      hexes.set(core.cellKey(col, row), {
        col, row, cx, cy, elevation,
        water: elevation > 0 ? "none" : "ocean",
        rainfall: elevation > 0 ? (rain === undefined ? 0.4 : rain) : 0,
      });
    }
  }
  return hexes;
}
const border = (n, col, row) => col === 0 || row === 0 || col === n - 1 || row === n - 1;
const island = (n) => (col, row) => (border(n, col, row) ? -0.5 : 0.3);
// Island with a raised ring (crater rim) around a low floor — one guaranteed depression.
function craterFn(n, c) {
  return (col, row) => {
    if (border(n, col, row)) return -0.5;
    const a = core.axialOf(col, row), b = core.axialOf(c, c);
    const d = core.hexDistance(a.q, a.r, b.q, b.r);
    if (d <= 1) return 0.05;
    if (d <= 3) return 0.6;
    return 0.2;
  };
}

test("junctions: 6 corners per land hex; reciprocal links exactly one hex-side long", () => {
  const hexes = makeWorld(8, island(8));
  const J = Hy.buildJunctions(hexes, G);
  for (const h of hexes.values()) {
    if (h.water !== "none") continue;
    for (const id of Hy.cornerIds(h.col, h.row)) assert.ok(J.has(id), id + " missing");
  }
  for (const j of J.values()) {
    assert.ok(j.links.length >= 1 && j.links.length <= 3, "degree out of range");
    for (const nid of j.links) {
      const nb = J.get(nid);
      assert.ok(nb, "link to nonexistent " + nid);
      assert.ok(nb.links.includes(j.id), "non-reciprocal " + j.id + " -> " + nid);
      assert.ok(Math.abs(Math.hypot(nb.x - j.x, nb.y - j.y) - G.size) < 1e-6,
        "edge not one hex side: " + j.id + " -> " + nid);
    }
  }
});

test("junctions: altitude = min of touching hexes; ocean/edge contact sets sea", () => {
  const hexes = makeWorld(8, island(8));
  const J = Hy.buildJunctions(hexes, G);
  let seaSeen = 0, interiorSeen = 0;
  for (const j of J.values()) {
    if (j.hexKeys.length === 3 && !j.sea) {
      let mn = Infinity;
      for (const hk of j.hexKeys) mn = Math.min(mn, hexes.get(hk).elevation);
      assert.strictEqual(j.alt, mn, "alt must be the min of touching hexes");
      interiorSeen++;
    }
    if (j.sea) { seaSeen++; assert.ok(j.alt <= 0, "sea junction with positive alt"); }
  }
  assert.ok(seaSeen > 0 && interiorSeen > 0, "island must have both kinds");
});

test("priority flood: never below ground; open slopes stay unfilled", () => {
  const hexes = makeWorld(10, island(10));   // flat island, no depressions
  const J = Hy.buildJunctions(hexes, G);
  Hy.priorityFlood(J);
  for (const j of J.values()) {
    assert.ok(j.popIdx >= 0, "unvisited junction " + j.id);
    assert.ok(j.filled >= j.alt - 1e-12, "filled below ground at " + j.id);
    assert.ok(Math.abs(j.filled - j.alt) < 1e-9, "flat island must not pool anywhere");
    if (!j.sea) assert.ok(j.parent, "non-sea junction without a flood parent");
  }
});

test("priority flood: a crater floor fills to the rim's spill level", () => {
  const hexes = makeWorld(13, craterFn(13, 6));
  const J = Hy.buildJunctions(hexes, G);
  Hy.priorityFlood(J);
  let floor = 0;
  for (const j of J.values()) {
    // Junctions entirely inside the floor (all three touching hexes at 0.05).
    if (j.hexKeys.length === 3 &&
        j.hexKeys.every((hk) => hexes.get(hk).elevation === 0.05)) {
      floor++;
      assert.ok(Math.abs(j.filled - 0.6) < 1e-9,
        "floor junction filled to " + j.filled + ", expected the 0.6 rim");
    }
  }
  assert.ok(floor > 0, "crater floor produced no interior junctions");
});

test("priority flood: deterministic — two runs identical", () => {
  const run = () => {
    const J = Hy.buildJunctions(makeWorld(13, craterFn(13, 6)), G);
    Hy.priorityFlood(J);
    return [...J.values()].map((j) => [j.id, j.filled, j.parent, j.popIdx]);
  };
  assert.deepStrictEqual(run(), run());
});

// Rolling terrain with no closed depressions is not guaranteed by this fn — that's
// fine; these tests assert invariants that hold either way.
const rolling = (n) => (col, row) => {
  if (border(n, col, row)) return -0.5;
  return 0.05 + 0.4 * Math.abs(Math.sin(col * 1.7) * Math.cos(row * 2.3));
};

function flooded(n, fn, seed, rain) {
  const hexes = makeWorld(n, fn, rain);
  const J = Hy.buildJunctions(hexes, G);
  Hy.priorityFlood(J);
  Hy.routeFlow(J, seed === undefined ? 42 : seed);
  Hy.accumulateFlux(J, hexes);
  return { hexes, J };
}

test("routeFlow: every outflow chain terminates at a sea junction, no cycles", () => {
  const { J } = flooded(14, rolling(14));
  for (const j of J.values()) {
    let cur = j, hops = 0;
    while (!cur.sea) {
      assert.ok(cur.out, "dead end at " + cur.id);
      cur = J.get(cur.out);
      assert.ok(cur, "outflow to nonexistent junction");
      assert.ok(++hops <= J.size, "cycle reached from " + j.id);
    }
  }
});

test("routeFlow: deterministic per seed, seed-sensitive somewhere", () => {
  const outs = (seed) => {
    const { J } = flooded(14, rolling(14), seed);
    return [...J.values()].map((j) => j.out);
  };
  assert.deepStrictEqual(outs(42), outs(42));
  // Assert seed sensitivity on a world with real choices (slopes with several
  // strictly-lower neighbors): 4 seeds must produce at least 2 distinct routings.
  const craterOuts = (seed) => {
    const hexes = makeWorld(13, craterFn(13, 6));
    const J = Hy.buildJunctions(hexes, G);
    Hy.priorityFlood(J);
    Hy.routeFlow(J, seed);
    return JSON.stringify([...J.values()].map((j) => j.out));
  };
  const distinct = new Set([craterOuts(1), craterOuts(2), craterOuts(3), craterOuts(4)]);
  assert.ok(distinct.size > 1, "outflow picks ignore the seed");
});

test("flux: conserved — total arriving at sea equals total seeded rain (open island)", () => {
  const { hexes, J } = flooded(10, island(10));   // flat island: no depressions, nothing cut
  let landRain = 0;
  for (const h of hexes.values()) if (h.water === "none") landRain += h.rainfall;
  let seaIn = 0;
  for (const j of J.values()) if (j.sea) seaIn += j.flux;
  assert.ok(Math.abs(seaIn - landRain) < 1e-6,
    "sea received " + seaIn + " of " + landRain + " seeded");
});

test("flux: monotone along outflow chains (before basin settlement)", () => {
  const { J } = flooded(14, rolling(14));
  for (const j of J.values()) {
    if (!j.out) continue;
    assert.ok(J.get(j.out).flux >= j.flux - 1e-12,
      "downstream flux shrank at " + j.id);
  }
});

test("endorheic: a starved crater is terminal (salt/flat); a soaked one overflows (open)", () => {
  const basinsAt = (rain) => {
    const hexes = makeWorld(13, craterFn(13, 6), rain);
    const J = Hy.buildJunctions(hexes, G);
    Hy.priorityFlood(J);
    Hy.routeFlow(J, 42);
    Hy.accumulateFlux(J, hexes);
    const basins = Hy.findBasins(J);
    Hy.settleBasins(J, basins, hexes);
    return basins;
  };
  const dry = basinsAt(0.02), wet = basinsAt(0.9);
  assert.strictEqual(dry.length, 1, "crater must be exactly one basin");
  assert.strictEqual(wet.length, 1);
  assert.ok(dry[0].kind === "salt" || dry[0].kind === "flat",
    "starved crater came out " + dry[0].kind);
  assert.strictEqual(wet[0].kind, "open", "soaked crater must overflow");
  assert.ok(dry[0].hexKeys.length > 0, "terminal basin without a footprint");
  // Terminal cut: the spill's outflow target loses EXACTLY the spill's throughput
  // (compare an unsettled run against a settled one — the target may also carry an
  // independent tributary, so an absolute "less than spill" check would be flaky).
  const pair = (settle) => {
    const hexes = makeWorld(13, craterFn(13, 6), 0.02);
    const J = Hy.buildJunctions(hexes, G);
    Hy.priorityFlood(J);
    Hy.routeFlow(J, 42);
    Hy.accumulateFlux(J, hexes);
    const basins = Hy.findBasins(J);
    if (settle) Hy.settleBasins(J, basins, hexes);
    const spill = J.get(basins[0].spill);
    return { spillFlux: spill.flux, nextFlux: J.get(spill.out).flux };
  };
  const before = pair(false), after = pair(true);
  assert.ok(after.spillFlux > 0, "spill carries no flux at all");
  assert.ok(Math.abs((before.nextFlux - after.nextFlux) - after.spillFlux) < 1e-9,
    "the terminal basin's throughput must leave the downstream chain exactly");
});

test("computeHydrology: rivers end only in water; deterministic; hexFlux covers land", () => {
  const hexes = makeWorld(14, rolling(14));
  const run = () => Hy.computeHydrology(hexes, G, 42);
  const a = run(), b = run();
  assert.deepStrictEqual(a.rivers, b.rivers, "computeHydrology not deterministic");
  assert.ok(a.rivers.length > 0, "rolling island produced no rivers");
  for (const s of a.rivers) {
    assert.ok(Number.isFinite(s.x1 + s.y1 + s.x2 + s.y2));
    assert.ok(s.f > 0 && s.w01 >= 0 && s.w01 <= 1);
  }
  // Every river junction's chain ends at sea, a lake, a basin member, or another river.
  const riverSrc = new Set();
  for (const j of a.junctions.values()) {
    if (j.riverSeg) riverSrc.add(j.id);
  }
  const basinMember = new Set();
  for (const bn of a.basins) for (const m of bn.members) basinMember.add(m);
  for (const j of a.junctions.values()) {
    if (!j.riverSeg) continue;
    const t = a.junctions.get(j.out);
    assert.ok(t.sea || t.lake || basinMember.has(t.id) || riverSrc.has(t.id),
      "river from " + j.id + " ends on dry land at " + t.id);
  }
  for (const h of hexes.values()) {
    if (h.water !== "none") continue;
    assert.ok(a.hexFlux.has(core.cellKey(h.col, h.row)), "land hex without flux");
  }
});

// A pond crater: exactly ONE low hex inside a high rim — the 1-hex speck lake.
function pondFn(n, c) {
  return (col, row) => {
    if (border(n, col, row)) return -0.5;
    const a = core.axialOf(col, row), b = core.axialOf(c, c);
    const d = core.hexDistance(a.q, a.r, b.q, b.r);
    if (d === 0) return 0.05;
    if (d <= 2) return 0.6;
    return 0.2;
  };
}
function settledPond(rain, minLake) {
  const hexes = makeWorld(13, pondFn(13, 6), rain);
  const J = Hy.buildJunctions(hexes, G);
  Hy.priorityFlood(J);
  Hy.routeFlow(J, 42);
  Hy.accumulateFlux(J, hexes);
  const basins = Hy.findBasins(J);
  Hy.settleBasins(J, basins, hexes, minLake);
  return { J, basins };
}

test("MIN_LAKE: a soaked 1-hex pond is culled — drains through, no lake flags", () => {
  const keep = settledPond(0.9, 1);
  assert.strictEqual(keep.basins.length, 1, "pond must be exactly one basin");
  assert.strictEqual(keep.basins[0].kind, "open");
  assert.ok(keep.basins[0].hexKeys.length >= 1, "minLake=1 must keep the pond");
  const cull = settledPond(0.9, 3);
  assert.strictEqual(cull.basins[0].kind, "open", "culled pond still drains (open)");
  assert.strictEqual(cull.basins[0].culled, true);
  assert.strictEqual(cull.basins[0].hexKeys.length, 0, "culled pond must not flood hexes");
  for (const j of cull.J.values()) assert.ok(!j.lake, "culled pond left a lake flag");
});

test("MIN_LAKE: a starved speck is culled too — the river dies, but no pan is drawn", () => {
  // The cull must be KIND-INDEPENDENT: whether a speck basin floods can't depend on
  // rainfall, or the water partition stops being terrain-invariant and the
  // characterOverride A/B guarantee breaks. Find a rain level where the 1-hex pond
  // settles as a SALT lake at minLake=1…
  let saltRain = null;
  for (const rain of [0.05, 0.1, 0.2, 0.3, 0.45, 0.6]) {
    if (settledPond(rain, 1).basins[0].kind === "salt") { saltRain = rain; break; }
  }
  assert.ok(saltRain !== null, "no rain level lands in the salt band — check SALT_RATIO");
  // …then the same rain at minLake=3 culls it: still terminal (the cut ran), but
  // no footprint, no pan, no lake flags — the speck reverts to plain land.
  const culled = settledPond(saltRain, 3);
  assert.strictEqual(culled.basins[0].kind, "salt", "kind stays diagnostic (terminal)");
  assert.strictEqual(culled.basins[0].culled, true);
  assert.strictEqual(culled.basins[0].hexKeys.length, 0, "culled speck must not pool or pan");
  for (const j of culled.J.values()) assert.ok(!j.lake);
});

test("MIN_LAKE: settleBasins defaults to HYDRO.MIN_LAKE when the param is omitted", () => {
  const dflt = settledPond(0.9, undefined);
  const expl = settledPond(0.9, Hy.HYDRO.MIN_LAKE);
  assert.strictEqual(dflt.basins[0].kind, expl.basins[0].kind);
  assert.strictEqual(dflt.basins[0].culled, expl.basins[0].culled);
  assert.deepStrictEqual(dflt.basins[0].hexKeys, expl.basins[0].hexKeys);
});

test("M5: riverPct dial — lower percentile means more river segments", () => {
  // A simple sloped world with uniform rain: many junctions carry flux.
  const slope = (n) => (col, row) =>
    (border(n, col, row)) ? -0.5 : 0.15 + 0.6 * (row / n);
  const built = (riverPct) => {
    const hexes = makeWorld(15, slope(15), 0.8);
    return Hy.computeHydrology(hexes, G, 7, { riverPct }).rivers.length;
  };
  const many = built(0.75), dflt = built(undefined), few = built(0.97);
  assert.ok(many > dflt && dflt > few,
    `not monotone: ${many} / ${dflt} / ${few}`);
});

test("M5: riverCheat dial — width-only: same segments, fatter minor rivers", () => {
  const slope = (n) => (col, row) =>
    (border(n, col, row)) ? -0.5 : 0.15 + 0.6 * (row / n);
  const built = (riverCheat) => {
    const hexes = makeWorld(15, slope(15), 0.8);
    return Hy.computeHydrology(hexes, G, 7, { riverCheat }).rivers;
  };
  const honest = built(1.0), flat = built(0.6);
  assert.strictEqual(flat.length, honest.length, "cheat changed the selected set");
  let strictly = 0;
  for (let i = 0; i < honest.length; i++) {
    assert.ok(flat[i].w01 >= honest[i].w01 - 1e-12,
      "cheat narrowed a river at index " + i);
    if (flat[i].w01 > honest[i].w01 + 1e-9) strictly++;
  }
  assert.ok(strictly > 0, "cheat 0.6 widened nothing — the dial looks inert");
  const iMax = honest.reduce((m, s, i) => (s.f > honest[m].f ? i : m), 0);
  assert.ok(Math.abs(flat[iMax].w01 - honest[iMax].w01) < 1e-9,
    "the trunk river's width must not move (w01=1 either way)");
});
