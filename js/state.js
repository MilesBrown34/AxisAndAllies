// IRON & CROWNS - CENTRAL GAME STATE ENGINE (WITH PROCEDURAL HEX PLANET GENERATION)
import { mapData } from './data/mapData.js';
import { unitData } from './data/unitData.js';
import { cardData } from './data/cardData.js';

export class GameState {
  constructor() {
    this.round = 1;
    this.seasonIndex = 0;
    this.seasons = ["Spring 1914", "Summer 1914", "Autumn 1914", "Winter 1914", "Spring 1915"];
    
    this.activeFaction = "red";
    this.currentPhase = "Event";
    
    this.activeEvent = null;
    this.activityLog = [];

    // Faction resources, cards, upgrades, and doctrines
    this.factions = {
      red: {
        name: "Imperium of Iron",
        gold: 18,
        prestige: 10,
        wood: 6,
        metal: 4,
        oil: 2,
        doctrines: [],
        offices: [],
        hand: [],
        capital: "Essen_Core",
        upgrades: { logging_camp: 0, steelworks: 0, refinery: 0, senate_hall: 0, factory_expansion: 0 }
      },
      blue: {
        name: "Alliance of Crowns",
        gold: 18,
        prestige: 10,
        wood: 6,
        metal: 4,
        oil: 2,
        doctrines: [],
        offices: [],
        hand: [],
        capital: "London_Core",
        upgrades: { logging_camp: 0, steelworks: 0, refinery: 0, senate_hall: 0, factory_expansion: 0 }
      }
    };

    // Board configuration
    this.board = {};
    this.commanders = {};
    
    // Dynamic generated map graph details
    this.generatedTerritories = {};
    
    this.generatePlanetMap();
    this.initializeBoard();
  }

  // Model map after the real world instead of procedural generation
  generatePlanetMap() {
    const maxQ = 119; // 120 columns
    const maxR = 59; // 60 rows
    
    // Initialize procedural territory buckets
    this.generatedTerritories = {};
    for (const [id, data] of Object.entries(mapData.seeds)) {
      this.generatedTerritories[id] = {
        id: id,
        name: data.name,
        label: data.label || data.name,
        type: data.type,
        defaultOwner: data.defaultOwner,
        hexes: [],
        connections: new Set(),
        resource: null,
        income: data.type === "capital" ? 5 : (data.type === "sea" ? 0 : 2)
      };
    }

    // Coordinate distance to segment helper
    const distToSegment = (x, y, x1, y1, x2, y2) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      if (dx === 0 && dy === 0) {
        const rx = x - x1;
        const ry = y - y1;
        return Math.sqrt(rx*rx + ry*ry);
      }
      let t = ((x - x1) * dx + (y - y1) * dy) / (dx*dx + dy*dy);
      t = Math.max(0, Math.min(1, t));
      const rx = x - (x1 + t * dx);
      const ry = y - (y1 + t * dy);
      return Math.sqrt(rx*rx + ry*ry);
    };

    // Cylindrical wrapped distance to segment helper (width 120)
    const distToSegmentWrapped = (q, r, x1, y1, x2, y2) => {
      let minDist = Infinity;
      for (const offset of [-120, 0, 120]) {
        const d = distToSegment(q + offset, r, x1, y1, x2, y2);
        if (d < minDist) minDist = d;
      }
      return minDist;
    };

