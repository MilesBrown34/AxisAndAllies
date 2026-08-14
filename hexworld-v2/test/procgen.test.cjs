const test = require("node:test");
const assert = require("node:assert");
const N = require("../src/procgen/noise.js");
const core = require("../src/core.js");

const W = 1800, H = 850;

test("substream: deterministic, salt- and seed-sensitive", () => {
  const a = N.substream(42, "elev"), b = N.substream(42, "elev");
  const c = N.substream(42, "warp"), d = N.substream(43, "elev");
  const seq = (r) => [r(), r(), r()];
  assert.deepStrictEqual(seq(a), seq(b));
  assert.notDeepStrictEqual(seq(N.substream(42, "elev")), seq(c));
  assert.notDeepStrictEqual(seq(N.substream(42, "elev")), seq(d));
});

test("simplex3: deterministic per rng seed, bounded, non-constant", () => {
  const s1 = N.makeSimplex(core.mulberry32(7));
  const s2 = N.makeSimplex(core.mulberry32(7));
  const s3 = N.makeSimplex(core.mulberry32(8));
  const vals = [];
  for (let i = 0; i < 200; i++) {
    const x = i * 0.37, y = i * 0.53, z = i * 0.71;
    const v = s1.noise3(x, y, z);
    assert.strictEqual(v, s2.noise3(x, y, z), "same seed must match");
    assert.ok(v >= -1.05 && v <= 1.05, "out of range: " + v);
    vals.push(v);
  }
  assert.ok(vals.some((v, i) => i && Math.abs(v - vals[0]) > 1e-3), "constant field");
  assert.ok(vals.some((v, i) => s3.noise3(i * 0.37, i * 0.53, i * 0.71) !== v), "seed-insensitive");
});

test("fbmCyl: seamless across the x=0 / x=W wrap", () => {
  const sx = N.makeSimplex(core.mulberry32(11));
  for (let i = 0; i < 20; i++) {
    const cy = (i / 20) * H;
    const a = N.fbmCyl(sx, 0, cy, { freq: 1, octaves: 5, W });
    const b = N.fbmCyl(sx, W, cy, { freq: 1, octaves: 5, W });
    assert.ok(Math.abs(a - b) < 1e-9, `seam mismatch at cy=${cy}: ${a} vs ${b}`);
  }
});

test("fbmCyl variogram grows ~linearly in log distance (1/f kernel)", () => {
  // gamma(d) = E[(f(p) - f(p+d))^2] should be ~affine in ln d inside the octave range.
  const sx = N.makeSimplex(core.mulberry32(5));
  const rng = core.mulberry32(99);
  const gamma = (d) => {
    let sum = 0; const K = 400;
    for (let k = 0; k < K; k++) {
      const cx = rng() * W, cy = rng() * (H - 2 * d) + d;
      const ang = rng() * Math.PI * 2;
      const a = N.fbmCyl(sx, cx, cy, { freq: 2, octaves: 6, W });
      const b = N.fbmCyl(sx, cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, { freq: 2, octaves: 6, W });
      sum += (a - b) * (a - b);
    }
    return sum / K;
  };
  const g = [8, 16, 32, 64].map(gamma);
  assert.ok(g[1] > g[0] && g[2] > g[1] && g[3] > g[2], "variogram must increase");
  // successive increments per doubling should be comparable (log-linear), not decaying geometrically
  const inc1 = g[1] - g[0], inc2 = g[2] - g[1], inc3 = g[3] - g[2];
  assert.ok(inc2 > inc1 * 0.35 && inc2 < inc1 * 2.8, `inc2/inc1=${(inc2 / inc1).toFixed(2)}`);
  assert.ok(inc3 > inc2 * 0.35 && inc3 < inc2 * 2.8, `inc3/inc2=${(inc3 / inc2).toFixed(2)}`);
});

const P = require("../src/procgen/worldgen.js");

const OPTS = { seed: 3, hexSize: 8.8, clusterR: 0, oceanPct: 0.65 };

test("generateProcedural: deterministic (two runs deep-equal)", () => {
  const a = P.generateProcedural(OPTS), b = P.generateProcedural(OPTS);
  assert.deepStrictEqual([...a.hexes.entries()], [...b.hexes.entries()]);
  assert.strictEqual(a.totalLand, b.totalLand);
  const c = P.generateProcedural({ ...OPTS, seed: 4 });
  assert.notStrictEqual(a.totalLand, c.totalLand, "seed-insensitive");
});

