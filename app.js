const ECO_MONS = [
  {
    id: "pet",
    name: "PET-Dragon",
    material: "Plastica (PET)",
    bin: "GIALLO",
    color: "#fbbf24",
    description: "Bottiglie e flaconi in plastica trasparente."
  },
  {
    id: "paper",
    name: "Carta-Kong",
    material: "Carta",
    bin: "BLU",
    color: "#60a5fa",
    description: "Fogli, cartoncini e giornali puliti."
  },
  {
    id: "tetra",
    name: "Tetra-Fox",
    material: "Tetrapak",
    bin: "GIALLO",
    color: "#f59e0b",
    description: "Cartoni per bevande e succhi."
  },
  {
    id: "glass",
    name: "Vetro-Lumaca",
    material: "Vetro",
    bin: "VERDE",
    color: "#22c55e",
    description: "Bottiglie e vasetti in vetro."
  },
  {
    id: "organic",
    name: "Bio-Fungus",
    material: "Organico",
    bin: "MARRONE",
    color: "#a16207",
    description: "Scarti di cibo, bucce, fondi di caffè."
  },
  {
    id: "metal",
    name: "Alu-Rex",
    material: "Alluminio",
    bin: "GIALLO",
    color: "#94a3b8",
    description: "Lattine, scatolette e piccoli metalli."
  }
];

const MAX_DAILY_SCANS = 3;
const STORAGE_KEY = "ecomon-state";
const AI_MIN_CONFIDENCE = 0.4;
const AI_KEYWORDS = [
  {
    id: "pet",
    keywords: ["plastic bottle", "water bottle", "soda bottle", "pop bottle", "detergent bottle"]
  },
  {
    id: "paper",
    keywords: ["paper", "newspaper", "book", "notebook", "cardboard", "envelope", "carton box"]
  },
  {
    id: "tetra",
    keywords: ["milk carton", "juice carton", "tetra", "drink carton", "beverage carton"]
  },
  {
    id: "glass",
    keywords: ["glass bottle", "wine bottle", "beer bottle", "jar", "vase"]
  },
  {
    id: "organic",
    keywords: ["banana", "apple", "orange", "vegetable", "salad", "sandwich", "pizza", "mushroom"]
  },
  {
    id: "metal",
    keywords: ["soda can", "beer can", "tin can", "aluminum", "steel", "metal can"]
  }
];
const AI_KEYWORD_WORDS = new Map();
const AI_KEYWORD_PHRASES = [];

AI_KEYWORDS.forEach((hint) => {
  hint.keywords.forEach((keyword) => {
    const normalized = keyword.toLowerCase();
    if (normalized.includes(" ")) {
      const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      AI_KEYWORD_PHRASES.push({ id: hint.id, regex: new RegExp(`\\b${escaped}\\b`) });
      return;
    }

    if (!AI_KEYWORD_WORDS.has(normalized)) {
      AI_KEYWORD_WORDS.set(normalized, new Set());
    }
    AI_KEYWORD_WORDS.get(normalized).add(hint.id);
  });
});

const elements = {
  status: document.getElementById("onlineStatus"),
  cameraFeed: document.getElementById("cameraFeed"),
  startCamera: document.getElementById("startCamera"),
  aiStatus: document.getElementById("aiStatus"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  confirmBtn: document.getElementById("confirmBtn"),
  resultText: document.getElementById("resultText"),
  resultConfidence: document.getElementById("resultConfidence"),
  resultBin: document.getElementById("resultBin"),
  dailyLimit: document.getElementById("dailyLimit"),
  pokedex: document.getElementById("pokedexGrid"),
  progressBar: document.getElementById("progressBar"),
  toast: document.getElementById("toast"),
  modal: document.getElementById("cardModal"),
  modalCard: document.getElementById("modalCard"),
  closeModal: document.getElementById("closeModal")
};

let currentRecognition = null;
let cameraStream = null;
let aiModel = null;
let aiModelPromise = null;
let captureCanvas = null;

const state = loadState();
resetIfNewDay();

bootstrap();

function bootstrap() {
  registerServiceWorker();
  renderPokedex();
  updateDailyLimit();
  updateProgress();
  updateOnlineStatus();
  setAiStatus("AI pronta a iniziare. Attiva la fotocamera.");

  elements.startCamera.addEventListener("click", startCamera);
  elements.analyzeBtn.addEventListener("click", recognizeWaste);
  elements.confirmBtn.addEventListener("click", confirmDeposit);
  elements.closeModal.addEventListener("click", closeModal);
  elements.modal.addEventListener("click", (event) => {
    if (event.target === elements.modal) {
      closeModal();
    }
  });

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      showToast("Service worker non disponibile.");
    });
  }
}

