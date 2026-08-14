const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("world data is baked, compact, and sane", () => {
  const p = path.join(__dirname, "../src/world-data.js");
  assert.ok(fs.existsSync(p), "src/world-data.js missing — run: node tools/bake-data.mjs");
  assert.ok(fs.statSync(p).size < 400_000, "baked data exceeds 400KB cap");

  const data = require("../src/world-data.js");
  assert.ok(Array.isArray(data.countries) && data.countries.length >= 150,
    "expected >=150 countries, got " + (data.countries && data.countries.length));

  const france = data.countries.find((c) => c.n === "France");
  assert.ok(france, "France missing");
  assert.strictEqual(france.c, "Europe");

  for (const c of data.countries) {
    assert.ok(typeof c.n === "string" && c.n.length > 0);
    assert.ok(typeof c.c === "string" && c.c.length > 0);
    for (const poly of c.p) {
      assert.strictEqual(poly.b.length, 4);
      assert.ok(poly.r.length >= 1);
      assert.ok(poly.r[0].length >= 8 && poly.r[0].length % 2 === 0, "outer ring must be flat lon,lat pairs");
    }
  }
});