test("generateProcedural: every grid cell exists, ocean included", () => {
  const r = P.generateProcedural(OPTS);
  assert.ok(r.totalCells > 5000, "expected thousands of cells, got " + r.totalCells);
  assert.strictEqual(r.hexes.size, r.totalCells);
  // M3 ledger: totalLand = dry land + salt flats; lakes are surface water.
  let ocean = 0, land = 0;
  for (const h of r.hexes.values()) {
    if (h.water === "ocean" || h.water === "lake") ocean++;
    else land++;
  }
  assert.ok(ocean > 0 && land > 0);
  assert.strictEqual(land, r.totalLand);
});

test("generateProcedural: sea level is a true zero at the Ocean % quantile", () => {
  for (const oceanPct of [0.5, 0.65, 0.8]) {
    const r = P.generateProcedural({ ...OPTS, oceanPct });
    let ocean = 0;
    for (const h of r.hexes.values()) {
      if (h.water === "ocean") { ocean++; assert.ok(h.elevation <= 0, "ocean above sea level"); }
      else assert.ok(h.elevation > 0, "land at/below sea level");
      assert.ok(h.elevation >= -1 - 1e-9 && h.elevation <= 1 + 1e-9);
    }
    const frac = ocean / r.totalCells;
    assert.ok(Math.abs(frac - oceanPct) < 0.02, `ocean ${frac.toFixed(3)} vs dial ${oceanPct}`);
  }
});

test("generateProcedural: hex layout identical to Earth mode at the same seed", () => {
  const BOX = { countries: [{ n: "B", c: "T", p: [{ b: [-20, -20, 20, 20], r: [[-20, -20, 20, -20, 20, 20, -20, 20]] }] }] };
  for (const seed of [1, 7, 12345]) {
    const e = core.generate(BOX, { seed, hexSize: 8.8, clusterR: 1 });
    const p = P.generateProcedural({ seed, hexSize: 8.8, clusterR: 1, oceanPct: 0.65 });
    assert.deepStrictEqual(p.geom, e.geom, "geometry (size jitter, dx, dy) must match core");
  }
});

test("generateProcedural: landmasses are connected components, largest first", () => {
  const r = P.generateProcedural(OPTS);
  assert.ok(r.landmasses.size >= 1);
  const sizes = [...r.landmasses.values()].map((m) => m.size);
  for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i] <= sizes[i - 1], "not sorted by size");
  // adjacency check: two neighboring land cells always share a landmass id
  for (const h of r.hexes.values()) {
    if (h.water !== "none") continue;
    for (const [nc, nr] of core.neighbors(h.col, h.row)) {
      const nb = r.hexes.get(core.cellKey(nc, nr));
      if (nb && nb.water === "none") {
        assert.strictEqual(nb.landmassId, h.landmassId, "adjacent land, different landmass");
      }
    }
  }
  let sum = 0;
  for (const m of r.landmasses.values()) sum += m.size;
  assert.strictEqual(sum, r.totalLand);
});

test("generateProcedural: clusters group land only, never span landmasses", () => {
  const r = P.generateProcedural({ ...OPTS, clusterR: 1 });
  assert.ok(r.clusters.size > 1);
  let sum = 0;
  for (const cl of r.clusters.values()) {
    sum += cl.hexKeys.length;
    assert.ok(cl.hexKeys.length >= 1 && cl.hexKeys.length <= 7);
    for (const k of cl.hexKeys) {
      const h = r.hexes.get(k);
      // M3: clusters hold the playable surface — dry land and salt flats, never
      // ocean or lakes.
      assert.ok(h.playable, "cluster contains unplayable hex");
      assert.ok(h.water !== "ocean" && h.water !== "lake", "cluster contains water");
      assert.strictEqual(h.name, cl.name, "cluster spans landmasses");
    }
  }
  assert.strictEqual(sum, r.totalLand);
});

test("generateProcedural: palette covers all cells — depth bands on water, biomes on land", () => {
  const B = require("../src/procgen/biomes.js");
  const r = P.generateProcedural(OPTS);
  let sum = 0;
  for (const [, n] of r.biomeCounts) sum += n;
  assert.strictEqual(sum, r.totalCells);
  const waterIds = new Set(B.WATER_BANDS.map((b) => b.id));
  const surfaceIds = new Set(B.SURFACE_BANDS.map((b) => b.id));
  const landIds = new Set([...B.BIOMES, ...B.MARGIN_BANDS].map((b) => b.id));
  for (const h of r.hexes.values()) {
    if (h.water === "ocean") assert.ok(waterIds.has(h.biome), "ocean cell biome " + h.biome);
    else if (h.water === "lake" || h.water === "saltflat")
      assert.ok(surfaceIds.has(h.biome), "surface cell biome " + h.biome);
    else assert.ok(landIds.has(h.biome), "land cell biome " + h.biome);
  }
  assert.deepStrictEqual(r.palette.map((p) => p.id), B.PALETTE.map((p) => p.id));
  assert.ok(r.biomeLandCount >= 4, "expected at least 4 land biomes, got " + r.biomeLandCount);
});

