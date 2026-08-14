// IRON & CROWNS - DOCTRINES & RESEARCH ENGINE

export const doctrineData = {
  tracks: {
    "tactics": {
      name: "Tactical Maneuvers",
      nodes: [
        {
          id: "blitzkrieg",
          name: "Blitzkrieg",
          cost: 2,
          effect: "+1 Move to Tanks",
          description: "Coordination of fast armored spearheads increases tank operational range."
        },
        {
          id: "combined_arms",
          name: "Combined Arms",
          cost: 3,
          effect: "Tanks boost paired Infantry attack by +1",
          description: "Infantry divisions advance directly behind armor plates, increasing punch."
        }
      ]
    },
    "mobilization": {
      name: "Industrial Mobilization",
      nodes: [
        {
          id: "war_draft",
          name: "Standardized Draft",
          cost: 2,
          effect: "Infantry cost 1 less Wood",
          description: "Mass production of uniforms and basic rifles reduces recruitment costs."
        },
        {
          id: "factory_assembly",
          name: "Assembly Line",
          cost: 3,
          effect: "+3 Factory Build Capacity",
          description: "Conveyor belts and organized shifts maximize division assembly speeds."
        }
      ]
    },
    "senate": {
      name: "Senate Hegemony",
      nodes: [
        {
          id: "bureaucracy",
          name: "State Bureaucracy",
          cost: 2,
          effect: "+2 Prestige per turn",
          description: "Streamlined administration pools political capital and empire legitimacy."
        },
        {
          id: "coalition_bribe",
          name: "Lobbying Networks",
          cost: 3,
          effect: "-2 Prestige to Bribe Commanders",
          description: "Backchannel deals and political leverage make bribes cheaper."
        }
      ]
    }
  }
};

export class DoctrinesEngine {
  constructor(gameState, updateUI) {
    this.gameState = gameState;
    this.updateUI = updateUI;
    this.container = document.getElementById("doctrines-tree-container");
    this.rpLabel = document.getElementById("doctrine-rp-value");
  }

  // Check if a faction has unlocked a specific doctrine node
  isUnlocked(factionId, nodeId) {
    return this.gameState.factions[factionId].doctrines.includes(nodeId);
  }

  // Spend Prestige/RP to unlock a doctrine node
  unlockNode(factionId, nodeId, cost) {
    const faction = this.gameState.factions[factionId];
    if (faction.prestige < cost) {
      this.gameState.log(`Research failed: insufficient Prestige (requires ${cost}).`);
      return false;
    }

    if (faction.doctrines.includes(nodeId)) {
      this.gameState.log(`Research failed: doctrine already unlocked.`);
      return false;
    }

    faction.prestige -= cost;
    faction.doctrines.push(nodeId);
    this.gameState.log(`${faction.name} unlocked doctrine: ${nodeId.replace("_", " ")}.`);
    
    this.render(factionId);
    this.updateUI();
    return true;
  }

  // Render the doctrine trees in the UI panel
  render(factionId) {
    const faction = this.gameState.factions[factionId];
    this.rpLabel.textContent = `${faction.prestige} Prestige`;

    this.container.innerHTML = "";

    for (const track of Object.values(doctrineData.tracks)) {
      const trackDiv = document.createElement("div");
      trackDiv.className = "doctrine-track";

      const title = document.createElement("div");
      title.className = "doctrine-track-title";
      title.textContent = track.name;
      trackDiv.appendChild(title);

      const nodesContainer = document.createElement("div");
      nodesContainer.className = "nodes-container";

      track.nodes.forEach(node => {
        const nodeDiv = document.createElement("div");
        const active = this.isUnlocked(factionId, node.id);
        
        nodeDiv.className = `doctrine-node ${active ? 'active' : ''}`;
        nodeDiv.innerHTML = `
          <div class="doctrine-node-title">${node.name}</div>
          <div style="font-size: 0.6rem; color: var(--color-prestige); margin-top: 2px;">Cost: ${node.cost}</div>
          <div class="node-desc-tooltip">
            <strong>${node.name}</strong><br>
            <span style="color: var(--gold-primary); font-size: 0.65rem;">${node.effect}</span><br><br>
            ${node.description}
          </div>
        `;

        if (!active) {
          nodeDiv.addEventListener("click", () => {
            this.unlockNode(factionId, node.id, node.cost);
          });
        }

        nodesContainer.appendChild(nodeDiv);
      });

      trackDiv.appendChild(nodesContainer);
      this.container.appendChild(trackDiv);
    }
  }
}
