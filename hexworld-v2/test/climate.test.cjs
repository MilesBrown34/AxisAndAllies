const test = require("node:test");
const assert = require("node:assert");
const C = require("../src/procgen/climate.js");

test("temperature: warm equator, frozen poles, monotone in latitude", () => {
  assert.ok(C.temperatureAt(0, 0, 0) > 0.9, "equator sea level should be hot");
  assert.ok(C.temperatureAt(1, 0, 0) < 0.05, "pole should be frozen");
  let prev = Infinity;
  for (let lf = 0; lf <= 1.0001; lf += 0.1) {
    const t = C.temperatureAt(lf, 0, 0);
    assert.ok(t <= prev + 1e-12, `not monotone at latFrac ${lf.toFixed(1)}`);
    assert.ok(t >= 0 && t <= 1);
    prev = t;
  }
});

test("temperature: lapse rate cools mountains, offset shifts the whole curve", () => {
  const sea = C.temperatureAt(0.3, 0, 0);
  const peak = C.temperatureAt(0.3, 0.8, 0);
  assert.ok(Math.abs((sea - peak) - C.CLIMATE.LAPSE * 0.8) < 1e-9, "lapse must be linear in elevation");
  assert.ok(C.temperatureAt(0.3, 0, -0.28) < sea - 0.2, "Frozen-style offset must cool");
  assert.ok(C.temperatureAt(0.99, 0.9, -0.5) === 0, "clamped at 0");
  assert.ok(C.temperatureAt(0, 0, 0.5) === 1, "clamped at 1");
});

test("wind belts: easterlies, westerlies, polar easterlies", () => {
  assert.strictEqual(C.windDirAt(0.1), -1);   // trade winds: travel east→west
  assert.strictEqual(C.windDirAt(0.5), 1);    // westerlies: travel west→east
  assert.strictEqual(C.windDirAt(0.9), -1);   // polar easterlies
});

test("subsidence peaks at the 28-degree belt", () => {
  const atBelt = C.subsidenceAt(C.CLIMATE.SUB_LAT);
  assert.ok(atBelt > C.subsidenceAt(0) * 2, "belt must be far drier than the equator");
  assert.ok(atBelt > C.subsidenceAt(0.6) * 2, "belt must be far drier than the storm zone");
  assert.ok(Math.abs(atBelt - C.CLIMATE.SUBSIDENCE) < 1e-9, "gaussian peak = SUBSIDENCE");
});

function syntheticRow() {
  // 30 ocean cells, 10 flat coastal land, 1 ridge, 14 flat leeward land (west→east).
  const row = [];
  for (let i = 0; i < 30; i++) row.push({ elev: -0.4, water: true, temp: 0.7 });
  for (let i = 0; i < 10; i++) row.push({ elev: 0.1, water: false, temp: 0.65 });
  row.push({ elev: 0.8, water: false, temp: 0.3 });
  for (let i = 0; i < 14; i++) row.push({ elev: 0.1, water: false, temp: 0.65 });
  return row;
}

test("advectRow: deterministic, finite, non-negative", () => {
  const a = C.advectRow(syntheticRow(), 1, 0.5);
  const b = C.advectRow(syntheticRow(), 1, 0.5);
  assert.deepStrictEqual([...a], [...b]);
  for (const v of a) assert.ok(Number.isFinite(v) && v >= 0);
});

test("advectRow: rain shadow — leeward of the ridge is drier than windward", () => {
  const rain = C.advectRow(syntheticRow(), 1, 0.5);   // westerlies: travel west→east
  const windward = rain.slice(33, 38);                // flat land before the ridge
  const leeward = rain.slice(45, 50);                 // flat land well past the ridge
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(mean(leeward) < mean(windward) * 0.5,
    `leeward ${mean(leeward)} not < half of windward ${mean(windward)}`);
  const ridge = rain[40];
  for (let i = 33; i < 40; i++) assert.ok(ridge > rain[i], "orographic peak must out-rain flat land");
});

test("advectRow: 60/40 split — the cell after the ridge catches the carry", () => {
  const rain = C.advectRow(syntheticRow(), 1, 0.5);
  assert.ok(rain[41] > rain[44], "first leeward cell (carry) must beat deep-leeward cells");
});

test("advectRow: continentality — rain fades with distance from the upwind coast", () => {
  const row = [];
  for (let i = 0; i < 25; i++) row.push({ elev: -0.4, water: true, temp: 0.7 });
  for (let i = 0; i < 30; i++) row.push({ elev: 0.1, water: false, temp: 0.65 });
  const rain = C.advectRow(row, 1, 0.5);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(mean(rain.slice(25, 30)) > mean(rain.slice(50, 55)) * 1.5,
    "coastal land must clearly out-rain the deep interior");
});