test("continents: top-N landmasses dominate the land area", () => {
  for (const continents of [1, 3, 5]) {
    const r = P.generateProcedural({ ...OPTS, continents });
    const sizes = [...r.landmasses.values()].map((m) => m.size);
    const top = sizes.slice(0, continents).reduce((a, b) => a + b, 0);
    const share = top / r.totalLand;
    assert.ok(share >= 0.6,
      `continents=${continents}: top ${continents} hold ${(share * 100).toFixed(0)}% < 60%`);
  }
});

test("continents: count is a sub-seed — different count, different world", () => {
  const a = P.generateProcedural({ ...OPTS, continents: 3 });
  const b = P.generateProcedural({ ...OPTS, continents: 5 });
  const landKeys = (r) => [...r.hexes.values()].filter((h) => h.water === "none")
    .map((h) => h.col + "," + h.row).join(";");
  assert.notStrictEqual(landKeys(a), landKeys(b), "continent count must reshape the world");
  assert.deepStrictEqual(a.geom, b.geom, "but the hex lattice must not move");
});

test("continents: no speck islands below 3 hexes", () => {
  const r = P.generateProcedural({ ...OPTS, continents: 4 });
  for (const m of r.landmasses.values()) {
    assert.ok(m.size >= 3, `speck landmass of ${m.size} hexes survived the cull`);
  }
});

test("continents: each landmass carries a deterministic character", () => {
  const a = P.generateProcedural({ ...OPTS, continents: 4 });
  const b = P.generateProcedural({ ...OPTS, continents: 4 });
  const chars = new Set(P.CHARACTERS.map((c) => c.id));
  for (const [id, m] of a.landmasses) {
    assert.ok(chars.has(m.character), "unknown character " + m.character);
    assert.strictEqual(b.landmasses.get(id).character, m.character, "character not deterministic");
  }
  // with 4 continents the major landmasses should not all share one character
  const majors = [...a.landmasses.values()].filter((m) => m.size > 50).map((m) => m.character);
  if (majors.length >= 3) {
    assert.ok(new Set(majors).size >= 2, "no character variety across major continents");
  }
});

test("continents: ocean fraction still honors the dial with the mask active", () => {
  for (const continents of [1, 5]) {
    const r = P.generateProcedural({ ...OPTS, continents, oceanPct: 0.65 });
    const frac = 1 - r.totalLand / r.totalCells;
    assert.ok(Math.abs(frac - 0.65) < 0.03, `ocean ${frac.toFixed(3)} vs 0.65 at count ${continents}`);
  }
});

test("continents: the requested number actually materializes (merge regression guard)", () => {
  // "real" continent = a landmass holding >= 8% of total land
  for (let seed = 1; seed <= 5; seed++) {
    for (const continents of [2, 4, 6]) {
      const r = P.generateProcedural({ seed, hexSize: 8.8, oceanPct: 0.65, continents });
      const sizes = [...r.landmasses.values()].map((m) => m.size);
      const real = sizes.slice(0, continents).filter((s) => s / r.totalLand >= 0.08).length;
      assert.strictEqual(real, continents,
        `seed ${seed} continents ${continents}: only ${real} real continents [${sizes.slice(0, continents)}]`);
    }
    const r7 = P.generateProcedural({ seed, hexSize: 8.8, oceanPct: 0.65, continents: 7 });
    const s7 = [...r7.landmasses.values()].map((m) => m.size);
    const real7 = s7.slice(0, 7).filter((s) => s / r7.totalLand >= 0.08).length;
    assert.ok(real7 >= 6, `seed ${seed} continents 7: only ${real7} real continents`);
  }
});

