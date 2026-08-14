// IRON & CROWNS - UNIT STATS & NATIONAL UPGRADES DATABASE

export const unitData = {
  units: {
    "infantry": {
      id: "infantry",
      name: "Infantry Division",
      cost: { wood: 2, metal: 1, oil: 0 },
      attack: 1,
      defense: 2,
      move: 1,
      icon: "⚔️",
      description: "Standard defensive backbone. Gets attack bonus (+1) when paired with Artillery."
    },
    "artillery": {
      id: "artillery",
      name: "Artillery Brigade",
      cost: { wood: 2, metal: 2, oil: 0 },
      attack: 2,
      defense: 2,
      move: 1,
      icon: "💣",
      description: "Support brigade. Boosts attack rating of 1 Infantry in the same territory."
    },
    "tank": {
      id: "tank",
      name: "Ironclad Armor (Tank)",
      cost: { wood: 0, metal: 1, oil: 3 },
      attack: 3,
      defense: 3,
      move: 2,
      icon: "🚜",
      description: "Powerful mobile offense. Can blitz through empty land. Cannot enter Mountains."
    },
    "fighter": {
      id: "fighter",
      name: "Biplane Squadron",
      cost: { wood: 0, metal: 2, oil: 2 },
      attack: 3,
      defense: 4,
      move: 4,
      icon: "✈️",
      description: "High-range air squad. Must land in friendly territory at the end of the turn."
    },
    "warship": {
      id: "warship",
      name: "Dreadnought Warship",
      cost: { wood: 0, metal: 4, oil: 1 },
      attack: 3,
      defense: 3,
      move: 2,
      icon: "🚢",
      description: "Dominates sea lanes. Provides shore bombardment support for amphibious invasions."
    },
    "transport": {
      id: "transport",
      name: "Steam Transport",
      cost: { wood: 3, metal: 1, oil: 0 },
      attack: 0,
      defense: 0,
      move: 2,
      icon: "📦",
      description: "Carries up to 2 land units across sea zones. Has no combat attack or defense."
    }
  },

  upgrades: {
    "logging_camp": {
      id: "logging_camp",
      name: "Steam Sawmill",
      cost: { wood: 0, metal: 5, oil: 0 },
      incomeBonus: { wood: 2 },
      description: "Global country-wide timber upgrade. Generates +2 Wood income per turn."
    },
    "steelworks": {
      id: "steelworks",
      name: "Bessemer Steelworks",
      cost: { wood: 5, metal: 5, oil: 0 },
      incomeBonus: { metal: 2 },
      description: "Global metallurgical furnace. Generates +2 Metal income per turn."
    },
    "refinery": {
      id: "refinery",
      name: "Petroleum Refinery",
      cost: { wood: 5, metal: 5, oil: 0 },
      incomeBonus: { oil: 2 },
      description: "Fuel processing refinery. Generates +2 Oil income per turn."
    },
    "senate_hall": {
      id: "senate_hall",
      name: "Senate Assembly Hall",
      cost: { wood: 10, metal: 10, oil: 0 },
      incomeBonus: { prestige: 3 },
      description: "Enlarged administrative hall. Generates +3 Prestige income per turn."
    },
    "factory_expansion": {
      id: "factory_expansion",
      name: "Munitions Line Expansion",
      cost: { wood: 3, metal: 8, oil: 0 },
      capacityBonus: 3,
      description: "Upgrades national factories. Increases unit build capacity limit by +3 units."
    }
  }
};
