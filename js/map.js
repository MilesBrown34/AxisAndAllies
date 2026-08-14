// IRON & CROWNS - HYBRID CANVAS-SVG INTERACTIVE MAP ENGINE (CIV 5 HEX GRID STYLE)
import { mapData } from './data/mapData.js';

export class MapEngine {
  constructor(gameState, onTerritorySelected) {
    this.gameState = gameState;
    this.onTerritorySelected = onTerritorySelected;
    
    this.svg = document.getElementById("map-svg");
    this.connectionsLayer = document.getElementById("map-connections-layer");
    this.territoriesLayer = document.getElementById("map-territories-layer");
    this.featuresLayer = document.getElementById("map-features-layer");
    this.selectionLayer = document.getElementById("map-selection-layer");
    this.riversLayer = document.getElementById("map-rivers-layer");
    this.labelsLayer = document.getElementById("map-labels-layer");
    this.nodesLayer = document.getElementById("map-nodes-layer");
    this.unitsLayer = document.getElementById("map-units-layer");

    // Hexagon Dimensions (Pointy-topped staggered offset layout coordinates)
    this.hexR = 12; 
    this.offsetX = 40; 
    this.offsetY = 50;

    // Zoom & Pan State
    this.zoomScale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.hasDragged = false;
    this.startX = 0;
    this.startY = 0;
    this.startMouseX = 0;
    this.startMouseY = 0;

    this.selectedTerritoryId = null;
    
    // Computed centers for connections & badges
    this.territoryCenters = {};

    // Loaded Texture Images Cache
    this.textures = {};
    this.staticSeaBgDataUrl = null;
    this.staticLandBgDataUrl = null;

    // Initialize SVG filters for ocean effects
    this.initOceanWaveFilter();

    this.initMapControls();
    
    // Asynchronously load textures, render background canvas, and then draw interactive layer
    this.loadTextures().then(() => {
      this.computeTerritoryCenters();
      this.preRenderStaticBackground();
      this.render();
    });
  }

  // Set up an animated SVG turbulence filter for the sea background
  initOceanWaveFilter() {
    let defs = this.svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      this.svg.insertBefore(defs, this.svg.firstChild);
    }
    