test("M2: bounded climate fields everywhere; coastal flag matches adjacency", () => {
  const r = P.generateProcedural(OPTS);
  for (const h of r.hexes.values()) {
    assert.ok(h.temperature >= 0 && h.temperature <= 1, "temperature out of range");
    assert.ok(h.rainfall >= 0 && h.rainfall <= 1, "rainfall out of range");
    if (h.water !== "none") continue;
    // M3: coastal means OCEAN-coastal — lakes don't grant sea breeze, on purpose.
    const adj = core.neighbors(h.col, h.row).some(([nc, nr]) => {
      const nb = r.hexes.get(core.cellKey(nc, nr));
      return nb && nb.water === "ocean";
    });
    assert.strictEqual(h.coastal, adj, "coastal flag mismatch");
  }
});

test("M2: characterOverride — same terrain, character-driven climate (A/B)", () => {
  const landKeys = (r) => [...r.hexes.values()].filter((h) => h.water === "none")
    .map((h) => h.col + "," + h.row).join(";");
  const meanOf = (r, field) => {
    let s = 0, n = 0;
    for (const h of r.hexes.values()) if (h.water === "none") { s += h[field]; n++; }
    return s / n;
  };
  const arid = P.generateProcedural({ ...OPTS, characterOverride: "arid" });
  const lush = P.generateProcedural({ ...OPTS, characterOverride: "lush" });
  assert.strictEqual(landKeys(arid), landKeys(lush), "override must not reshape the terrain");
  assert.ok(meanOf(arid, "rainfall") < meanOf(lush, "rainfall") * 0.6,
    `arid ${meanOf(arid, "rainfall").toFixed(3)} not clearly drier than lush ${meanOf(lush, "rainfall").toFixed(3)}`);
  const frozen = P.generateProcedural({ ...OPTS, characterOverride: "frozen" });
  const temperate = P.generateProcedural({ ...OPTS, characterOverride: "temperate" });
  assert.strictEqual(landKeys(frozen), landKeys(temperate), "override must not reshape the terrain");
  assert.ok(meanOf(frozen, "temperature") < meanOf(temperate, "temperature") - 0.1,
    "frozen must be clearly colder than temperate on the same terrain");
});

test("M2: subtropical desert belt — drier than the equatorial band (aggregate)", () => {
  // Aggregated across seeds so one continent layout can't flip the comparison.
  let eqSum = 0, eqN = 0, subSum = 0, subN = 0;
  for (let seed = 1; seed <= 5; seed++) {
    const r = P.generateProcedural({ seed, hexSize: 8.8, oceanPct: 0.65, continents: 4 });
    for (const h of r.hexes.values()) {
      if (h.water !== "none") continue;
      const lf = Math.abs(h.cy / core.WORLD.H - 0.5) * 2;
      if (lf < 0.15) { eqSum += h.rainfall; eqN++; }
      else if (lf > 0.25 && lf < 0.37) { subSum += h.rainfall; subN++; }
    }
  }
  assert.ok(eqN > 100 && subN > 100, `too little land to compare (${eqN}/${subN})`);
  assert.ok(subSum / subN < (eqSum / eqN) * 0.95,
    `desert belt ${(subSum / subN).toFixed(3)} not drier than equator ${(eqSum / eqN).toFixed(3)}`);
});

test("M2.5: warp dial — default 60, reshapes coastlines, lattice and land budget stable", () => {
  const smooth = P.generateProcedural({ ...OPTS, warp: 0 });
  const def = P.generateProcedural(OPTS);
  const explicit = P.generateProcedural({ ...OPTS, warp: 60 });
  assert.deepStrictEqual([...def.hexes.entries()], [...explicit.hexes.entries()],
    "default warp must be 60 (regression: today's worlds unchanged)");
  const wild = P.generateProcedural({ ...OPTS, warp: 130 });
  const landKeys = (r) => [...r.hexes.values()].filter((h) => h.water === "none")
    .map((h) => h.col + "," + h.row).join(";");
  assert.notStrictEqual(landKeys(smooth), landKeys(wild), "warp must reshape the world");
  assert.deepStrictEqual(smooth.geom, wild.geom, "the hex lattice must not move");
  assert.ok(Math.abs(1 - smooth.totalLand / wild.totalLand) < 0.15,
    "quantile sea level keeps the land budget stable across warp");
});

