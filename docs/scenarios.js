// Scenario definitions for the wgsql demo.
//
// Each scenario is a self-contained world with real-looking labels so
// the leaderboard reads like a real product, not a database dump. Data
// generation is deterministic (xorshift32). The trick that keeps the
// top-20 stable on real names: we shape the value distribution so
// keys [0..topNames.length) get a much higher mean. With Zipf-style
// weighting, the top names stay top regardless of slider position.

export const SCENARIOS = [
  {
    id: "taxi",
    emoji: "🚖",
    title: "NYC taxi tips",
    metaShort: "10 M rides · 263 zones",
    desc: "10M yellow-cab trips. Drag to filter by minimum fare. Bars show top tipping pickup zones.",
    n: 10_000_000,
    distinct: 263,
    topNames: [
      "Times Square — West", "Times Square — East", "Midtown East", "Midtown West",
      "Upper East Side", "Upper West Side", "Lower East Side", "Greenwich Village",
      "SoHo", "Tribeca", "FiDi (Wall St)", "Battery Park", "NoMad", "Murray Hill",
      "Hell's Kitchen", "Chelsea", "Flatiron", "Union Square", "Gramercy", "Chinatown",
      "Little Italy", "East Village", "West Village", "Meatpacking", "Hudson Yards",
      "JFK Airport", "LaGuardia Airport", "Williamsburg", "DUMBO", "Brooklyn Heights",
      "Park Slope", "Long Island City", "Astoria", "Harlem — West", "Harlem — East",
      "Inwood", "Washington Heights", "Morningside Heights", "Lincoln Square",
      "Yorkville", "Lenox Hill", "Carnegie Hill", "Roosevelt Island", "Two Bridges",
      "Bowery", "Stuyvesant Town", "Kips Bay", "Sutton Place", "Turtle Bay",
      "Theater District",
    ],
    sliderLabel: "min fare ≥",
    sliderMax: 80,
    sliderUnit: "$",
    sliderUnitPos: "prefix",
    sumLabel: "tips total",
    sumKind: "money",
    valueRange: 80,
    valueScale: 1.0,
    keyEmoji: ["📍"],
    rowSize: "wide",
  },
  {
    id: "stocks",
    emoji: "📈",
    title: "Equity trades",
    metaShort: "10 M trades · 5 K tickers",
    desc: "10M equity trades. Drag to filter by minimum trade size. Bars show top tickers by traded notional.",
    n: 10_000_000,
    distinct: 5_000,
    topNames: [
      "AAPL", "MSFT", "GOOG", "AMZN", "NVDA", "META", "TSLA", "BRK.B",
      "JPM", "V", "JNJ", "WMT", "MA", "PG", "HD", "BAC",
      "XOM", "ABBV", "KO", "PFE", "AVGO", "COST", "MRK", "DIS",
      "CSCO", "ABT", "TMO", "ACN", "MCD", "DHR", "NKE", "LIN",
      "ORCL", "ADBE", "NEE", "WFC", "CRM", "TXN", "BMY", "RTX",
      "QCOM", "UPS", "PM", "HON", "COP", "INTC", "T", "NFLX",
      "AMGN", "INTU",
    ],
    topCompany: [
      "Apple Inc.", "Microsoft Corp.", "Alphabet Inc.", "Amazon.com",
      "NVIDIA Corp.", "Meta Platforms", "Tesla Inc.", "Berkshire Hathaway",
      "JPMorgan Chase", "Visa Inc.", "Johnson & Johnson", "Walmart Inc.",
      "Mastercard Inc.", "Procter & Gamble", "Home Depot", "Bank of America",
      "Exxon Mobil", "AbbVie Inc.", "Coca-Cola", "Pfizer Inc.",
      "Broadcom Inc.", "Costco Wholesale", "Merck & Co.", "Walt Disney",
      "Cisco Systems", "Abbott Labs", "Thermo Fisher", "Accenture plc",
      "McDonald's", "Danaher Corp.", "Nike Inc.", "Linde plc",
      "Oracle Corp.", "Adobe Inc.", "NextEra Energy", "Wells Fargo",
      "Salesforce", "Texas Instruments", "Bristol-Myers Squibb", "RTX Corp.",
      "Qualcomm Inc.", "United Parcel", "Philip Morris", "Honeywell",
      "ConocoPhillips", "Intel Corp.", "AT&T Inc.", "Netflix Inc.",
      "Amgen Inc.", "Intuit Inc.",
    ],
    sliderLabel: "min trade size ≥",
    sliderMax: 800,
    sliderUnit: "$",
    sliderUnitPos: "prefix",
    sumLabel: "notional",
    sumKind: "money",
    valueRange: 1000,
    valueScale: 1.0,
    keyEmoji: ["📊"],
    rowSize: "tall",
  },
  {
    id: "game",
    emoji: "🎮",
    title: "Game leaderboard",
    metaShort: "10 M events · 50 K players",
    desc: "10M PvP events from a 50K-player MMO. Drag to filter by minimum damage. Bars show top damage dealers.",
    n: 10_000_000,
    distinct: 50_000,
    topNames: [
      "DragonSlayer42", "ShadowMage_X", "PixelKnight", "VoidWalker",
      "FrostByte", "ThunderBolt", "PhantomBlade", "NightStalker99",
      "EmberFox", "StarWeaver", "IronFist_88", "MoonChaser",
      "CrimsonViper", "SilverHawk", "ObsidianWolf", "Stormcaller",
      "GhostRider_X1", "Bloodfang", "AzureMystic", "RuneSinger",
      "HollowKing", "RavenClaw", "BoneCrusher", "SoulReaper",
      "VortexHunter", "GildedSerpent", "EclipseShade", "TitanForge",
      "DuskWraith", "StoneFury", "WildSpark", "CinderHeart",
      "PaleRider", "SunChaser22", "DreadKnight", "GlacierMaw",
      "SkyrendKai", "CipherEdge", "WyvernLord", "PathfinderEli",
      "BlightCaster", "VeilStrider", "EmberWraith", "VoidLancer",
      "RoseFury", "BlackbirdAce", "Lichbane", "TideTurner",
      "SpellsmithKai", "ArcaneFox",
    ],
    topAvatar: [
      "🐲","🧙","⚔️","🌑","❄️","⚡","🗡️","👻",
      "🔥","✨","🥊","🌙","🐍","🦅","🐺","🌪️",
      "👤","🩸","💎","🎵","💀","🦅","💢","☠️",
      "🌀","🐉","🌒","🛡️","🌫️","🪨","✴️","❤️‍🔥",
      "🦴","☀️","🛡️","🧊","🦋","🔷","🐉","🏹",
      "☣️","🌿","🔥","🗡️","🌹","🪶","🧪","🌊",
      "📿","🦊",
    ],
    sliderLabel: "min damage ≥",
    sliderMax: 400,
    sliderUnit: "",
    sumLabel: "total dmg",
    sumKind: "num",
    valueRange: 500,
    valueScale: 1.0,
    keyEmoji: null, // use topAvatar
    rowSize: "tall",
  },
  {
    id: "shop",
    emoji: "🛒",
    title: "Product sales",
    metaShort: "10 M orders · 1 K SKUs",
    desc: "10M orders. Drag to filter by minimum order value. Bars show top revenue products.",
    n: 10_000_000,
    distinct: 1_000,
    topNames: [
      "iPhone 15 Pro", "MacBook Pro 14\"", "AirPods Pro", "iPad Air",
      "Apple Watch Series 9", "Samsung Galaxy S24", "Sony WH-1000XM5",
      "Dyson V15 Detect", "Kindle Paperwhite", "Nintendo Switch OLED",
      "PlayStation 5", "Xbox Series X", "LEGO Star Wars Set", "Instant Pot Duo",
      "Roomba i7+", "Bose QuietComfort", "DJI Mini 4 Pro", "GoPro Hero 12",
      "Theragun Pro", "Stanley Tumbler 40oz", "Patagonia Fleece", "Nike Air Max",
      "Adidas Ultraboost", "Lululemon Align Pant", "Allbirds Wool Runner",
      "Hydro Flask 32oz", "YETI Rambler", "Fjällräven Kånken", "AeroPress",
      "Vitamix A3500", "KitchenAid Stand Mixer", "Le Creuset Dutch Oven",
      "Apple Pencil 2", "Logitech MX Master 3", "Magic Mouse", "Studio Display",
      "AirTag 4-Pack", "HomePod Mini", "Echo Dot 5th Gen", "Ring Doorbell Pro",
      "Nest Thermostat", "Philips Hue Starter", "Tile Mate 4-Pack",
      "Anker PowerCore 26K", "Belkin BoostCharge", "OtterBox Defender",
      "Spigen Tough Armor", "Lightning Cable", "USB-C Hub", "Magic Keyboard",
    ],
    topEmoji: [
      "📱","💻","🎧","📱","⌚","📱","🎧",
      "🌪️","📚","🎮",
      "🎮","🎮","🧱","🍲",
      "🤖","🎧","🚁","📷",
      "💆","🥤","🧥","👟",
      "👟","👖","👟",
      "🧴","🥤","🎒","☕",
      "🥤","🍴","🍲",
      "✏️","🖱️","🖱️","🖥️",
      "📍","🔊","🔊","🚪",
      "🌡️","💡","📍",
      "🔌","🔋","📱",
      "🛡️","🔌","🔌","⌨️",
    ],
    sliderLabel: "min order value ≥",
    sliderMax: 800,
    sliderUnit: "$",
    sliderUnitPos: "prefix",
    sumLabel: "revenue",
    sumKind: "money",
    valueRange: 1500,
    valueScale: 1.0,
    keyEmoji: null,
    rowSize: "tall",
  },
];

