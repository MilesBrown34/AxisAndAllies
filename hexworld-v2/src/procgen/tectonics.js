// HexWorld procgen — tectonics (Milestone 6). UMD-lite, pure, zero-dep beyond noise.
// Supercontinent breakup (Wilson cycle, Art's locked decision 2): grow ONE landmass
// in pre-drift "plate space", crack it along a shared wiggled Voronoi rift network,
// then drift/rotate each fragment on the wrapped sheet. Conjugate coastlines fit by
// construction at the crack level: both sides of a rift are cut by the SAME plate-
// space curve. Leading edges (drift direction) are ACTIVE margins — coastal ridge
// uplift + offshore trench, Andes-style; rifted/trailing edges are PASSIVE — wide
// shallow shelf, Atlantic-style. crustAt is the elevation backbone worldgen rides;
// under the sea-level QUANTILE it is the crust ORDERING that decides coastlines,
// so every shaping term here adds/subtracts real rank (the M3/M5 dial lesson).
// RNG: substreams salted with the COUNT ("tect:"+count) so each (seed, count) pair
// stays its own world family, exactly like the old continentSites contract.
(function (root, factory) {
  if (typeof module === "object" && module.exports !== undefined) {
    module.exports = factory(require("./noise.js"));
  } else {
    root.HexWorldTectonics = factory(root.HexWorldNoise);
  }
})(typeof self !== "undefined" ? self : globalThis, function (N) {
  // Continent personalities (moved from worldgen.js; worldgen re-exports).
  const CHARACTERS = [
    { id: "alpine",    label: "Alpine",    relief: 1.7,  tempOffset: -0.06, moist: 1.0  },
    { id: "frozen",    label: "Frozen",    relief: 0.95, tempOffset: -0.28, moist: 0.85 },
    { id: "arid",      label: "Arid",      relief: 1.1,  tempOffset: 0.04,  moist: 0.45 },
    { id: "temperate", label: "Temperate", relief: 1.0,  tempOffset: 0,     moist: 1.0  },
    { id: "lush",      label: "Lush",      relief: 0.85, tempOffset: 0.03,  moist: 1.55 },
    { id: "plains",    label: "Plains",    relief: 0.6,  tempOffset: 0,     moist: 0.9  },
  ];

  // The M6 dial block. Tunable at the visual gate; tests assert behavior, not values.
  const TECT = {
    SIGMA: 1.15,      // supercontinent gaussian width, × R0
    SITE_R: 0.95,     // site ring × R0: count budget-circles of radius Rf pack into ~R0 (Rf·√count = R0) — a tighter ring crowds high counts into fusion
    DRIFT: 0.85,      // spreading fraction: anchors expand away from the center by
                      // (1 + DRIFT·jitter) — ∝-to-radius drift, so EVERY pairwise
                      // gap opens (constant radial drift left same-bearing
                      // fragments fused — probed, the merge failure mode)
    ROT: 0.12,        // max |fragment rotation| (radians) — big swings re-close rift gaps
    CRACK_AMP: 40,    // plate-space crack wiggle amplitude (px) — shared, conjugate
    CRACK_FREQ: 6,    // crack-warp fBm frequency (2 octaves)
    RIFT_W: 65,       // crust taper width along cracks (px)
    RIDGE_H: 0.5,     // active-margin coastal ridge uplift (crust units)
    RIDGE_W: 40,      // ridge band width (px), peak ~0.6·RIDGE_W inland
    TRENCH_D: 0.45,   // offshore trench depth (crust units)
    TRENCH_W: 55,     // trench band width (px), deepest ~TRENCH_W offshore
    SHELF_H: 0.16,    // passive shelf lift (crust units) — must stay below rim crust
    SHELF_W: 80,      // shelf half-width (px)
    LEAD_MIN: 0.3,    // outwardness (drift·outward) above which an edge is ACTIVE
    MARGIN_W: 70,     // |boundary distance| within which a cell carries a margin tag
    VOLC_ELEV: 0.45,  // normalized land elevation floor for the volcanic label
    Y_BAND: 0.22,     // drifted anchors clamped to [Y_BAND, 1−Y_BAND]·H (polar fade zone)
  };

  function makeTectonics(seed, count, oceanPct, W, H) {
    const rng = N.substream(seed, "tect:" + count);
    const sxCrack = N.makeSimplex(N.substream(seed, "tect:crack:" + count));
    const wrapDx = (dx) => {
      if (dx > W / 2) return dx - W;
      if (dx < -W / 2) return dx + W;
      return dx;
    };
    const dist = (ax, ay, bx, by) => {
      const dx = wrapDx(ax - bx), dy = ay - by;
      return Math.sqrt(dx * dx + dy * dy);
    };

    // Character deck (same shuffle discipline as the old continentSites).
    const deck = CHARACTERS.map((c) => c.id);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }

    // Supercontinent: one blob sized to carry the whole land budget. Each fragment
    // carries an EQUAL share of that budget as its own Gaussian centered on its
    // plate site (σf below): pre-drift the adjacent Gaussians union into one
    // connected supercontinent, post-drift every fragment owns comparable mass —
    // a single global Gaussian starved rim fragments (<8% share) while central
    // pairs stayed fat enough to bridge (probed; the old per-site-σ guarantee).
    const landArea = W * H * (1 - oceanPct);
    const R0 = Math.sqrt(landArea / Math.PI);
    const Rf = Math.sqrt(landArea / (Math.PI * count));
    // C.x stays in the middle band: the hex GRID does not wrap east-west (only
    // the noise fields do), so land straddling x=0 splits into two landmasses —
    // centering the chain parks its wrap gap over the seam instead (probed,
    // the count=1 50/50 "supercontinent").
    const C = { x: W * (0.4 + rng() * 0.2), y: H * (0.4 + rng() * 0.2) };
    // Chain geometry. σ is capped to the slot width (the old longitude-slot
    // rule): cramped fragments must shrink or their Gaussian tails outrank the
    // crack corridors under the quantile and everything bridges. Expansion is
    // capped by the WRAP-GAP budget: the chain's two END fragments drift toward
    // each other through the wrap (their gap shrinks by (k−1)·span — probed,
    // bridge cells sat exactly there, where NO plate crack exists to suppress),
    // so k keeps ≥3σ of open sea between the end Gaussians. Crowded counts get
    // k→1 (barely-drifted young rift; interior separation rides the ratio
    // suppression, the mechanism the old site masks proved for months).
    let spacingPre = count > 1 ? Math.min(1.6 * Rf, W / count) : 0;
    // count=1 gets σ = R0 exactly: wider and the blob's gradient goes so
    // shallow that detail noise shatters the lone supercontinent (<60% top
    // share); the multi-fragment σ additionally obeys the slot cap.
    let sigma = count > 1
      ? Math.min(Rf * TECT.SIGMA, 0.55 * spacingPre)
      : R0;
    let span = spacingPre * (count - 1);
    let kMax = span > 0 ? Math.max(1, 1 + (W - span - 3 * sigma) / span) : 1;
    if (count > 1 && kMax < 1.15) {
      // Crowded cylinder: a contracted chain would leave a permanent dead wrap
      // gap and pack the interior corridors up the ordering into bridges
      // (probed). Snap to EVEN FILL — the old longitude-slot geometry the count
      // guarantee was proven on — with zero drift: a barely-rifted world whose
      // separation rides the conjugate cracks' ratio suppression alone.
      spacingPre = W / count;
      sigma = Math.min(Rf * TECT.SIGMA, 0.55 * spacingPre);
      span = spacingPre * (count - 1);
      kMax = 1;
    }

    // Fragment sites on a jittered horizontal CHAIN. The sheet is wide and short
    // with a polar kill zone — there is no vertical room for isotropic breakup
    // (a ring's top/bottom arcs hit the temperate clamp and fuse; a disk gives a
    // crowded central site whose budget dies in the crack taper — both probed).
    // A chain gives every fragment an equal vertical-slab Voronoi cell, cracks
    // come out meridional, and expansion opens EVERY adjacent gap ∝ spacing —
    // the same geometry the old longitude-slot masks used, now with conjugate
    // rift coasts.
    // x rides the chain slots; y is best-candidate STAGGERED (max-min pairwise
    // distance, the old continentSites discipline) — a blind y draw can land
    // two adjacent sites at the same latitude, and a same-latitude pair only
    // ever gets the bare slot spacing of separation (probed, the c≥6 pair
    // fusions; staggering buys them diagonal distance).
    const sites = [];
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2 + (rng() - 0.5) * 0.15) * spacingPre;
      let x = C.x + off; x -= W * Math.floor(x / W);
      let bestY = 0, bestScore = -1;
      for (let attempt = 0; attempt < 10; attempt++) {
        const y = H * (0.28 + rng() * 0.44);
        let score = Infinity;
        for (const s of sites) score = Math.min(score, dist(x, y, s.x, s.y));
        if (score > bestScore) { bestScore = score; bestY = y; }
      }
      sites.push({ x, y: bestY });
    }

    // Drift = uniform expansion about the supercontinent center (spreading): each
    // anchor moves outward by DRIFT·jitter × its own radius, so every pairwise gap
    // opens proportionally; rotation is about the anchor.
    // count=1: the Wilson cycle never starts — no drift, no rotation, no cracks.
    const fragments = sites.map((s, id) => {
      let dir = { x: 0, y: 0 }, mag = 0, rot = 0;
      if (count > 1) {
        const dx = wrapDx(s.x - C.x), dy = s.y - C.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const a = d > 1e-9 ? Math.atan2(dy, dx) : rng() * 2 * Math.PI;
        dir = { x: Math.cos(a), y: Math.sin(a) };
        // Narrow jitter (a low-jitter outer fragment vs a high-jitter inner one
        // cancels the gap — probed); kMax keeps the wrapped chain from
        // colliding with its own tail at high counts. Rotation scales with the
        // same room: a slab rotated without drift room swings its far ends INTO
        // the neighbor's claim — overlapping b>0 regions have no rift corridor
        // at all and bridge unconditionally (probed, the c=7 total fusion).
        const room = Math.min(1, (kMax - 1) / TECT.DRIFT);
        mag = d * Math.min(TECT.DRIFT * (0.9 + rng() * 0.2), kMax - 1);
        rot = (rng() - 0.5) * 2 * TECT.ROT * room;
      }
      // Anchor y stays in the temperate band; drift the clamp eats is TRANSFERRED
      // into x (fragments slide along the band), so poleward pairs still separate
      // instead of freezing against the clamp (probed — the c=2 vertical fusion).
      let ax = s.x + dir.x * mag;
      const ayRaw = s.y + dir.y * mag;
      const ay = Math.min(H * (1 - TECT.Y_BAND), Math.max(H * TECT.Y_BAND, ayRaw));
      ax += (dir.x >= 0 ? 1 : -1) * Math.abs(ayRaw - ay);
      ax -= W * Math.floor(ax / W);
      return { id, site: { x: s.x, y: s.y }, anchor: { x: ax, y: ay },
        dir, mag, rot, cos: Math.cos(-rot), sin: Math.sin(-rot),
        character: deck[id % deck.length] };
    });

    // Shared plate-space crack wiggle — a SCALAR meander added to the signed
    // crack distance with an antisymmetric sign per side, so the whole rift
    // corridor shifts sideways as one: both coasts read the same field ⇒
    // conjugate interlocking fit, and the suppression band keeps its width.
    // (Positionally domain-warping the Voronoi instead shears the partition —
    // the suppressed band pinches to zero where the warp gradient stretches it
    // and noise bridges the pinch; probed, the dominant fusion source.)
    const crackWiggle = (qx, qy) => count === 1 ? 0
      : N.fbmCyl(sxCrack, qx + 511.7, qy + 269.3,
          { freq: TECT.CRACK_FREQ, octaves: 2, W }) * TECT.CRACK_AMP;

    const sat = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const reach = Rf * 2.5 + TECT.CRACK_AMP;   // early-out radius per fragment

    function crustAt(x, y) {
      // Argmax-belonging: every world point is scored against every fragment via
      // that fragment's INVERSE drift transform; b = signed distance into the
      // fragment (min of crack-side and own-Gaussian-rim-side), in px.
      let w = null, bBest = -Infinity, rBest = 0, dBest = 0, cBest = Infinity;
      for (const f of fragments) {
        const rdx = wrapDx(x - f.anchor.x), rdy = y - f.anchor.y;
        if (rdx * rdx + rdy * rdy > reach * reach) continue;
        // un-rotate about the anchor, then un-drift back to plate space
        const ux = rdx * f.cos - rdy * f.sin, uy = rdx * f.sin + rdy * f.cos;
        let qx = f.site.x + ux; qx -= W * Math.floor(qx / W);
        const qy = f.site.y + uy;
        // crack side: how deep inside f's Voronoi cell, meander applied to the
        // SIGNED distance (antisymmetric per side — see crackWiggle)
        let d1 = Infinity, d2 = Infinity, i1 = -1, i2 = -1, df = 0;
        for (const s of fragments) {
          const d = dist(qx, qy, s.site.x, s.site.y);
          if (s.id === f.id) df = d;
          if (d < d1) { d2 = d1; i2 = i1; d1 = d; i1 = s.id; }
          else if (d < d2) { d2 = d; i2 = s.id; }
        }
        const otherId = i1 === f.id ? i2 : i1;
        const sgn = otherId < 0 ? 0 : (f.id < otherId ? 1 : -1);
        const crack = count === 1 ? Infinity
          : (i1 === f.id ? (d2 - d1) : -(df - d1)) * 0.5   // half the gap each side
            + sgn * crackWiggle(qx, qy);
        // rim side: how deep inside this fragment's own mass budget
        const b = Math.min(crack, Rf - df);
        if (b > bBest) {
          bBest = b; dBest = df; cBest = crack; w = f;
          // Ratio-rift suppression: 1 at the (meandered) crack, →0 deep inside
          // the cell — the M1.5-proven ordering form, rebuilt from the shifted
          // signed distance so the suppression line rides the meander exactly.
          rBest = count === 1 ? 0
            : Math.min(1, Math.exp(-(2 * crack * (d1 + d2)) / (sigma * sigma)));
        }
      }
      if (!w) return { crust: 0, fragmentId: -1, margin: null, amp: 0.25 };

      const inner = Math.exp(-(dBest * dBest) / (sigma * sigma));
      const b = bBest;
      // Crust = own-Gaussian mass × ratio-rift suppression. The outer falloff is
      // the smooth Gaussian shoulder (a hard rim taper starves the land-budget
      // supply and the quantile floods the corridors into bridges — probed; the
      // M1.5 "cores must carry the budget" lesson). The rim survives only in b —
      // margin geometry (ridge/trench/shelf placement + tags).
      let crust = inner * 0.95 * (1 - 0.85 * rBest);

      // Margins. Leading-ness: how squarely this point sits on the drift-forward
      // side of its fragment. Ridge/trench/shelf shape the RIM coast ONLY
      // (rimB) — shaping on b = min(crack, rim) puts the +RIDGE_H uplift on
      // crack shoulders and the shelf lift in the corridors, i.e. it BUILDS
      // land bridges straight across the rifts, overpowering the ratio
      // suppression (probed — the persistent count-guarantee fusion through
      // every placement scheme).
      const rimB = Rf - dBest;
      const ox = wrapDx(x - w.anchor.x), oy = y - w.anchor.y;
      const od = Math.sqrt(ox * ox + oy * oy);
      const lead = w.mag > 1e-9 && od > 1e-9
        ? Math.max(0, (ox / od) * w.dir.x + (oy / od) * w.dir.y) : 0;
      const leadF = sat((lead - TECT.LEAD_MIN) / (1 - TECT.LEAD_MIN));
      const passF = 1 - sat(lead / TECT.LEAD_MIN);
      if (leadF > 0) {
        const rb = (rimB - TECT.RIDGE_W * 0.6) / TECT.RIDGE_W;
        crust += TECT.RIDGE_H * leadF * inner * Math.exp(-rb * rb);   // coastal ridge
        const tb = (rimB + TECT.TRENCH_W) / TECT.TRENCH_W;
        crust -= TECT.TRENCH_D * leadF * Math.exp(-tb * tb);          // offshore trench
      }
      if (passF > 0 && rimB < 0 && cBest > TECT.RIFT_W) {
        const sb = (rimB + TECT.SHELF_W * 0.5) / TECT.SHELF_W;
        crust += TECT.SHELF_H * passF * inner * Math.exp(-sb * sb);   // wide shelf
      }

      const margin = Math.abs(b) <= TECT.MARGIN_W
        ? (w.mag > 1e-9 && lead >= TECT.LEAD_MIN ? "active" : "passive") : null;
      // Noise amplitude rides the crust and quiets near CRACKS, so detail noise
      // carves fragments instead of bridging rifts (the M1.5 principle). The
      // outer shoulder keeps full amplitude — that's where coastlines form.
      const amp = (0.25 + 0.75 * inner) * (1 - 0.6 * rBest);
      return { crust, fragmentId: w.id, margin, amp };
    }

    return { C, R0, fragments, crustAt };
  }

  return { CHARACTERS, TECT, makeTectonics };
});