test("M2.5: sea breeze — near-coast land is clearly wetter than the deep interior", () => {
  const r = P.generateProcedural(OPTS);
  let nearS = 0, nearN = 0, deepS = 0, deepN = 0;
  for (const h of r.hexes.values()) {
    if (h.water === "ocean") { assert.strictEqual(h.coastDist, 0); continue; }
    // M3: lake/saltflat cells keep the coastDist they had as land during the
    // advection sweep, but they're surface water now — out of the land means.
    if (h.water !== "none") continue;
    assert.ok(h.coastDist >= 1, "land must carry a coast distance");
    assert.strictEqual(h.coastal, h.coastDist === 1, "coastal flag = ring 1");
    if (h.coastDist <= 2) { nearS += h.rainfall; nearN++; }
    else if (h.coastDist >= 4) { deepS += h.rainfall; deepN++; }
  }
  assert.ok(nearN > 100 && deepN > 100, `too few cells (${nearN}/${deepN})`);
  assert.ok(nearS / nearN > (deepS / deepN) * 1.25,
    `near-coast ${(nearS / nearN).toFixed(3)} not clearly wetter than interior ${(deepS / deepN).toFixed(3)}`);
});

test("M2.5: the continent-count guarantee holds through warp 110", () => {
  // Beyond ~110 heavy warp can smear the rift trenches and merge continents
  // (Pangaea territory) — that zone is deliberately allowed; this pins the safe zone.
  for (const warp of [0, 110]) {
    for (let seed = 1; seed <= 3; seed++) {
      const r = P.generateProcedural({ seed, hexSize: 8.8, oceanPct: 0.65, continents: 4, warp });
      const sizes = [...r.landmasses.values()].map((m) => m.size);
      const real = sizes.slice(0, 4).filter((s) => s / r.totalLand >= 0.08).length;
      assert.strictEqual(real, 4, `warp ${warp} seed ${seed}: only ${real} real continents`);
    }
  }
});
test("M3: rivers with real mouths; flux + labels consistent; counts wired", () => {
  const Hy = require("../src/procgen/hydrology.js");
  const r = P.generateProcedural(OPTS);
  assert.ok(Array.isArray(r.rivers) && r.rivers.length > 0, "no river segments on seed 3");
  assert.ok(r.riverCount > 0, "no river reaches a mouth");
  assert.ok(Number.isInteger(r.lakeCount) && Number.isInteger(r.saltflatCount));
  for (const h of r.hexes.values()) {
    assert.ok(Number.isFinite(h.flux) && h.flux >= 0, "flux missing");
    assert.strictEqual(typeof h.snowcap, "boolean");
    if (h.water === "lake") {
      assert.strictEqual(h.biome, "lake");
      assert.strictEqual(h.playable, false, "lakes must not be selectable land");
    }
    if (h.water === "saltflat") assert.strictEqual(h.playable, true, "salt flats are walkable");
    if (h.snowcap) {
      assert.ok(h.water === "none", "snowcap on water");
      assert.ok(h.temperature <= Hy.HYDRO.SNOW_TEMP + 1e-12 &&
                h.elevation >= Hy.HYDRO.SNOW_ELEV - 1e-12, "snowcap off the snowline");
    }
  }
});

test("M3: snowcaps follow temperature — frozen override out-snows arid (same terrain)", () => {
  const count = (override) => {
    let n = 0;
    for (let seed = 1; seed <= 3; seed++) {
      const r = P.generateProcedural({ seed, hexSize: 8.8, oceanPct: 0.65,
        continents: 4, characterOverride: override });
      for (const h of r.hexes.values()) if (h.snowcap) n++;
    }
    return n;
  };
  const frozen = count("frozen"), arid = count("arid");
  assert.ok(frozen > 0, "no snowcaps even on all-frozen worlds — raise SNOW_TEMP, the milestone needs visible caps");
  // Superset guarantee, not a margin: same terrain, frozen is strictly colder, so
  // every arid snowcap hex is also a frozen snowcap hex.
  assert.ok(frozen >= arid, `frozen (${frozen}) must at least match arid (${arid})`);
});

test("M3.5: minLake dial — raising it never adds lakes, and actually culls specks", () => {
  const lakes = (minLake) => {
    let n = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const r = P.generateProcedural({ seed, hexSize: 8.8, oceanPct: 0.65, continents: 4, minLake });
      n += r.lakeCount;
    }
    return n;
  };
  const all = lakes(1), def = lakes(3), strict = lakes(8);
  assert.ok(def <= all && strict <= def, `not monotone: ${all} / ${def} / ${strict}`);
  assert.ok(strict < all, "minLake 8 culled nothing across 5 seeds — the dial looks inert");
});

