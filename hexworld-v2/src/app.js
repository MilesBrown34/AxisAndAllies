/* global PIXI, WORLD_DATA, HexWorldCore, HexWorldProcgen */
// Browser app: Pixi rendering + pan/zoom + math-based hover/click + DOM UI.
(async function () {
  const core = HexWorldCore;

  const app = new PIXI.Application();
  await app.init({
    background: 0x0b1d33, resizeTo: window, antialias: true,
    resolution: window.devicePixelRatio || 1, autoDensity: true,
  });
  document.getElementById("map").appendChild(app.canvas);

  const world = new PIXI.Container();
  app.stage.addChild(world);
  const fillG = new PIXI.Graphics();
  const riverG = new PIXI.Graphics();   // rivers ride above fills, under coastlines
  const edgeG = new PIXI.Graphics();
  const selectG = new PIXI.Graphics();
  const hoverG = new PIXI.Graphics();
  world.addChild(fillG, riverG, edgeG, selectG, hoverG);

  const $ = (id) => document.getElementById(id);
  const ui = {
    controls: $("controls"), controlsToggle: $("controlsToggle"),
    seedSlider: $("seedSlider"), seedInput: $("seedInput"), seedVal: $("seedVal"),
    sizeBtns: $("sizeBtns"), nodeBtns: $("nodeBtns"), stats: $("stats"), panel: $("panel"),
    panelTitle: $("panelTitle"), panelSub: $("panelSub"), log: $("log"), tooltip: $("tooltip"),
    modeBtns: $("modeBtns"), oceanRow: $("oceanRow"), oceanSlider: $("oceanSlider"),
    oceanVal: $("oceanVal"), legend: $("legend"), legendRows: $("legendRows"),
    legendHead: $("legendHead"), legendChev: $("legendChev"),
    continentRow: $("continentRow"), continentSlider: $("continentSlider"), continentVal: $("continentVal"),
    warpRow: $("warpRow"), warpSlider: $("warpSlider"), warpVal: $("warpVal"),
    minLakeRow: $("minLakeRow"), minLakeSlider: $("minLakeSlider"), minLakeVal: $("minLakeVal"),
    themeRow: $("themeRow"), themeSel: $("themeSel"),
    advHead: $("advHead"), advToggle: $("advToggle"), advanced: $("advanced"),
    mountainSlider: $("mountainSlider"), mountainVal: $("mountainVal"),
    rainSlider: $("rainSlider"), rainVal: $("rainVal"),
    aridSlider: $("aridSlider"), aridVal: $("aridVal"),
    riverSlider: $("riverSlider"), riverVal: $("riverVal"),
    honestSlider: $("honestSlider"), honestVal: $("honestVal"),
    seaSlider: $("seaSlider"), seaVal: $("seaVal"),
    btnWorld: $("btnWorld"), btnLegend: $("btnLegend"), tbStats: $("tbStats"),
  };

  let seed = 1, sizeKey = "medium", nodeR = 0, res = null;
  let mode = "earth", oceanPct = 0.65, continents = 4, warp = 60, minLake = 3;
  let theme = "terran", advOpen = false;
  let mountainPc = 100, rainPc = 100, aridPc = 100, riverDens = 10, honestyPc = 100, seaOffPm = 0;
  let selectUnit = null, hoverUnit = null, userView = false;

  // ---- themes: selector options + envelope application ----
  const THEMES = HexWorldProcgen.THEMES;
  for (const t of THEMES) {
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = `${t.label} — ${t.tagline}`;
    ui.themeSel.appendChild(o);
  }
  const themeLabelOf = (id) => (THEMES.find((x) => x.id === id) || THEMES[0]).label;
  // Switching theme RESETS every dial to the theme's envelope (or the base default);
  // Advanced edits after that are user overrides until the next theme switch.
  const DIALS = [
    { key: "oceanPct",   dflt: 0.65, toUi: (v) => Math.round(v * 100),  set: (u) => { oceanPct = u / 100; ui.oceanSlider.value = u; ui.oceanVal.textContent = u; } },
    { key: "continents", dflt: 4,    toUi: (v) => v,                    set: (u) => { continents = u; ui.continentSlider.value = u; ui.continentVal.textContent = u; } },
    { key: "warp",       dflt: 60,   toUi: (v) => v,                    set: (u) => { warp = u; ui.warpSlider.value = u; ui.warpVal.textContent = u; } },
    { key: "minLake",    dflt: 3,    toUi: (v) => v,                    set: (u) => { minLake = u; ui.minLakeSlider.value = u; ui.minLakeVal.textContent = u; } },
    { key: "mountain",   dflt: 1,    toUi: (v) => Math.round(v * 100),  set: (u) => { mountainPc = u; ui.mountainSlider.value = u; ui.mountainVal.textContent = u; } },
    { key: "rainMult",   dflt: 1,    toUi: (v) => Math.round(v * 100),  set: (u) => { rainPc = u; ui.rainSlider.value = u; ui.rainVal.textContent = u; } },
    { key: "arid",       dflt: 1,    toUi: (v) => Math.round(v * 100),  set: (u) => { aridPc = u; ui.aridSlider.value = u; ui.aridVal.textContent = u; } },
    { key: "riverPct",   dflt: 0.9,  toUi: (v) => Math.round((1 - v) * 100), set: (u) => { riverDens = u; ui.riverSlider.value = u; ui.riverVal.textContent = u; } },
    { key: "riverCheat", dflt: 1,    toUi: (v) => Math.round(v * 100),  set: (u) => { honestyPc = u; ui.honestSlider.value = u; ui.honestVal.textContent = u; } },
    { key: "seaOffset",  dflt: 0,    toUi: (v) => Math.round(v * 1000), set: (u) => { seaOffPm = u; ui.seaSlider.value = u; ui.seaVal.textContent = (u / 10).toFixed(1); } },
  ];
  function applyThemeEnvelope() {
    const t = THEMES.find((x) => x.id === theme) || THEMES[0];
    for (const d of DIALS) {
      const v = t.envelope[d.key] === undefined ? d.dflt : t.envelope[d.key];
      d.set(d.toUi(v));
    }
  }

  // ---- responsive layout: phone = bottom bar + sheets, mid = collapsible cards ----
  const mqPhone = matchMedia("(max-width: 600px)");
  const mqMid = matchMedia("(max-width: 900px)");
  function syncToggleGlyph() {
    ui.controlsToggle.textContent = mqPhone.matches ? "✕"
      : ui.controls.classList.contains("collapsed") ? "▸" : "▾";
  }
  function closeSheets() {
    ui.controls.classList.remove("open");
    ui.legend.classList.remove("open");
  }
  function applyLayout() {
    if (mqMid.matches) {                       // phone + foldable: start out of the way
      ui.controls.classList.add("collapsed");
      ui.legend.classList.add("folded");
    } else {
      ui.controls.classList.remove("collapsed");
      ui.legend.classList.remove("folded");
      closeSheets();
    }
    syncToggleGlyph();
  }
  mqPhone.addEventListener("change", applyLayout);
  mqMid.addEventListener("change", applyLayout);
  applyLayout();

  // FNV-1a name hash → stable per-country HSL color.
  function colorFor(name) {
    let h = 2166136261;
    for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
    h >>>= 0;
    return hslToInt(h % 360, 42 + ((h >> 9) % 24), 40 + ((h >> 17) % 18));
  }
  function hslToInt(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
  }

  let regenTimer = 0;
  function regenerateSoon() {           // proc regen is heavier — debounce slider drags
    clearTimeout(regenTimer);
    ui.stats.textContent = "generating…";
    regenTimer = setTimeout(regenerate, 80);
  }
  function regenerate() {
    res = mode === "proc"
      ? HexWorldProcgen.generateWorld({ seed, sizeKey, clusterR: nodeR, theme,
          oceanPct, continents, warp, minLake,
          mountain: mountainPc / 100, rainMult: rainPc / 100, arid: aridPc / 100,
          riverPct: 1 - riverDens / 100, riverCheat: honestyPc / 100,
          seaOffset: seaOffPm / 1000 })
      : core.generate(WORLD_DATA, { seed, sizeKey, clusterR: nodeR });
    selectUnit = null; hoverUnit = null;
    drawMap(); drawSelect(); drawHover(); updateStats(); updateLegend();
    ui.panel.classList.add("hidden");
    ui.tooltip.classList.add("hidden");
  }

  // Procedural mode: fills batched per hypsometric band (~7 flushes), ocean drawn as
  // real cells; edges emanate from land only (grid, node borders, coastline).
  function drawProcFills(g) {
    const byBand = new Map();
    for (const hex of res.hexes.values()) {
      let arr = byBand.get(hex.biome);
      if (!arr) byBand.set(hex.biome, (arr = []));
      arr.push(hex);
    }
    for (const band of res.palette) {
      const arr = byBand.get(band.id);
      if (!arr) continue;
      for (const hex of arr) fillG.poly(core.hexCorners(hex.cx, hex.cy, g.size));
      fillG.fill(band.color);
    }
    // Snowcaps: smaller white hexes over the biome fill, one flush.
    const snow = [];
    for (const hex of res.hexes.values()) if (hex.snowcap) snow.push(hex);
    for (const hex of snow) fillG.poly(core.hexCorners(hex.cx, hex.cy, g.size * 0.55));
    if (snow.length) fillG.fill({ color: 0xf4f8fb, alpha: 0.9 });
  }
  // Rivers: one stroke flush per width bucket (width ∝ √flux via w01). Buckets are
  // sorted so wide trunks draw over their thin tributaries' joints.
  function drawProcRivers(g) {
    if (!res.rivers || !res.rivers.length) return;
    const buckets = new Map();
    for (const s of res.rivers) {
      const w = Math.max(0.7, g.size * (0.10 + 0.30 * s.w01));
      const k = Math.round(w * 2) / 2;
      let arr = buckets.get(k);
      if (!arr) buckets.set(k, (arr = []));
      arr.push(s);
    }
    for (const [w, segs] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
      for (const s of segs) riverG.moveTo(s.x1, s.y1).lineTo(s.x2, s.y2);
      riverG.stroke({ width: w, color: 0x3aa3d9, alpha: 0.9, cap: "round" });
    }
  }
  function drawProcEdges(g) {
    const grid = [], coast = [], node = [];
    for (const [key, hex] of res.hexes) {
      if (hex.water !== "none") continue;
      const pts = core.hexCorners(hex.cx, hex.cy, g.size);
      const nbs = core.neighbors(hex.col, hex.row);
      for (let i = 0; i < 6; i++) {
        const nkey = core.cellKey(nbs[i][0], nbs[i][1]);
        const nb = res.hexes.get(nkey);
        const seg = [pts[i * 2], pts[i * 2 + 1], pts[(i * 2 + 2) % 12], pts[(i * 2 + 3) % 12]];
        if (!nb || nb.water !== "none") coast.push(seg);
        else if (key < nkey) {
          grid.push(seg);
          if (res.clusters && nb.clusterId !== hex.clusterId) node.push(seg);
        }
      }
    }
    for (const s of grid) edgeG.moveTo(s[0], s[1]).lineTo(s[2], s[3]);
    edgeG.stroke({ width: Math.max(0.4, g.size * 0.06), color: 0x0a1626, alpha: 0.35 });
    for (const s of node) edgeG.moveTo(s[0], s[1]).lineTo(s[2], s[3]);
    edgeG.stroke({ width: Math.max(0.7, g.size * 0.1), color: 0xdfe8f2, alpha: 0.3 });
    for (const s of coast) edgeG.moveTo(s[0], s[1]).lineTo(s[2], s[3]);
    edgeG.stroke({ width: Math.max(1, g.size * 0.14), color: 0x081221, alpha: 0.95 });
  }

  function drawMap() {
    const g = res.geom;
    fillG.clear(); riverG.clear(); edgeG.clear();
    if (res.mode === "proc") {
      drawProcFills(g);
      drawProcRivers(g);
      drawProcEdges(g);
      if (!userView) fitView();
      return;
    }

    // One fill path per country (fast: ~170 fill flushes, not ~8000).
    // Unplayable land (Antarctica) gets one muted silhouette fill instead.
    const byCountry = new Map();
    const unplayableHexes = [];
    for (const hex of res.hexes.values()) {
      if (!hex.playable) { unplayableHexes.push(hex); continue; }
      let arr = byCountry.get(hex.name);
      if (!arr) byCountry.set(hex.name, (arr = []));
      arr.push(hex);
    }
    for (const [name, hexes] of byCountry) {
      for (const hex of hexes) fillG.poly(core.hexCorners(hex.cx, hex.cy, g.size));
      fillG.fill(colorFor(name));
    }
    for (const hex of unplayableHexes) fillG.poly(core.hexCorners(hex.cx, hex.cy, g.size));
    if (unplayableHexes.length) fillG.fill(0x2c3a48);

    // Batched edge strokes: per-hex grid (every unique internal edge), coasts,
    // country borders — one stroke flush each. Grid skips unplayable-unplayable
    // edges so Antarctica reads as an inert silhouette.
    const grid = [], coast = [], border = [], node = [];
    for (const [key, hex] of res.hexes) {
      const pts = core.hexCorners(hex.cx, hex.cy, g.size);
      const nbs = core.neighbors(hex.col, hex.row);
      for (let i = 0; i < 6; i++) {
        const nkey = core.cellKey(nbs[i][0], nbs[i][1]);
        const nb = res.hexes.get(nkey);
        const seg = [pts[i * 2], pts[i * 2 + 1], pts[(i * 2 + 2) % 12], pts[(i * 2 + 3) % 12]];
        if (!nb) coast.push(seg);
        else if (key < nkey) {
          if (hex.playable || nb.playable) grid.push(seg);
          if (nb.name !== hex.name && hex.playable && nb.playable) border.push(seg);
          else if (res.clusters && hex.playable && nb.playable &&
                   nb.clusterId !== hex.clusterId) node.push(seg);
        }
      }
    }
    for (const s of grid) edgeG.moveTo(s[0], s[1]).lineTo(s[2], s[3]);
    edgeG.stroke({ width: Math.max(0.4, g.size * 0.06), color: 0x0a1626, alpha: 0.35 });
    for (const s of node) edgeG.moveTo(s[0], s[1]).lineTo(s[2], s[3]);
    edgeG.stroke({ width: Math.max(0.7, g.size * 0.1), color: 0xdfe8f2, alpha: 0.3 });
    for (const s of coast) edgeG.moveTo(s[0], s[1]).lineTo(s[2], s[3]);
    edgeG.stroke({ width: Math.max(1, g.size * 0.14), color: 0x081221, alpha: 0.95 });
    for (const s of border) edgeG.moveTo(s[0], s[1]).lineTo(s[2], s[3]);
    edgeG.stroke({ width: Math.max(0.7, g.size * 0.09), color: 0x101b28, alpha: 0.8 });

    if (!userView) fitView();
  }

  // A "unit" is the selectable thing: one hex, or the whole node cluster.
  function unitOf(hexKey) {
    if (!hexKey) return null;
    const hex = res.hexes.get(hexKey);
    if (!res.clusters || !hex.clusterId) return { id: hexKey, keys: [hexKey], hex, size: 1 };
    const c = res.clusters.get(hex.clusterId);
    return { id: c.id, keys: c.hexKeys, hex, size: c.hexKeys.length };
  }
  function outlineUnit(gfx, unit, color, width) {
    gfx.clear();
    if (!unit) return;
    const g = res.geom, set = new Set(unit.keys);
    for (const k of unit.keys) {
      const h = res.hexes.get(k);
      gfx.poly(core.hexCorners(h.cx, h.cy, g.size)).fill({ color, alpha: 0.22 });
    }
    for (const k of unit.keys) {
      const h = res.hexes.get(k);
      const pts = core.hexCorners(h.cx, h.cy, g.size);
      const nbs = core.neighbors(h.col, h.row);
      for (let i = 0; i < 6; i++) {
        if (!set.has(core.cellKey(nbs[i][0], nbs[i][1]))) {
          gfx.moveTo(pts[i * 2], pts[i * 2 + 1]).lineTo(pts[(i * 2 + 2) % 12], pts[(i * 2 + 3) % 12]);
        }
      }
    }
    gfx.stroke({ width, color, alpha: 1 });
  }
  function drawHover() { outlineUnit(hoverG, hoverUnit, 0xffffff, Math.max(1, res.geom.size * 0.12)); }
  function drawSelect() { outlineUnit(selectG, selectUnit, 0xf0c96a, Math.max(1.5, res.geom.size * 0.18)); }

  function fitView() {
    const contain = Math.min(app.screen.width / core.WORLD.W, app.screen.height / core.WORLD.H);
    // Portrait screens: containing the whole 1800×850 world leaves a letterboxed
    // strip — frame the world height to ~62% of the viewport instead and let the
    // user pan sideways (map-app convention).
    const portrait = app.screen.width < app.screen.height;
    const s = (portrait ? Math.max(contain, (app.screen.height * 0.62) / core.WORLD.H) : contain) * 0.98;
    world.scale.set(s);
    world.position.set(
      (app.screen.width - core.WORLD.W * s) / 2,
      (app.screen.height - core.WORLD.H * s) / 2
    );
  }
  window.addEventListener("resize", () => { if (!userView) fitView(); });

  function updateLegend() {
    ui.btnLegend.disabled = res.mode !== "proc";
    if (res.mode !== "proc") { ui.legend.classList.add("hidden"); return; }
    ui.legend.classList.remove("hidden");
    ui.legendRows.innerHTML = "";
    for (const band of res.palette) {
      const n = res.biomeCounts.get(band.id);
      if (!n) continue;
      const row = document.createElement("div");
      row.className = "lg-row";
      const sw = document.createElement("span");
      sw.className = "lg-swatch";
      sw.style.background = "#" + band.color.toString(16).padStart(6, "0");
      const label = document.createElement("span");
      label.textContent = band.label;
      const count = document.createElement("span");
      count.className = "lg-count";
      count.textContent = n;
      row.append(sw, label, count);
      ui.legendRows.appendChild(row);
    }
  }

  function bandLabel(id) { return res.palette.find((b) => b.id === id).label; }
  function charLabel(id) { return res.characters.find((c) => c.id === id).label; }
  const tempC = (t) => Math.round(-25 + 58 * t);   // display map: [0,1] → about −25..33 °C
  const climateLine = (hex) =>
    `${tempC(hex.temperature)}°C · rain ${Math.round(hex.rainfall * 100)} · flux ${hex.flux.toFixed(1)}`;

  function updateStats() {
    if (res.mode === "proc") {
      const landPct = ((res.totalLand / res.totalCells) * 100).toFixed(0);
      const top = [...res.landmasses.values()].slice(0, 5)
        .map((m) => `${m.name} (${charLabel(m.character)}) ${m.size}`).join(" · ");
      // 4 = VALIDATE.MAX_TRIES — every try failed, the degraded world is shown.
      const rej = res.rejections && res.rejections.length
        ? `<div class="chips">⚠ ${res.rejections
            .map((x) => `seed ${x.seed} rejected: ${x.reason}`).join(" · ")} · ${
            res.rejections.length >= 4 ? "showing it anyway" : `showing seed ${res.seed}`}</div>`
        : "";
      ui.stats.innerHTML =
        `<b>${themeLabelOf(res.theme)}</b> · seed <b>${res.seed}</b> · ${sizeKey} · hex ${res.geom.size.toFixed(1)}px · ` +
        `<b>${landPct}%</b> land (${res.totalLand}/${res.totalCells}) · ` +
        `${res.landmasses.size} landmasses · ${res.biomeLandCount} biomes · ` +
        `${res.riverCount} rivers · ${res.lakeCount} lakes` +
        (res.clusters ? ` · <b>${res.clusters.size}</b> nodes` : "") +
        `<div class="chips">${top}</div>` + rej;
      ui.tbStats.textContent =
        (res.rejections && res.rejections.length ? "⚠ " : "") +
        `${themeLabelOf(res.theme)} · seed ${res.seed} · ${landPct}% land · ${res.landmasses.size} lm · ` +
        `${res.biomeLandCount} biomes · ${res.riverCount} riv` +
        (res.clusters ? ` · ${res.clusters.size} nodes` : "");
      return;
    }
    const conts = [...res.continentCounts.entries()].sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${c} ${n}`).join(" · ");
    ui.stats.innerHTML =
      `seed <b>${res.seed}</b> · ${sizeKey} · hex ${res.geom.size.toFixed(1)}px · ` +
      `<b>${res.totalLand}</b> land hexes · ${res.countryCounts.size} countries` +
      (res.clusters ? ` · <b>${res.clusters.size}</b> nodes` : "") +
      `<div class="chips">${conts} · Antarctica ${res.unplayable} (unplayable)</div>`;
    ui.tbStats.textContent =
      `seed ${res.seed} · ${res.totalLand} land · ${res.countryCounts.size} countries` +
      (res.clusters ? ` · ${res.clusters.size} nodes` : "");
  }

  // ---- pointer: hover (math hit-test), click select, drag pan, wheel zoom ----
  function hexAt(e) {
    const x = (e.offsetX - world.x) / world.scale.x;
    const y = (e.offsetY - world.y) / world.scale.y;
    const cell = core.pixelToCell(x, y, res.geom);
    if (!cell) return null;
    const key = core.cellKey(cell.col, cell.row);
    const hex = res.hexes.get(key);
    return hex && hex.playable ? key : null;
  }

  let dragging = false, dragMoved = false, lastX = 0, lastY = 0;
  let pinch = null; // {d, mx, my} — two-finger state
  const pointers = new Map();

  app.canvas.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true; dragMoved = false; lastX = e.clientX; lastY = e.clientY;
    } else if (pointers.size === 2) {
      dragging = false; dragMoved = true; // a pinch is never a tap-select
      const [p1, p2] = [...pointers.values()];
      pinch = { d: Math.hypot(p2.x - p1.x, p2.y - p1.y), mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2 };
    }
  });
  window.addEventListener("pointerup", (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (dragging && !dragMoved && e.target === app.canvas) {
      selectUnit = unitOf(hexAt(e));
      drawSelect();
      if (selectUnit) {
        const hex = selectUnit.hex;
        ui.panel.classList.remove("hidden");
        ui.panelTitle.textContent = hex.name;
        if (res.mode === "proc") {
          const elev = (hex.elevation >= 0 ? "+" : "") + hex.elevation.toFixed(2);
          ui.panelSub.textContent =
            `${charLabel(res.landmasses.get(hex.landmassId).character)} · ` +
            `${bandLabel(hex.biome)} · elev ${elev} · ${climateLine(hex)}` +
            (res.clusters
              ? ` · node of ${selectUnit.size} hexes`
              : ` · hex (${hex.col},${hex.row})`) +
            ` · ${res.landmasses.get(hex.landmassId).size} hexes on landmass`;
        } else {
          ui.panelSub.textContent = res.clusters
            ? `${hex.continent} · node of ${selectUnit.size} hexes · ` +
              `${res.countryCounts.get(hex.name)} hexes in country`
            : `${hex.continent} · hex (${hex.col},${hex.row}) · ` +
              `${res.countryCounts.get(hex.name)} hexes this seed`;
        }
      } else ui.panel.classList.add("hidden");
    }
    if (pointers.size === 0) dragging = false;
  });
  window.addEventListener("pointercancel", (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) dragging = false;
  });
  app.canvas.addEventListener("pointermove", (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      if (d > 0 && pinch.d > 0) {
        userView = true;
        const s0 = world.scale.x;
        const s1 = Math.min(12, Math.max(0.3, s0 * (d / pinch.d)));
        const wx = (pinch.mx - world.x) / s0, wy = (pinch.my - world.y) / s0;
        world.scale.set(s1);
        world.position.set(mx - wx * s1, my - wy * s1);
      }
      pinch = { d, mx, my };
      return;
    }
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (dragMoved || Math.abs(dx) + Math.abs(dy) > 4) {
        dragMoved = true; userView = true;
        world.position.set(world.x + dx, world.y + dy);
        lastX = e.clientX; lastY = e.clientY;
      }
      return;
    }
    if (e.pointerType !== "mouse") return; // hover/tooltip is mouse-only
    const unit = unitOf(hexAt(e));
    if ((unit && unit.id) !== (hoverUnit && hoverUnit.id)) { hoverUnit = unit; drawHover(); }
    if (unit) {
      const hex = unit.hex;
      ui.tooltip.classList.remove("hidden");
      ui.tooltip.style.left = e.clientX + 14 + "px";
      ui.tooltip.style.top = e.clientY + 12 + "px";
      ui.tooltip.innerHTML = res.mode === "proc"
        ? `<span class="tt-country">${hex.name}</span> · ` +
          `${charLabel(res.landmasses.get(hex.landmassId).character)} · ${bandLabel(hex.biome)}` +
          `<br>elev ${(hex.elevation >= 0 ? "+" : "") + hex.elevation.toFixed(2)} · ${climateLine(hex)}` +
          (res.clusters ? ` · node: ${unit.size} hexes` : ` · hex (${hex.col},${hex.row})`)
        : `<span class="tt-country">${hex.name}</span> · ${hex.continent}` +
          (res.clusters
            ? `<br>node: ${unit.size} hexes · country: ${res.countryCounts.get(hex.name)} hexes`
            : `<br>hex (${hex.col},${hex.row}) · country: ${res.countryCounts.get(hex.name)} hexes`);
    } else ui.tooltip.classList.add("hidden");
  });
  app.canvas.addEventListener("pointerleave", () => {
    hoverUnit = null; drawHover(); ui.tooltip.classList.add("hidden");
  });
  app.canvas.addEventListener("wheel", (e) => {
    e.preventDefault(); userView = true;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const ns = Math.min(12, Math.max(0.3, world.scale.x * factor));
    const wx = (e.offsetX - world.x) / world.scale.x, wy = (e.offsetY - world.y) / world.scale.y;
    world.scale.set(ns);
    world.position.set(e.offsetX - wx * ns, e.offsetY - wy * ns);
  }, { passive: false });

  // ---- controls ----
  const requestRegen = () => (mode === "proc" ? regenerateSoon() : regenerate());
  ui.seedSlider.addEventListener("input", () => {
    seed = Number(ui.seedSlider.value);
    ui.seedVal.textContent = seed;
    ui.seedInput.value = seed;
    requestRegen();
  });
  ui.seedInput.addEventListener("change", () => {
    seed = Math.max(0, Math.floor(Number(ui.seedInput.value) || 0));
    ui.seedVal.textContent = seed;
    if (seed >= 1 && seed <= 10) ui.seedSlider.value = seed;
    requestRegen();
  });
  ui.modeBtns.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-mode]");
    if (!btn || btn.dataset.mode === mode) return;
    for (const b of ui.modeBtns.querySelectorAll("button")) b.classList.remove("active");
    btn.classList.add("active");
    mode = btn.dataset.mode;
    ui.themeRow.classList.toggle("hidden", mode !== "proc");
    ui.continentRow.classList.toggle("hidden", mode !== "proc");
    ui.oceanRow.classList.toggle("hidden", mode !== "proc");
    ui.advHead.classList.toggle("hidden", mode !== "proc");
    ui.advanced.classList.toggle("hidden", mode !== "proc" || !advOpen);
    userView = false;   // re-fit on mode switch
    regenerate();
  });
  ui.themeSel.addEventListener("change", () => {
    theme = ui.themeSel.value;
    applyThemeEnvelope();
    regenerateSoon();
  });
  ui.advToggle.addEventListener("click", () => {
    advOpen = !advOpen;
    ui.advToggle.textContent = (advOpen ? "▾" : "▸") + " Advanced";
    ui.advanced.classList.toggle("hidden", mode !== "proc" || !advOpen);
  });
  ui.mountainSlider.addEventListener("input", () => {
    mountainPc = Number(ui.mountainSlider.value);
    ui.mountainVal.textContent = ui.mountainSlider.value;
    regenerateSoon();
  });
  ui.rainSlider.addEventListener("input", () => {
    rainPc = Number(ui.rainSlider.value);
    ui.rainVal.textContent = ui.rainSlider.value;
    regenerateSoon();
  });
  ui.aridSlider.addEventListener("input", () => {
    aridPc = Number(ui.aridSlider.value);
    ui.aridVal.textContent = ui.aridSlider.value;
    regenerateSoon();
  });
  ui.riverSlider.addEventListener("input", () => {
    riverDens = Number(ui.riverSlider.value);
    ui.riverVal.textContent = ui.riverSlider.value;
    regenerateSoon();
  });
  ui.honestSlider.addEventListener("input", () => {
    honestyPc = Number(ui.honestSlider.value);
    ui.honestVal.textContent = ui.honestSlider.value;
    regenerateSoon();
  });
  ui.seaSlider.addEventListener("input", () => {
    seaOffPm = Number(ui.seaSlider.value);
    ui.seaVal.textContent = (seaOffPm / 10).toFixed(1);
    regenerateSoon();
  });
  ui.warpSlider.addEventListener("input", () => {
    warp = Number(ui.warpSlider.value);
    ui.warpVal.textContent = ui.warpSlider.value;
    regenerateSoon();
  });
  ui.minLakeSlider.addEventListener("input", () => {
    minLake = Number(ui.minLakeSlider.value);
    ui.minLakeVal.textContent = ui.minLakeSlider.value;
    regenerateSoon();
  });
  // ---- responsive controls: sheet/collapse toggles ----
  ui.controlsToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (mqPhone.matches) ui.controls.classList.remove("open");
    else ui.controls.classList.toggle("collapsed");
    syncToggleGlyph();
  });
  ui.legendHead.addEventListener("click", () => {
    if (mqPhone.matches) { ui.legend.classList.remove("open"); return; }
    ui.legend.classList.toggle("folded");
    ui.legendChev.textContent = ui.legend.classList.contains("folded") ? "▸" : "▾";
  });
  ui.btnWorld.addEventListener("click", () => {
    const open = ui.controls.classList.contains("open");
    closeSheets();
    if (!open) ui.controls.classList.add("open");
  });
  ui.btnLegend.addEventListener("click", () => {
    const open = ui.legend.classList.contains("open");
    closeSheets();
    if (!open) ui.legend.classList.add("open");
  });
  app.canvas.addEventListener("pointerdown", () => { if (mqPhone.matches) closeSheets(); });
  ui.oceanSlider.addEventListener("input", () => {
    oceanPct = Number(ui.oceanSlider.value) / 100;
    ui.oceanVal.textContent = ui.oceanSlider.value;
    regenerateSoon();
  });
  ui.continentSlider.addEventListener("input", () => {
    continents = Number(ui.continentSlider.value);
    ui.continentVal.textContent = ui.continentSlider.value;
    regenerateSoon();
  });
  ui.sizeBtns.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-size]");
    if (!btn) return;
    for (const b of ui.sizeBtns.querySelectorAll("button")) b.classList.remove("active");
    btn.classList.add("active");
    sizeKey = btn.dataset.size;
    regenerate();
  });
  ui.nodeBtns.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-node]");
    if (!btn) return;
    for (const b of ui.nodeBtns.querySelectorAll("button")) b.classList.remove("active");
    btn.classList.add("active");
    nodeR = Number(btn.dataset.node);
    regenerate();
  });
  ui.panel.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn || !selectUnit) return;
    const hex = selectUnit.hex;
    const target = res.clusters
      ? `${hex.name} node (${selectUnit.size} hexes)`
      : `${hex.name} (${hex.col},${hex.row})`;
    const div = document.createElement("div");
    div.textContent = `[seed ${seed}] ${btn.dataset.act} → ${target} — placeholder, no effect`;
    ui.log.prepend(div);
  });

  regenerate();
  // Verification hook (used by the Playwright checks; harmless in normal use).
  window.__hexworld = {
    get res() { return res; }, get seed() { return seed; }, get sizeKey() { return sizeKey; },
    get nodeR() { return nodeR; }, get mode() { return mode; }, get oceanPct() { return oceanPct; },
    get continents() { return continents; }, get warp() { return warp; },
    get minLake() { return minLake; },
    get theme() { return theme; }, get advOpen() { return advOpen; },
    get mountain() { return mountainPc / 100; }, get rainMult() { return rainPc / 100; },
    get arid() { return aridPc / 100; },
    get riverPct() { return 1 - riverDens / 100; }, get riverCheat() { return honestyPc / 100; },
    get seaOffset() { return seaOffPm / 1000; },
    get view() { return { x: world.x, y: world.y, s: world.scale.x }; },
  };
})();
