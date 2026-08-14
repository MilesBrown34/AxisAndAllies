const test = require("node:test");
const assert = require("node:assert");
const B = require("../src/procgen/biomes.js");
const V = require("../src/procgen/validate.js");
const T = require("../src/procgen/themes.js");

const ENVELOPE_KEYS = new Set(["continents", "oceanPct", "warp", "minLake",
  "mountain", "rainMult", "riverPct", "riverCheat", "seaOffset", "characterOverride"]);
const PREDICATE_KEYS = new Set(["floors", "shareMin", "landmassMin", "largestShare"]);

test("themes: six well-formed themes, terran first and default", () => {
  assert.strictEqual(T.THEMES.length, 6);
  assert.strictEqual(T.THEMES[0].id, "terran");
  const ids = new Set(T.THEMES.map((t) => t.id));
  assert.strictEqual(ids.size, 6, "duplicate theme ids");
  const paletteIds = new Set(B.PALETTE.map((b) => b.id));
  const validateKeys = new Set(Object.keys(V.VALIDATE));
  for (const t of T.THEMES) {
    assert.ok(t.label && t.tagline, t.id + " missing label/tagline");
    for (const k of Object.keys(t.envelope)) {
      assert.ok(ENVELOPE_KEYS.has(k), t.id + " unknown envelope key " + k);
    }
    for (const id of Object.keys(t.palette)) {
      assert.ok(paletteIds.has(id), t.id + " palette override for unknown biome " + id);
    }
    for (const k of Object.keys(t.predicate)) {
      assert.ok(PREDICATE_KEYS.has(k), t.id + " unknown predicate key " + k);
    }
    for (const k of Object.keys(t.predicate.floors || {})) {
      assert.ok(validateKeys.has(k), t.id + " floor override for unknown dial " + k);
    }
    for (const s of t.predicate.shareMin || []) {
      for (const id of s.ids) {
        assert.ok(paletteIds.has(id), t.id + " shareMin over unknown biome " + id);
      }
    }
  }
  assert.strictEqual(T.themeById("nope").id, "terran");
  assert.strictEqual(T.themeById(undefined).id, "terran");
  assert.strictEqual(T.themeById("dune").id, "dune");
});

test("themes: themeSeed — terran is identity, every other theme a distinct universe", () => {
  const terran = T.themeById("terran");
  assert.strictEqual(T.themeSeed(7, terran), 7);
  const seen = new Set();
  for (const t of T.THEMES) {
    const s = T.themeSeed(7, t);
    assert.strictEqual(s, T.themeSeed(7, t), "themeSeed not deterministic");
    seen.add(s);
  }
  assert.strictEqual(seen.size, 6, "theme seed universes collide at seed 7");
});

test("themes: applyTheme — envelope fills gaps, explicit opts always win", () => {
  const dune = T.themeById("dune");
  const filled = T.applyTheme(dune, { seed: 3 });
  assert.strictEqual(filled.characterOverride, "arid");
  assert.strictEqual(filled.rainMult, dune.envelope.rainMult);
  const forced = T.applyTheme(dune, { seed: 3, rainMult: 1.8, oceanPct: 0.8 });
  assert.strictEqual(forced.rainMult, 1.8, "user dial must beat the envelope");
  assert.strictEqual(forced.oceanPct, 0.8);
  assert.strictEqual(forced.characterOverride, "arid", "untouched envelope keys stay");
  assert.strictEqual(forced.seed, 3);
});

test("themes: themedPalette — relabel/recolor by id, base never mutated", () => {
  const dune = T.themeById("dune");
  const before = JSON.stringify(B.PALETTE);
  const p = T.themedPalette(dune, B.PALETTE);
  assert.strictEqual(JSON.stringify(B.PALETTE), before, "base palette mutated");
  assert.deepStrictEqual(p.map((b) => b.id), B.PALETTE.map((b) => b.id),
    "themed palette must keep ids and order");
  const lake = p.find((b) => b.id === "lake");
  assert.strictEqual(lake.label, "Oasis", "dune must relabel lakes as oases");
  const terran = T.themedPalette(T.themeById("terran"), B.PALETTE);
  assert.deepStrictEqual(terran, B.PALETTE, "terran palette must be untouched");
});

const P = require("../src/procgen/worldgen.js");

test("themes: validateWorld — theme floors override, theme checks fire with reasons", () => {
  const good = P.generateProcedural({ seed: 2, hexSize: 8.8, oceanPct: 0.65, continents: 4 });
  const dune = T.themeById("dune");
  // Floor override: 1 river mouth fails the global floor (3) but passes dune's (1).
  const oneRiver = { ...good, riverCount: 1 };
  assert.strictEqual(V.validateWorld(oneRiver).ok, false);
  const duneOne = { ...oneRiver,
    biomeCounts: new Map([["desert", Math.ceil(good.totalLand * 0.6)],
      ["steppe", Math.floor(good.totalLand * 0.3)],
      ["tundra", Math.ceil(good.totalLand * 0.05)],
      ["forest", Math.ceil(good.totalLand * 0.05)]]) };
  assert.strictEqual(V.validateWorld(duneOne, dune).ok, true,
    JSON.stringify(V.validateWorld(duneOne, dune)));
  // shareMin: a lush world fails dune's dry-land floor with a named reason.
  // (The rig must still clear the biome-spread floor — floors run before flavor.)
  const lush = { ...good, biomeCounts: new Map([
    ["jungle", Math.ceil(good.totalLand * 0.6)],
    ["forest", Math.ceil(good.totalLand * 0.2)],
    ["tundra", Math.ceil(good.totalLand * 0.15)],
    ["desert", Math.floor(good.totalLand * 0.05)]]) };
  const vd = V.validateWorld(lush, dune);
  assert.strictEqual(vd.ok, false);
  assert.match(vd.reason, /dry land/);
  // landmassMin (archipelago) and largestShare.min (pangaea).
  const arch = T.themeById("archipelago");
  const merged = { ...good, landmasses: new Map([[1, { size: good.totalLand }]]) };
  assert.match(V.validateWorld(merged, arch).reason, /landmass/);
  const pangaea = T.themeById("pangaea");
  const half = Math.floor(good.totalLand / 2);
  const split = { ...good, warp: 125,
    landmasses: new Map([[1, { size: half }], [2, { size: good.totalLand - half }]]) };
  assert.match(V.validateWorld(split, pangaea).reason, /largest/);
});