test("M4: refinement is a polish, not a repaint — and rain shadows survive it", () => {
  for (const seed of [1, 2, 3]) {
    const base = { seed, hexSize: 8.8, oceanPct: 0.65, continents: 4 };
    const raw = P.generateProcedural({ ...base, refineSweeps: 0 });   // dither only
    const ref = P.generateProcedural(base);                            // dither + ICM
    let land = 0, same = 0, dryRaw = 0, dryRef = 0;
    for (const [k, h] of raw.hexes) {
      if (h.water !== "none") continue;
      land++;
      const g = ref.hexes.get(k);
      if (g.biome === h.biome) same++;
      if (h.biome === "desert" || h.biome === "steppe") dryRaw++;
      if (g.biome === "desert" || g.biome === "steppe") dryRef++;
    }
    assert.ok(same / land >= 0.75,
      `seed ${seed}: refine repainted ${(100 - (100 * same) / land).toFixed(0)}% of land`);
    assert.ok(same / land < 1, `seed ${seed}: refine did nothing at all`);
    assert.ok(dryRef >= dryRaw * 0.7,
      `seed ${seed}: dry biomes eroded ${dryRaw} -> ${dryRef} — rain shadows must survive`);
  }
});

test("M3.5: default minLake is HYDRO.MIN_LAKE and is reported on the result", () => {
  const Hy2 = require("../src/procgen/hydrology.js");
  const a = P.generateProcedural(OPTS);
  const b = P.generateProcedural({ ...OPTS, minLake: Hy2.HYDRO.MIN_LAKE });
  assert.strictEqual(a.lakeCount, b.lakeCount);
  assert.strictEqual(a.minLake, Hy2.HYDRO.MIN_LAKE);
});

const V = require("../src/procgen/validate.js");

test("M4: generateWorld — a rigged predicate rejects with reasons, then lands", () => {
  const predicate = (res) => res.seed >= 9 ? { ok: true } : { ok: false, reason: "rigged" };
  const r = P.generateWorld({ seed: 7, hexSize: 8.8, oceanPct: 0.65, continents: 4, predicate });
  assert.strictEqual(r.seed, 9);
  assert.strictEqual(r.requestedSeed, 7);
  assert.deepStrictEqual(r.rejections,
    [{ seed: 7, reason: "rigged" }, { seed: 8, reason: "rigged" }]);
});

test("M4: generateWorld — never blank: an unappeasable predicate still returns a world", () => {
  const predicate = () => ({ ok: false, reason: "nope" });
  const r = P.generateWorld({ seed: 1, hexSize: 8.8, oceanPct: 0.65, continents: 4, predicate });
  assert.ok(r.hexes.size > 0, "degraded path must still produce a world");
  assert.strictEqual(r.rejections.length, V.VALIDATE.MAX_TRIES);
  assert.strictEqual(r.seed, 1 + V.VALIDATE.MAX_TRIES - 1);
});

test("M4: validateWorld — floor predicates fire with human-readable reasons", () => {
  const good = P.generateProcedural(OPTS);
  assert.deepStrictEqual(V.validateWorld(good), { ok: true });
  const starved = { ...good, riverCount: 1 };
  assert.match(V.validateWorld(starved).reason, /river/);
  const mono = { ...good, biomeCounts: new Map([["desert", good.totalLand]]) };
  assert.match(V.validateWorld(mono).reason, /biome/);
  const merged = { ...good, landmasses: new Map([[1, {}]]), continents: 4, warp: 60 };
  assert.match(V.validateWorld(merged).reason, /landmass/);
  const pangaea = { ...merged, warp: 140 };   // the deliberate Pangaea zone
  assert.strictEqual(V.validateWorld(pangaea).ok, true,
    "beyond warp 110 the landmass-count check must stand down (Art kept the zone)");
});

test("M4: generateWorld default predicate — the seed panel rarely rejects", () => {
  let rejectedSeeds = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const r = P.generateWorld({ seed, hexSize: 8.8, oceanPct: 0.65, continents: 4 });
    if (r.rejections.length) rejectedSeeds++;
    assert.ok(r.rejections.length < V.VALIDATE.MAX_TRIES, "seed " + seed + " degraded");
  }
  assert.ok(rejectedSeeds <= 3,
    rejectedSeeds + "/10 seeds rejected — the floor predicate is too strict");
});

test("M4: generateWorld — deterministic per (opts)", () => {
  const opts = { seed: 2, hexSize: 8.8, oceanPct: 0.65, continents: 4 };
  const a = P.generateWorld(opts), b = P.generateWorld(opts);
  assert.strictEqual(a.seed, b.seed);
  assert.deepStrictEqual(a.rejections, b.rejections);
  assert.deepStrictEqual([...a.hexes.values()].map((h) => h.biome),
    [...b.hexes.values()].map((h) => h.biome));
});

