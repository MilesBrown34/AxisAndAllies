// HexWorld procgen — labeling (Milestone 2). UMD-lite, pure, zero-dep, zero RNG.
// Water keeps the M1 hypsometric depth bands; land gets a Whittaker-style biome table:
// boxes in (temperature, rainfall) space with two hard gates (ice by cold, alpine by
// altitude) and a nearest-box-center fallback for the deliberate gaps — the spec's
// "parameter-space table + nearest-point fallback". PALETTE is the single ordered
// source the renderer and legend both read.
(function (root, factory) {
  if (typeof module === "object" && module.exports !== undefined) module.exports = factory();
  else root.HexWorldBiomes = factory();
})(typeof self !== "undefined" ? self : globalThis, function () {
  const WATER_BANDS = [
    { id: "deep",  label: "Deep Ocean", max: -0.55, color: 0x0e2f52 },
    { id: "ocean", label: "Ocean",      max: -0.18, color: 0x15446f },
    { id: "shelf", label: "Shelf Sea",  max: 0,     color: 0x2a6b8f },
  ];
  function depthBandOf(elev) {
    for (const b of WATER_BANDS) if (elev <= b.max) return b.id;
    return "shelf";
  }

  // First two entries are gate-only (their boxes are never scanned); the rest tile
  // (t, r) space with intended gaps for the fallback to fill.
  const BIOMES = [
    { id: "ice",        label: "Ice Cap",              color: 0xe8eef2, t: [0,    0.11], r: [0, 1] },
    { id: "alpine",     label: "Alpine",               color: 0x9aa0a8, t: [0,    1],    r: [0, 1] },
    { id: "tundra",     label: "Tundra",               color: 0xb5bda4, t: [0.11, 0.24], r: [0, 1] },
    { id: "taiga",      label: "Taiga",                color: 0x46705a, t: [0.24, 0.46], r: [0.30, 1] },
    { id: "steppe",     label: "Steppe",               color: 0xa8a06a, t: [0.24, 0.72], r: [0.12, 0.30] },
    { id: "desert",     label: "Desert",               color: 0xd9c37e, t: [0.30, 1],    r: [0, 0.12] },
    { id: "forest",     label: "Temperate Forest",     color: 0x3f7a47, t: [0.46, 0.72], r: [0.30, 0.65] },
    { id: "rainforest", label: "Temperate Rainforest", color: 0x2e6b45, t: [0.46, 0.72], r: [0.65, 1] },
    { id: "savanna",    label: "Savanna",              color: 0xc2b264, t: [0.72, 1],    r: [0.12, 0.42] },
    { id: "tropforest", label: "Tropical Forest",      color: 0x578c3f, t: [0.72, 1],    r: [0.42, 0.72] },
    { id: "jungle",     label: "Tropical Rainforest",  color: 0x2f7d3a, t: [0.72, 1],    r: [0.72, 1] },
  ];
  const TREELINE = 0.75;   // normalized elevation above which forests give way to rock
  const MARITIME = 0.15;   // coastal temperature pull toward the middle (maritime climate)

  function classifyBiome(t, r, elev, coastal) {
    if (coastal) t = t + (0.5 - t) * MARITIME;
    // Upper box bounds are exclusive; clamp just under 1 so t=1/r=1 stays in-table.
    t = Math.max(0, Math.min(0.9999, t));
    r = Math.max(0, Math.min(0.9999, r));
    if (t < BIOMES[0].t[1]) return "ice";
    if (elev > TREELINE) return "alpine";
    for (let i = 2; i < BIOMES.length; i++) {
      const b = BIOMES[i];
      if (t >= b.t[0] && t < b.t[1] && r >= b.r[0] && r < b.r[1]) return b.id;
    }
    let best = "tundra", bestD = Infinity;
    for (let i = 2; i < BIOMES.length; i++) {
      const b = BIOMES[i];
      const dt = t - (b.t[0] + b.t[1]) / 2, dr = r - (b.r[0] + b.r[1]) / 2;
      const d = dt * dt + dr * dr;
      if (d < bestD) { bestD = d; best = b.id; }
    }
    return best;
  }

  // M3 surface water: rendered/legended like biomes but produced by hydrology,
  // not the Whittaker table. Lake = open or endorheic salt lake; salt flat = the
  // dry bed a starved basin leaves behind.
  const SURFACE_BANDS = [
    { id: "lake",     label: "Lake",      color: 0x2f7fae },
    { id: "saltflat", label: "Salt Flat", color: 0xd9d3c2 },
  ];

  // M6 margin geology: volcanic is a labeling GATE (margin === 'active' + altitude,
  // assigned in worldgen), never a Whittaker box — terrain-derived, so climate
  // overrides can't move it and refine must freeze it.
  const MARGIN_BANDS = [
    { id: "volcanic", label: "Volcanic", color: 0x7a4034 },
  ];

  const PALETTE = [...WATER_BANDS, ...SURFACE_BANDS, ...BIOMES, ...MARGIN_BANDS];

  return { WATER_BANDS, depthBandOf, BIOMES, SURFACE_BANDS, MARGIN_BANDS, TREELINE, MARITIME, classifyBiome, PALETTE };
});