function setAiStatus(message, state) {
  elements.aiStatus.textContent = message;
  elements.aiStatus.classList.remove("ready", "loading", "error");
  if (state) {
    elements.aiStatus.classList.add(state);
  }
}

function ensureAiModel() {
  if (aiModel) {
    return Promise.resolve(aiModel);
  }

  if (!window.mobilenet || !window.tf) {
    setAiStatus("AI non disponibile. Controlla la connessione.", "error");
    return Promise.reject(new Error("AI libraries missing"));
  }

  if (!aiModelPromise) {
    setAiStatus("Caricamento modello AI…", "loading");
    aiModelPromise = window.mobilenet
      .load({ version: 2, alpha: 1.0 })
      .then((model) => {
        aiModel = model;
        setAiStatus("AI pronta.", "ready");
        return model;
      })
      .catch((error) => {
        setAiStatus("AI non disponibile. Riprova più tardi.", "error");
        throw error;
      });
  }

  return aiModelPromise;
}

function prepareAiModel() {
  return ensureAiModel().catch(() => null);
}

function getCaptureCanvas() {
  if (!captureCanvas) {
    captureCanvas = document.createElement("canvas");
  }
  return captureCanvas;
}

function syncCanvasSize() {
  const canvas = getCaptureCanvas();
  const width = elements.cameraFeed.videoWidth;
  const height = elements.cameraFeed.videoHeight;
  if (!width || !height) {
    return;
  }
  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }
}

function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("La fotocamera non è supportata su questo dispositivo.");
    return;
  }

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" } })
    .then((stream) => {
      cameraStream = stream;
      elements.cameraFeed.srcObject = stream;
      elements.cameraFeed.addEventListener("loadedmetadata", syncCanvasSize, { once: true });
      showToast("Fotocamera attiva. Inquadra il rifiuto!");
      prepareAiModel();
    })
    .catch(() => {
      showToast("Accesso alla fotocamera negato.");
    });
}

async function recognizeWaste() {
  resetIfNewDay();
  if (!cameraStream) {
    showToast("Attiva la fotocamera prima di analizzare.");
    return;
  }

  if (
    elements.cameraFeed.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    !elements.cameraFeed.videoWidth
  ) {
    showToast("La fotocamera non è ancora pronta. Riprova tra poco.");
    return;
  }

  elements.resultText.textContent = "Analisi in corso…";
  elements.resultConfidence.textContent = "Confidenza AI: —";
  elements.resultBin.textContent = "—";

  let model;
  try {
    model = await ensureAiModel();
  } catch (error) {
    showToast("Modello AI non disponibile.");
    return;
  }

  const canvas = getCaptureCanvas();
  syncCanvasSize();
  if (!canvas.width || !canvas.height) {
    showToast("La fotocamera non è ancora pronta. Riprova tra poco.");
    return;
  }
  const ctx = canvas.getContext("2d");
  ctx.drawImage(elements.cameraFeed, 0, 0, canvas.width, canvas.height);

  let predictions = [];
  try {
    predictions = await model.classify(canvas, 5);
  } catch (error) {
    showToast("Errore durante il riconoscimento.");
    return;
  }
  const match = mapPredictionsToEcoMon(predictions);

  if (!match) {
    currentRecognition = null;
    elements.resultText.textContent = "Nessun rifiuto riconosciuto.";
    elements.resultConfidence.textContent = "Confidenza AI: bassa";
    elements.resultBin.textContent = "—";
    showToast("L’AI non ha riconosciuto il materiale.");
    return;
  }

  currentRecognition = match.mon;
  elements.resultText.textContent = `${match.mon.material} · ${match.mon.name}`;
  elements.resultConfidence.textContent = `Confidenza AI: ${match.confidence}%`;
  elements.resultBin.textContent = `Bidone ${match.mon.bin}`;
  showToast(`Rilevato: ${match.mon.material}.`);
}

function mapPredictionsToEcoMon(predictions) {
  const scores = new Map();
  predictions.forEach((prediction) => {
    const label = prediction.className.toLowerCase();
    const words = label.split(/[^a-zà-ÿ0-9]+/i).filter(Boolean);
    words.forEach((word) => {
      const ids = AI_KEYWORD_WORDS.get(word);
      if (!ids) {
        return;
      }
      ids.forEach((id) => {
        const current = scores.get(id) || 0;
        scores.set(id, Math.max(current, prediction.probability));
      });
    });

    AI_KEYWORD_PHRASES.forEach((entry) => {
      if (entry.regex.test(label)) {
        const current = scores.get(entry.id) || 0;
        scores.set(entry.id, Math.max(current, prediction.probability));
      }
    });
  });

  if (!scores.size) {
    return null;
  }

  let bestId = null;
  let bestScore = 0;
  scores.forEach((score, id) => {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  });

  if (!bestId || bestScore < AI_MIN_CONFIDENCE) {
    return null;
  }

  const mon = ECO_MONS.find((item) => item.id === bestId);
  if (!mon) {
    return null;
  }

  return { mon, confidence: Math.round(bestScore * 100) };
}