test("M5: new dials at their defaults are byte-identical to omitting them", () => {
  const a = P.generateProcedural(OPTS);
  const b = P.generateProcedural({ ...OPTS,
    mountain: 1, rainMult: 1, riverPct: 0.9, riverCheat: 1, seaOffset: 0 });
  assert.deepStrictEqual(
    [...a.hexes.values()].map((h) => [h.biome, h.elevation, h.rainfall, h.water]),
    [...b.hexes.values()].map((h) => [h.biome, h.elevation, h.rainfall, h.water]));
  assert.strictEqual(a.riverCount, b.riverCount);
  assert.strictEqual(a.lakeCount, b.lakeCount);
});

test("M5: mountain dial — more relief means more alpine + snowcaps", () => {
  const count = (mountain) => {
    let n = 0;
    for (let seed = 1; seed <= 3; seed++) {
      const r = P.generateProcedural({ ...OPTS, seed, mountain });
      for (const h of r.hexes.values()) {
        if (h.biome === "alpine" || h.snowcap) n++;
      }
    }
    return n;
  };
  const low = count(0.5), high = count(1.7);
  assert.ok(high > low, `mountain dial inert: ${low} vs ${high}`);
});

test("M5: rainMult dial — wetter worlds, fewer dry biomes", () => {
  let rainLo = 0, rainHi = 0, dryLo = 0, dryHi = 0;
  for (let seed = 1; seed <= 3; seed++) {
    const lo = P.generateProcedural({ ...OPTS, seed, rainMult: 0.5 });
    const hi = P.generateProcedural({ ...OPTS, seed, rainMult: 1.5 });
    for (const h of lo.hexes.values()) {
      if (h.water !== "none") continue;
      rainLo += h.rainfall;
      if (h.biome === "desert" || h.biome === "steppe") dryLo++;
    }
    for (const h of hi.hexes.values()) {
      if (h.water !== "none") continue;
      rainHi += h.rainfall;
      if (h.biome === "desert" || h.biome === "steppe") dryHi++;
    }
  }
  assert.ok(rainHi > rainLo, "rainfall sum did not rise with rainMult");
  assert.ok(dryHi <= dryLo, `dry biomes rose with rainMult: ${dryLo} -> ${dryHi}`);
});

test("M5: seaOffset dial — positive offset drowns land", () => {
  const land = (seaOffset) => {
    let n = 0;
    for (let seed = 1; seed <= 3; seed++) {
      n += P.generateProcedural({ ...OPTS, seed, seaOffset }).totalLand;
    }
    return n;
  };
  const wet = land(0.04), dry = land(-0.04);
  assert.ok(dry > wet, `seaOffset inert: land ${dry} (dry) vs ${wet} (wet)`);
});

test("M6: every cell carries a fragmentId and a lawful margin tag", () => {
  const r = P.generateProcedural({ ...OPTS, continents: 4 });
  assert.strictEqual(r.fragments.length, 4);
  for (const h of r.hexes.values()) {
    if (h.water === "none") {
      assert.ok(Number.isInteger(h.fragmentId) && h.fragmentId >= 0 && h.fragmentId < 4,
        "bad fragmentId " + h.fragmentId);
    }
    assert.ok([null, "active", "passive"].includes(h.margin), "bad margin " + h.margin);
  }
});

test("M6: landmass characters come from their fragments", () => {
  const r = P.generateProcedural({ ...OPTS, continents: 4 });
  const fragChar = new Map(r.fragments.map((f) => [f.id, f.character]));
  for (const m of r.landmasses.values()) {
    if (m.size < r.totalLand * 0.08) continue;   // majors only — specks may straddle
    assert.ok([...fragChar.values()].includes(m.character),
      "landmass character " + m.character + " not on any fragment");
  }
});

test("M6: volcanic land exists on drifting worlds and hugs active margins", () => {
  let volc = 0;
  for (const seed of [1, 2, 3]) {
    const r = P.generateProcedural({ seed, hexSize: 8.8, oceanPct: 0.65, continents: 4 });
    for (const h of r.hexes.values()) {
      if (h.biome !== "volcanic") continue;
      volc++;
      assert.strictEqual(h.water, "none", "volcanic on water");
      assert.strictEqual(h.margin, "active", "volcanic off the active margin");
    }
  }
  assert.ok(volc > 0, "no volcanic land in 3 seeds at 4 fragments — the gate never fires");
});