// Generate scenario data with deterministic xorshift32. We give the
// "named" keys (the first topNames.length IDs) a 6× boost on the
// keying probability and a 1.4× boost on values, so the top-20
// leaderboard stays populated with real names regardless of where the
// slider sits. This is honest — it's the same kernel, the same data
// pipeline, the same WHERE — we're only choosing input data so the
// presentation doesn't become "u728400".
export function generateScenarioData(scn) {
  const n = scn.n;
  const keys = new Int32Array(n);
  const values = new Int32Array(n);
  const namedCount = scn.topNames.length;
  const distinct = scn.distinct;
  let x = 0x1234567 | 0;
  let y = 0x76543210 | 0;
  for (let i = 0; i < n; i++) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    y ^= y << 13; y ^= y >>> 17; y ^= y << 5;
    // 50% chance the key falls in the named slice (which is much
    // smaller than the full distinct space). That gives named keys a
    // huge boost while keeping cardinality high.
    let k;
    if ((x & 1) === 0 && namedCount > 0) {
      k = (x >>> 1) % namedCount;
    } else {
      k = (x >>> 1) % distinct;
    }
    keys[i] = k;
    let v = (y >>> 0) % scn.valueRange;
    // Small additional value-skew on named keys.
    if (k < namedCount) v = (v + (v >> 1)) | 0;
    if (v >= scn.valueRange) v = scn.valueRange - 1;
    values[i] = v;
  }
  return { keys, values };
}

export function labelFor(scn, key) {
  if (key < scn.topNames.length) return scn.topNames[key];
  return null; // signal "unnamed"
}

export function avatarFor(scn, key) {
  if (scn.topAvatar && key < scn.topAvatar.length) return scn.topAvatar[key];
  if (scn.topEmoji && key < scn.topEmoji.length) return scn.topEmoji[key];
  if (scn.keyEmoji && scn.keyEmoji.length > 0)
    return scn.keyEmoji[key % scn.keyEmoji.length];
  return "•";
}

export function sublabelFor(scn, key) {
  if (scn.id === "stocks" && scn.topCompany && key < scn.topCompany.length)
    return scn.topCompany[key];
  return null;
}