test("themes: generateWorld terran ≡ pre-theme generateWorld, byte for byte", () => {
  const base = { seed: 2, hexSize: 8.8, oceanPct: 0.65, continents: 4 };
  const a = P.generateWorld(base);
  const b = P.generateWorld({ ...base, theme: "terran" });
  assert.strictEqual(a.seed, b.seed);
  assert.deepStrictEqual(a.rejections, b.rejections);
  assert.deepStrictEqual([...a.hexes.values()].map((h) => h.biome),
    [...b.hexes.values()].map((h) => h.biome));
  assert.strictEqual(a.theme, "terran");
});

test("themes: each theme reads as itself — cross-theme aggregate directions", () => {
  // Aggregates over 3 seeds; envelope + characterOverride must move the mix.
  const mix = (theme) => {
    const acc = { dry: 0, cold: 0, land: 0, masses: 0, largest: 0, total: 0 };
    for (let seed = 1; seed <= 3; seed++) {
      const r = P.generateWorld({ seed, hexSize: 8.8, theme });
      acc.total++;
      acc.masses += r.landmasses.size;
      let big = 0;
      for (const m of r.landmasses.values()) if (m.size > big) big = m.size;
      acc.largest += big / r.totalLand;
      for (const h of r.hexes.values()) {
        if (h.water !== "none" && h.water !== "saltflat") continue;
        acc.land++;
        if (["desert", "steppe", "savanna", "saltflat"].includes(h.biome)) acc.dry++;
        if (["ice", "tundra", "taiga", "alpine"].includes(h.biome)) acc.cold++;
      }
    }
    return acc;
  };
  const terran = mix("terran"), dune = mix("dune"), glacial = mix("glacial");
  const arch = mix("archipelago"), pangaea = mix("pangaea");
  assert.ok(dune.dry / dune.land > terran.dry / terran.land,
    "dune must be drier than terran");
  assert.ok(glacial.cold / glacial.land > terran.cold / terran.land,
    "glacial must be colder than terran");
  assert.ok(arch.masses > terran.masses,
    "archipelago must shatter into more landmasses");
  assert.ok(pangaea.largest / 3 > terran.largest / 3,
    "pangaea's largest landmass must dominate more than terran's");
});

test("themes: generateWorld — every theme lands a world without degrading (seeds 1–5)", () => {
  let rejected = 0;
  for (const t of T.THEMES) {
    for (let seed = 1; seed <= 5; seed++) {
      const r = P.generateWorld({ seed, hexSize: 8.8, theme: t.id });
      assert.ok(r.rejections.length < V.VALIDATE.MAX_TRIES,
        t.id + " seed " + seed + " degraded: " +
        JSON.stringify(r.rejections));
      if (r.rejections.length) rejected++;
    }
  }
  assert.ok(rejected <= 8,
    rejected + "/30 theme-seeds rejected — some predicate is too strict for its envelope");
});

test("themes: generateWorld — deterministic per (opts, theme); seeds stay user-space", () => {
  const opts = { seed: 3, hexSize: 8.8, theme: "dune" };
  const a = P.generateWorld(opts), b = P.generateWorld(opts);
  assert.deepStrictEqual([...a.hexes.values()].map((h) => h.biome),
    [...b.hexes.values()].map((h) => h.biome));
  assert.strictEqual(a.seed, b.seed);
  assert.ok(a.seed >= 3 && a.seed < 3 + V.VALIDATE.MAX_TRIES,
    "res.seed must be the user-space seed, not the hash: " + a.seed);
  const lake = a.palette.find((p) => p.id === "lake");
  assert.strictEqual(lake.label, "Oasis", "dune palette must reach the result");
  const terran = P.generateWorld({ seed: 3, hexSize: 8.8 });
  assert.notDeepStrictEqual([...a.hexes.values()].map((h) => h.biome),
    [...terran.hexes.values()].map((h) => h.biome),
    "dune at seed 3 must be a different world from terran at seed 3");
});

test("M6: primordial ships real volcanics, not a re-skin", () => {
  const prim = T.themeById("primordial");
  assert.ok(!prim.palette.alpine || !prim.palette.alpine.label,
    "primordial still relabels alpine — the M5 stopgap must retire with real volcanics");
  assert.ok((prim.predicate.shareMin || []).some((s) => s.ids.includes("volcanic")),
    "primordial's promise must include the volcanic id");
  let volc = 0;
  for (let seed = 1; seed <= 3; seed++) {
    const r = P.generateWorld({ seed, hexSize: 8.8, theme: "primordial" });
    volc += r.biomeCounts.get("volcanic") || 0;
  }
  assert.ok(volc > 0, "no volcanic cells on 3 primordial worlds");
});