    // Exact 120x60 Earth Map Array
    const earthMap = [
      "................................................................................t.......................................",
      "........................................s...................................ttttttttt...................................",
      "......................................sssss...............................ttttttttttttt.................................",
      "............t........................sssssss.............................ttttttttttttttt................................",
      ".........ttttttt.....................sssssss............................ttttttttttttttttt......t........................",
      "........ttttttttt...................sssssssss...........................ttttttttttttttttt...ttttttt.....................",
      ".......tttttttttttg.........f........sssssss...................t.......tttttttttttttttttttttttttttttt...................",
      ".......tttttttttttgggg...fffffff.....sssssss.................ttttt.....ttttttttttttttttttttttttttttttt..................",
      ".......tttttttttttggggggfffffffff.....sssss.................ttttttt....ttttttttttttttttttttttttttttttt..................",
      "......tttttttttttttggggfffffffffff......s...............g...ttttttt....tttttttttttttttttttttttttttttttt.................",
      ".......tttttttttttgggggfffffffffff...................ggggggttttttttt..ttttttttttttttttttttttttttttttttt.................",
      ".......tttttttttttgggggfffffffffff..................ggggggggttttttt....tttttttttttttttttttttttttttttttt.................",
      ".......tttttttttttggggfffffffffffff.................ggggggggttttttt....ttttttttttttttttttttttttttttttttt................",
      "........tttttttttggggggfffffffffff..................gggggggggttttt.....tttttttttttttttttttttttttttttttt.................",
      ".........tttttttggggggdfffffffffff.................ggggggggggg.t.......ttttdttttttttttttttttttttttttttt.......g.........",
      "...........gtggggggddddfffffffffff..................ggggggggg...........dddddddtttttttttttttttttttttttt......ggg........",
      "...........gggggggddddddfffffffff...................ggggggggg..........dddddddddtttttttttttttttgtttttt......ggggg.......",
      "...........gggggggdddddddfffffff....................ggggggggg.........dddddddddddttttttt.tttgggggggttt.......ggg........",
      "............ggggggddddddddd.f........................ggggggg..........dddddddddddtttttt...tgggggggggt.........g.........",
      "............gggggddddddddddd............................g.............dddddddddddtttt.....ggggggggggg...................",
      ".............gggggddddddddd..................................d.......ddddddddddddd........ggggggggggg...................",
      "...............gggddddddddd...............................ddddddd.....ddddddddddd.........ggggggggggg...................",
      "..................ddddddddd.............................ddddddddddd...ddddddddddd........ggggggggggggg..................",
      "...................ddddddd.............................ddddddddddddd..ddddddddddd.j.......ggggggggggg...................",
      "......................d................................ddddddddddddd...dddddddddjjjjj.....ggggggggggg...................",
      "......................................................ddddddddddddddd...ddddddd.jjjjj.....ggggggggggj...................",
      "......................................................ddddddddddddddd......d...jjjjjjj.....gggggggjjjjj.................",
      "......................................................ddddddddddddddd...........jjjjj.......ggggggjjjjj.................",
      "..................................j..................ddddddddddddddddd..........jjjjj..........g.jjjjjjj................",
      "...............................jjjjjjj................ddddddddddddddd.............j...............jjjjj.................",
      "..............................jjjjjjjjj...............ddddddddddddddd.............................jjjjj.................",
      ".............................jjjjjjjjjjj..............ddddddddddddddd...............................j...................",
      ".............................jjjjjjjjjjj...............ddddddddddddd....................................j...............",
      ".............................jjjjjjjjjjj...............dddddddddjddd..................................jjjjj.............",
      "............................jjjjjjjjjjjjj...............dddddjjjjjjj.................................jjjjjjj............",
      ".............................jjjjjjjjjjj..................ddjjjjjjjjj................................jjjjjjj............",
      ".............................jjjjjjjjjjj....................jjjjjjjjj...............................jjjjjjjjj...........",
      ".............................jjjjjjjjjjj....................jjjjjjjjj................................jjjjjjj............",
      "..............................jjjjjgjjj....................jjjjjjjjjjj...............................jjjjjjj............",
      "...............................jjggggg......................jjjjjjjjj.................................jjjjj...d.........",
      "................................ggggggg.....................jjjjjjjjj...................................j..ddddddd......",
      "................................ggggggg.....................jjjjjjjjj.....j...............................ddddddddd.....",
      "...............................ggggggggg.....................jjjjjjj.....jjj..............................ddddddddd.....",
      "................................ggggggg.........................jg........j...............................ddddddddd.....",
      "................................ggggggg........................ggggg.....................................ddddddddddd....",
      ".................................ggggg.........................ggggg......................................ddddddddd.....",
      "...................................g..........................ggggggg.....................................ddddddddd.....",
      "...............................................................ggggg......................................ddddddddd.....",
      "................................d..............................ggggg.......................................ddddddd......",
      "...............................ddd...............................g............................................d.......g.",
      "..............................ddddd..................................................................................ggg",
      "...............................ddd....................................................................................g.",
      "................................d.......................................................................................",
      "........................................................................................................................",
      "........................................................................................................................",
      "........................................................................................................................",
      "ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
      "ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
      "ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
      "ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss"
    ];

    const charToBiome = {
      '.': 'sea',
      'g': 'grassland',
      'd': 'desert',
      'f': 'forest',
      'j': 'jungle',
      'm': 'mountain',
      't': 'tundra',
      's': 'tundra'
    };

