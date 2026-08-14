// HexWorld procgen — world validation (Milestone 4). UMD-lite, pure, zero-dep, zero RNG.
// The Dwarf-Fortress hard-rejection principle: a generated world must pass a small
// quality predicate or the generator quietly retries seed+1 AND SAYS SO — "many
// seeds unusable" dies here, not in the user's patience. Global floor checks plus,
// since M5, the per-theme layer: a theme may override the floor dials (a Dune world
// is ALLOWED to be river-poor) and add declarative checks of its own (biome-share
// minimums, landmass counts, largest-landmass share) — themes.js stays data, the
// compilation lives here.
(function (root, factory) {
  if (typeof module === "object" && module.exports !== undefined) {
    module.exports = factory(require("./biomes.js"));
  } else {
    root.HexWorldValidate = factory(root.HexWorldBiomes);
  }
})(typeof self !== "undefined" ? self : globalThis, function (B) {
  // The M4 validation dial block. Tunable; tests assert behavior, not values.
  const VALIDATE = {
    MAX_TRIES: 4,       // requested seed + up to 3 internal seed+1 retries
    MIN_RIVERS: 3,      // river mouths a world must reach
    MIN_BIOMES: 4,      // distinct biomes...
    MIN_SHARE: 0.02,    // ...each covering at least this fraction of the land
    WARP_PANGAEA: 110,  // beyond this warp, merging continents is the point —
                        // the landmass-count check stands down (Art kept the zone)
  };

  const NON_LAND = new Set([...B.WATER_BANDS, ...B.SURFACE_BANDS].map((b) => b.id));

  function validateWorld(res, theme) {
    const p = (theme && theme.predicate) || {};
    const f = p.floors ? { ...VALIDATE, ...p.floors } : VALIDATE;
    const tag = theme ? theme.id : null;
    if (res.riverCount < f.MIN_RIVERS) {
      return { ok: false,
        reason: "only " + res.riverCount + " river mouths (need " + f.MIN_RIVERS + ")" };
    }
    let spread = 0;
    for (const [id, n] of res.biomeCounts) {
      if (!NON_LAND.has(id) && n >= res.totalLand * f.MIN_SHARE) spread++;
    }
    if (spread < f.MIN_BIOMES) {
      return { ok: false,
        reason: "only " + spread + " biomes over 2% of land (need " + f.MIN_BIOMES + ")" };
    }
    if (res.warp <= f.WARP_PANGAEA && res.landmasses.size < res.continents) {
      return { ok: false,
        reason: res.landmasses.size + " landmasses < " + res.continents + " requested" };
    }
    // --- Theme checks (M5): declarative, compiled here so themes.js stays data ---
    if (p.landmassMin && res.landmasses.size < p.landmassMin) {
      return { ok: false,
        reason: res.landmasses.size + " landmasses (" + tag + " needs ≥ " + p.landmassMin + ")" };
    }
    if (p.largestShare) {
      let big = 0;
      for (const m of res.landmasses.values()) if (m.size > big) big = m.size;
      const share = res.totalLand > 0 ? big / res.totalLand : 0;
      const pctS = Math.round(share * 100);
      if (p.largestShare.min !== undefined && share < p.largestShare.min) {
        return { ok: false, reason: "largest landmass " + pctS + "% of land (" +
          tag + " needs ≥ " + Math.round(p.largestShare.min * 100) + "%)" };
      }
      if (p.largestShare.max !== undefined && share > p.largestShare.max) {
        return { ok: false, reason: "largest landmass " + pctS + "% of land (" +
          tag + " needs ≤ " + Math.round(p.largestShare.max * 100) + "%)" };
      }
    }
    for (const s of p.shareMin || []) {
      let n = 0;
      for (const id of s.ids) n += res.biomeCounts.get(id) || 0;
      const share = res.totalLand > 0 ? n / res.totalLand : 0;
      if (share < s.frac) {
        return { ok: false, reason: s.name + " " + Math.round(share * 100) +
          "% of land (" + tag + " needs ≥ " + Math.round(s.frac * 100) + "%)" };
      }
    }
    return { ok: true };
  }

  return { VALIDATE, validateWorld };
});
