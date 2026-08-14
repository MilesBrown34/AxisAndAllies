// HexWorld procgen — seeded noise. UMD-lite, pure, zero-dep (mirror of core.js discipline).
// 3D simplex (Gustavson-style, public-domain construction) sampled on a cylinder for
// seamless east-west wrap. fBm at persistence 0.5 / lacunarity 2 — the 1/f spectrum whose
// spatial correlation decays logarithmically with distance (de Wijs / 2D GFF identity).
(function (root, factory) {
  if (typeof module === "object" && module.exports !== undefined) module.exports = factory();
  else root.HexWorldNoise = factory();
})(typeof self !== "undefined" ? self : globalThis, function () {
  function fnv(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // Derived RNG stream: independent of the main draw sequence, stable per (seed, salt).
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function substream(seed, salt) { return mulberry32((seed >>> 0) ^ fnv(salt)); }

  const GRAD3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
  ];
  const F3 = 1 / 3, G3 = 1 / 6;

  function makeSimplex(rng) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {           // seeded Fisher–Yates
      const j = Math.floor(rng() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    const perm = new Uint8Array(512), permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; permMod12[i] = perm[i] % 12; }

    function noise3(xin, yin, zin) {
      const s = (xin + yin + zin) * F3;
      const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
      const t = (i + j + k) * G3;
      const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0)      { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else               { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0)       { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0)  { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else               { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
      const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      const ii = i & 255, jj = j & 255, kk = k & 255;
      let n = 0;
      let t0 = 0.5 - x0 * x0 - y0 * y0 - z0 * z0;
      if (t0 > 0) { const g = GRAD3[permMod12[ii + perm[jj + perm[kk]]]]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0 + g[2] * z0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1 - z1 * z1;
      if (t1 > 0) { const g = GRAD3[permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1 + g[2] * z1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2 - z2 * z2;
      if (t2 > 0) { const g = GRAD3[permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2 + g[2] * z2); }
      let t3 = 0.5 - x3 * x3 - y3 * y3 - z3 * z3;
      if (t3 > 0) { const g = GRAD3[permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]]; t3 *= t3; n += t3 * t3 * (g[0] * x3 + g[1] * y3 + g[2] * z3); }
      return 72 * n;   // ≈ [-1, 1] (empirical max ~0.013 for the r=0.5 kernel)
    }
    return { noise3 };
  }

  // Cylinder-mapped fBm: cx wraps around the cylinder (seamless at x=0/x=W), cy runs
  // along its axis at the same metric rate, so features are isotropic in pixel space.
  function fbmCyl(sx, cx, cy, opts) {
    const W = opts.W, octaves = opts.octaves, freq = opts.freq;
    const R = 1;                                   // unit cylinder; freq scales features
    const k = (2 * Math.PI * R) / W;               // noise units per pixel along both axes
    const u = cx - W * Math.floor(cx / W);         // exact wrap: cx = W maps to u = 0
    const ang = (u / W) * 2 * Math.PI;
    const bx = Math.cos(ang) * R, by = Math.sin(ang) * R, bz = cy * k;
    let amp = 1, f = freq, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * sx.noise3(bx * f, by * f, bz * f);
      norm += amp;
      amp *= 0.5; f *= 2;                          // persistence 0.5, lacunarity 2 → 1/f
    }
    return sum / norm;
  }

  return { fnv, substream, makeSimplex, fbmCyl };
});
