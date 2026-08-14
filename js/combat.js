// IRON & CROWNS - COMBAT RESOLUTION ENGINE
import { unitData } from './data/unitData.js';
import { mapData } from './data/mapData.js';

export class CombatEngine {
  constructor(gameState, updateUI) {
    this.gameState = gameState;
    this.updateUI = updateUI;

    this.attackerUnitsDiv = document.getElementById("combat-attacker-units");
    this.defenderUnitsDiv = document.getElementById("combat-defender-units");
    this.combatLog = document.getElementById("combat-log");
    this.rollBtn = document.getElementById("btn-combat-roll");
    this.retreatBtn = document.getElementById("btn-combat-retreat");

    this.activeBattle = null;
    this.initCombatControls();
  }

  initCombatControls() {
    this.rollBtn.addEventListener("click", () => this.executeCombatRound());
    this.retreatBtn.addEventListener("click", () => this.executeRetreat());
    this.disableControls();
  }

  disableControls() {
    this.rollBtn.disabled = true;
    this.retreatBtn.disabled = true;
  }

  enableControls() {
    this.rollBtn.disabled = false;
    this.retreatBtn.disabled = false;
  }

  // Initialize a new battle in a territory
  initializeBattle(territoryId, attackerId, defenderId, originTerritoryId, isRiverCrossing) {
    // Attacker units are the ones that moved in this turn
    // To simplify: we collect all units belonging to the attacker in that territory as the attacking force,
    // and all units belonging to the defender/neutrals as the defending force.
    // The units are currently stored in the territory; battleData below pulls from board state directly.

    // However, during Phase 3 (Combat Move), the attacker moved their units *into* the territory.
    // In our simplified engine, we will pass the list of attacking units and defending units explicitly:
    // Let's assume the attacker moved their units from originTerritoryId.
    const battleData = {
      territoryId: territoryId,
      attackerId: attackerId,
      defenderId: defenderId,
      originTerritoryId: originTerritoryId,
      isRiverCrossing: isRiverCrossing,
      round: 1,
      attacker: {
        faction: attackerId,
        units: { ...this.gameState.board[originTerritoryId].units }, // moved out of origin
        hitsPending: 0
      },
      defender: {
        faction: defenderId,
        units: { ...this.gameState.board[territoryId].units }, // defending in target
        hitsPending: 0
      }
    };

    // Temporarily clear units from origin and target on the board to avoid double-counting
    // (They are now in the activeBattle object)
    for (const unitId of Object.keys(unitData.units)) {
      this.gameState.board[originTerritoryId].units[unitId] = 0;
      this.gameState.board[territoryId].units[unitId] = 0;
    }

    this.activeBattle = battleData;
    this.combatLog.innerHTML = `Battle initialized in ${mapData.territories[territoryId].name}!<br>Attacker: ${this.gameState.factions[attackerId].name}<br>Defender: ${this.gameState.factions[defenderId].name}`;
    
    this.enableControls();
    this.render();
  }

