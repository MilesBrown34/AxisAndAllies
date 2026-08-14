// HexWorld procgen — hydrology (Milestone 3). UMD-lite, pure, zero-dep.
// Rivers live on the junction graph of hex corners: every vertex of a pointy-top
// grid is the top corner (c5) of exactly one hex (an N junction) or the bottom
// corner (c2) of one (an S junction). N(c,r) touches {H, NW, NE} and links to
// S(NW), S(NE), S(c,r-2); S(c,r) touches {H, SW, SE} and links to N(SW), N(SE),
// N(c,r+2). Each link is one hex EDGE — so river mouths land exactly on the
// coastline. Pipeline: priority-flood (Barnes) -> one seeded downhill outflow per
// junction -> rainfall-weighted flux accumulation -> basin evaporation check
// (terminal salt lake / salt flat, or rim overflow) -> top-percentile river edges.
// RNG: ONLY positional substreams ("hydro:" + junction id) — never sequential.
(function (root, factory) {
  if (typeof module === "object" && module.exports !== undefined) {
    module.exports = factory(require("../core.js"), require("./noise.js"));
  } else {
    root.HexWorldHydrology = factory(root.HexWorldCore, root.HexWorldNoise);
  }
})(typeof self !== "undefined" ? self : globalThis, function (core, N) {
  // The M3 dial block. Tunable at the visual gate; tests assert shape, not values.
  const HYDRO = {
    EPS: 1e-9,        // depression detection: filled > alt + EPS
    EDGE_SEA: -0.02,  // off-sheet neighbors count as sea at this depth (edge drains)
    LAKE_EVAP: 0.75,  // evaporation capacity per flooded hex (rain-mass units)
    SALT_RATIO: 0.4,  // inflow/capacity below this: dry bed (salt flat), else salt lake
    RIVER_PCT: 0.9,   // flux percentile a junction must reach to carry a river
    MIN_LAKE: 3,      // basins flooding fewer hexes than this never read as lakes:
                      // open ones drain through, starved ones dry to salt flats
                      // (Art's speck-lake call at the M3 gate)
    CHEAT: 1.0,       // width exponent: w01 = (f/max)^(0.5·CHEAT); 1 = honest sqrt,
                      // <1 draws minor rivers fatter (the honest-rivers dial)
    SNOW_TEMP: 0.16,  // snowcap: at or below this temperature...
    SNOW_ELEV: 0.5,   //          ...and at or above this normalized elevation
  };

  function cornerIds(col, row) {
    const K = core.cellKey, nbs = core.neighbors(col, row);
    return [
      "N|" + K(col, row), "S|" + K(col, row),
      "S|" + K(nbs[5][0], nbs[5][1]), "N|" + K(nbs[1][0], nbs[1][1]),
      "N|" + K(nbs[2][0], nbs[2][1]), "S|" + K(nbs[4][0], nbs[4][1]),
    ];
  }

  function buildJunctions(hexes, geom) {
    const junctions = new Map();
    const ensure = (kind, col, row) => {
      const id = kind + "|" + core.cellKey(col, row);
      let j = junctions.get(id);
      if (!j) {
        const { cx, cy } = core.cellCenter(col, row, geom);
        j = { id, kind, col, row, x: cx, y: cy + (kind === "N" ? -geom.size : geom.size),
              alt: Infinity, sea: false, hexKeys: [], links: null,
              filled: 0, parent: null, popIdx: -1, out: null, flux: 0, lake: false };
        junctions.set(id, j);
      }
      return j;
    };
    // A junction exists iff at least one of its touching hexes is land.
    for (const h of hexes.values()) {
      if (h.water !== "none") continue;
      const nbs = core.neighbors(h.col, h.row);
      ensure("N", h.col, h.row); ensure("S", h.col, h.row);
      ensure("S", nbs[5][0], nbs[5][1]); ensure("N", nbs[1][0], nbs[1][1]);
      ensure("N", nbs[2][0], nbs[2][1]); ensure("S", nbs[4][0], nbs[4][1]);
    }
    for (const j of junctions.values()) {
      const nbs = core.neighbors(j.col, j.row);
      const touch = j.kind === "N"
        ? [[j.col, j.row], nbs[4], nbs[5]]
        : [[j.col, j.row], nbs[2], nbs[1]];
      for (const [c, r] of touch) {
        const key = core.cellKey(c, r);
        const h = hexes.get(key);
        if (!h) { j.sea = true; j.alt = Math.min(j.alt, HYDRO.EDGE_SEA); continue; }
        j.hexKeys.push(key);
        j.alt = Math.min(j.alt, h.elevation);
        if (h.water !== "none") j.sea = true;
      }
      const L = j.kind === "N"
        ? ["S|" + core.cellKey(nbs[4][0], nbs[4][1]),
           "S|" + core.cellKey(nbs[5][0], nbs[5][1]),
           "S|" + core.cellKey(j.col, j.row - 2)]
        : ["N|" + core.cellKey(nbs[2][0], nbs[2][1]),
           "N|" + core.cellKey(nbs[1][0], nbs[1][1]),
           "N|" + core.cellKey(j.col, j.row + 2)];
      j.links = L.filter((id) => junctions.has(id));
    }
    return junctions;
  }

  // Barnes priority-flood over the junction graph. Seeds: sea junctions at their own
  // altitude. Pop the lowest (ties broken by id — deterministic); each unseen neighbor
  // floods to max(its alt, current filled) and records the flooding parent. popIdx is
  // the pop order = a topological order of the drainage forest.
  function priorityFlood(junctions) {
    const heap = [];   // [filled, id, parentId]
    const lt = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
    const push = (e) => {
      heap.push(e);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!lt(heap[i], heap[p])) break;
        [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && lt(heap[l], heap[m])) m = l;
          if (r < heap.length && lt(heap[r], heap[m])) m = r;
          if (m === i) break;
          [heap[i], heap[m]] = [heap[m], heap[i]]; i = m;
        }
      }
      return top;
    };
    for (const j of junctions.values()) {
      j.filled = NaN; j.parent = null; j.popIdx = -1;
      if (j.sea) push([j.alt, j.id, null]);
    }
    let n = 0;
    while (heap.length) {
      const [f, id, parentId] = pop();
      const j = junctions.get(id);
      if (j.popIdx >= 0) continue;             // already settled at a lower level
      j.filled = f; j.parent = parentId; j.popIdx = n++;
      for (const nid of j.links) {
        const nb = junctions.get(nid);
        if (nb.popIdx < 0) push([Math.max(nb.alt, f), nid, id]);
      }
    }
  }

  // One seeded downhill outflow per junction: a positional-hash pick among the
  // strictly-lower-filled neighbors (rivers wander instead of combing); on flats
  // and filled pits, fall back to the flood parent. Termination: (filled, popIdx)
  // strictly decreases lexicographically along any chain — a strictly-lower step
  // drops filled; a parent step keeps filled and drops popIdx — so every chain
  // reaches a sea junction (the only ones with out = null).
  function routeFlow(junctions, seed) {
    for (const j of junctions.values()) {
      if (j.sea || j.popIdx < 0) { j.out = null; continue; }
      const lower = [];
      for (const nid of j.links) {
        if (junctions.get(nid).filled < j.filled) lower.push(nid);
      }
      if (!lower.length) { j.out = j.parent; continue; }
      const r = N.substream(seed, "hydro:" + j.id)();
      j.out = lower[Math.min(lower.length - 1, Math.floor(r * lower.length))];
    }
  }

  // Seed rainfall/6 per corner (a hex has 6 corners; a junction ≤3 touching hexes —
  // the total is conserved), then push downstream. popIdx ascending is downstream-
  // first, so DESCENDING order visits every junction before its outflow target.
  function accumulateFlux(junctions, hexes) {
    for (const j of junctions.values()) j.flux = 0;
    for (const h of hexes.values()) {
      if (h.water !== "none") continue;
      for (const id of cornerIds(h.col, h.row)) {
        const j = junctions.get(id);
        if (j) j.flux += h.rainfall / 6;
      }
    }
    const order = [...junctions.values()].sort((a, b) => b.popIdx - a.popIdx);
    for (const j of order) {
      if (j.out) junctions.get(j.out).flux += j.flux;
    }
  }

  function findBasins(junctions) {
    const seen = new Set(), basins = [];
    for (const j of junctions.values()) {
      if (j.sea || j.popIdx < 0 || j.filled <= j.alt + HYDRO.EPS || seen.has(j.id)) continue;
      const members = [], stack = [j.id];
      seen.add(j.id);
      let level = -Infinity, spill = j;
      while (stack.length) {
        const cur = junctions.get(stack.pop());
        members.push(cur.id);
        if (cur.filled > level) level = cur.filled;
        if (cur.popIdx < spill.popIdx) spill = cur;
        for (const nid of cur.links) {
          const nb = junctions.get(nid);
          if (!seen.has(nid) && !nb.sea && nb.filled > nb.alt + HYDRO.EPS) {
            seen.add(nid); stack.push(nid);
          }
        }
      }
      members.sort();
      basins.push({ members, level, spill: spill.id, kind: null, hexKeys: [] });
    }
    // Upstream first, so a terminal cut lands before downstream basins are judged.
    basins.sort((a, b) => (b.level - a.level) || (a.spill < b.spill ? -1 : 1));
    return basins;
  }

  function settleBasins(junctions, basins, hexes, minLake) {
    const ml = minLake === undefined ? HYDRO.MIN_LAKE : minLake;
    for (const b of basins) {
      const lakeKeys = new Set();
      for (const jid of b.members) {
        for (const hk of junctions.get(jid).hexKeys) {
          const h = hexes.get(hk);
          if (h && h.water === "none" && h.elevation + HYDRO.EPS < b.level) lakeKeys.add(hk);
        }
      }
      const spill = junctions.get(b.spill);
      const capacity = Math.max(1, lakeKeys.size) * HYDRO.LAKE_EVAP;
      const ratio = spill.flux / capacity;
      b.kind = ratio >= 1 ? "open" : ratio >= HYDRO.SALT_RATIO ? "salt" : "flat";
      // Speck cull (M3 gate feedback): a footprint under minLake hexes reverts to
      // plain land whatever its kind — open ponds drain through, starved ones still
      // kill their river (the terminal cut below) but leave no 1-hex pan. The cull
      // must NOT branch on kind: kind is rainfall-driven, and a rainfall-dependent
      // water partition would break characterOverride's terrain-invariance.
      b.culled = lakeKeys.size < ml;
      if (b.kind !== "open") {
        // The river dies here: its throughput leaves the downstream chain.
        let cur = spill.out;
        const cut = spill.flux;
        while (cur) {
          const t = junctions.get(cur);
          t.flux = Math.max(0, t.flux - cut);
          cur = t.out;
        }
      }
      if (b.kind !== "flat" && !b.culled) {
        for (const jid of b.members) junctions.get(jid).lake = true;
      }
      b.hexKeys = b.culled ? [] : [...lakeKeys].sort();
    }
  }

  function selectRivers(junctions, riverPct, cheat) {
    const pct = riverPct === undefined ? HYDRO.RIVER_PCT : riverPct;
    const ch = cheat === undefined ? HYDRO.CHEAT : cheat;
    const vals = [];
    for (const j of junctions.values()) {
      if (!j.sea && j.flux > 0) vals.push(j.flux);
    }
    vals.sort((a, b) => a - b);
    const thr = vals.length
      ? vals[Math.min(vals.length - 1, Math.floor(vals.length * pct))]
      : Infinity;
    const segs = [];
    let mouths = 0, maxF = 0;
    for (const j of junctions.values()) {
      j.riverSeg = false;
      if (j.sea || !j.out || j.flux < thr) continue;
      const t = junctions.get(j.out);
      if (j.lake && t.lake) continue;          // don't draw under lake surfaces
      j.riverSeg = true;
      segs.push({ x1: j.x, y1: j.y, x2: t.x, y2: t.y, f: j.flux, w01: 0 });
      if (j.flux > maxF) maxF = j.flux;
      if (t.sea || t.lake) mouths++;
    }
    // Width: honest = sqrt(flux share). cheat < 1 flatters minor rivers (fatter
    // strokes) without touching selection — a monotone pow around the percentile
    // can't change the selected set, so THIS is where the honest-rivers dial lives.
    for (const s of segs) s.w01 = maxF > 0 ? Math.pow(s.f / maxF, 0.5 * ch) : 0;
    return { segs, mouths };
  }

  function computeHydrology(hexes, geom, seed, opts) {
    const junctions = buildJunctions(hexes, geom);
    priorityFlood(junctions);
    routeFlow(junctions, seed);
    accumulateFlux(junctions, hexes);
    const basins = findBasins(junctions);
    settleBasins(junctions, basins, hexes, opts && opts.minLake);
    const { segs, mouths } = selectRivers(junctions,
      opts && opts.riverPct, opts && opts.riverCheat);
    const hexFlux = new Map();
    for (const j of junctions.values()) {
      for (const hk of j.hexKeys) {
        const f = hexFlux.get(hk) || 0;
        if (j.flux > f) hexFlux.set(hk, j.flux);
      }
    }
    return { junctions, basins, rivers: segs, riverCount: mouths, hexFlux };
  }

  return { HYDRO, cornerIds, buildJunctions, priorityFlood,
           routeFlow, accumulateFlux, findBasins, settleBasins, selectRivers,
           computeHydrology };
});
