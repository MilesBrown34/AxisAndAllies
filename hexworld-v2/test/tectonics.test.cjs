const test = require("node:test");
const assert = require("node:assert");
const Tec = require("../src/procgen/tectonics.js");

const W = 1800, H = 850;

test("tectonics: deterministic per (seed, count, oceanPct)", () => {
  const a = Tec.makeTectonics(7, 4, 0.65, W, H);
  const b = Tec.makeTectonics(7, 4, 0.65, W, H);
  assert.deepStrictEqual(
    a.fragments.map((f) => [f.site, f.anchor, f.mag, f.rot, f.character]),
    b.fragments.map((f) => [f.site, f.anchor, f.mag, f.rot, f.character]));
  for (let i = 0; i < 40; i++) {
    const x = (i * 97.3) % W, y = 60 + ((i * 53.7) % (H - 120));
    assert.deepStrictEqual(a.crustAt(x, y), b.crustAt(x, y));
  }
});

test("tectonics: count salts its own universe and yields exactly count fragments", () => {
  const c3 = Tec.makeTectonics(7, 3, 0.65, W, H);
  const c5 = Tec.makeTectonics(7, 5, 0.65, W, H);
  assert.strictEqual(c3.fragments.length, 3);
  assert.strictEqual(c5.fragments.length, 5);
  assert.notDeepStrictEqual(c3.fragments[0].site, c5.fragments[0].site,
    "count must salt the substream (different count, different plate layout)");
  const chars = new Set(Tec.CHARACTERS.map((c) => c.id));
  for (const f of [...c3.fragments, ...c5.fragments]) {
    assert.ok(chars.has(f.character), "unknown character " + f.character);
  }
  assert.strictEqual(new Set(c5.fragments.map((f) => f.character)).size, 5,
    "5 fragments must draw 5 distinct characters from the deck");
});

test("tectonics: count=1 — no drift, no cracks, no active margins, one blob", () => {
  const t = Tec.makeTectonics(3, 1, 0.65, W, H);
  assert.strictEqual(t.fragments.length, 1);
  assert.strictEqual(t.fragments[0].mag, 0, "a lone supercontinent must not drift");
  assert.strictEqual(t.fragments[0].rot, 0);
  const c0 = t.crustAt(t.C.x, t.C.y).crust;
  let dx = t.C.x + t.R0 * 2.4; dx -= W * Math.floor(dx / W);
  const far = t.crustAt(dx, t.C.y).crust;
  assert.ok(c0 > far * 3, `no blob: center ${c0} vs far ${far}`);
  for (let i = 0; i < 400; i++) {
    const x = (i * 61.7) % W, y = 40 + ((i * 37.3) % (H - 80));
    assert.notStrictEqual(t.crustAt(x, y).margin, "active",
      "active margin without drift at " + x + "," + y);
  }
});

test("tectonics: crustAt is seamless across the x=0/x=W wrap", () => {
  const t = Tec.makeTectonics(11, 4, 0.65, W, H);
  for (let i = 0; i < 20; i++) {
    const y = 60 + (i / 20) * (H - 120);
    const a = t.crustAt(0, y), b = t.crustAt(W, y);
    assert.ok(Math.abs(a.crust - b.crust) < 1e-9, `seam crust mismatch at y=${y}`);
    assert.strictEqual(a.fragmentId, b.fragmentId, `seam fragment mismatch at y=${y}`);
  }
});

test("tectonics: drift opens a low-crust channel between fragment anchors", () => {
  // Aggregate over seeds — one layout must not decide the geology.
  let anchorSum = 0, midMinSum = 0, n = 0;
  for (const seed of [1, 2, 3]) {
    const t = Tec.makeTectonics(seed, 4, 0.65, W, H);
    for (let i = 0; i < t.fragments.length; i++) {
      for (let j = i + 1; j < t.fragments.length; j++) {
        const a = t.fragments[i].anchor, b = t.fragments[j].anchor;
        let dx = b.x - a.x;
        if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W;
        const ca = t.crustAt(a.x, a.y).crust, cb = t.crustAt(b.x, b.y).crust;
        let mid = Infinity;
        for (let s = 0.25; s <= 0.75; s += 0.05) {
          let mx = a.x + dx * s; mx -= W * Math.floor(mx / W);
          const c = t.crustAt(mx, a.y + (b.y - a.y) * s).crust;
          if (c < mid) mid = c;
        }
        anchorSum += Math.min(ca, cb); midMinSum += mid; n++;
      }
    }
  }
  assert.ok(midMinSum / n < 0.6 * (anchorSum / n),
    `no rift channels: mean mid-crust ${(midMinSum / n).toFixed(3)} vs mean anchor ${(anchorSum / n).toFixed(3)}`);
});

test("tectonics: both margin types occur, and active implies a drifting fragment", () => {
  let active = 0, passive = 0;
  for (const seed of [1, 2, 3]) {
    const t = Tec.makeTectonics(seed, 4, 0.65, W, H);
    for (let i = 0; i < 4000; i++) {
      const x = (i * 41.3) % W, y = 40 + ((i * 23.9) % (H - 80));
      const r = t.crustAt(x, y);
      if (r.margin === "active") {
        active++;
        assert.ok(t.fragments[r.fragmentId].mag > 0, "active margin on a still fragment");
      }
      if (r.margin === "passive") passive++;
    }
  }
  assert.ok(active > 0, "no active margins in 3 seeds — leading edges never tagged");
  assert.ok(passive > 0, "no passive margins in 3 seeds");
});
