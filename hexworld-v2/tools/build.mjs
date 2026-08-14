// Inline pixi + data + core + app into one self-contained index.html.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
// Vendored copy first (standalone package), monorepo copy as fallback.
const PIXI_CANDIDATES = [
  join(root, "vendor/pixi.min.js"),
  join(root, "node_modules/pixi.js/dist/pixi.min.js"),
  join(root, "../../packages/client/node_modules/pixi.js/dist/pixi.min.js"),
];
const PIXI_PATH = PIXI_CANDIDATES.find(existsSync);
if (!PIXI_PATH) throw new Error("pixi.min.js not found — tried:\n" + PIXI_CANDIDATES.join("\n"));

let html = readFileSync(join(root, "src/template.html"), "utf8");

function inject(token, content) {
  if (!html.includes(token)) throw new Error("template missing token: " + token);
  // Guard: a literal </script> inside inlined JS would terminate the script tag.
  const safe = content.replace(/<\/script/gi, "<\\/script")
    .replace(/^\/\/#\s*sourceMappingURL=.*$/gm, "");
  html = html.split(token).join(safe);
}

inject("/*__PIXI__*/", readFileSync(PIXI_PATH, "utf8"));
inject("/*__DATA__*/", readFileSync(join(root, "src/world-data.js"), "utf8"));
inject("/*__CORE__*/", readFileSync(join(root, "src/core.js"), "utf8"));
// Fixed order: worldgen depends on noise + climate + biomes (all attach globals).
const PROCGEN_ORDER = [
  "src/procgen/noise.js", "src/procgen/tectonics.js", "src/procgen/climate.js",
  "src/procgen/biomes.js", "src/procgen/hydrology.js", "src/procgen/refine.js",
  "src/procgen/validate.js", "src/procgen/themes.js", "src/procgen/worldgen.js",
];
inject("/*__PROCGEN__*/", PROCGEN_ORDER.map((f) => readFileSync(join(root, f), "utf8")).join("\n"));
inject("/*__APP__*/", readFileSync(join(root, "src/app.js"), "utf8"));

writeFileSync(join(root, "index.html"), html);
console.log(`built index.html — ${(html.length / 1024 / 1024).toFixed(2)}MB`);
