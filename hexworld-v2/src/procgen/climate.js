// HexWorld procgen — climate fields (Milestone 2). UMD-lite, pure, zero-dep, ZERO RNG.
// Temperature: latitude insolation minus a linear lapse over land elevation.
// Rainfall: a wind-ordered moisture-advection sweep per hex row (the rows are the
// latitude lanes): parcels recharge toward capacity over water, drop a base fraction
// over land, and dump orographic rain proportional to windward uplift with a 60/40
// windward/leeward split — rain shadows and continentality are emergent. A gaussian
// subsidence factor at the 28-degree belt carves the horse-latitude deserts.
(function (root, factory) {
  if (typeof module === "object" && module.exports !== undefined) module.exports = factory();
  else root.HexWorldClimate = factory();
})(typeof self !== "undefined" ? self : globalThis, function () {
  // The M2 dial block. Tunable at the visual gate; tests assert shape, not values.
  const CLIMATE = {
    LAPSE: 0.55,        // temperature drop across full normalized elevation (0 → 1)
    CAP_BASE: 0.25,     // moisture capacity floor (cold air)
    CAP_TEMP: 0.75,     // + capacity ∝ temperature (warm air holds more)
    EVAP: 0.35,         // recharge rate toward capacity per water cell
    OCEAN_RAIN: 0.02,   // light bookkeeping rain over water
    BASE_RAIN: 0.035,   // fraction of carried moisture dropped per land cell (sets how deep
                        // inland moisture penetrates: e-fold ≈ 1/BASE_RAIN cells)
    OROG_K: 3.0,        // orographic extraction ∝ windward uplift step above the threshold
    OROG_MIN: 0.12,     // uplift below this is sub-range roughness — air flows AROUND small
                        // bumps; without the threshold fBm texture bleeds the parcel dry
                        // in ~5 cells and every interior turns to desert
    OROG_SPLIT: 0.6,    // windward share of orographic rain; the rest lands one cell downwind
    SUBSIDENCE: 0.6,    // desert-belt strength (descending-air dryness, 0..1)
    SUB_DRAIN: 0.07,    // belt moisture re-absorption per cell — descending dry air REMOVES
                        // water; scaling deposits alone just moves rain inland (conserves it)
    SUB_LAT: 28 / 90,   // belt center as a latitude fraction (28°)
    SUB_WIDTH: 6.5 / 90,  // gaussian belt width
    RAIN_NORM: 20,      // sweep deposit → [0,1] display scale (applied by worldgen)
    SEA_BREEZE: 0.35,   // onshore-convection rain boost: ×(1+SB) on ring-1 coast land,
                        // ×(1+SB/2) on ring 2 — biases lush toward the water (Art's call)
  };

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function latFracOf(cy, H) { return Math.min(1, Math.abs(cy / H - 0.5) * 2); }
  function insolation(latFrac) { return Math.pow(Math.cos((latFrac * Math.PI) / 2), 1.35); }
  function temperatureAt(latFrac, elevAboveSea, tempOffset) {
    return clamp01(insolation(latFrac) - CLIMATE.LAPSE * Math.max(0, elevAboveSea) + (tempOffset || 0));
  }
  // Three-cell wind model: trades (0–30°) and polar easterlies (60–90°) travel east→west,
  // westerlies (30–60°) travel west→east.
  function windDirAt(latFrac) { return latFrac < 1 / 3 ? -1 : latFrac < 2 / 3 ? 1 : -1; }
  function beltFactor(latFrac) {
    const d = (latFrac - CLIMATE.SUB_LAT) / CLIMATE.SUB_WIDTH;
    return Math.exp(-d * d);
  }
  function subsidenceAt(latFrac) { return CLIMATE.SUBSIDENCE * beltFactor(latFrac); }
  // coastDist: 0 = water, 1 = shoreline land, 2 = one ring in, 3+ = interior.
  function seaBreezeFactor(coastDist) {
    if (coastDist === 1) return 1 + CLIMATE.SEA_BREEZE;
    if (coastDist === 2) return 1 + CLIMATE.SEA_BREEZE / 2;
    return 1;
  }

  // One row's sweep. cells are west→east; dir is the parcel's travel direction.
  // Two laps around the cylinder wrap: lap 1 is warm-up (a wrapped row has no natural
  // start, so we let the moisture state converge), only lap 2 records deposits. The
  // carry (leeward orographic share) rides across cell and lap boundaries.
  // arid (M7.1, default 1) scales BOTH belt terms — the deposit suppression and the
  // column drain — so 0 erases the horse-latitude deserts (island-jungle worlds) and
  // 2 deepens them; it must scale the DRAIN too or the belt just moves rain inland.
  function advectRow(cells, dir, latFrac, arid) {
    const n = cells.length, rain = new Float64Array(n);
    if (!n) return rain;
    const a = arid === undefined ? 1 : arid;
    const dry = Math.max(0, 1 - a * subsidenceAt(latFrac));
    const drain = Math.max(0, 1 - a * CLIMATE.SUB_DRAIN * beltFactor(latFrac));
    let m = 0.4, carry = 0, prevElev = 0;
    for (let lap = 0; lap < 2; lap++) {
      for (let s = 0; s < n; s++) {
        const i = dir > 0 ? s : n - 1 - s;
        const c = cells[i];
        let deposit = carry;
        carry = 0;
        if (c.water) {
          const cap = CLIMATE.CAP_BASE + CLIMATE.CAP_TEMP * c.temp;
          m += (cap - m) * CLIMATE.EVAP;          // recharge toward (or shed down to) capacity
          const r = m * CLIMATE.OCEAN_RAIN * dry;
          deposit += r;
          m -= r;
          prevElev = 0;
        } else {
          const uplift = Math.max(0, c.elev - prevElev - CLIMATE.OROG_MIN);
          const base = m * CLIMATE.BASE_RAIN * dry;
          const orog = m * Math.min(0.9, CLIMATE.OROG_K * uplift) * dry;
          deposit += base + orog * CLIMATE.OROG_SPLIT;
          carry = orog * (1 - CLIMATE.OROG_SPLIT);
          m = Math.max(0, m - base - orog);
          prevElev = c.elev;
        }
        m *= drain;   // the descending branch drinks the air column dry
        if (lap === 1) rain[i] += deposit;
      }
    }
    return rain;
  }

  return { CLIMATE, latFracOf, insolation, temperatureAt, windDirAt, beltFactor, subsidenceAt, seaBreezeFactor, advectRow };
});
