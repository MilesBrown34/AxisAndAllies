// IRON & CROWNS - MAP SEEDS DATABASE
// Defines the coordinates of the 26 capital & region seeds. The map generator procedurally builds the map around these seeds.

export const mapData = {
  // Staggered world map coordinates (q, r)
  seeds: {
    // RED FACTION (Imperium of Iron - Europe Core)
    "Essen_Core": { name: "Central Europe (Germany)", type: "capital", defaultOwner: "red", q: 59, r: 16, label: "Germany" },
    "Rhine_Plains": { name: "Western Europe (France)", type: "province", defaultOwner: "red", q: 54, r: 18, label: "France" },
    "Bavaria": { name: "Southern Europe (Italy)", type: "province", defaultOwner: "red", q: 57, r: 21, label: "Italy" },
    "Prussia": { name: "Eastern Europe (Poland)", type: "province", defaultOwner: "red", q: 63, r: 16, label: "Poland" },

    // BLUE FACTION (Alliance of Crowns - Americas Core)
    "London_Core": { name: "North America East", type: "capital", defaultOwner: "blue", q: 21, r: 18, label: "US East" },
    "California_Outpost": { name: "North America West", type: "province", defaultOwner: "blue", q: 14, r: 20, label: "US West" },
    "Yukon_Territory": { name: "Canada", type: "province", defaultOwner: "blue", q: 18, r: 14, label: "Canada" },
    "Paris_Citadel": { name: "South America East (Brazil)", type: "province", defaultOwner: "blue", q: 32, r: 39, label: "Brazil" },
    "Andes_Outpost": { name: "South America West (Andes)", type: "province", defaultOwner: "blue", q: 27, r: 46, label: "Andes" },

    // NEUTRAL / CONTESTED OUTPOSTS & CAPITALS
    "Rome_Core": { name: "Sahara (North Africa)", type: "province", defaultOwner: "neutral", q: 59, r: 30, label: "Sahara" },
    "Balkans_Pass": { name: "Congo (Central Africa)", type: "province", defaultOwner: "neutral", q: 62, r: 39, label: "Congo" },
    "Cape_Outpost": { name: "South Africa", type: "province", defaultOwner: "neutral", q: 63, r: 50, label: "South Africa" },
    "Scandinavia": { name: "Scandinavia", type: "province", defaultOwner: "neutral", q: 60, r: 9, label: "Scandinavia" },
    "Moscow_Heart": { name: "Russia (Moscow)", type: "province", defaultOwner: "neutral", q: 71, r: 14, label: "Russia" },
    "Siberian_Wastes": { name: "Siberia (Eastern Russia)", type: "province", defaultOwner: "neutral", q: 87, r: 12, label: "Siberia" },
    "Caucasus_Oil": { name: "Middle East", type: "province", defaultOwner: "neutral", q: 69, r: 22, label: "Mid East" },
    "Ural_Mines": { name: "East Asia (China)", type: "province", defaultOwner: "neutral", q: 93, r: 20, label: "China" },
    "Tokyo_Heart": { name: "Japan", type: "province", defaultOwner: "neutral", q: 110, r: 16, label: "Japan" },
    "Suez_Outpost": { name: "India", type: "province", defaultOwner: "neutral", q: 81, r: 27, label: "India" },
    "Indochina_Pass": { name: "Southeast Asia", type: "province", defaultOwner: "neutral", q: 98, r: 30, label: "SE Asia" },
    "Outback_Outpost": { name: "Australia", type: "province", defaultOwner: "neutral", q: 110, r: 46, label: "Australia" },

    // SEA ZONES (Water Seeds)
    "English_Channel": { name: "Caribbean Sea", type: "sea", q: 26, r: 26, label: "Caribbean" },
    "Atlantic_Ocean": { name: "Atlantic Ocean", type: "sea", q: 41, r: 27, label: "Atlantic" },
    "North_Sea": { name: "Pacific Ocean", type: "sea", q: 117, r: 30, label: "Pacific" },
    "Indian_Ocean": { name: "Indian Ocean", type: "sea", q: 84, r: 40, label: "Indian Ocean" },
    "Mediterranean_Sea": { name: "Mediterranean Sea", type: "sea", q: 57, r: 26, label: "Mediterranean" }
  },

  // River border boundaries between specific seeds (for combat crossing penalties)
  riverCrossings: [
    { from: "Rhine_Plains", to: "Essen_Core" },
    { from: "Prussia", to: "Moscow_Heart" },
    { from: "Suez_Outpost", to: "Ural_Mines" }
  ]
};