test("M6: a lone supercontinent has no volcanoes (no drift, no subduction)", () => {
  for (const seed of [1, 2, 3]) {
    const r = P.generateProcedural({ seed, hexSize: 8.8, oceanPct: 0.65, continents: 1 });
    for (const h of r.hexes.values()) {
      assert.notStrictEqual(h.biome, "volcanic", "volcano without plate drift, seed " + seed);
    }
  }
});

test("M6: volcanic is terrain-derived — characterOverride cannot move it", () => {
  const keysOf = (o) => {
    const r = P.generateProcedural({ ...OPTS, continents: 4, characterOverride: o });
    return [...r.hexes.values()].filter((h) => h.biome === "volcanic")
      .map((h) => h.col + "," + h.row).join(";");
  };
  assert.strictEqual(keysOf("arid"), keysOf("lush"),
    "the volcanic set moved under a climate-only override — a terrain partition read climate");
});

test("M7.1: arid dial at its default 1 is byte-identical to omitting it", () => {
  const a = P.generateProcedural(OPTS);
  const b = P.generateProcedural({ ...OPTS, arid: 1 });
  assert.deepStrictEqual(
    [...a.hexes.values()].map((h) => [h.biome, h.elevation, h.rainfall, h.water]),
    [...b.hexes.values()].map((h) => [h.biome, h.elevation, h.rainfall, h.water]));
  assert.strictEqual(a.riverCount, b.riverCount);
  assert.strictEqual(a.lakeCount, b.lakeCount);
  assert.strictEqual(b.arid, 1, "res must carry the arid dial like the other dials");
});

test("M7.1: arid dial damps DRY-character intensity too — an Arid world softens at 0", () => {
  // The belt is only one desert source; Arid-character fragments (moist 0.45) are the
  // other dial-worthy one. At arid 0 the dry-character multiplier neutralizes (moist^0),
  // at 1 it is exact identity, at 2 it deepens. Lush (moist > 1) stays untouched.
  const dryShare = (arid) => {
    let dry = 0, land = 0;
    for (let seed = 1; seed <= 2; seed++) {
      const r = P.generateProcedural({ ...OPTS, seed, characterOverride: "arid", arid });
      for (const h of r.hexes.values()) {
        if (h.water !== "none" || h.biome === "lake" || h.biome === "saltflat") continue;
        land++;
        if (h.biome === "desert" || h.biome === "steppe") dry++;
      }
    }
    return dry / land;
  };
  const soft = dryShare(0), base = dryShare(1), harsh = dryShare(2);
  assert.ok(soft < base - 0.1,
    `arid 0 must clearly soften an Arid-character world: ${soft} vs ${base}`);
  assert.ok(harsh > base, `arid 2 must deepen it: ${base} -> ${harsh}`);
});

test("M7.1: arid dial leaves Lush characters alone — Lush still beats Temperate at arid 0", () => {
  // If the exponent were wrongly applied to moist > 1, Lush (1.55^0 = 1) would collapse
  // onto Temperate (1.0) at arid 0. Terrain is character-invariant, so the same seed
  // gives identical land — compare total rainfall directly.
  const wet = (characterOverride) => {
    const r = P.generateProcedural({ ...OPTS, seed: 2, characterOverride, arid: 0 });
    let s = 0;
    for (const h of r.hexes.values()) if (h.water === "none") s += h.rainfall;
    return s;
  };
  const lush = wet("lush"), temperate = wet("temperate");
  assert.ok(lush > temperate * 1.05,
    `Lush must stay wetter than Temperate at arid 0 (moist>1 untouched): ${lush} vs ${temperate}`);
});

test("M7.1: arid dial — arid 0 clears dry biomes toward the tropics, arid 2 grows them", () => {
  const dryCount = (arid) => {
    let n = 0;
    for (let seed = 1; seed <= 3; seed++) {
      const r = P.generateProcedural({ ...OPTS, seed, arid });
      for (const h of r.hexes.values()) {
        if (h.biome === "desert" || h.biome === "steppe") n++;
      }
    }
    return n;
  };
  const lush = dryCount(0), base = dryCount(1), harsh = dryCount(2);
  assert.ok(lush < base, `arid 0 did not reduce dry biomes: ${lush} vs ${base}`);
  assert.ok(harsh > base, `arid 2 did not grow dry biomes: ${base} -> ${harsh}`);
});