  // Execute one round of combat rolls
  executeCombatRound() {
    if (!this.activeBattle) return;

    const b = this.activeBattle;
    this.combatLog.innerHTML = `=== Round ${b.round} Rolls ===<br>`;

    // 1. Calculate hit thresholds
    const attackerThresholds = this.calculateHitThresholds(b.attackerId, b.territoryId, b.attacker.units, true);
    const defenderThresholds = this.calculateHitThresholds(b.defenderId, b.territoryId, b.defender.units, false);

    let attackerHits = 0;
    let defenderHits = 0;

    // 2. Attacker rolls
    for (const [unitId, qty] of Object.entries(b.attacker.units)) {
      if (qty <= 0) continue;
      const threshold = attackerThresholds[unitId];
      for (let i = 0; i < qty; i++) {
        const roll = Math.floor(Math.random() * 6) + 1;
        const hit = roll <= threshold;
        if (hit) attackerHits++;
        this.combatLog.innerHTML += `Attacking ${unitId} rolled ${roll} (Needs &le;${threshold}): ${hit ? '<strong style="color:var(--faction-red);">HIT</strong>' : 'Miss'}<br>`;
      }
    }

    // 3. Defender rolls
    for (const [unitId, qty] of Object.entries(b.defender.units)) {
      if (qty <= 0) continue;
      const threshold = defenderThresholds[unitId];
      for (let i = 0; i < qty; i++) {
        const roll = Math.floor(Math.random() * 6) + 1;
        const hit = roll <= threshold;
        if (hit) defenderHits++;
        this.combatLog.innerHTML += `Defending ${unitId} rolled ${roll} (Needs &le;${threshold}): ${hit ? '<strong style="color:var(--faction-blue);">HIT</strong>' : 'Miss'}<br>`;
      }
    }

    // 4. Apply casualties (Cheapest units auto-destroyed first)
    this.applyCasualties(b.defender.units, attackerHits, "Defender");
    this.applyCasualties(b.attacker.units, defenderHits, "Attacker");

    b.round++;
    this.render();

    // 5. Check end of battle conditions
    const attackerCount = Object.values(b.attacker.units).reduce((a,b)=>a+b, 0);
    const defenderCount = Object.values(b.defender.units).reduce((a,b)=>a+b, 0);

    if (attackerCount === 0 && defenderCount === 0) {
      this.concludeBattle("draw");
    } else if (attackerCount === 0) {
      this.concludeBattle("defender_victory");
    } else if (defenderCount === 0) {
      this.concludeBattle("attacker_victory");
    }
  }

  // Calculate dice hit thresholds based on artillery pairings, commanders, and river crossing
  calculateHitThresholds(factionId, territoryId, units, isAttacking) {
    const thresholds = {};
    
    // Base stats
    for (const [unitId, stats] of Object.entries(unitData.units)) {
      thresholds[unitId] = isAttacking ? stats.attack : stats.defense;
    }

    // 1. Artillery support pairing (1 Artillery increases 1 Infantry attack from 1 to 2)
    if (isAttacking) {
      const artCount = units.artillery || 0;
      // Wait, thresholds are static per unit type, but we have individual roll capabilities.
      // To model this pairing in a simple threshold mapping:
      // If we have paired infantry, we can roll them separately, or just average them.
      // In this code, let's treat the infantry threshold as 2 if there is at least one artillery,
      // and we handle the specific counts. A simple way:
      // If there's artillery, infantry gets +1 attack threshold for up to artCount units.
      // For simplicity in the log, let's set infantry threshold to 2 if there is artillery,
      // or we can roll them with specific values in executeCombatRound.
      // Let's implement pairing directly in the thresholds:
      if (artCount > 0) {
        thresholds.infantry = 2; // paired infantry hits on 2
      }
    }

    // 2. Commander presence (+1 to hit threshold)
    let hasCommander = false;
    for (const c of Object.values(this.gameState.commanders)) {
      if (c.location === territoryId && c.faction === factionId) {
        hasCommander = true;
        break;
      }
    }
    if (hasCommander) {
      for (const unitId of Object.keys(thresholds)) {
        thresholds[unitId] = Math.min(5, thresholds[unitId] + 1); // Capped at 5 to allow chance of failure
      }
    }

    // 3. Faction upgrades / office buffs
    // If attacking and faction holds Minister of War, Tanks gain +1 attack
    const isRedWar = factionId === "red" && this.gameState.factions.red.offices.includes("minister_war");
    const isBlueWar = factionId === "blue" && this.gameState.factions.blue.offices.includes("minister_war");
    if (isAttacking && (isRedWar || isBlueWar)) {
      thresholds.tank = Math.min(5, thresholds.tank + 1);
    }

    // 4. River Crossing penalty (-1 to attack threshold on Round 1)
    if (isAttacking && this.activeBattle && this.activeBattle.round === 1 && this.activeBattle.isRiverCrossing) {
      for (const unitId of Object.keys(thresholds)) {
        thresholds[unitId] = Math.max(1, thresholds[unitId] - 1);
      }
    }

    return thresholds;
  }