function confirmDeposit() {
  resetIfNewDay();
  if (!currentRecognition) {
    showToast("Nessun rifiuto riconosciuto. Premi Analizza.");
    return;
  }

  if (state.todayScans >= MAX_DAILY_SCANS) {
    showToast("Limite giornaliero raggiunto. Torna domani!");
    return;
  }

  if (state.todayCollected.includes(currentRecognition.id)) {
    showToast("Hai già salvato questo Eco-Mon oggi! Cerca altri materiali.");
    return;
  }

  state.todayScans += 1;
  state.todayCollected.push(currentRecognition.id);
  state.unlocked[currentRecognition.id] = true;
  saveState();

  renderPokedex();
  updateDailyLimit();
  updateProgress();
  launchConfetti();
  openModal(currentRecognition);
}

function renderPokedex() {
  elements.pokedex.innerHTML = "";
  ECO_MONS.forEach((mon) => {
    const card = document.createElement("div");
    const isUnlocked = Boolean(state.unlocked[mon.id]);
    card.className = `pokedex-card ${isUnlocked ? "" : "locked"}`;

    card.innerHTML = `
      <strong>${isUnlocked ? mon.name : "???"}</strong>
      <span class="badge">${mon.material}</span>
      <p>${isUnlocked ? mon.description : "Sblocca questo Eco-Mon con una scansione."}</p>
      <span class="badge">Bidone ${mon.bin}</span>
    `;

    card.style.borderColor = isUnlocked ? `${mon.color}55` : "rgba(148, 163, 184, 0.2)";
    card.style.background = isUnlocked
      ? `linear-gradient(135deg, ${mon.color}22, rgba(15, 23, 42, 0.95))`
      : "rgba(15, 23, 42, 0.9)";

    elements.pokedex.appendChild(card);
  });
}

function updateDailyLimit() {
  elements.dailyLimit.textContent = `Scansioni di oggi: ${state.todayScans}/${MAX_DAILY_SCANS}`;
}

function updateProgress() {
  const unlockedCount = Object.values(state.unlocked).filter(Boolean).length;
  const percentage = Math.min(100, (unlockedCount / ECO_MONS.length) * 100);
  elements.progressBar.style.width = `${percentage}%`;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createDefaultState();
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      lastDate: parsed.lastDate || getToday(),
      todayScans: Number(parsed.todayScans) || 0,
      todayCollected: Array.isArray(parsed.todayCollected) ? parsed.todayCollected : [],
      unlocked: parsed.unlocked && typeof parsed.unlocked === "object" ? parsed.unlocked : {}
    };
  } catch (error) {
    return createDefaultState();
  }
}

function createDefaultState() {
  return {
    lastDate: getToday(),
    todayScans: 0,
    todayCollected: [],
    unlocked: {}
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetIfNewDay() {
  const today = getToday();
  if (state.lastDate !== today) {
    state.lastDate = today;
    state.todayScans = 0;
    state.todayCollected = [];
    saveState();
  }
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(elements.toast.dataset.timeout);

  const timeout = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2400);

  elements.toast.dataset.timeout = timeout;
}

function launchConfetti() {
  const colors = ["#22c55e", "#f97316", "#38bdf8", "#facc15", "#f472b6"];
  for (let i = 0; i < 32; i += 1) {
    const piece = document.createElement("div");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.2}s`;
    piece.style.transform = `translateY(-20px) rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(piece);

    piece.addEventListener("animationend", () => {
      piece.remove();
    });
  }
}

function openModal(mon) {
  elements.modalCard.innerHTML = `
    <h3>${mon.name}</h3>
    <p>${mon.description}</p>
    <span class="badge">Materiale: ${mon.material}</span>
    <span class="badge">Bidone: ${mon.bin}</span>
  `;
  elements.modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  elements.modal.setAttribute("aria-hidden", "true");
}

function updateOnlineStatus() {
  const isOnline = navigator.onLine;
  elements.status.textContent = isOnline ? "Online" : "Offline";
  elements.status.style.color = isOnline ? "#22c55e" : "#f87171";
}

window.addEventListener("beforeunload", () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
  }
});
