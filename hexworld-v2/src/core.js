// HexWorld pure generation core — UMD-lite: node (module.exports) + browser (global HexWorldCore).
// No DOM, no Pixi, no I/O. Deterministic given (data, {seed, sizeKey|hexSize}).
(function (root, factory) {
  if (typeof module === "object" && module.exports !== undefined) module.exports = factory();
  else root.HexWorldCore = factory();
})(typeof self !== "undefined" ? self : globalThis, function () {
  const WORLD = { W: 1800, H: 850, LAT_MAX: 85 }; // 5 px/deg on both axes
  const SIZES = { coarse: 16.5, medium: 8.8, fine: 4.9 };
  // Land that renders but cannot be hovered/selected and is excluded from playable counts.
  const UNPLAYABLE_CONTINENTS = new Set(["Antarctica"]);

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function unproject(x, y) {
    return {
      lon: (x / WORLD.W) * 360 - 180,
      lat: WORLD.LAT_MAX - (y / WORLD.H) * (2 * WORLD.LAT_MAX),
    };
  }

  // Even-odd ray cast across ALL rings (outer + holes) of one polygon.
  function pointInRings(lon, lat, rings) {
    let inside = false;
    for (const ring of rings) {
      const n = ring.length;
      for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
        const x1 = ring[i], y1 = ring[i + 1], x2 = ring[j], y2 = ring[j + 1];
        if ((y1 > lat) !== (y2 > lat) &&
            lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) inside = !inside;
      }
    }
    return inside;
  }

  function countryAt(lon, lat, countries) {
    for (const c of countries) {
      for (const p of c.p) {
        const b = p.b;
        if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
        if (pointInRings(lon, lat, p.r)) return c;
      }
    }
    return null;
  }

  function cellCenter(col, row, g) {
    const odd = ((row % 2) + 2) % 2 === 1;
    return {
      cx: col * g.hexW + (odd ? g.hexW / 2 : 0) + g.dx,
      cy: row * g.vs + g.dy,
    };
  }

  function cellKey(col, row) { return col + "," + row; }

  // Nearest-center over the candidate cells around (x,y). Exact for points
  // inside a hex (Voronoi of centers == hex grid).
  function pixelToCell(x, y, g) {
    const r0 = Math.round((y - g.dy) / g.vs);
    let best = null, bestD = Infinity;
    for (let row = r0 - 1; row <= r0 + 1; row++) {
      const odd = ((row % 2) + 2) % 2 === 1;
      const c0 = Math.floor((x - g.dx - (odd ? g.hexW / 2 : 0)) / g.hexW);
      for (let col = c0; col <= c0 + 1; col++) {
        const cc = cellCenter(col, row, g);
        const d = (cc.cx - x) * (cc.cx - x) + (cc.cy - y) * (cc.cy - y);
        if (d < bestD) { bestD = d; best = { col, row }; }
      }
    }
    return best;
  }

  // Pointy-top: corner i at angle (60*i - 30)°, screen y down.
  // c0 upper-right, c1 lower-right, c2 bottom, c3 lower-left, c4 upper-left, c5 top.
  function hexCorners(cx, cy, size) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      pts.push(cx + size * Math.cos(a), cy + size * Math.sin(a));
    }
    return pts;
  }

  // Edge i (corners i -> i+1) faces neighbors(...)[i]: E, SE, SW, W, NW, NE.
  function neighbors(col, row) {
    const o = ((row % 2) + 2) % 2; // 1 on odd rows (shifted right)
    return [
      [col + 1, row],
      [col + o, row + 1],
      [col + o - 1, row + 1],
      [col - 1, row],
      [col + o - 1, row - 1],
      [col + o, row - 1],
    ];
  }

  // Offset (odd-r) <-> axial coordinate conversion.
  function axialOf(col, row) {
    const parity = ((row % 2) + 2) % 2;
    return { q: col - (row - parity) / 2, r: row };
  }
  function offsetOf(q, r) {
    const parity = ((r % 2) + 2) % 2;
    return { col: q + (r - parity) / 2, row: r };
  }
  function hexDistance(q1, r1, q2, r2) {
    const dq = q1 - q2, dr = r1 - r2;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }

  // Nearest center of the cluster sublattice with basis u=(2R+1,-R), v=(R,R+1)
  // (determinant 3R²+3R+1 = 7 for R=1, 19 for R=2). Nearest-center assignment
  // partitions the grid into node tiles of that average size (exact 7-flowers
  // for R=1); deterministic tie-break keeps the partition stable.
  function clusterCenterOf(q, r, R) {
    const uq = 2 * R + 1, ur = -R, vq = R, vr = R + 1;
    const det = uq * vr - vq * ur;
    const a0 = Math.round((vr * q - vq * r) / det);
    const b0 = Math.round((uq * r - ur * q) / det);
    let best = null;
    for (let da = -1; da <= 1; da++) {
      for (let db = -1; db <= 1; db++) {
        const a = a0 + da, b = b0 + db;
        const cq = a * uq + b * vq, cr = a * ur + b * vr;
        const d = hexDistance(q, r, cq, cr);
        if (!best || d < best.d ||
            (d === best.d && (cq < best.q || (cq === best.q && cr < best.r)))) {
          best = { d, q: cq, r: cr };
        }
      }
    }
    return { q: best.q, r: best.r };
  }

  function generate(data, opts) {
    const rng = mulberry32(opts.seed);
    const base = opts.hexSize !== undefined ? opts.hexSize : SIZES[opts.sizeKey];
    const size = base * (0.92 + rng() * 0.16); // ±8% seed jitter
    const g = { size, hexW: Math.sqrt(3) * size, vs: 1.5 * size, dx: 0, dy: 0 };
    g.dx = (rng() - 0.5) * g.hexW;
    g.dy = (rng() - 0.5) * g.vs;

    const hexes = new Map();
    const countryCounts = new Map();
    const continentCounts = new Map();
    let totalLand = 0, unplayable = 0;
    const rows = Math.ceil(WORLD.H / g.vs) + 1;
    const cols = Math.ceil(WORLD.W / g.hexW) + 1;
    for (let row = -1; row <= rows; row++) {
      for (let col = -1; col <= cols; col++) {
        const { cx, cy } = cellCenter(col, row, g);
        if (cx < 0 || cx > WORLD.W || cy < 0 || cy > WORLD.H) continue;
        const { lon, lat } = unproject(cx, cy);
        const c = countryAt(lon, lat, data.countries);
        if (!c) continue;
        const playable = !UNPLAYABLE_CONTINENTS.has(c.c);
        hexes.set(cellKey(col, row), { col, row, cx, cy, name: c.n, continent: c.c, playable });
        if (playable) {
          totalLand++;
          countryCounts.set(c.n, (countryCounts.get(c.n) || 0) + 1);
          continentCounts.set(c.c, (continentCounts.get(c.c) || 0) + 1);
        } else unplayable++;
      }
    }
    // Node clustering. The lattice-shift draws happen for EVERY clusterR so the
    // hex layout is identical across node modes at the same seed.
    const clusterR = opts.clusterR || 0;
    const shiftQ = Math.floor(rng() * 37), shiftR = Math.floor(rng() * 37);
    let clusters = null;
    if (clusterR > 0) {
      clusters = new Map();
      for (const [key, hex] of hexes) {
        if (!hex.playable) continue;
        const a = axialOf(hex.col, hex.row);
        const c = clusterCenterOf(a.q + shiftQ, a.r + shiftR, clusterR);
        const id = hex.name + "|" + c.q + "," + c.r;
        hex.clusterId = id;
        let cl = clusters.get(id);
        if (!cl) clusters.set(id, (cl = { id, name: hex.name, continent: hex.continent, hexKeys: [] }));
        cl.hexKeys.push(key);
      }
    }
    return {
      hexes, countryCounts, continentCounts, totalLand, unplayable,
      geom: g, seed: opts.seed, clusterR, clusters,
    };
  }

  return {
    WORLD, SIZES, UNPLAYABLE_CONTINENTS, mulberry32, unproject, pointInRings, countryAt,
    cellCenter, cellKey, pixelToCell, hexCorners, neighbors,
    axialOf, offsetOf, hexDistance, clusterCenterOf, generate,
  };
});
