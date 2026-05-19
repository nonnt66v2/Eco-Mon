export const ECO_MONS = [
  { id: "pet", name: "PET-Dragon", material: "Plastica (PET)", bin: "GIALLO", color: "#fbbf24", description: "Bottiglie e flaconi in plastica trasparente." },
  { id: "paper", name: "Carta-Kong", material: "Carta", bin: "BLU", color: "#60a5fa", description: "Fogli, cartoncini e giornali puliti." },
  { id: "tetra", name: "Tetra-Fox", material: "Tetrapak", bin: "GIALLO", color: "#f59e0b", description: "Cartoni per bevande e succhi." },
  { id: "glass", name: "Vetro-Lumaca", material: "Vetro", bin: "VERDE", color: "#22c55e", description: "Bottiglie e vasetti in vetro." },
  { id: "organic", name: "Bio-Fungus", material: "Organico", bin: "MARRONE", color: "#a16207", description: "Scarti di cibo, bucce, fondi di caffè." },
  { id: "metal", name: "Alu-Rex", material: "Alluminio", bin: "GIALLO", color: "#94a3b8", description: "Lattine, scatolette e piccoli metalli." }
];

export const MAX_DAILY_SCANS = 100;
export const STORAGE_KEY = "ecomon-state";
export const AI_MIN_CONFIDENCE = 0.4;
export const AUTO_SCAN_INTERVAL_MS = 1000;
export const NO_DETECTION_RESET_MS = 10000;

export const CAMERA_CONSTRAINTS = [
  { video: { facingMode: { ideal: "environment" } } },
  { video: { facingMode: "environment" } },
  { video: true }
];

export const AI_KEYWORDS = [
  { id: "pet", keywords: ["plastic bottle", "water bottle", "soda bottle", "pop bottle", "detergent bottle"] },
  { id: "paper", keywords: ["paper", "newspaper", "book", "notebook", "cardboard", "envelope", "carton box"] },
  { id: "tetra", keywords: ["milk carton", "juice carton", "tetra", "drink carton", "beverage carton"] },
  { id: "glass", keywords: ["glass bottle", "wine bottle", "beer bottle", "jar", "vase"] },
  { id: "organic", keywords: ["banana", "apple", "orange", "vegetable", "salad", "sandwich", "pizza", "mushroom"] },
  { id: "metal", keywords: ["soda can", "beer can", "tin can", "aluminum", "steel", "metal can"] }
];
