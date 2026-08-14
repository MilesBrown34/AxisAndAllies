// HexWorld procgen — procedural world generation (Milestone 6: signed world +
// tectonics + climate + hydrology + refine + validate + dials). Pure & deterministic
// per (seed, sizeKey|hexSize, clusterR, oceanPct, continents, warp, minLake,
// characterOverride, refineSweeps, mountain, rainMult, arid, riverPct, riverCheat,
// seaOffset). Since M6 `continents` means FRAGMENT COUNT: the terrain backbone is
// supercontinent breakup (tectonics.js) — the old continent site masks are gone.
// The dials are plain parameters — they add ZERO randomness; climate adds NO
// randomness; tectonics, hydrology and the labeling dither use only substreams
// salted off the same seed.
// RNG discipline: replicates core.generate's 5 main-stream draws in the same order
// (size jitter, dx, dy, shiftQ, shiftR) so hex layout matches Earth mode at the same
// seed; ALL noise randomness comes from salted substreams and never touches that stream.
(function (root, factory) {
  if (typeof module === "object" && module.exports !== undefined) {
    module.exports = factory(require("../core.js"), require("./noise.js"),
      require("./tectonics.js"), require("./climate.js"), require("./biomes.js"),
      require("./hydrology.js"), require("./refine.js"), require("./validate.js"),
      require("./themes.js"));
  } else {
    root.HexWorldProcgen = factory(root.HexWorldCore, root.HexWorldNoise,
      root.HexWorldTectonics, root.HexWorldClimate, root.HexWorldBiomes,
      root.HexWorldHydrology, root.HexWorldRefine, root.HexWorldValidate,
      root.HexWorldThemes);
  }
})(typeof self !== "undefined" ? self : globalThis, function (core, N, Tec, C, B, Hy, R, V, T) {
  const { WORLD, SIZES } = core;

  // Continent personalities live with the plate model now (tectonics.js);
  // re-exported here so P.CHARACTERS / res.characters keep their address.
  const CHARACTERS = Tec.CHARACTERS;
  const CHAR_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

  const MIN_ISLAND = 3;   // land components smaller than this sink into shoals

  // Raw (pre-sea-level) elevation: tectonic crust (supercontinent breakup — the
  // dominant, saturating backbone) + low-freq mass + relief-scaled detail, all
  // sampled at domain-warped coordinates, with a polar fade so land does not hug
  // the top/bottom sheet edges. The noise amplitude rides the crust (amp), so
  // detail carves fragments instead of spawning bridge-land in the rift oceans.
  function rawElevation(cx, cy, ctx) {
    const W = WORLD.W;
    const wx = N.fbmCyl(ctx.sxWarp, cx + 137.1, cy + 89.7, { freq: 2, octaves: 3, W }) * ctx.warp;
    const wy = N.fbmCyl(ctx.sxWarp, cx - 211.3, cy + 41.9, { freq: 2, octaves: 3, W }) * ctx.warp;
    const x = cx + wx, y = cy + wy;
    const tec = ctx.tect.crustAt(x, y);
    const relief = tec.fragmentId >= 0
      ? CHAR_BY_ID.get(ctx.tect.fragments[tec.fragmentId].character).relief : 1;
    const cont = N.fbmCyl(ctx.sxElev, x, y, { freq: 1.1, octaves: 3, W });
    const detail = N.fbmCyl(ctx.sxElev, x + 977.4, y + 631.2, { freq: 3.2, octaves: 5, W });
    const polar = Math.pow(Math.abs(cy / WORLD.H - 0.5) * 2, 3);
    return { raw: tec.crust + (cont * 0.34 + detail * 0.42 * relief) * tec.amp - polar * 0.5,
      frag: tec.fragmentId, margin: tec.margin };
  }

  function generateProcedural(opts) {
    const seaOffset = Math.min(0.05, Math.max(-0.05, opts.seaOffset === undefined ? 0 : opts.seaOffset));
    const oceanPct = Math.min(0.9, Math.max(0.3,
      (opts.oceanPct === undefined ? 0.65 : opts.oceanPct) + seaOffset));
    const continents = Math.min(7, Math.max(1, opts.continents === undefined ? 4 : Math.floor(opts.continents)));
    // Domain-warp amplitude in pixels: 0 = round noise blobs, 60 = today's look,
    // 150 = craggy fjord-land. Same substream either way — the lattice never moves.
    const warp = Math.min(150, Math.max(0, opts.warp === undefined ? 60 : opts.warp));
    const minLake = Math.min(8, Math.max(1,
      opts.minLake === undefined ? Hy.HYDRO.MIN_LAKE : Math.floor(opts.minLake)));
    const mountain = Math.min(2, Math.max(0.25, opts.mountain === undefined ? 1 : opts.mountain));
    const rainMult = Math.min(2, Math.max(0.25, opts.rainMult === undefined ? 1 : opts.rainMult));
    const arid = Math.min(2, Math.max(0, opts.arid === undefined ? 1 : opts.arid));
    const riverPct = Math.min(0.98, Math.max(0.75, opts.riverPct === undefined ? Hy.HYDRO.RIVER_PCT : opts.riverPct));
    const riverCheat = Math.min(1, Math.max(0.5, opts.riverCheat === undefined ? Hy.HYDRO.CHEAT : opts.riverCheat));
    const rng = core.mulberry32(opts.seed);
    const base = opts.hexSize !== undefined ? opts.hexSize : SIZES[opts.sizeKey];
    const size = base * (0.92 + rng() * 0.16);           // draw 1 (same as core)
    const g = { size, hexW: Math.sqrt(3) * size, vs: 1.5 * size, dx: 0, dy: 0 };
    g.dx = (rng() - 0.5) * g.hexW;                        // draw 2
    g.dy = (rng() - 0.5) * g.vs;                          // draw 3

    const ctx = {
      sxElev: N.makeSimplex(N.substream(opts.seed, "elevation")),
      sxWarp: N.makeSimplex(N.substream(opts.seed, "warp")),
      tect: Tec.makeTectonics(opts.seed, continents, oceanPct, WORLD.W, WORLD.H),
      warp,
    };

    // Pass 1: every in-sheet cell, raw elevation + owning fragment + margin.
    const cells = [];
    const rows = Math.ceil(WORLD.H / g.vs) + 1;
    const cols = Math.ceil(WORLD.W / g.hexW) + 1;
    for (let row = -1; row <= rows; row++) {
      for (let col = -1; col <= cols; col++) {
        const { cx, cy } = core.cellCenter(col, row, g);
        if (cx < 0 || cx > WORLD.W || cy < 0 || cy > WORLD.H) continue;
        const e = rawElevation(cx, cy, ctx);
        cells.push({ col, row, cx, cy, raw: e.raw, frag: e.frag, margin: e.margin });
      }
    }

    // Sea level = quantile of the sorted raw field at oceanPct → signed + normalized.
    const sorted = Float64Array.from(cells, (c) => c.raw).sort();
    const sea = sorted[Math.min(sorted.length - 1, Math.floor(oceanPct * sorted.length))];
    let posMax = 1e-9, negMin = -1e-9;
    for (const c of cells) {
      c.es = c.raw - sea;
      if (c.es > posMax) posMax = c.es;
      if (c.es < negMin) negMin = c.es;
    }

    // Mountains dial (M5): a vertical-exaggeration exponent on the LAND side of the
    // hypsometric curve. Raw amplitude scaling is absorbed by the max-normalization
    // (a taller extreme peak pushes everyone ELSE down — probed, anti-monotone); the
    // exponent acts AFTER it, so >1 genuinely lifts mid-slopes toward the treeline/
    // snowline and <1 flattens the world. Monotone in elevation: coastlines, land
    // shape, and flow topology are untouched.
    const eLand = (e) => (mountain === 1 ? e : Math.pow(e, 1 / mountain));
    const hexes = new Map();
    const fragOf = new Map();
    for (const c of cells) {
      const elevation = c.es > 0 ? eLand(c.es / posMax) : c.es / -negMin;
      const water = elevation > 0 ? "none" : "ocean";
      const key = core.cellKey(c.col, c.row);
      fragOf.set(key, c.frag);
      hexes.set(key, {
        col: c.col, row: c.row, cx: c.cx, cy: c.cy,
        elevation, water, biome: null, landmassId: null, name: "Ocean",
        fragmentId: c.frag, margin: c.margin,
        temperature: 0, rainfall: 0, coastal: false, coastDist: 0, flux: 0, snowcap: false,
        playable: water === "none",
      });
    }

    // Connected components of land (BFS over the 6-neighborhood).
    const comps = [];
    {
      const seen = new Set();
      for (const [key, h] of hexes) {
        if (h.water !== "none" || seen.has(key)) continue;
        const queue = [key]; seen.add(key);
        const members = [];
        while (queue.length) {
          const k = queue.pop();
          members.push(k);
          const cur = hexes.get(k);
          for (const [nc, nr] of core.neighbors(cur.col, cur.row)) {
            const nk = core.cellKey(nc, nr);
            const nb = hexes.get(nk);
            if (nb && nb.water === "none" && !seen.has(nk)) { seen.add(nk); queue.push(nk); }
          }
        }
        comps.push(members);
      }
    }

    // Speck cull: components below MIN_ISLAND sink into shoals (shallow water) so the
    // map reads as continents + real islands, not noise dust.
    const kept = [];
    for (const members of comps) {
      if (members.length >= MIN_ISLAND) { kept.push(members); continue; }
      for (const k of members) {
        const h = hexes.get(k);
        h.elevation = -0.02;
        h.water = "ocean";
        h.playable = false;
      }
    }

    // Landmasses named by size rank; character = majority vote of member cells'
    // owning fragment (the fix for "Voronoi continents" labeling).
    kept.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
    const landmasses = new Map();
    let totalLand = 0;
    kept.forEach((members, i) => {
      const id = i + 1, name = "Landmass " + id;
      const votes = new Map();
      for (const k of members) {
        const s = fragOf.get(k);
        votes.set(s, (votes.get(s) || 0) + 1);
      }
      let bestSite = 0, bestVotes = -1;
      for (const [s, v] of votes) if (v > bestVotes) { bestVotes = v; bestSite = s; }
      const character = ctx.tect.fragments[bestSite]
        ? ctx.tect.fragments[bestSite].character : CHARACTERS[0].id;
      landmasses.set(id, { id, name, size: members.length, character });
      totalLand += members.length;
      for (const k of members) { const h = hexes.get(k); h.landmassId = id; h.name = name; }
    });

    // Dev/test dial: force every landmass's character for the climate stage.
    // Landmass-level on purpose — relief already acted via the natural deck, so the
    // terrain is identical across overrides; only the climate offsets are forced.
    if (opts.characterOverride && CHAR_BY_ID.has(opts.characterOverride)) {
      for (const m of landmasses.values()) m.character = opts.characterOverride;
    }

    // --- Climate (M2/M2.5): coast distance (BFS from water) → temperature → rainfall ---
    {
      const queue = [];
      for (const [key, h] of hexes) {
        if (h.water !== "none") queue.push(key);   // water = distance 0 (already in the literal)
      }
      let head = 0;
      while (head < queue.length) {
        const h = hexes.get(queue[head++]);
        for (const [nc, nr] of core.neighbors(h.col, h.row)) {
          const nk = core.cellKey(nc, nr);
          const nb = hexes.get(nk);
          if (nb && nb.water === "none" && nb.coastDist === 0) {
            nb.coastDist = h.coastDist + 1;
            queue.push(nk);
          }
        }
      }
      for (const h of hexes.values()) {
        if (h.water === "none") {
          if (h.coastDist === 0) h.coastDist = 9;   // sheet-edge-locked fallback
          h.coastal = h.coastDist === 1;
        }
      }
    }
    const charOf = (h) => (h.landmassId ? CHAR_BY_ID.get(landmasses.get(h.landmassId).character) : null);
    for (const h of hexes.values()) {
      const ch = charOf(h);
      h.temperature = C.temperatureAt(
        C.latFracOf(h.cy, WORLD.H), Math.max(0, h.elevation), ch ? ch.tempOffset : 0);
    }
    // Advection lanes: cells[] is generated row-major with col ascending (= west→east),
    // and same-row hexes are grid-adjacent, so each row is one wrapped latitude lane.
    const rowMap = new Map();
    for (const c of cells) {
      let arr = rowMap.get(c.row);
      if (!arr) rowMap.set(c.row, (arr = []));
      arr.push(core.cellKey(c.col, c.row));
    }
    for (const keys of rowMap.values()) {
      const rowHexes = keys.map((k) => hexes.get(k));
      const latFrac = C.latFracOf(rowHexes[0].cy, WORLD.H);
      const rain = C.advectRow(
        rowHexes.map((h) => ({ elev: h.elevation, water: h.water !== "none", temp: h.temperature })),
        C.windDirAt(latFrac), latFrac, arid);
      for (let i = 0; i < rowHexes.length; i++) {
        const h = rowHexes[i], ch = charOf(h);
        // arid (M7.1) also damps DRY-character intensity: moist<1 → moist^arid
        // (neutral at 0, identity at 1, deeper at 2). Wet characters (moist≥1)
        // stay untouched — Aridity is the dryness dial, not a lushness dial.
        const moist = ch ? (ch.moist < 1 && arid !== 1 ? Math.pow(ch.moist, arid) : ch.moist) : 1;
        h.rainfall = Math.min(1,
          rain[i] * C.CLIMATE.RAIN_NORM * moist * C.seaBreezeFactor(h.coastDist) * rainMult);
      }
    }

    // --- Hydrology (M3): junction rivers consume the rainfall field; endorheic
    // basins become salt lakes / salt flats; coastDist stays ocean-only (sea breeze
    // is a marine effect — lakes don't get it, on purpose). ---
    const hydro = Hy.computeHydrology(hexes, g, opts.seed, { minLake, riverPct, riverCheat });
    let lakeCount = 0, saltflatCount = 0;
    for (const bn of hydro.basins) {
      if (!bn.hexKeys.length) continue;   // culled speck — never pooled
      if (bn.kind === "flat") saltflatCount++; else lakeCount++;
      for (const hk of bn.hexKeys) {
        const h = hexes.get(hk);
        h.water = bn.kind === "flat" ? "saltflat" : "lake";
        h.playable = bn.kind === "flat";
        if (!h.playable && h.landmassId) {   // lakes leave the land ledger; salt flats stay
          totalLand--;
          landmasses.get(h.landmassId).size--;
        }
      }
    }
    for (const [hk, f] of hydro.hexFlux) hexes.get(hk).flux = f;

    // --- Labeling: ocean → depth bands; lake/saltflat → surface bands; land →
    // the Whittaker table over DITHERED (t, r) (M4: positional jitter breaks the
    // straight banding lines into organic transitions). Snowcaps ride the
    // lapse-rate snowline. ---
    for (const [key, h] of hexes) {
      h.snowcap = h.water === "none" &&
        h.temperature <= Hy.HYDRO.SNOW_TEMP && h.elevation >= Hy.HYDRO.SNOW_ELEV;
      if (h.water === "ocean") h.biome = B.depthBandOf(h.elevation);
      else if (h.water === "lake") h.biome = "lake";
      else if (h.water === "saltflat") h.biome = "saltflat";
      else if (h.margin === "active" && h.elevation >= Tec.TECT.VOLC_ELEV) {
        // M6: volcanic gate ahead of the Whittaker table — terrain-derived
        // (margin + altitude only), so climate overrides can never move it.
        h.biome = "volcanic";
      } else {
        const dj = R.ditherAt(opts.seed, key);
        h.biome = B.classifyBiome(
          h.temperature + dj.dt, h.rainfall + dj.dr, h.elevation, h.coastal);
      }
    }
    // --- Refine (M4): Potts/MRF polish — speckle absorbed, hostile adjacencies
    // buffered; the climate unary keeps rain shadows in place. refineSweeps is the
    // dev/test A/B lever, like characterOverride. ---
    R.refineBiomes(hexes, opts.seed,
      opts.refineSweeps === undefined ? undefined : { sweeps: opts.refineSweeps });
    const biomeCounts = new Map();
    for (const h of hexes.values()) {
      biomeCounts.set(h.biome, (biomeCounts.get(h.biome) || 0) + 1);
    }
    const nonLand = new Set([...B.WATER_BANDS, ...B.SURFACE_BANDS].map((b) => b.id));
    let biomeLandCount = 0;
    for (const id of biomeCounts.keys()) {
      if (!nonLand.has(id)) biomeLandCount++;
    }

    // Node clustering — same draws + id scheme as core.generate (name|cq,cr), so the
    // lattice shifts stay identical across modes and node modes at the same seed.
    const clusterR = opts.clusterR || 0;
    const shiftQ = Math.floor(rng() * 37), shiftR = Math.floor(rng() * 37);   // draws 4–5
    let clusters = null;
    if (clusterR > 0) {
      clusters = new Map();
      for (const [key, hex] of hexes) {
        if (!hex.playable) continue;
        const a = core.axialOf(hex.col, hex.row);
        const c = core.clusterCenterOf(a.q + shiftQ, a.r + shiftR, clusterR);
        const id = hex.name + "|" + c.q + "," + c.r;
        hex.clusterId = id;
        let cl = clusters.get(id);
        if (!cl) clusters.set(id, (cl = { id, name: hex.name, continent: hex.name, hexKeys: [] }));
        cl.hexKeys.push(key);
      }
    }

    return {
      mode: "proc", hexes, geom: g, seed: opts.seed, oceanPct, continents, warp, minLake,
      mountain, rainMult, arid, riverPct, riverCheat, seaOffset, clusterR, clusters,
      fragments: ctx.tect.fragments,
      landmasses, totalLand, totalCells: hexes.size, biomeCounts, biomeLandCount,
      rivers: hydro.rivers, riverCount: hydro.riverCount, lakeCount, saltflatCount,
      palette: B.PALETTE, characters: CHARACTERS,
    };
  }

  // Validated facade (M4/M5): generateProcedural stays raw AND theme-less; the app
  // calls THIS. A theme is applied here as: envelope defaults (the caller's dials
  // win) + a hashed per-theme seed universe + the theme predicate + a palette
  // re-skin. res.seed/rejections stay in USER seed space — the stats bar must
  // never show a hash. A failed predicate quietly retries seed+1 — and each
  // rejection is surfaced as {seed, reason}, never swallowed. An unappeasable
  // predicate returns the last world anyway: degraded beats blank.
  function generateWorld(opts) {
    const theme = T.themeById(opts.theme);
    const merged = T.applyTheme(theme, opts);
    const predicate = opts.predicate || ((res) => V.validateWorld(res, theme));
    const rejections = [];
    let res;
    for (let t = 0; t < V.VALIDATE.MAX_TRIES; t++) {
      res = generateProcedural({ ...merged, seed: T.themeSeed(opts.seed + t, theme) });
      res.seed = opts.seed + t;
      const v = predicate(res);
      if (v.ok) break;
      rejections.push({ seed: opts.seed + t, reason: v.reason });
    }
    res.theme = theme.id;
    res.palette = T.themedPalette(theme, res.palette);
    res.requestedSeed = opts.seed;
    res.rejections = rejections;
    return res;
  }

  return { CHARACTERS, MIN_ISLAND, THEMES: T.THEMES, rawElevation, generateProcedural, generateWorld };
});