    let filter = document.getElementById("ocean-wave-filter");
    if (!filter) {
      filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
      filter.setAttribute("id", "ocean-wave-filter");
      filter.setAttribute("x", "0");
      filter.setAttribute("y", "0");
      filter.setAttribute("width", "2600");
      filter.setAttribute("height", "1200");
      filter.setAttribute("filterUnits", "userSpaceOnUse");

      // Generate fractal noise
      const feTurb = document.createElementNS("http://www.w3.org/2000/svg", "feTurbulence");
      feTurb.setAttribute("type", "fractalNoise");
      feTurb.setAttribute("baseFrequency", "0.012");
      feTurb.setAttribute("numOctaves", "2");
      feTurb.setAttribute("result", "noise");
      feTurb.setAttribute("seed", "1");
      
      // Animate the seed attribute dynamically for water ripple flow
      const animate = document.createElementNS("http://www.w3.org/2000/svg", "animate");
      animate.setAttribute("attributeName", "seed");
      animate.setAttribute("from", "1");
      animate.setAttribute("to", "100");
      animate.setAttribute("dur", "40s");
      animate.setAttribute("repeatCount", "indefinite");
      feTurb.appendChild(animate);
      
      // Displace source graphics slightly using generated noise
      const feDisp = document.createElementNS("http://www.w3.org/2000/svg", "feDisplacementMap");
      feDisp.setAttribute("in", "SourceGraphic");
      feDisp.setAttribute("in2", "noise");
      feDisp.setAttribute("scale", "5");
      feDisp.setAttribute("xChannelSelector", "R");
      feDisp.setAttribute("yChannelSelector", "G");
      
      filter.appendChild(feTurb);
      filter.appendChild(feDisp);
      defs.appendChild(filter);
    }
  }

  // Load all 8 terrain textures into cache
  loadTextures() {
    const textureNames = ['grassland', 'plains', 'tundra', 'desert', 'forest', 'jungle', 'mountain', 'sea'];
    return Promise.all(textureNames.map(name => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = `images/tex_${name}.png?t=` + Date.now();
        img.onload = () => {
          this.textures[name] = img;
          resolve();
        };
        img.onerror = () => {
          console.error(`Failed to load texture: ${name}`);
          resolve(); // Resolve anyway to avoid blocking initialization
        };
      });
    }));
  }

  // Use the territory's seed coordinates as the visual center for labels, resource badges, and units.
  computeTerritoryCenters() {
    const W = this.hexR * Math.sqrt(3);
    const H = this.hexR * 1.5;

    for (const [id, t] of Object.entries(mapData.territories)) {
      const seed = mapData.seeds[id];
      if (seed) {
        this.territoryCenters[id] = {
          // Staggered horizontal offset mapping
          x: this.offsetX + W * (seed.q + (seed.r % 2 === 1 ? 0.5 : 0)),
          y: this.offsetY + H * seed.r
        };
      } else if (t.hexes && t.hexes.length > 0) {
        let sumX = 0;
        let sumY = 0;
        t.hexes.forEach(hex => {
          const pxX = this.offsetX + W * (hex.q + (hex.r % 2 === 1 ? 0.5 : 0));
          const pxY = this.offsetY + H * hex.r;
          sumX += pxX;
          sumY += pxY;
        });
        this.territoryCenters[id] = {
          x: sumX / t.hexes.length,
          y: sumY / t.hexes.length
        };
      }
    }
  }

  // Bind Zoom & Drag Navigation
  initMapControls() {
    const viewport = document.getElementById("map-viewport");

    viewport.addEventListener("mousedown", (e) => {
      // Allow dragging on clicking any element inside viewport
      this.isDragging = true;
      this.hasDragged = false;
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
      this.startMouseX = e.clientX;
      this.startMouseY = e.clientY;
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      this.panX = e.clientX - this.startX;
      this.panY = e.clientY - this.startY;
      
      const dx = e.clientX - this.startMouseX;
      const dy = e.clientY - this.startMouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.hasDragged = true;
      }
      this.applyTransform();
    });

    window.addEventListener("mouseup", () => {
      this.isDragging = false;
    });

    document.getElementById("map-zoom-in").addEventListener("click", () => this.zoomToCenter(0.15));
    document.getElementById("map-zoom-out").addEventListener("click", () => this.zoomToCenter(-0.15));
    document.getElementById("map-zoom-reset").addEventListener("click", () => {
      this.zoomScale = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.applyTransform();
    });

    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 0.08 : -0.08;
      const newScale = Math.max(0.5, Math.min(3.0, this.zoomScale + zoomFactor));
      
      if (newScale !== this.zoomScale) {
        const scaleRatio = newScale / this.zoomScale;
        this.panX = mouseX - (mouseX - this.panX) * scaleRatio;
        this.panY = mouseY - (mouseY - this.panY) * scaleRatio;
        this.zoomScale = newScale;
        this.applyTransform();
      }
    });
  }

  // Zoom centered on the viewport frame
  zoomToCenter(factor) {
    const viewport = document.getElementById("map-viewport");
    const rect = viewport.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const newScale = Math.max(0.5, Math.min(3.0, this.zoomScale + factor));
    if (newScale !== this.zoomScale) {
      const scaleRatio = newScale / this.zoomScale;
      this.panX = centerX - (centerX - this.panX) * scaleRatio;
      this.panY = centerY - (centerY - this.panY) * scaleRatio;
      this.zoomScale = newScale;
      this.applyTransform();
    }
  }

  applyTransform() {
    this.svg.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomScale})`;
  }

  // pre-render static map details (terrain texture layers, crease borders, mountain/forest overlays)
  // directly onto two separate backgrounds (sea and land) to allow filtering the ocean dynamically.
  preRenderStaticBackground() {
    const seaCanvas = document.createElement("canvas");
    seaCanvas.width = 2600;
    seaCanvas.height = 1200;
    const seaCtx = seaCanvas.getContext("2d");

    const landCanvas = document.createElement("canvas");
    landCanvas.width = 2600;
    landCanvas.height = 1200;
    const landCtx = landCanvas.getContext("2d");

    // 1. Draw flat sea zones background across seaCanvas
    if (this.textures['sea']) {
      const pattern = seaCtx.createPattern(this.textures['sea'], 'repeat');
      // Scale the texture pattern appropriately for the new 155x151 texture size
      const matrix = new DOMMatrix().scale(0.5, 0.5);
      pattern.setTransform(matrix);
      seaCtx.fillStyle = pattern;
      seaCtx.fillRect(0, 0, 2600, 1200);
    } else {
      seaCtx.fillStyle = "#0c1a2e";
      seaCtx.fillRect(0, 0, 2600, 1200);
    }

    // Add a rich radial gradient overlay on the ocean to give depth (dark edges, lighter center)
    const depthGrad = seaCtx.createRadialGradient(1300, 600, 200, 1300, 600, 1500);
    depthGrad.addColorStop(0, "rgba(5, 20, 45, 0.4)");
    depthGrad.addColorStop(1, "rgba(2, 8, 20, 0.95)");
    seaCtx.fillStyle = depthGrad;
    seaCtx.fillRect(0, 0, 2600, 1200);

    const W = this.hexR * Math.sqrt(3);
    const H = this.hexR * 1.5;

    // Build a quick lookup of hex coordinate to biome for land/sea determination
    const hexBiomeMap = {};
    for (const t of Object.values(mapData.territories)) {
      t.hexes.forEach(hex => {
        hexBiomeMap[`${hex.q},${hex.r}`] = hex.biome;
      });
    }

    // Helper to calculate hex neighbors with cylindrical wrapping (120 cols)
    const getHexNeighbors = (q, r) => {
      const neighbors = [];
      neighbors.push({ q: (q + 1) % 120, r: r });
      neighbors.push({ q: (q - 1 + 120) % 120, r: r });
      
      const isOddRow = (r % 2 === 1);
      if (isOddRow) {
        neighbors.push({ q: q, r: r - 1 });
        neighbors.push({ q: (q + 1) % 120, r: r - 1 });
        neighbors.push({ q: q, r: r + 1 });
        neighbors.push({ q: (q + 1) % 120, r: r + 1 });
      } else {
        neighbors.push({ q: q, r: r - 1 });
        neighbors.push({ q: (q - 1 + 120) % 120, r: r - 1 });
        neighbors.push({ q: q, r: r + 1 });
        neighbors.push({ q: (q - 1 + 120) % 120, r: r + 1 });
      }
      return neighbors.filter(n => n.r >= 0 && n.r < 60);
    };

    const isNearLand = (q, r) => {
      const neighbors = getHexNeighbors(q, r);
      for (const n of neighbors) {
        const b = hexBiomeMap[`${n.q},${n.r}`];
        if (b && b !== "sea") {
          return true;
        }
      }
      return false;
    };

    // Helper to draw pointy hex paths on canvas
    const drawPointyHexPath = (cContext, cx, cy, r) => {
      cContext.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + (Math.PI / 6);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) cContext.moveTo(x, y);
        else cContext.lineTo(x, y);
      }
      cContext.closePath();
    };

    // Helper to fill hex with texture patterns
    const fillHexTexture = (cContext, cx, cy, r, textureImg, customScale = null) => {
      cContext.save();
      drawPointyHexPath(cContext, cx, cy, r);
      cContext.clip();

      const pattern = cContext.createPattern(textureImg, 'repeat');
      if (customScale) {
        const matrix = new DOMMatrix().scale(customScale, customScale);
        pattern.setTransform(matrix);
      }
      cContext.fillStyle = pattern;
      cContext.fill();
      cContext.restore();
    };

    // 2. Draw hex terrain tiles and dynamic feature icons
    for (const t of Object.values(mapData.territories)) {
      t.hexes.forEach(hex => {
        const pxX = this.offsetX + W * (hex.q + (hex.r % 2 === 1 ? 0.5 : 0));
        const pxY = this.offsetY + H * hex.r;

        if (hex.biome === "sea") {
          // A. Draw Sea Hexes onto seaCanvas
          let tex = this.textures['sea'];
          if (tex) {
            fillHexTexture(seaCtx, pxX, pxY, this.hexR, tex, 0.5);
          }

          // Apply Chroma Coastlines (Teal overlay near land to simulate shallow reefs)
          if (isNearLand(hex.q, hex.r)) {
            seaCtx.save();
            drawPointyHexPath(seaCtx, pxX, pxY, this.hexR);
            seaCtx.fillStyle = "rgba(44, 161, 161, 0.4)";
            seaCtx.fill();
            seaCtx.restore();
          }

          // Draw sea hex crease outlines (very subtle light lines)
          drawPointyHexPath(seaCtx, pxX, pxY, this.hexR);
          seaCtx.strokeStyle = "rgba(255, 255, 255, 0.05)";
          seaCtx.lineWidth = 0.3;
          seaCtx.stroke();
        } else {
          // B. Draw Land Hexes & Features onto landCanvas
          let tex = this.textures['grassland'];
          const b = hex.biome;
          if (b.includes("grassland")) tex = this.textures['grassland'];
          else if (b.includes("plains")) tex = this.textures['plains'];
          else if (b.includes("desert")) tex = this.textures['desert'];
          else if (b.includes("tundra")) tex = this.textures['tundra'];
          else if (b.includes("forest")) tex = this.textures['forest'];
          else if (b.includes("jungle")) tex = this.textures['jungle'];
          else if (b.includes("mountain")) tex = this.textures['mountain'];
          else if (b === "urban") tex = this.textures['grassland'];

          if (tex) {
            fillHexTexture(landCtx, pxX, pxY, this.hexR, tex);
          }

          // Draw land hex crease outlines (dark crease line style)
          drawPointyHexPath(landCtx, pxX, pxY, this.hexR);
          landCtx.strokeStyle = "rgba(0, 0, 0, 0.14)";
          landCtx.lineWidth = 0.5;
          landCtx.stroke();

          // Draw overlay features on top of land terrain
          if (b === "mountain") {
            this.drawCanvasMountain(landCtx, pxX, pxY - 5, 1.1);
          } else if (b === "forest") {
            this.drawCanvasForestPine(landCtx, pxX, pxY);
          } else if (b === "forest_hill") {
            this.drawCanvasHill(landCtx, pxX, pxY);
            this.drawCanvasForestPine(landCtx, pxX, pxY - 2);
          } else if (b === "jungle") {
            this.drawCanvasJunglePalm(landCtx, pxX, pxY);
          } else if (b === "jungle_hill") {
            this.drawCanvasHill(landCtx, pxX, pxY);
            this.drawCanvasJunglePalm(landCtx, pxX, pxY - 2);
          } else if (b.endsWith("_hill")) {
            this.drawCanvasHill(landCtx, pxX, pxY);
          } else if (b === "urban") {
            this.drawCanvasUrban(landCtx, pxX, pxY - 1, 1.05);
          }
        }
      });
    }

    this.staticSeaBgDataUrl = seaCanvas.toDataURL("image/png");
    this.staticLandBgDataUrl = landCanvas.toDataURL("image/png");
  }

  // --- CANVAS STATIC VECTOR SYMBOLS DRAWING ROUTINES ---
  drawCanvasHill(ctx, x, y) {
    ctx.save();
    // Shaded slope
    ctx.beginPath();
    ctx.moveTo(x - 16, y + 8);
    ctx.quadraticCurveTo(x, y - 6, x + 16, y + 8);
    ctx.quadraticCurveTo(x, y - 3, x - 16, y + 8);
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fill();

    // Dark stroke
    ctx.beginPath();
    ctx.moveTo(x - 16, y + 8);
    ctx.quadraticCurveTo(x, y - 6, x + 16, y + 8);
    ctx.strokeStyle = "rgba(41, 69, 25, 0.45)";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.stroke();

    // White highlight
    ctx.beginPath();
    ctx.moveTo(x - 15, y + 7.5);
    ctx.quadraticCurveTo(x, y - 5.2, x + 15, y + 7.5);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  drawCanvasPineTree(ctx, x, y, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 5.5, 5, 1.6, 0, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.fill();

    // Trunk
    ctx.fillStyle = "#3a2512";
    ctx.fillRect(-0.6, 3, 1.2, 3);

    // Foliage 3 (Bottom)
    ctx.beginPath();
    ctx.moveTo(-5, 3.2);
    ctx.quadraticCurveTo(0, 1.2, 5, 3.2);
    ctx.lineTo(0, 1.2);
    ctx.closePath();
    ctx.fillStyle = "#1b331f"; 
    ctx.fill();
    ctx.strokeStyle = "#0e1f10";
    ctx.lineWidth = 0.3;
    ctx.stroke();

    // Foliage 2 (Middle)
    ctx.beginPath();
    ctx.moveTo(-4, 0.8);
    ctx.quadraticCurveTo(0, -1.0, 4, 0.8);
    ctx.lineTo(0, -1.0);
    ctx.closePath();
    ctx.fillStyle = "#2d5234"; 
    ctx.fill();
    ctx.stroke();

    // Foliage 1 (Top)
    ctx.beginPath();
    ctx.moveTo(-2.5, -1.6);
    ctx.quadraticCurveTo(0, -7.0, 2.5, -1.6);
    ctx.lineTo(0, -7.0);
    ctx.closePath();
    ctx.fillStyle = "#417047"; 
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  drawCanvasDeciduousTree(ctx, x, y, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 4.5, 4.5, 1.6, 0, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.fill();

    // Trunk
    ctx.fillStyle = "#3a2512";
    ctx.fillRect(-0.6, 1.5, 1.2, 3.5);

    // Canopy cloud
    ctx.beginPath();
    ctx.arc(0, -4, 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#1d3d20";
    ctx.fill();
    ctx.strokeStyle = "#112b13";
    ctx.lineWidth = 0.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-1.5, -5, 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#33663a";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(1.5, -4, 2.0, 0, 2 * Math.PI);
    ctx.fillStyle = "#4a8553";
    ctx.fill();

    ctx.restore();
  }

  drawCanvasPalmTree(ctx, x, y, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 7.5, 5.5, 1.8, 0, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.fill();

    // Trunk
    ctx.beginPath();
    ctx.moveTo(-1.5, 7.5);
    ctx.quadraticCurveTo(-2.2, 2.5, -0.5, -6.5);
    ctx.lineTo(0.5, -6.5);
    ctx.quadraticCurveTo(-1.2, 2.5, -0.5, 7.5);
    ctx.closePath();
    ctx.fillStyle = "#52391b";
    ctx.fill();

    // Fronds
    ctx.fillStyle = "#144d18";
    ctx.strokeStyle = "#113014";
    ctx.lineWidth = 0.2;
    const drawFrond = (xCurve, yCurve, xEnd, yEnd) => {
      ctx.beginPath();
      ctx.moveTo(-0.5, -6.5);
      ctx.quadraticCurveTo(xCurve, yCurve, xEnd, yEnd);
      ctx.quadraticCurveTo(xCurve * 0.7, yCurve * 0.7, -0.5, -6.5);
      ctx.fill();
      ctx.stroke();
    };

    drawFrond(-6, -8, -9, -5);
    drawFrond(-4, -11, -7, -14);
    drawFrond(0.5, -12, 4, -14);
    drawFrond(5, -10, 9, -7);
    drawFrond(3, -4, 7, -1);
    drawFrond(-3.5, -4, -7, -2);

    ctx.restore();
  }

  drawCanvasMountain(ctx, x, y, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Shadows
    ctx.beginPath();
    ctx.ellipse(-4, 10.5, 13, 3.5, 0, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, 10.5, 9, 3, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Back peak
    ctx.beginPath();
    ctx.moveTo(-10, 8);
    ctx.lineTo(-3, -5);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fillStyle = "#827b72";
    ctx.fill();
    ctx.strokeStyle = "#332e27";
    ctx.lineWidth = 0.3;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-3, -5);
    ctx.lineTo(4, 8);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fillStyle = "#59534a";
    ctx.fill();
    ctx.stroke();

    // Front Peak
    // Left Face
    ctx.beginPath();
    ctx.moveTo(-16, 12);
    ctx.lineTo(-3, -12);
    ctx.lineTo(-7, 3);
    ctx.lineTo(-11, 12);
    ctx.closePath();
    ctx.fillStyle = "#918c80";
    ctx.fill();
    ctx.strokeStyle = "#2b251f";
    ctx.lineWidth = 0.4;
    ctx.stroke();

    // Right Face
    ctx.beginPath();
    ctx.moveTo(-3, -12);
    ctx.lineTo(10, 12);
    ctx.lineTo(1, 12);
    ctx.lineTo(-7, 12);
    ctx.lineTo(-7, 3);
    ctx.closePath();
    ctx.fillStyle = "#3c372e";
    ctx.fill();
    ctx.stroke();

    // Snow Cap
    ctx.beginPath();
    ctx.moveTo(-3, -12);
    ctx.lineTo(-7.5, -4);
    ctx.lineTo(-4.5, -2);
    ctx.lineTo(-3, -4);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-3, -12);
    ctx.lineTo(1.5, -4);
    ctx.lineTo(-1.5, -2);
    ctx.lineTo(-3, -4);
    ctx.closePath();
    ctx.fillStyle = "#dce2e6";
    ctx.fill();

    ctx.restore();
  }

  drawCanvasUrban(ctx, x, y, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Shadows
    ctx.beginPath();
    ctx.ellipse(-3.5, 8.5, 8, 2.6, 0, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(3.5, 8.5, 8, 2.6, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Central Spire
    ctx.fillStyle = "#b85f4f"; 
    ctx.fillRect(-3, -8, 6, 16);
    ctx.strokeStyle = "#301f19";
    ctx.lineWidth = 0.4;
    ctx.strokeRect(-3, -8, 6, 16);

    // Gold Roof
    ctx.beginPath();
    ctx.moveTo(-3, -8);
    ctx.lineTo(0, -14);
    ctx.lineTo(3, -8);
    ctx.closePath();
    ctx.fillStyle = "#c99738"; 
    ctx.fill();
    ctx.stroke();

    // Left building
    ctx.fillStyle = "#5e271e";
    ctx.fillRect(-9.5, -3, 7, 11);
    ctx.strokeRect(-9.5, -3, 7, 11);
    ctx.beginPath();
    ctx.moveTo(-9.5, -3);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-2.5, -3);
    ctx.closePath();
    ctx.fillStyle = "#753f34";
    ctx.fill();
    ctx.stroke();

    // Right building
    ctx.fillStyle = "#e38c7d";
    ctx.fillRect(2.5, -1, 7, 9);
    ctx.strokeRect(2.5, -1, 7, 9);
    ctx.beginPath();
    ctx.moveTo(2.5, -1);
    ctx.lineTo(6, -5);
    ctx.lineTo(9.5, -1);
    ctx.closePath();
    ctx.fillStyle = "#c99738";
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  drawCanvasForestPine(ctx, x, y) {
    this.drawCanvasPineTree(ctx, x - 8, y - 4, 0.85);
    this.drawCanvasPineTree(ctx, x + 8, y - 6, 0.8);
    this.drawCanvasPineTree(ctx, x, y + 5, 1.15);
    this.drawCanvasPineTree(ctx, x - 6, y + 7, 0.95);
    this.drawCanvasPineTree(ctx, x + 7, y + 6, 1.0);
  }

  drawCanvasForestDeciduous(ctx, x, y) {
    this.drawCanvasDeciduousTree(ctx, x - 7, y - 5, 0.85);
    this.drawCanvasDeciduousTree(ctx, x + 7, y - 7, 0.8);
    this.drawCanvasDeciduousTree(ctx, x, y + 4, 1.15);
    this.drawCanvasDeciduousTree(ctx, x - 6, y + 6, 0.95);
    this.drawCanvasDeciduousTree(ctx, x + 6, y + 5, 1.0);
  }

  drawCanvasJunglePalm(ctx, x, y) {
    this.drawCanvasPalmTree(ctx, x - 7, y - 4, 0.9);
    this.drawCanvasPalmTree(ctx, x + 7, y - 6, 0.85);
    this.drawCanvasPalmTree(ctx, x, y + 4, 1.1);
    this.drawCanvasPalmTree(ctx, x - 5, y + 7, 0.95);
    this.drawCanvasPalmTree(ctx, x + 6, y + 6, 1.0);
  }

  // --- MAIN PROCEDURAL DYNAMIC SVG RENDER LAYER ---
  render() {
    // If background static canvas images are not generated yet, skip rendering
    if (!this.staticSeaBgDataUrl || !this.staticLandBgDataUrl) return;

    // Remove the old combined background image if it exists
    const oldBg = document.getElementById("map-static-bg");
    if (oldBg) {
      oldBg.remove();
    }

    // Ensure the sea background `<image>` exists (under animated turbulence filter)
    let seaBgImage = document.getElementById("map-static-sea-bg");
    if (!seaBgImage) {
      seaBgImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
      seaBgImage.setAttribute("id", "map-static-sea-bg");
      seaBgImage.setAttribute("x", "0");
      seaBgImage.setAttribute("y", "0");
      seaBgImage.setAttribute("width", "2600");
      seaBgImage.setAttribute("height", "1200");
      // Commented out to prevent tiles and grid lines from moving/warping
      // seaBgImage.setAttribute("filter", "url(#ocean-wave-filter)");
      this.svg.insertBefore(seaBgImage, this.svg.firstChild);
    }
    seaBgImage.setAttribute("href", this.staticSeaBgDataUrl);

    // Ensure the land background `<image>` exists (unfiltered, drawn on top of sea)
    let landBgImage = document.getElementById("map-static-land-bg");
    if (!landBgImage) {
      landBgImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
      landBgImage.setAttribute("id", "map-static-land-bg");
      landBgImage.setAttribute("x", "0");
      landBgImage.setAttribute("y", "0");
      landBgImage.setAttribute("width", "2600");
      landBgImage.setAttribute("height", "1200");
      
      // Insert immediately after the sea background
      const seaBg = document.getElementById("map-static-sea-bg");
      this.svg.insertBefore(landBgImage, seaBg.nextSibling);
    }
    landBgImage.setAttribute("href", this.staticLandBgDataUrl);

    // Clear dynamic layers
    this.connectionsLayer.innerHTML = "";
    this.territoriesLayer.innerHTML = "";
    this.selectionLayer.innerHTML = "";
    this.riversLayer.innerHTML = "";
    this.labelsLayer.innerHTML = "";
    this.nodesLayer.innerHTML = "";
    this.unitsLayer.innerHTML = "";

    const W = this.hexR * Math.sqrt(3);
    const H = this.hexR * 1.5;

    // 1. Draw connection lines using averaged centers
    const processedConnections = new Set();
    for (const [id, t] of Object.entries(mapData.territories)) {
      const c1 = this.territoryCenters[id];
      if (!c1) continue;

      t.connections.forEach(neighborId => {
        const pairKey = [id, neighborId].sort().join("-");
        if (processedConnections.has(pairKey)) return;
        processedConnections.add(pairKey);

        const c2 = this.territoryCenters[neighborId];
        if (!c2) return;

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", c1.x);
        line.setAttribute("y1", c1.y);
        line.setAttribute("x2", c2.x);
        line.setAttribute("y2", c2.y);
        line.setAttribute("class", "connection-line");
        this.connectionsLayer.appendChild(line);
      });
    }

    // 2. Draw River Borders (Crossing boundaries) between centers
    mapData.riverCrossings.forEach(crossing => {
      const t1 = this.territoryCenters[crossing.from];
      const t2 = this.territoryCenters[crossing.to];
      if (!t1 || !t2) return;

      const midX = (t1.x + t2.x) / 2;
      const midY = (t1.y + t2.y) / 2;
      const dx = t2.x - t1.x;
      const dy = t2.y - t1.y;

      const len = Math.sqrt(dx * dx + dy * dy);
      const px = (-dy / len) * 22;
      const py = (dx / len) * 22;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${midX - px} ${midY - py} L ${midX + px} ${midY + py}`);
      path.setAttribute("class", "river-border");
      this.riversLayer.appendChild(path);
    });

    // 3. Draw Hexagonal Grid Clusters for Countries
    for (const [id, t] of Object.entries(mapData.territories)) {
      const boardState = this.gameState.board[id];
      const owner = boardState ? boardState.owner : "neutral";

      // Create a grouping for this territory's hover/click polygons
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", `territory-hex-group owned-${owner}`);
      group.addEventListener("click", () => this.handleTerritoryClick(id));

      let pathData = "";

      t.hexes.forEach(hex => {
        const pxX = this.offsetX + W * (hex.q + (hex.r % 2 === 1 ? 0.5 : 0));
        const pxY = this.offsetY + H * hex.r;
        pathData += this.getPointyHexPath(pxX, pxY, this.hexR) + " ";
      });

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData.trim());
      path.setAttribute("class", "hex-cell");
      
      // Color overlays based on ownership: transparent for neutral, semi-transparent for factions
      let fill = "rgba(0, 0, 0, 0.01)"; // invisible but clickable
      if (owner === "red") {
        fill = "rgba(198, 59, 59, 0.18)";
      } else if (owner === "blue") {
        fill = "rgba(59, 125, 198, 0.18)";
      }

      path.setAttribute("fill", fill);
      path.setAttribute("stroke", "transparent"); // creases are already rendered to canvas
      path.setAttribute("stroke-width", "0");

      group.appendChild(path);

      this.territoriesLayer.appendChild(group);

      // 4. Draw Label & Node Icons at the averaged center
      const center = this.territoryCenters[id];
      if (center) {
        // Label
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", center.x);
        label.setAttribute("y", t.type === "sea" ? center.y : center.y - 12);
        label.setAttribute("class", "territory-label");
        label.textContent = (t.label || t.name).toUpperCase();
        this.labelsLayer.appendChild(label);

        // Resource Node Badge
        if (t.resource) {
          const nodeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
          nodeGroup.setAttribute("class", "node-marker");
          nodeGroup.addEventListener("click", () => this.handleTerritoryClick(id));

          const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          circle.setAttribute("cx", center.x - 18);
          circle.setAttribute("cy", center.y + 12);
          circle.setAttribute("r", 9);
          circle.setAttribute("fill", "#111");
          circle.setAttribute("stroke", "var(--border-gold)");
          circle.setAttribute("stroke-width", "0.8");
          nodeGroup.appendChild(circle);

          const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
          icon.setAttribute("x", center.x - 18);
          icon.setAttribute("y", center.y + 15);
          icon.setAttribute("text-anchor", "middle");
          icon.setAttribute("style", "font-size: 8px;");
          
          let iconChar = "⚙️";
          if (t.resource === "wood") iconChar = "🌲";
          if (t.resource === "oil") iconChar = "🔥";
          
          icon.textContent = iconChar;
          nodeGroup.appendChild(icon);
          this.nodesLayer.appendChild(nodeGroup);
        }

        // Army Garrison badge
        if (boardState && t.type !== "sea") {
          const totalUnits = Object.values(boardState.units).reduce((a, b) => a + b, 0);
          
          // Find if commander is present
          let hasCommander = false;
          for (const c of Object.values(this.gameState.commanders)) {
            if (c.location === id) {
              hasCommander = true;
              break;
            }
          }

          if (totalUnits > 0 || hasCommander) {
            const unitBadge = document.createElementNS("http://www.w3.org/2000/svg", "g");
            unitBadge.setAttribute("transform", `translate(${center.x + 10}, ${center.y + 2})`);
            unitBadge.addEventListener("click", () => this.handleTerritoryClick(id));

            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", -12);
            rect.setAttribute("y", -6);
            rect.setAttribute("width", 24);
            rect.setAttribute("height", 12);
            rect.setAttribute("rx", 2);
            rect.setAttribute("fill", owner === "red" ? "var(--faction-red)" : (owner === "blue" ? "var(--faction-blue)" : "#333"));
            rect.setAttribute("stroke", "var(--border-gold)");
            rect.setAttribute("stroke-width", "0.8");
            unitBadge.appendChild(rect);

            const valText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            valText.setAttribute("x", 0);
            valText.setAttribute("y", 3);
            valText.setAttribute("text-anchor", "middle");
            valText.setAttribute("style", "font-family: var(--font-display); font-size: 8px; font-weight: 800; fill: #fff;");
            valText.textContent = hasCommander ? `⭐${totalUnits}` : totalUnits;
            unitBadge.appendChild(valText);

            this.unitsLayer.appendChild(unitBadge);
          }
        }
      }
    }

    // 5. Draw Borders Layer on top of all hexes (Civ 5 style)
    const borderGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    borderGroup.setAttribute("class", "map-borders-layer");

    // Adjacency directions matching staggered offset neighbor lookup
    const getHexEdgeVertices = (cx, cy, r, edgeIdx) => {
      const angleA = (Math.PI / 3) * edgeIdx + (Math.PI / 6);
      const angleB = (Math.PI / 3) * ((edgeIdx + 1) % 6) + (Math.PI / 6);
      return {
        x1: cx + Math.cos(angleA) * r,
        y1: cy + Math.sin(angleA) * r,
        x2: cx + Math.cos(angleB) * r,
        y2: cy + Math.sin(angleB) * r
      };
    };

    // Staggered offset neighbors edges resolution:
    // Maps adjacent coordinates index to their corresponding hex edge index
    const getNeighborEdgeDetails = (r) => {
      const isOddRow = (r % 2 === 1);
      if (isOddRow) {
        return [
          { dq: 1, dr: 0, edgeIdx: 5 },  // Right
          { dq: -1, dr: 0, edgeIdx: 2 }, // Left
          { dq: 0, dr: -1, edgeIdx: 3 }, // Up-Left
          { dq: 1, dr: -1, edgeIdx: 4 }, // Up-Right
          { dq: 0, dr: 1, edgeIdx: 1 },  // Down-Left
          { dq: 1, dr: 1, edgeIdx: 0 }   // Down-Right
        ];
      } else {
        return [
          { dq: 1, dr: 0, edgeIdx: 5 },  // Right
          { dq: -1, dr: 0, edgeIdx: 2 }, // Left
          { dq: -1, dr: -1, edgeIdx: 3 },// Up-Left
          { dq: 0, dr: -1, edgeIdx: 4 }, // Up-Right
          { dq: -1, dr: 1, edgeIdx: 1 }, // Down-Left
          { dq: 0, dr: 1, edgeIdx: 0 }   // Down-Right
        ];
      }
    };

    // Prebuild lookup map
    const hexLookup = {};
    for (const [tid, t] of Object.entries(mapData.territories)) {
      t.hexes.forEach(hex => {
        hexLookup[`${hex.q},${hex.r}`] = {
          territoryId: tid,
          owner: this.gameState.board[tid] ? this.gameState.board[tid].owner : "neutral"
        };
      });
    }

    // Draw borders for each territory
    for (const [tid, t] of Object.entries(mapData.territories)) {
      const boardState = this.gameState.board[tid];
      const owner = boardState ? boardState.owner : "neutral";

      if (t.type === "sea") continue;

      t.hexes.forEach(hex => {
        const cx = this.offsetX + W * (hex.q + (hex.r % 2 === 1 ? 0.5 : 0));
        const cy = this.offsetY + H * hex.r;
        const edgeDetails = getNeighborEdgeDetails(hex.r);

        edgeDetails.forEach(dir => {
          const nq = (hex.q + dir.dq + 120) % 120;
          const nr = hex.r + dir.dr;
          const neighborKey = `${nq},${nr}`;
          const neighbor = hexLookup[neighborKey];

          // Draw a border if the neighbor is in a different territory
          if (!neighbor || neighbor.territoryId !== tid) {
            const edge = getHexEdgeVertices(cx, cy, this.hexR, dir.edgeIdx);

            let strokeColor = "rgba(100, 100, 100, 0.4)";
            let strokeWidth = "1.2";
            let strokeDash = "";
            let opacity = "0.7";

            const neighborOwner = neighbor ? neighbor.owner : "neutral";

            // If neighbor is owned by a different faction
            if (neighborOwner !== owner || !neighbor) {
              strokeWidth = "2.0";
              opacity = "1.0";
              if (owner === "red") strokeColor = "var(--faction-red)";
              else if (owner === "blue") strokeColor = "var(--faction-blue)";
              else strokeColor = "rgba(150, 150, 150, 0.8)";
            } else {
              // Same owner, different territory (internal dashed line)
              strokeDash = "3,3";
              strokeColor = "rgba(180, 160, 120, 0.5)";
            }

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", edge.x1);
            line.setAttribute("y1", edge.y1);
            line.setAttribute("x2", edge.x2);
            line.setAttribute("y2", edge.y2);
            line.setAttribute("stroke", strokeColor);
            line.setAttribute("stroke-width", strokeWidth);
            line.setAttribute("stroke-linecap", "round");
            line.setAttribute("opacity", opacity);
            if (strokeDash) {
              line.setAttribute("stroke-dasharray", strokeDash);
            }
            borderGroup.appendChild(line);
          }
        });
      });
    }
    this.territoriesLayer.appendChild(borderGroup);

    // Render selection highlights (only the selected territory outer glow)
    this.drawSelectionHighlight(this.selectedTerritoryId);
  }

  // Generate pointy hex path string
  getPointyHexPath(cx, cy, r) {
    let d = "";
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + (Math.PI / 6);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      d += i === 0 ? `M ${x.toFixed(1)},${y.toFixed(1)} ` : `L ${x.toFixed(1)},${y.toFixed(1)} `;
    }
    d += "Z";
    return d;
  }

  handleTerritoryClick(id) {
    if (this.hasDragged) return; // Ignore clicks if panning occurred
    this.selectedTerritoryId = id;
    this.drawSelectionHighlight(id);
    this.onTerritorySelected(id);
  }

  // Dynamic light-weight drawing of selection highlight without redrawing the entire board
  drawSelectionHighlight(territoryId) {
    this.selectionLayer.innerHTML = "";
    if (!territoryId) return;

    const t = mapData.territories[territoryId];
    if (!t || t.type === "sea") return;

    const W = this.hexR * Math.sqrt(3);
    const H = this.hexR * 1.5;

    const hexSet = new Set();
    t.hexes.forEach(hex => {
      hexSet.add(`${hex.q},${hex.r}`);
    });

    const getHexEdgeVertices = (cx, cy, r, edgeIdx) => {
      const angleA = (Math.PI / 3) * edgeIdx + (Math.PI / 6);
      const angleB = (Math.PI / 3) * ((edgeIdx + 1) % 6) + (Math.PI / 6);
      return {
        x1: cx + Math.cos(angleA) * r,
        y1: cy + Math.sin(angleA) * r,
        x2: cx + Math.cos(angleB) * r,
        y2: cy + Math.sin(angleB) * r
      };
    };

    const getNeighborEdgeDetails = (r) => {
      const isOddRow = (r % 2 === 1);
      if (isOddRow) {
        return [
          { dq: 1, dr: 0, edgeIdx: 5 },
          { dq: -1, dr: 0, edgeIdx: 2 },
          { dq: 0, dr: -1, edgeIdx: 3 },
          { dq: 1, dr: -1, edgeIdx: 4 },
          { dq: 0, dr: 1, edgeIdx: 1 },
          { dq: 1, dr: 1, edgeIdx: 0 }
        ];
      } else {
        return [
          { dq: 1, dr: 0, edgeIdx: 5 },
          { dq: -1, dr: 0, edgeIdx: 2 },
          { dq: -1, dr: -1, edgeIdx: 3 },
          { dq: 0, dr: -1, edgeIdx: 4 },
          { dq: -1, dr: 1, edgeIdx: 1 },
          { dq: 0, dr: 1, edgeIdx: 0 }
        ];
      }
    };

    t.hexes.forEach(hex => {
      const cx = this.offsetX + W * (hex.q + (hex.r % 2 === 1 ? 0.5 : 0));
      const cy = this.offsetY + H * hex.r;
      const edgeDetails = getNeighborEdgeDetails(hex.r);

      edgeDetails.forEach(dir => {
        const nq = (hex.q + dir.dq + 120) % 120;
        const nr = hex.r + dir.dr;
        const neighborKey = `${nq},${nr}`;

        if (!hexSet.has(neighborKey)) {
          const edge = getHexEdgeVertices(cx, cy, this.hexR, dir.edgeIdx);

          const glowLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
          glowLine.setAttribute("x1", edge.x1);
          glowLine.setAttribute("y1", edge.y1);
          glowLine.setAttribute("x2", edge.x2);
          glowLine.setAttribute("y2", edge.y2);
          glowLine.setAttribute("stroke", "var(--border-gold)");
          glowLine.setAttribute("stroke-width", "3.0");
          glowLine.setAttribute("stroke-linecap", "round");
          glowLine.setAttribute("opacity", "0.95");
          this.selectionLayer.appendChild(glowLine);
        }
      });
    });
  }
}
export default MapEngine;