  // Auto-allocate casualties cheapest to most expensive: transport -> infantry -> artillery -> tank -> warship -> fighter
  applyCasualties(units, hits, sideName) {
    const casualtyOrder = ["transport", "infantry", "artillery", "tank", "warship", "fighter"];
    let hitsRemaining = hits;

    for (const unitId of casualtyOrder) {
      if (hitsRemaining <= 0) break;
      const qty = units[unitId] || 0;
      if (qty > 0) {
        const killed = Math.min(qty, hitsRemaining);
        units[unitId] -= killed;
        hitsRemaining -= killed;
        this.combatLog.innerHTML += `${sideName} lost <strong style="color:var(--faction-red);">${killed} ${unitId}</strong>.<br>`;
      }
    }
  }

  executeRetreat() {
    if (!this.activeBattle) return;
    this.gameState.log(`Attacking force has ordered a tactical retreat.`);
    this.concludeBattle("retreat");
  }

  concludeBattle(result) {
    const b = this.activeBattle;
    this.disableControls();

    if (result === "attacker_victory") {
      this.gameState.log(`VICTORY! Attacking forces successfully conquered ${mapData.territories[b.territoryId].name}!`);
      this.gameState.board[b.territoryId].owner = b.attackerId;
      
      // Move surviving attacking units into the conquered territory
      this.gameState.board[b.territoryId].units = { ...b.attacker.units };
      
      // Move attacker's commander into the conquered territory
      for (const c of Object.values(this.gameState.commanders)) {
        if (c.faction === b.attackerId && c.location === b.originTerritoryId) {
          c.location = b.territoryId; // Commander advances!
        }
      }
    } else if (result === "defender_victory" || result === "draw") {
      this.gameState.log(`DEFEAT! Attackers were repelled. ${mapData.territories[b.territoryId].name} remains under defender control.`);
      // Move surviving defending units back to target territory
      this.gameState.board[b.territoryId].units = { ...b.defender.units };
    } else if (result === "retreat") {
      // Move surviving attacking units back to origin territory
      this.gameState.board[b.originTerritoryId].units = { ...b.attacker.units };
      // Move surviving defending units back to target territory
      this.gameState.board[b.territoryId].units = { ...b.defender.units };
    }

    this.activeBattle = null;
    this.updateUI();
  }

  render() {
    if (!this.activeBattle) {
      this.attackerUnitsDiv.innerHTML = "No active battle.";
      this.defenderUnitsDiv.innerHTML = "No active battle.";
      return;
    }

    const b = this.activeBattle;
    
    // Render Attacker Units
    this.attackerUnitsDiv.innerHTML = "";
    for (const [unitId, qty] of Object.entries(b.attacker.units)) {
      if (qty <= 0) continue;
      const cell = document.createElement("div");
      cell.className = "combat-unit-cell";
      cell.innerHTML = `
        <div class="combat-unit-icon">${unitData.units[unitId].icon}</div>
        <div class="combat-unit-name">${unitId}</div>
        <div class="combat-unit-qty">${qty}</div>
      `;
      this.attackerUnitsDiv.appendChild(cell);
    }

    // Render Defender Units
    this.defenderUnitsDiv.innerHTML = "";
    for (const [unitId, qty] of Object.entries(b.defender.units)) {
      if (qty <= 0) continue;
      const cell = document.createElement("div");
      cell.className = "combat-unit-cell";
      cell.innerHTML = `
        <div class="combat-unit-icon">${unitData.units[unitId].icon}</div>
        <div class="combat-unit-name">${unitId}</div>
        <div class="combat-unit-qty">${qty}</div>
      `;
      this.defenderUnitsDiv.appendChild(cell);
    }
  }
}
