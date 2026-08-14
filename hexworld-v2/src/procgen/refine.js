// HexWorld procgen — biome refinement (Milestone 4). UMD-lite, pure.
// Dithered thresholds + a Potts/MRF polish: labels relax under ICM sweeps that
// minimize E(L) = W_UNARY·boxDist(L,t,r) − W_PYR·pyramid(L) − W_PAIR·Σnb aff(L,nb)/6.
// The unary anchors a hex to its climate (rain shadows survive — the climate still
// says desert); the pairwise K×K affinity matrix (designer-editable) absorbs speckle
// and buffers hostile adjacencies; the pyramid term is multi-scale neighborhood
// evidence (indicator diffused by iterated 1-ring means, sampled at 1/2/4 passes,
// equal-weight — the log-kernel approximation). Gates are frozen: ice, alpine,
// volcanic (M6), and all water/surface labels are never reassigned and never
// candidates, but they DO act as neighbors. RNG: dither only — positional substream per hex ("dither:"+key);
// ICM is a deterministic argmin (sorted keys, direction alternating per sweep,
// incumbent wins ties), so no draw order can ever change a world.
(function (root, factory) {
  if (typeof module === "object" && module.exports !== undefined) {
    module.exports = factory(require("../core.js"), require("./noise.js"), require("./biomes.js"));
  } else {
    root.HexWorldRefine = factory(root.HexWorldCore, root.HexWorldNoise, root.HexWorldBiomes);
  }
})(typeof self !== "undefined" ? self : globalThis, function (core, N, B) {
  // The M4 dial block. Tunable at the visual gate; tests assert shape, not values.
  const REFINE = {
    SWEEPS: 4,        // ICM passes (spec: 3–5); 0 disables — the A/B lever
    W_UNARY: 1.0,     // climate-fit weight (squared box distance in (t, r))
    W_PAIR: 0.55,     // neighbor-affinity weight (the K×K matrix)
    W_PYR: 0.35,      // regional-evidence weight (the multi-scale pyramid)
    DITHER: 0.035,    // ± jitter on (t, r) before classification (breaks banding)
    EPS_E: 1e-12,     // strict-improvement margin — ties keep the incumbent
  };

  // Designer-editable adjacency affinities (sorted-pair keys, a < b). Same label = 1,
  // unlisted = 0. Positive pairs border happily; negative pairs are climate whiplash
  // the relaxation pushes a buffer biome between.
  const AFFINITY_PAIRS = {
    "taiga|tundra": 0.6, "ice|tundra": 0.6, "alpine|tundra": 0.5, "steppe|tundra": 0.3,
    "alpine|volcanic": 0.5,
    "forest|taiga": 0.5, "alpine|taiga": 0.4, "steppe|taiga": 0.3,
    "desert|steppe": 0.5, "savanna|steppe": 0.5, "forest|steppe": 0.3,
    "desert|savanna": 0.4, "desert|saltflat": 0.5,
    "savanna|tropforest": 0.5, "jungle|tropforest": 0.6,
    "forest|rainforest": 0.6, "jungle|rainforest": 0.4,
    "desert|jungle": -0.8, "desert|rainforest": -0.8, "desert|tundra": -0.7,
    "desert|taiga": -0.5, "desert|forest": -0.4,
    "ice|jungle": -1.0, "ice|tropforest": -0.9, "ice|savanna": -0.8,
    "jungle|tundra": -1.0, "jungle|taiga": -0.8,
  };
  function affinityOf(a, b) {
    if (a === b) return 1;
    const k = a < b ? a + "|" + b : b + "|" + a;
    const v = AFFINITY_PAIRS[k];
    return v === undefined ? 0 : v;
  }

  function ditherAt(seed, key) {
    const r = N.substream(seed, "dither:" + key);
    return { dt: (r() - 0.5) * 2 * REFINE.DITHER, dr: (r() - 0.5) * 2 * REFINE.DITHER };
  }

  const TILES = B.BIOMES.slice(2);   // the 9 relabelable boxes (gates excluded)

  function boxDistance(b, t, r) {
    const dt = Math.max(b.t[0] - t, 0, t - b.t[1]);
    const dr = Math.max(b.r[0] - r, 0, r - b.r[1]);
    return dt * dt + dr * dr;
  }

  // Multi-scale regional evidence from the PRE-refine labels (a stable target —
  // refreshing per sweep would let the evidence drift under its own smoothing).
  function pyramidEvidence(hexes) {
    const land = [];
    for (const [k, h] of hexes) if (h.water === "none") land.push([k, h]);
    const nbsOf = new Map();
    for (const [k, h] of land) {
      const ids = [];
      for (const [nc, nr] of core.neighbors(h.col, h.row)) {
        const nk = core.cellKey(nc, nr);
        const nb = hexes.get(nk);
        if (nb && nb.water === "none") ids.push(nk);
      }
      nbsOf.set(k, ids);
    }
    const ev = new Map();
    for (const [k] of land) ev.set(k, new Float64Array(TILES.length));
    for (let li = 0; li < TILES.length; li++) {
      let f = new Map();
      for (const [k, h] of land) f.set(k, h.biome === TILES[li].id ? 1 : 0);
      let passes = 0;
      for (const sample of [1, 2, 4]) {
        while (passes < sample) {
          const g = new Map();
          for (const [k] of land) {
            let sum = f.get(k), n = 1;
            for (const nk of nbsOf.get(k)) { sum += f.get(nk); n++; }
            g.set(k, sum / n);
          }
          f = g; passes++;
        }
        for (const [k] of land) ev.get(k)[li] += f.get(k) / 3;
      }
    }
    return ev;
  }

  // In-place ICM relaxation over the mutable land hexes. Returns relabel count.
  function refineBiomes(hexes, seed, opts) {
    const sweeps = opts && opts.sweeps !== undefined ? opts.sweeps : REFINE.SWEEPS;
    if (sweeps <= 0) return 0;
    const keys = [];
    for (const [k, h] of hexes) {
      if (h.water === "none" && h.biome !== "ice" && h.biome !== "alpine"
        && h.biome !== "volcanic") keys.push(k);
    }
    keys.sort();
    const ev = pyramidEvidence(hexes);
    let changed = 0;
    for (let s = 0; s < sweeps; s++) {
      let flips = 0;
      for (let i = 0; i < keys.length; i++) {
        const k = keys[s % 2 ? keys.length - 1 - i : i];
        const h = hexes.get(k);
        const t = Math.max(0, Math.min(0.9999,
          h.coastal ? h.temperature + (0.5 - h.temperature) * B.MARITIME : h.temperature));
        const r = Math.max(0, Math.min(0.9999, h.rainfall));
        const neigh = [];
        for (const [nc, nr] of core.neighbors(h.col, h.row)) {
          const nb = hexes.get(core.cellKey(nc, nr));
          if (nb) neigh.push(nb.biome);
        }
        const e = ev.get(k);
        let best = h.biome, bestE = Infinity, curE = Infinity;
        for (let li = 0; li < TILES.length; li++) {
          const b = TILES[li];
          let aff = 0;
          for (const nbBiome of neigh) aff += affinityOf(b.id, nbBiome);
          const E = REFINE.W_UNARY * boxDistance(b, t, r)
            - REFINE.W_PYR * e[li]
            - REFINE.W_PAIR * (aff / 6);
          if (b.id === h.biome) curE = E;
          if (E < bestE - REFINE.EPS_E) { bestE = E; best = b.id; }
        }
        if (best !== h.biome && bestE < curE - REFINE.EPS_E) { h.biome = best; flips++; }
      }
      changed += flips;
      if (!flips) break;   // converged early
    }
    return changed;
  }

  return { REFINE, AFFINITY_PAIRS, affinityOf, ditherAt, pyramidEvidence, refineBiomes };
});