test("advectRow: an all-ocean row converges to near-uniform rain (wrap warm-up works)", () => {
  const row = [];
  for (let i = 0; i < 60; i++) row.push({ elev: -0.5, water: true, temp: 0.6 });
  const rain = C.advectRow(row, 1, 0.2);
  const vals = [...rain];
  const mx = Math.max(...vals), mn = Math.min(...vals);
  assert.ok(mn > 0 && mx / mn < 1.05, `ocean row not converged: ${mn}..${mx}`);
});

test("advectRow: the subsidence belt LOSES moisture — belt land out-dries temperate land", () => {
  const row = [];
  for (let i = 0; i < 20; i++) row.push({ elev: -0.4, water: true, temp: 0.7 });
  for (let i = 0; i < 40; i++) row.push({ elev: 0.1, water: false, temp: 0.6 });
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const belt = C.advectRow(row, 1, C.CLIMATE.SUB_LAT);
  const temperate = C.advectRow(row, 1, 0.55);
  assert.ok(sum([...belt].slice(20)) < sum([...temperate].slice(20)) * 0.7,
    "belt total land rain must be well below temperate — the drain must remove water, not defer it");
});

test("advectRow: sub-range roughness casts no shadow — air flows around small bumps", () => {
  const mkRow = (bumpy) => {
    const row = [];
    for (let i = 0; i < 20; i++) row.push({ elev: -0.4, water: true, temp: 0.7 });
    for (let i = 0; i < 30; i++) {
      row.push({ elev: bumpy && i % 2 ? 0.1 + C.CLIMATE.OROG_MIN * 0.8 : 0.1, water: false, temp: 0.6 });
    }
    return row;
  };
  const flat = C.advectRow(mkRow(false), 1, 0.5);
  const bumpy = C.advectRow(mkRow(true), 1, 0.5);
  assert.deepStrictEqual([...bumpy], [...flat],
    "bumps below OROG_MIN must not extract moisture (byte-identical to flat)");
});

test("seaBreezeFactor: boosts the first two rings off the coast, nothing further", () => {
  const sb = C.CLIMATE.SEA_BREEZE;
  assert.ok(sb > 0, "SEA_BREEZE must exist");
  assert.ok(Math.abs(C.seaBreezeFactor(1) - (1 + sb)) < 1e-12, "ring 1 gets the full boost");
  assert.ok(Math.abs(C.seaBreezeFactor(2) - (1 + sb / 2)) < 1e-12, "ring 2 gets half");
  assert.strictEqual(C.seaBreezeFactor(3), 1, "ring 3+ unboosted");
  assert.strictEqual(C.seaBreezeFactor(9), 1);
  assert.strictEqual(C.seaBreezeFactor(0), 1, "water cells unboosted");
});

test("M7.1: advectRow — arid omitted is byte-identical to arid 1", () => {
  const a = C.advectRow(syntheticRow(), 1, C.CLIMATE.SUB_LAT);
  const b = C.advectRow(syntheticRow(), 1, C.CLIMATE.SUB_LAT, 1);
  assert.deepStrictEqual([...a], [...b]);
});

test("M7.1: aridity scales the desert belt — arid 0 rains more on belt land, arid 2 less", () => {
  const landRain = (arid) => {
    const row = syntheticRow();
    const rain = C.advectRow(row, 1, C.CLIMATE.SUB_LAT, arid);
    let s = 0;
    for (let i = 0; i < row.length; i++) if (!row[i].water) s += rain[i];
    return s;
  };
  const lush = landRain(0), base = landRain(1), harsh = landRain(2);
  assert.ok(lush > base, `arid 0 must rain MORE than baseline in the belt: ${lush} vs ${base}`);
  assert.ok(harsh < base, `arid 2 must rain LESS than baseline in the belt: ${harsh} vs ${base}`);
});

test("M7.1: aridity targets the belt — far latitudes barely move", () => {
  const landRainAt = (latFrac, arid) => {
    const row = syntheticRow();
    const rain = C.advectRow(row, 1, latFrac, arid);
    let s = 0;
    for (let i = 0; i < row.length; i++) if (!row[i].water) s += rain[i];
    return s;
  };
  const beltSpread = Math.abs(landRainAt(C.CLIMATE.SUB_LAT, 0) - landRainAt(C.CLIMATE.SUB_LAT, 2));
  const polarSpread = Math.abs(landRainAt(0.85, 0) - landRainAt(0.85, 2));
  assert.ok(polarSpread < beltSpread * 0.01,
    `arid must act on the belt, not everywhere: polar spread ${polarSpread} vs belt ${beltSpread}`);
});
