// IRON & CROWNS - LAYOUT CONTROLLER & ASSEMBLY MODULE
import { GameState } from './state.js';
import { MapEngine } from './map.js';
import { CombatEngine } from './combat.js';
import { PoliticsEngine } from './politics.js';
import { DoctrinesEngine } from './doctrines.js';
import { unitData } from './data/unitData.js';
import { mapData } from './data/mapData.js';
import { cardData } from './data/cardData.js';

class App {
  constructor() {
    this.gameState = new GameState();
    
    // Bind UI updates
    this.updateGlobalMetrics = this.updateGlobalMetrics.bind(this);
    
    // Initialize Engines
    this.mapEngine = new MapEngine(this.gameState, (id) => this.handleTerritorySelected(id));
    this.combatEngine = new CombatEngine(this.gameState, this.updateGlobalMetrics);
    this.politicsEngine = new PoliticsEngine(this.gameState, this.updateGlobalMetrics);
    this.doctrinesEngine = new DoctrinesEngine(this.gameState, this.updateGlobalMetrics);

    // Active production cart
    this.purchaseCart = {
      infantry: 0,
      artillery: 0,
      tank: 0,
      fighter: 0,
      warship: 0,
      transport: 0
    };

    // Scheduled combat moves (to resolve in Combat Phase)
    // Format: { targetId, originId, units: { infantry: 1, ... } }
    this.scheduledBattles = [];

    this.initTabs();
    this.initPhaseButton();
    this.initProductionUI();
    this.updateGlobalMetrics();
    
    this.gameState.log("Application started successfully.");
  }

  // Bind right sidebar tabs
  initTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const panels = document.querySelectorAll(".panel-content");

    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        
        tabBtns.forEach(b => b.classList.remove("active"));
        panels.forEach(p => p.classList.remove("active"));