    const getRealWorldTerritoryAndBiome = (q, r) => {
      // 1. Look up character in the map blueprint
      let char = '.';
      if (r >= 0 && r < earthMap.length && q >= 0 && q < earthMap[r].length) {
        char = earthMap[r][q];
      }
      const isLand = char !== '.';

      // 2. Assign to territory
      let assignedId = "North_Sea";
      if (isLand) {
        let minDist = Infinity;
        let closestId = "London_Core";
        for (const [id, seed] of Object.entries(mapData.seeds)) {
          if (seed.type === "sea") continue;
          const d = distToSegmentWrapped(q, r, seed.q, seed.r, seed.q, seed.r);
          if (d < minDist) {
            minDist = d;
            closestId = id;
          }
        }
        assignedId = closestId;
      } else {
        // Assign sea zones based on coordinates (1.5x scaled)
        if (q >= 15 && q <= 36 && r >= 21 && r <= 33) {
          assignedId = "English_Channel"; // Caribbean
        } else if (q >= 37 && q <= 55 && r >= 12 && r <= 51) {
          assignedId = "Atlantic_Ocean";
        } else if (q >= 49 && q <= 72 && r >= 19 && r <= 27) {
          assignedId = "Mediterranean_Sea";
        } else if (q >= 60 && q <= 102 && r >= 30 && r <= 59) {
          assignedId = "Indian_Ocean";
        } else {
          assignedId = "North_Sea"; // Pacific Ocean default
        }
      }

      // 3. Determine biome (1.5x scaled coordinates to fit un-skewed world projection)
      if (!isLand) {
        return { id: assignedId, biome: "sea" };
      }

      const finalBiome = charToBiome[char] || 'grassland';
      
      // Override for capital centers
      const seedData = mapData.seeds[assignedId];
      if (seedData && seedData.q === q && seedData.r === r && seedData.type === "capital") {
        return { id: assignedId, biome: "urban" };
      }

      return { id: assignedId, biome: finalBiome };
    };

    // 1. Assign all hexes based on real world geography mapping
    for (let r = 0; r <= maxR; r++) {
      for (let q = 0; q <= maxQ; q++) {
        const { id, biome } = getRealWorldTerritoryAndBiome(q, r);
        this.generatedTerritories[id].hexes.push({ q, r, biome });
      }
    }

    // 2. Compute dynamic connections based on hex adjacency with cylindrical wrap-around (width 120)
    // Supports un-skewed staggered offset coordinates (odd-r, meaning odd rows are shifted right)
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

    // Build a quick lookup map of hex coordinate to territory ID
    const hexLookup = {};
    for (const [id, t] of Object.entries(this.generatedTerritories)) {
      t.hexes.forEach(hex => {
        hexLookup[`${hex.q},${hex.r}`] = id;
      });
    }

    // Check borders
    for (const [id, t] of Object.entries(this.generatedTerritories)) {
      t.hexes.forEach(hex => {
        const neighbors = getHexNeighbors(hex.q, hex.r);
        neighbors.forEach(n => {
          const neighborId = hexLookup[`${n.q},${n.r}`];
          if (neighborId && neighborId !== id) {
            t.connections.add(neighborId);
          }
        });
      });
    }

    // Convert connections set back to array for standard API logic
    for (const t of Object.values(this.generatedTerritories)) {
      t.connections = Array.from(t.connections);
    }

    // 3. Dynamic Resource Node Allocation based on biomes
    for (const [id, t] of Object.entries(this.generatedTerritories)) {
      if (t.type === "sea") continue;

      let mCount = 0;
      let fCount = 0;

      t.hexes.forEach(hex => {
        if (hex.biome === "mountain" || hex.biome.endsWith("_hill")) mCount++;
        else if (hex.biome === "forest" || hex.biome === "jungle") fCount++;
      });

      if (id === "Caucasus_Oil" || id === "Suez_Outpost" || id === "Rome_Core") {
        t.resource = "oil";
      } else if (fCount >= mCount && fCount > 0) {
        t.resource = "wood";
      } else if (mCount > fCount && mCount > 0) {
        t.resource = "metal";
      } else {
        t.resource = "metal";
      }
    }

