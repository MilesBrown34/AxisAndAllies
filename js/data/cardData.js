// IRON & CROWNS - CROWN CARDS DATABASE

export const cardData = {
  // Action cards drawn into a player's hand
  actionCards: [
    {
      id: "forced_march",
      name: "Forced March",
      type: "action",
      description: "Play during Combat Move. Select one land unit; it gains +1 Movement range for this turn."
    },
    {
      id: "industrial_sabotage",
      name: "Industrial Sabotage",
      type: "action",
      description: "Target an enemy territory containing upgrades. Disables one random upgrade (must pay 3 gold to repair)."
    },
    {
      id: "entrenchment",
      name: "Entrenchment",
      type: "action",
      description: "Play during battle. All defending units in the target territory gain +1 defense rating for the first combat round."
    },
    {
      id: "garrison_draft",
      name: "Emergency Draft",
      type: "action",
      description: "Instantly recruit 2 free Infantry Divisions in your Metropolitan Capital."
    },
    {
      id: "propagandist",
      name: "Electoral Fraud",
      type: "action",
      description: "Increases your bidding strength by +4 Prestige for any active Senate Office auction this turn."
    },
    {
      id: "espionage",
      name: "Infiltrator",
      type: "action",
      description: "Play in Senate phase. Expose the loyalty value of all active enemy commanders."
    }
  ],

  // Offices biddable during the Senate Phase
  offices: [
    {
      id: "minister_war",
      name: "Minister of War",
      type: "office",
      effect: "All Tanks gain +1 Attack.",
      baseBid: 3
    },
    {
      id: "high_chancellor",
      name: "High Chancellor",
      type: "office",
      effect: "Generates +2 Prestige per turn.",
      baseBid: 4
    },
    {
      id: "lord_admiral",
      name: "Lord Admiral of the Fleet",
      type: "office",
      effect: "All Warships cost 1 less Metal to construct.",
      baseBid: 3
    },
    {
      id: "grand_diplomat",
      name: "Grand Diplomat",
      type: "office",
      effect: "Reduces Commander Bribe costs by 3 Prestige.",
      baseBid: 2
    }
  ],

  // Global event cards drawn at the start of a round
  events: [
    {
      id: "deep_winter",
      name: "Severe Winter",
      type: "event",
      effect: "All land unit movement is reduced by 1 (minimum 1).",
      description: "Heavy snowstorms freeze roads and rails across the continent, slowing land movement."
    },
    {
      id: "industrial_boom",
      name: "Industrial Boom",
      type: "event",
      effect: "All Factory build limits increased by +2 units.",
      description: "New automation processes speed up military assembly lines."
    },
    {
      id: "parliamentary_crisis",
      name: "Parliamentary Crisis",
      type: "event",
      effect: "All commanders lose -2 Loyalty for this round.",
      description: "Political scandals shake the chain of command, weakening loyalty."
    },
    {
      id: "global_trade",
      name: "Bountiful Season",
      type: "event",
      effect: "All factions instantly gain +3 Gold.",
      description: "Bumper crops and trade agreements fill national treasuries."
    }
  ]
};
