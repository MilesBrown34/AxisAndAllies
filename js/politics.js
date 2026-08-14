// IRON & CROWNS - SENATE POLITICS & COMMANDER BRIBERY ENGINE
import { cardData } from './data/cardData.js';

export class PoliticsEngine {
  constructor(gameState, updateUI) {
    this.gameState = gameState;
    this.updateUI = updateUI;

    this.officesContainer = document.getElementById("senate-offices-container");
    this.briberySelect = document.getElementById("bribery-commander-select");
    this.briberyLoyaltyLabel = document.getElementById("bribery-loyalty-val");
    this.briberyBidInput = document.getElementById("bribery-bid-amount");
    this.bribeBtn = document.getElementById("btn-attempt-bribe");

    this.officesState = {};
    this.initializeOffices();
    this.initPoliticsControls();
  }

  // Initialize Senate Offices state from database
  initializeOffices() {
    cardData.offices.forEach(office => {
      this.officesState[office.id] = {
        id: office.id,
        name: office.name,
        effect: office.effect,
        currentBid: office.baseBid,
        currentHolder: "neutral"
      };
    });
  }

  initPoliticsControls() {
    this.bribeBtn.addEventListener("click", () => this.attemptCommanderBribe());
    this.briberySelect.addEventListener("change", (e) => this.handleCommanderSelect(e.target.value));
  }

  // Render the Senate Bidding offices
  renderOffices(factionId) {
    this.officesContainer.innerHTML = "";

    for (const [id, office] of Object.entries(this.officesState)) {
      const card = document.createElement("div");
      card.className = "office-card";
      
      const holderText = office.currentHolder === "neutral" ? "None" : (office.currentHolder === "red" ? "Imperium of Iron" : "Alliance of Crowns");
      const holderClass = office.currentHolder === "neutral" ? "" : `holder-${office.currentHolder}`;

      card.innerHTML = `
        <div class="office-header">
          <div class="office-name">${office.name}</div>
          <div class="office-holder ${holderClass}">Holder: ${holderText}</div>
        </div>
        <div class="office-effect">${office.effect}</div>
        <div class="office-bid-controls">
          <div class="office-current-bid">Current Bid: <strong style="color: var(--color-prestige);">${office.currentBid} Prestige</strong></div>
          <div style="display: flex; gap: 4px;">
            <input type="number" id="bid-val-${id}" min="${office.currentBid + 1}" value="${office.currentBid + 1}" style="background: #252830; color: #fff; border: 1px solid var(--border-gold-dim); padding: 2px 4px; width: 45px; text-align: center; border-radius: 4px;">
            <button class="btn-gold" id="btn-bid-${id}" style="margin: 0; padding: 2px 8px; font-size: 0.7rem; height: 22px;">Bid</button>
          </div>
        </div>
      `;

      this.officesContainer.appendChild(card);

      // Bind Bid Button
      document.getElementById(`btn-bid-${id}`).addEventListener("click", () => {
        const bidVal = parseInt(document.getElementById(`bid-val-${id}`).value);
        this.placeOfficeBid(factionId, id, bidVal);
      });
    }
  }

  placeOfficeBid(factionId, officeId, amount) {
    const faction = this.gameState.factions[factionId];
    const office = this.officesState[officeId];

    if (faction.prestige < amount) {
      this.gameState.log(`Bid failed: insufficient Prestige.`);
      return;
    }

    if (amount <= office.currentBid) {
      this.gameState.log(`Bid failed: must exceed the current bid of ${office.currentBid}.`);
      return;
    }

    // Refund previous holder if it was a player
    if (office.currentHolder !== "neutral") {
      this.gameState.factions[office.currentHolder].prestige += office.currentBid;
      this.gameState.log(`Refunded ${office.currentBid} Prestige to previous holder of ${office.name}.`);
    }

    // Deduct prestige from new holder
    faction.prestige -= amount;
    office.currentBid = amount;
    office.currentHolder = factionId;

    this.gameState.log(`${faction.name} bid ${amount} Prestige on ${office.name} and is now the current holder.`);
    this.renderOffices(factionId);
    this.updateUI();
  }

  // Populate Bribe commander selection
  populateCommanderDropdown(activeFactionId) {
    this.briberySelect.innerHTML = '<option value="">Select Commander...</option>';
    
    for (const [id, c] of Object.entries(this.gameState.commanders)) {
      // Allow bribing neutral or enemy commanders
      if (c.faction !== activeFactionId) {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = `${c.name} (${c.faction.toUpperCase()})`;
        this.briberySelect.appendChild(option);
      }
    }
    
    this.briberyLoyaltyLabel.textContent = "0";
  }

  handleCommanderSelect(commanderId) {
    if (!commanderId) {
      this.briberyLoyaltyLabel.textContent = "0";
      return;
    }
    const c = this.gameState.commanders[commanderId];
    this.briberyLoyaltyLabel.textContent = c.loyalty;
  }

  attemptCommanderBribe() {
    const factionId = this.gameState.activeFaction;
    const faction = this.gameState.factions[factionId];
    const commId = this.briberySelect.value;
    const bidAmount = parseInt(this.briberyBidInput.value);

    if (!commId) {
      this.gameState.log("Bribe failed: No commander selected.");
      return;
    }

    const c = this.gameState.commanders[commId];

    if (faction.prestige < bidAmount) {
      this.gameState.log("Bribe failed: insufficient Prestige in treasury.");
      return;
    }

    // Check if player has the Grand Diplomat office to reduce cost
    let finalCost = bidAmount;
    const hasGrandDiplomat = this.officesState["grand_diplomat"] && this.officesState["grand_diplomat"].currentHolder === factionId;
    if (hasGrandDiplomat) {
      finalCost = Math.max(1, finalCost - 3);
    }

    // Deduct cost based on outcome (lobbying cost is 50% on failure, 100% on success)
    const success = bidAmount > c.loyalty;

    if (success) {
      faction.prestige -= finalCost;
      const oldFaction = c.faction;
      c.faction = factionId; // DEFECT!

      // DEFECT ARMY: All units in the commander's territory belonging to the old faction switch sides!
      const territory = this.gameState.board[c.location];
      if (territory && territory.owner === oldFaction) {
        territory.owner = factionId; // Capture territory!
        // Garrison switches sides!
        this.gameState.log(`POLITICAL COUP! ${c.name} defected. The entire garrison at ${c.location} has sworn allegiance to ${faction.name}!`);
      } else {
        this.gameState.log(`${c.name} has defected and joined ${faction.name}!`);
      }

      this.populateCommanderDropdown(factionId);
      this.gameState.log(`Spent ${finalCost} Prestige on the successful coup.`);
    } else {
      const lobbyingCost = Math.floor(finalCost / 2);
      faction.prestige -= lobbyingCost;
      this.gameState.log(`Bribe failed: ${c.name} refused the offer. Spent ${lobbyingCost} Prestige on lobbying expenses.`);
    }

    this.updateUI();
  }

  // Get active office buffs
  getOfficeBuff(factionId, officeId) {
    const office = this.officesState[officeId];
    return office && office.currentHolder === factionId;
  }
}