    // Copy procedurally generated territories metadata back into mapData for engines reference
    mapData.territories = {};
    for (const [id, t] of Object.entries(this.generatedTerritories)) {
      mapData.territories[id] = {
        id: id,
        name: t.name,
        label: t.label,
        type: t.type,
        terrain: t.type === "sea" ? "sea" : (t.type === "capital" ? "urban" : "plains"),
        income: t.income,
        resource: t.resource,
        connections: t.connections,
        hexes: t.hexes
      };
    }
  }

  initializeBoard() {
    // 1. Setup territories board states
    for (const key of Object.keys(mapData.territories)) {
      const seedData = mapData.seeds[key];
      this.board[key] = {
        id: key,
        owner: (seedData && seedData.defaultOwner) ? seedData.defaultOwner : "neutral",
        units: {
          infantry: 0,
          artillery: 0,
          tank: 0,
          fighter: 0,
          warship: 0,
          transport: 0
        }
      };
    }

    // 2. Populate starting forces for all 26 seeds
    this.board["Essen_Core"].units = { infantry: 4, artillery: 1, tank: 1, fighter: 1, warship: 0, transport: 0 };
    this.board["Rhine_Plains"].units.infantry = 2;
    this.board["Bavaria"].units.infantry = 2;
    this.board["Prussia"].units = { infantry: 2, artillery: 1, tank: 1, fighter: 0, warship: 0, transport: 0 };
    
    this.board["London_Core"].units = { infantry: 3, artillery: 1, tank: 0, fighter: 1, warship: 0, transport: 0 };
    this.board["California_Outpost"].units = { infantry: 2, artillery: 0, tank: 1, fighter: 0, warship: 0, transport: 0 };
    this.board["Yukon_Territory"].units.infantry = 2;
    this.board["Paris_Citadel"].units = { infantry: 3, artillery: 1, tank: 1, fighter: 0, warship: 0, transport: 0 };
    this.board["Andes_Outpost"].units.infantry = 2;

    this.board["Rome_Core"].units.infantry = 2;
    this.board["Balkans_Pass"].units.infantry = 1;
    this.board["Cape_Outpost"].units.infantry = 1;
    this.board["Scandinavia"].units.infantry = 1;
    this.board["Moscow_Heart"].units = { infantry: 3, artillery: 1, tank: 0, fighter: 0, warship: 0, transport: 0 };
    this.board["Siberian_Wastes"].units.infantry = 2;
    this.board["Caucasus_Oil"].units.infantry = 1;
    this.board["Ural_Mines"].units.infantry = 2;
    this.board["Tokyo_Heart"].units = { infantry: 2, artillery: 1, tank: 0, fighter: 0, warship: 0, transport: 0 };
    this.board["Suez_Outpost"].units.infantry = 2;
    this.board["Indochina_Pass"].units.infantry = 1;
    this.board["Outback_Outpost"].units.infantry = 1;

    // Sea zones
    this.board["English_Channel"].units = { infantry: 0, artillery: 0, tank: 0, fighter: 0, warship: 1, transport: 1 };
    this.board["Atlantic_Ocean"].units.warship = 1;
    this.board["North_Sea"].units.warship = 1;
    this.board["Indian_Ocean"].units.transport = 1;
    this.board["Mediterranean_Sea"].units.warship = 1;

    // 3. Seed starting commanders
    this.commanders = {
      "von_schlieffen": {
        id: "von_schlieffen",
        name: "General von Schlieffen",
        location: "Essen_Core",
        faction: "red",
        loyalty: 8,
        trait: "+1 Attack to Tanks",
        type: "land"
      },
      "montgomery": {
        id: "montgomery",
        name: "Marshal Montgomery",
        location: "London_Core",
        faction: "blue",
        loyalty: 8,
        trait: "+1 Defense to Infantry",
        type: "land"
      },
      "badoglio": {
        id: "badoglio",
        name: "General Badoglio",
        location: "Rome_Core",
        faction: "neutral",
        loyalty: 5,
        trait: "+1 Defense to Artillery",
        type: "land"
      }
    };

    // 4. Seed starting cards to hands
    this.factions.red.hand.push({ ...cardData.actionCards[0] });
    this.factions.red.hand.push({ ...cardData.actionCards[3] });
    this.factions.blue.hand.push({ ...cardData.actionCards[2] });
    this.factions.blue.hand.push({ ...cardData.actionCards[4] });
  }

  // --- LOGGING & HISTORY ---
  log(message) {
    this.activityLog.unshift(message);
    if (this.activityLog.length > 50) this.activityLog.pop();
    console.log(`[GAME LOG]: ${message}`);
  }

  // --- SUPPLY PATH CHECKER ---
  checkSupplyLine(territoryId, factionId) {
    if (!factionId || factionId === "neutral" || !this.factions[factionId]) return false;
    const capitalId = this.factions[factionId].capital;
    if (territoryId === capitalId) return true;
    if (this.board[territoryId].owner !== factionId) return false;

    const queue = [territoryId];
    const visited = new Set([territoryId]);

    while (queue.length > 0) {
      const current = queue.shift();
      const connections = mapData.territories[current].connections;

      for (const neighborId of connections) {
        if (neighborId === capitalId) return true;

        if (
          this.board[neighborId].owner === factionId &&
          !visited.has(neighborId)
        ) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
    return false;
  }

  // --- PRODUCTION VALIDATION ---
  purchaseUnits(factionId, cart) {
    const faction = this.factions[factionId];
    let woodCost = 0;
    let metalCost = 0;
    let oilCost = 0;
    let totalQty = 0;

    for (const [unitId, qty] of Object.entries(cart)) {
      if (qty <= 0) continue;
      const unit = unitData.units[unitId];
      woodCost += unit.cost.wood * qty;
      metalCost += unit.cost.metal * qty;
      oilCost += unit.cost.oil * qty;
      totalQty += qty;
    }

    const capMax = 8 + (faction.upgrades.factory_expansion * 3);
    if (totalQty > capMax) {
      this.log(`Purchase failed: exceeding build capacity limit of ${capMax} units.`);
      return false;
    }

    if (faction.wood < woodCost || faction.metal < metalCost || faction.oil < oilCost) {
      this.log(`Purchase failed: insufficient resources.`);
      return false;
    }

    faction.wood -= woodCost;
    faction.metal -= metalCost;
    faction.oil -= oilCost;

    const capitalId = faction.capital;
    for (const [unitId, qty] of Object.entries(cart)) {
      this.board[capitalId].units[unitId] += qty;
    }

    this.log(`${faction.name} built: ` + 
      Object.entries(cart).filter(([,v]) => v > 0).map(([k,v]) => `${v} ${k}`).join(', ')
    );
    return true;
  }

  purchaseUpgrade(factionId, upgradeId) {
    const faction = this.factions[factionId];
    const upgrade = unitData.upgrades[upgradeId];

    if (!upgrade) return false;

    if (faction.wood < upgrade.cost.wood || faction.metal < upgrade.cost.metal) {
      this.log(`Upgrade failed: insufficient resources.`);
      return false;
    }

    faction.wood -= upgrade.cost.wood;
    faction.metal -= upgrade.cost.metal;
    
    faction.upgrades[upgradeId]++;
    this.log(`${faction.name} constructed ${upgrade.name}.`);
    return true;
  }

  // --- REVENUE & TURN PROGRESSION ---
  collectRevenue() {
    this.log(`--- Revenue Collection Phase ---`);
    for (const [factionId, faction] of Object.entries(this.factions)) {
      let goldEarned = 0;
      let woodEarned = 0;
      let metalEarned = 0;
      let oilEarned = 0;

      for (const [key, data] of Object.entries(mapData.territories)) {
        if (this.board[key].owner === factionId) {
          if (data.type === "capital" || this.checkSupplyLine(key, factionId)) {
            goldEarned += data.income;

            if (data.resource === "wood") woodEarned++;
            if (data.resource === "metal") metalEarned++;
            if (data.resource === "oil") oilEarned++;
          } else {
            this.log(`Supply Line Cut: Node ${data.name} is out of supply. Resource lost.`);
          }
        }
      }

      woodEarned += faction.upgrades.logging_camp * 2;
      metalEarned += faction.upgrades.steelworks * 2;
      oilEarned += faction.upgrades.refinery * 2;
      
      let prestigeEarned = 2 + (faction.upgrades.senate_hall * 3);

      faction.gold += goldEarned;
      faction.wood += woodEarned;
      faction.metal += metalEarned;
      faction.oil += oilEarned;
      faction.prestige += prestigeEarned;

      this.log(`${faction.name} collected: +${goldEarned} Gold, +${prestigeEarned} Prestige, +${woodEarned} Wood, +${metalEarned} Metal, +${oilEarned} Oil.`);
    }
  }

  advanceRound() {
    this.collectRevenue();
    
    this.round++;
    this.seasonIndex = (this.seasonIndex + 1) % this.seasons.length;
    this.log(`=== Round ${this.round} Start: ${this.seasons[this.seasonIndex]} ===`);
  }
}
