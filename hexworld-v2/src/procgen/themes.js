// HexWorld procgen — world themes (Milestone 5). UMD-lite, pure, zero-dep, ZERO RNG.
// A theme is a bundle: a param ENVELOPE (dial defaults the user's Advanced drawer can
// override), an optional characterOverride (the M2 landmass-level climate force — a
// whole-world personality), PALETTE overrides (recolor/relabel existing biome ids —
// never new ids, the M3 enum lesson), and a declarative acceptance PREDICATE that
// validate.js compiles (per-theme floors + share/landmass checks). themeSeed gives
// each theme its own seed universe by hashing, not drawing: terran is the identity
// (byte-compatible with every pre-M5 world), so "seed 3" means the same world it
// always did until you pick a different theme.
(function (root, factory) {
  if (typeof module === "object" && module.exports !== undefined) {
    module.exports = factory(require("./noise.js"));
  } else {
    root.HexWorldThemes = factory(root.HexWorldNoise);
  }
})(typeof self !== "undefined" ? self : globalThis, function (N) {
  // First-guess envelopes/predicates — every number here is Art-gate-tunable;
  // tests assert structure and cross-theme direction, never these values.
  const THEMES = [
    {
      id: "terran", label: "Terran", tagline: "Earthlike balance",
      envelope: {}, palette: {}, predicate: {},
    },
    {
      id: "pangaea", label: "Pangaea", tagline: "one supercontinent, dry heart",
      // warp 125 sits in the deliberate Pangaea zone (>110): the landmass-count
      // floor stands down and rift trenches smear into one mass.
      envelope: { continents: 1, warp: 125, oceanPct: 0.68, rainMult: 0.85, minLake: 4 },
      palette: {},
      predicate: { largestShare: { min: 0.7 } },
    },
    {
      id: "archipelago", label: "Shattered Archipelago", tagline: "a thousand islands",
      envelope: { continents: 7, oceanPct: 0.74, warp: 110, mountain: 0.85,
        riverPct: 0.93, minLake: 2 },
      palette: {},
      predicate: { landmassMin: 10, largestShare: { max: 0.35 },
        floors: { MIN_RIVERS: 2 } },
    },
    {
      id: "dune", label: "Dune", tagline: "endless sands, rare water",
      envelope: { characterOverride: "arid", oceanPct: 0.55, rainMult: 0.55,
        riverPct: 0.96, mountain: 1.1, minLake: 2 },
      palette: { desert: { color: 0xd9a55e }, steppe: { color: 0xc9a865 },
        lake: { label: "Oasis", color: 0x2f9e6e } },
      predicate: {
        shareMin: [{ ids: ["desert", "steppe", "savanna", "saltflat"],
          frac: 0.45, name: "dry land" }],
        floors: { MIN_RIVERS: 1, MIN_BIOMES: 3 },
      },
    },
    {
      id: "glacial", label: "Glacial", tagline: "ice age, land bridges",
      // Lowered sea quantile = the spec's land bridges; frozen character caps the poles.
      envelope: { characterOverride: "frozen", oceanPct: 0.58, rainMult: 0.9,
        mountain: 1.15, minLake: 4 },
      palette: { tundra: { color: 0xc3cbb8 }, lake: { label: "Meltwater Lake" } },
      predicate: {
        shareMin: [{ ids: ["ice", "tundra", "taiga", "alpine"],
          frac: 0.4, name: "cold land" }],
        floors: { MIN_BIOMES: 3 },
      },
    },
    {
      id: "primordial", label: "Primordial", tagline: "young, jagged, volcanic",
      // M6: real volcanic biomes at active margins — the alpine re-skin is
      // retired. Volcanoes need DRIFT (subduction coasts), and beyond 4
      // fragments the crowded chain snaps to even-fill with zero drift, so
      // primordial is a just-broken supercontinent: 3 big fragments, leading
      // edges ablaze.
      envelope: { continents: 3, warp: 150, mountain: 1.7, rainMult: 1.25,
        riverPct: 0.88, riverCheat: 0.8, minLake: 3 },
      palette: { volcanic: { color: 0x8a3324 }, jungle: { color: 0x1f6e33 } },
      predicate: { shareMin: [{ ids: ["volcanic", "alpine"], frac: 0.04,
        name: "volcanic peaks" }] },
    },
  ];
  const BY_ID = new Map(THEMES.map((t) => [t.id, t]));

  function themeById(id) { return BY_ID.get(id) || THEMES[0]; }

  // Each non-terran theme gets its own seed universe by hashing — a pure function,
  // never a draw. Terran is the identity so pre-M5 worlds keep their addresses.
  function themeSeed(seed, theme) {
    if (!theme || theme.id === "terran") return seed >>> 0;
    return ((seed >>> 0) ^ N.fnv("theme:" + theme.id)) >>> 0;
  }

  // Envelope fills only the dials the caller left undefined — the user's Advanced
  // drawer (and test opts) always beat the theme.
  function applyTheme(theme, opts) {
    const merged = { ...opts };
    for (const [k, v] of Object.entries(theme.envelope)) {
      if (merged[k] === undefined) merged[k] = v;
    }
    return merged;
  }

  function themedPalette(theme, base) {
    return base.map((b) => {
      const o = theme.palette[b.id];
      return o ? { ...b, ...o } : b;
    });
  }

  return { THEMES, themeById, themeSeed, applyTheme, themedPalette };
});