        btn.classList.add("active");
        document.getElementById(targetId).classList.add("active");
      });
    });
  }

  // Set up phase advance button
  initPhaseButton() {
    const btn = document.getElementById("btn-phase-next");
    btn.addEventListener("click", () => this.advancePhase());
  }

  // Update Faction UI metrics
  updateGlobalMetrics() {
    const faction = this.gameState.factions[this.gameState.activeFaction];
    
    // Set Header values
    document.getElementById("val-gold").textContent = faction.gold;
    document.getElementById("val-prestige").textContent = faction.prestige;
    document.getElementById("val-oil").textContent = faction.oil;
    document.getElementById("val-metal").textContent = faction.metal;
    document.getElementById("val-wood").textContent = faction.wood;

    document.getElementById("current-season").textContent = this.gameState.seasons[this.gameState.seasonIndex];
    document.getElementById("current-round").textContent = this.gameState.round;

    // Set Active Player badge
    const badge = document.getElementById("active-faction-badge");
    const nameLabel = document.getElementById("faction-turn-name");
    
    badge.className = `faction-badge active-${this.gameState.activeFaction}`;
    nameLabel.textContent = faction.name.toUpperCase();

    // Log footer text
    document.getElementById("log-text").textContent = this.gameState.activityLog[0] || "Waiting for command...";

    // Sync child modules
    this.politicsEngine.renderOffices(this.gameState.activeFaction);
    this.doctrinesEngine.render(this.gameState.activeFaction);
    this.renderProductionPanel();
    this.renderHandPanel();

    if (this.mapEngine.selectedTerritoryId) {
      this.renderInspector(this.mapEngine.selectedTerritoryId);
    }
  }

  // Advance state machine phases
  advancePhase() {
    const phases = ["Event", "Purchase", "Combat Move", "Combat", "Noncombat Move", "Senate Bidding", "End Turn"];
    let idx = phases.indexOf(this.gameState.currentPhase);
    
    idx = (idx + 1) % phases.length;
    this.gameState.currentPhase = phases[idx];

    const factionName = this.gameState.factions[this.gameState.activeFaction].name;
    this.gameState.log(`Phase changed: ${factionName} enters [${this.gameState.currentPhase}] Phase.`);

    const btn = document.getElementById("btn-phase-next");
    btn.textContent = `Advance Phase: ${phases[(idx + 1) % phases.length]}`;

    // Execute automated phase logic
    if (this.gameState.currentPhase === "Event") {
      this.executeEventPhase();
    } else if (this.gameState.currentPhase === "Combat") {
      this.executeCombatPhase();
    } else if (this.gameState.currentPhase === "End Turn") {
      this.executeEndTurn();
    }

    this.updateGlobalMetrics();
    this.mapEngine.render();
  }

  // Phase 1 Automation: Draw dynamic event card
  executeEventPhase() {
    // 1. Draw Event
    const randomEvent = cardData.events[Math.floor(Math.random() * cardData.events.length)];
    this.gameState.activeEvent = randomEvent;
    this.gameState.log(`GLOBAL EVENT DRAWN: ${randomEvent.name} - ${randomEvent.description}`);

    // Apply Event modifiers (e.g. Bountiful Season gives gold)
    if (randomEvent.id === "global_trade") {
      this.gameState.factions.red.gold += 3;
      this.gameState.factions.blue.gold += 3;
    }

    // 2. Draw Action Card to hand
    const randomAction = cardData.actionCards[Math.floor(Math.random() * cardData.actionCards.length)];
    this.gameState.factions[this.gameState.activeFaction].hand.push({ ...randomAction });
    this.gameState.log(`Drawn 1 Action Card to hand.`);
  }

  // Phase 4 Automation: Auto-trigger combat UI for scheduled moves
  executeCombatPhase() {
    if (this.scheduledBattles.length === 0) {
      this.gameState.log("No contested territories to resolve. Combat phase skipped.");
      return;
    }

    // Load first battle to resolution board
    const battle = this.scheduledBattles.shift();
    
    // Switch to Combat tab
    document.querySelector('[data-target="panel-combat"]').click();

    this.combatEngine.initializeBattle(
      battle.targetId,
      this.gameState.activeFaction,
      this.gameState.board[battle.targetId].owner,
      battle.originId,
      battle.isRiverCrossing
    );
  }

  // Phase 7 Automation: Reset parameters, rotate player, advance round
  executeEndTurn() {
    if (this.gameState.activeFaction === "red") {
      // Switch active player to Blue
      this.gameState.activeFaction = "blue";
      this.gameState.currentPhase = "Event";
      this.executeEventPhase();
    } else {
      // Completed full round (Red + Blue turns). Collect revenue and advance season
      this.gameState.activeFaction = "red";
      this.gameState.currentPhase = "Event";
      this.gameState.advanceRound();
      this.executeEventPhase();
    }

    // Refresh commander dropdowns for Bribes
    this.politicsEngine.populateCommanderDropdown(this.gameState.activeFaction);
    
    this.scheduledBattles = [];
  }

  // --- INSPECTOR LOGIC & GARRISON MOVEMENT ---
  handleTerritorySelected(id) {
    this.renderInspector(id);
  }

  renderInspector(id) {
    const t = mapData.territories[id];
    const boardState = this.gameState.board[id];
    
    document.getElementById("territory-inspect-empty").style.display = "none";
    
    const inspectData = document.getElementById("territory-inspect-data");
    inspectData.style.display = "block";

    document.getElementById("inspect-name").textContent = t.name;
    document.getElementById("inspect-faction").textContent = boardState.owner.toUpperCase();
    document.getElementById("inspect-terrain").textContent = t.terrain.toUpperCase();
    document.getElementById("inspect-value").textContent = `${t.income} Gold`;
    document.getElementById("inspect-resource").textContent = t.resource ? t.resource.toUpperCase() : "None";

    const isSupplied = this.gameState.checkSupplyLine(id, boardState.owner);
    const supplySpan = document.getElementById("inspect-supply");
    supplySpan.textContent = isSupplied ? "Connected" : "Cut Off";
    supplySpan.style.color = isSupplied ? "var(--faction-green)" : "var(--faction-red)";

    // Garrison list
    const garrisonDiv = document.getElementById("inspect-garrison-list");
    garrisonDiv.innerHTML = "";

    let hasUnits = false;
    for (const [unitId, qty] of Object.entries(boardState.units)) {
      if (qty > 0) {
        hasUnits = true;
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.fontSize = "0.8rem";
        row.innerHTML = `
          <span>${unitData.units[unitId].icon} ${unitData.units[unitId].name}:</span>
          <strong>${qty}</strong>
        `;
        garrisonDiv.appendChild(row);
      }
    }
    if (!hasUnits) garrisonDiv.innerHTML = '<div style="color:var(--text-dim);font-size:0.75rem;">No garrisoned divisions.</div>';

    // Commander presence
    const commDiv = document.getElementById("inspect-commander-container");
    commDiv.style.display = "none";
    for (const c of Object.values(this.gameState.commanders)) {
      if (c.location === id) {
        commDiv.style.display = "block";
        document.getElementById("inspect-commander-name").textContent = c.name;
        document.getElementById("inspect-commander-loyalty").textContent = c.loyalty;
        document.getElementById("inspect-commander-trait").textContent = c.trait;
        break;
      }
    }

    // Render movement buttons during Combat Move or Noncombat Move phases
    const activeFactionId = this.gameState.activeFaction;
    const isMovable = boardState.owner === activeFactionId && 
                       (this.gameState.currentPhase === "Combat Move" || this.gameState.currentPhase === "Noncombat Move");

    if (isMovable && hasUnits) {
      const moveSection = document.createElement("div");
      moveSection.innerHTML = `
        <h4 style="font-family: var(--font-display); font-size: 0.8rem; border-top: 1px solid var(--border-gold-dim); padding-top: 6px; margin-top: 10px; margin-bottom: 6px;">Dispatch Forces</h4>
        <div style="display:flex; flex-direction:column; gap: 4px;">
          <select id="move-destination-select" style="background:#252830; color:#fff; border:1px solid var(--border-gold-dim); padding:4px; font-size:0.75rem; border-radius:4px;">
            <option value="">Select Destination...</option>
            ${t.connections.map(cId => `<option value="${cId}">${mapData.territories[cId].name}</option>`).join("")}
          </select>
          <div style="display:flex; gap: 4px; margin-top: 4px;">
            <select id="move-unit-select" style="background:#252830; color:#fff; border:1px solid var(--border-gold-dim); padding:4px; font-size:0.75rem; border-radius:4px; flex:1;">
              ${Object.entries(boardState.units).filter(([,v]) => v > 0).map(([k,v]) => `<option value="${k}">${k} (${v})</option>`).join("")}
            </select>
            <button id="btn-dispatch-units" class="btn-gold" style="margin:0; padding:4px 10px; height:24px; font-size:0.7rem;">Send 1</button>
          </div>
        </div>
      `;
      garrisonDiv.appendChild(moveSection);

      document.getElementById("btn-dispatch-units").addEventListener("click", () => {
        const destId = document.getElementById("move-destination-select").value;
        const unitId = document.getElementById("move-unit-select").value;
        if (!destId || !unitId) return;

        this.executeUnitMove(id, destId, unitId);
      });
    }
  }

  // Execute actual move on graph
  executeUnitMove(originId, targetId, unitId) {
    const origin = this.gameState.board[originId];
    const target = this.gameState.board[targetId];

    if (origin.units[unitId] <= 0) return;

    // Movement validation checks:
    // 1. Tanks cannot enter Mountain terrain
    if (unitId === "tank" && mapData.territories[targetId].terrain === "mountain") {
      this.gameState.log(`Move denied: Tanks cannot traverse mountain passes.`);
      return;
    }

    // 2. Faction checks
    const targetOwner = target.owner;
    const activeFaction = this.gameState.activeFaction;

    // Deduct unit
    origin.units[unitId]--;

    // If target is owned by active player: simple movement
    if (targetOwner === activeFaction) {
      target.units[unitId]++;
      this.gameState.log(`Moved 1 ${unitId} from ${originId} to ${targetId}.`);
    } else {
      // Target is hostile or neutral! This is a combat move.
      // Move unit to target, schedule battle
      target.units[unitId]++;
      
      const isRiverCrossing = mapData.riverCrossings.some(
        c => (c.from === originId && c.to === targetId) || (c.from === targetId && c.to === originId)
      );

      // Check if battle already scheduled in targetId
      let battle = this.scheduledBattles.find(b => b.targetId === targetId);
      if (!battle) {
        battle = {
          targetId: targetId,
          originId: originId,
          isRiverCrossing: isRiverCrossing
        };
        this.scheduledBattles.push(battle);
      }
      
      this.gameState.log(`COMBAT MOVE: Dispatched 1 ${unitId} to attack ${targetId}. Battle scheduled.`);
    }

    // Re-render
    this.updateGlobalMetrics();
    this.mapEngine.render();
  }

  // --- PRODUCTION & UPGRADES PANEL RENDERING ---
  initProductionUI() {
    document.getElementById("btn-purchase-finalize").addEventListener("click", () => {
      const activeFactionId = this.gameState.activeFaction;
      const success = this.gameState.purchaseUnits(activeFactionId, this.purchaseCart);
      if (success) {
        // Reset cart
        Object.keys(this.purchaseCart).forEach(k => this.purchaseCart[k] = 0);
        this.updateGlobalMetrics();
        this.mapEngine.render();
      }
    });
  }

  renderProductionPanel() {
    const listDiv = document.getElementById("production-unit-list");
    listDiv.innerHTML = "";

    const activeFactionId = this.gameState.activeFaction;
    const faction = this.gameState.factions[activeFactionId];

    document.getElementById("production-city-name").textContent = mapData.territories[faction.capital].name;
    
    const capMax = 8 + (faction.upgrades.factory_expansion * 3);
    const cartSum = Object.values(this.purchaseCart).reduce((a,b)=>a+b, 0);
    document.getElementById("production-capacity").textContent = `${cartSum} / ${capMax} Units`;

    // 1. Populate Roster
    for (const [id, unit] of Object.entries(unitData.units)) {
      const row = document.createElement("div");
      row.className = "unit-row";
      
      // Calculate costs strings
      const costStr = Object.entries(unit.cost).filter(([,v]) => v > 0).map(([k,v]) => `${v} ${k}`).join(', ');

      row.innerHTML = `
        <div class="unit-info">
          <div class="unit-name">${unit.icon} ${unit.name}</div>
          <div class="unit-cost">Cost: ${costStr}</div>
        </div>
        <div class="unit-controls">
          <button class="btn-qty btn-minus" data-id="${id}">-</button>
          <span class="qty-val" id="qty-val-${id}">${this.purchaseCart[id]}</span>
          <button class="btn-qty btn-plus" data-id="${id}">+</button>
        </div>
      `;

      listDiv.appendChild(row);
    }

    // Bind roster buttons
    listDiv.querySelectorAll(".btn-plus").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.purchaseCart[id]++;
        this.renderProductionPanel();
      });
    });

    listDiv.querySelectorAll(".btn-minus").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (this.purchaseCart[id] > 0) {
          this.purchaseCart[id]--;
          this.renderProductionPanel();
        }
      });
    });

    // 2. Populate Upgrades
    const upgradeDiv = document.getElementById("production-upgrades-list");
    upgradeDiv.innerHTML = "";

    for (const [id, upgrade] of Object.entries(unitData.upgrades)) {
      const row = document.createElement("div");
      row.className = "unit-row";
      
      const costStr = Object.entries(upgrade.cost).filter(([,v]) => v > 0).map(([k,v]) => `${v} ${k}`).join(', ');
      const owned = faction.upgrades[id] || 0;

      row.innerHTML = `
        <div class="unit-info" style="max-width: 200px;">
          <div class="unit-name">${upgrade.name} (Owned: ${owned})</div>
          <div class="unit-cost" style="font-size: 0.65rem; color: var(--text-dim);">${upgrade.description}</div>
          <div class="unit-cost" style="font-weight:700;">Cost: ${costStr}</div>
        </div>
        <div class="unit-controls">
          <button class="btn-gold btn-build" data-id="${id}" style="margin:0; padding: 2px 10px; font-size: 0.75rem; height:26px;">Construct</button>
        </div>
      `;

      upgradeDiv.appendChild(row);
      
      row.querySelector(".btn-build").addEventListener("click", () => {
        this.gameState.purchaseUpgrade(activeFactionId, id);
        this.updateGlobalMetrics();
      });
    }
  }

  // --- CARDS HAND PANEL RENDERING ---
  renderHandPanel() {
    const container = document.getElementById("cards-hand-container");
    container.innerHTML = "";

    const activeFactionId = this.gameState.activeFaction;
    const faction = this.gameState.factions[activeFactionId];

    if (faction.hand.length === 0) {
      container.innerHTML = '<div style="color:var(--text-dim);font-size:0.75rem;text-align:center;grid-column:span 2;margin-top:20px;">No cards in hand.</div>';
      return;
    }

    faction.hand.forEach((card, idx) => {
      const cardDiv = document.createElement("div");
      cardDiv.className = "crown-card";
      cardDiv.innerHTML = `
        <div class="card-type ${card.type}">${card.type}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-description">${card.description}</div>
        <button class="btn-gold btn-play-card" style="margin:0; font-size:0.6rem; padding: 2px 0; height: 18px; width: 100%;">Play Card</button>
      `;

      container.appendChild(cardDiv);

      cardDiv.querySelector(".btn-play-card").addEventListener("click", () => {
        this.playCardFromHand(activeFactionId, idx);
      });
    });
  }

  playCardFromHand(factionId, cardIdx) {
    const faction = this.gameState.factions[factionId];
    const card = faction.hand[cardIdx];

    this.gameState.log(`Playing card: ${card.name}`);

    // Resolve Card Edicts
    if (card.id === "garrison_draft") {
      this.gameState.board[faction.capital].units.infantry += 2;
      this.gameState.log(`Emergency Draft complete. Spawned 2 Infantry Divisions at Capital.`);
    } else if (card.id === "propagandist") {
      faction.prestige += 4;
      this.gameState.log(`Received +4 Prestige from political support.`);
    } else if (card.id === "forced_march") {
      this.gameState.log(`Tactical maneuver active. Please execute unit movements.`);
    } else {
      this.gameState.log(`Played card action card: ${card.name}`);
    }

    // Remove from hand
    faction.hand.splice(cardIdx, 1);
    this.updateGlobalMetrics();
  }
}

// Assemble App on page load
window.addEventListener("DOMContentLoaded", () => {
  window.appInstance = new App();
});
