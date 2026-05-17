import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const ECO_MONS = [
  { id: "pet", name: "PET-Dragon", material: "Plastica (PET)", bin: "GIALLO", color: "#fbbf24", description: "Bottiglie e flaconi in plastica trasparente." },
  { id: "paper", name: "Carta-Kong", material: "Carta", bin: "BLU", color: "#60a5fa", description: "Fogli, cartoncini e giornali puliti." },
  { id: "tetra", name: "Tetra-Fox", material: "Tetrapak", bin: "GIALLO", color: "#f59e0b", description: "Cartoni per bevande e succhi." },
  { id: "glass", name: "Vetro-Lumaca", material: "Vetro", bin: "VERDE", color: "#22c55e", description: "Bottiglie e vasetti in vetro." },
  { id: "organic", name: "Bio-Fungus", material: "Organico", bin: "MARRONE", color: "#a16207", description: "Scarti di cibo, bucce, fondi di caffè." },
  { id: "metal", name: "Alu-Rex", material: "Alluminio", bin: "GIALLO", color: "#94a3b8", description: "Lattine, scatolette e piccoli metalli." }
];

const MAX_DAILY_SCANS = 3;
const STORAGE_KEY = "ecomon-state";
const AI_MIN_CONFIDENCE = 0.4;
const CAMERA_CONSTRAINTS = [
  { video: { facingMode: { ideal: "environment" } } },
  { video: { facingMode: "environment" } },
  { video: true }
];

const AI_KEYWORDS = [
  { id: "pet", keywords: ["plastic bottle", "water bottle", "soda bottle", "pop bottle", "detergent bottle"] },
  { id: "paper", keywords: ["paper", "newspaper", "book", "notebook", "cardboard", "envelope", "carton box"] },
  { id: "tetra", keywords: ["milk carton", "juice carton", "tetra", "drink carton", "beverage carton"] },
  { id: "glass", keywords: ["glass bottle", "wine bottle", "beer bottle", "jar", "vase"] },
  { id: "organic", keywords: ["banana", "apple", "orange", "vegetable", "salad", "sandwich", "pizza", "mushroom"] },
  { id: "metal", keywords: ["soda can", "beer can", "tin can", "aluminum", "steel", "metal can"] }
];

function buildAiKeywordMaps() {
  const wordMap = new Map();
  const phraseList = [];

  AI_KEYWORDS.forEach((hint) => {
    hint.keywords.forEach((keyword) => {
      const normalized = keyword.toLowerCase();
      if (normalized.includes(" ")) {
        const escaped = normalized.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
        phraseList.push({ id: hint.id, regex: new RegExp(`\\b${escaped}\\b`) });
        return;
      }
      if (!wordMap.has(normalized)) {
        wordMap.set(normalized, new Set());
      }
      wordMap.get(normalized).add(hint.id);
    });
  });

  return { wordMap, phraseList };
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function createDefaultState() {
  return { lastDate: getToday(), todayScans: 0, todayCollected: [], unlocked: {} };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createDefaultState();

  try {
    const parsed = JSON.parse(raw);
    return {
      lastDate: parsed.lastDate || getToday(),
      todayScans: Number(parsed.todayScans) || 0,
      todayCollected: Array.isArray(parsed.todayCollected) ? parsed.todayCollected : [],
      unlocked: parsed.unlocked && typeof parsed.unlocked === "object" ? parsed.unlocked : {}
    };
  } catch {
    return createDefaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function App() {
  const { wordMap: AI_KEYWORD_WORDS, phraseList: AI_KEYWORD_PHRASES } = useMemo(buildAiKeywordMaps, []);

  const cameraFeedRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const fallbackInputRef = useRef(null);

  const [aiStatus, setAiStatus] = useState({ message: "AI pronta a iniziare. Attiva la fotocamera.", state: "" });
  const [confirmEnabled, setConfirmEnabled] = useState(false);
  const [resultText, setResultText] = useState("In attesa di analisi…");
  const [resultConfidence, setResultConfidence] = useState("Confidenza AI: —");
  const [resultBin, setResultBin] = useState("—");
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);

  const [state, setState] = useState(loadState);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMon, setModalMon] = useState(null);

  const currentRecognitionRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const aiModelRef = useRef(null);
  const aiModelPromiseRef = useRef(null);
  const selectedImageRef = useRef(null);
  const selectedImageUrlRef = useRef("");

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(showToast._timeout);
    showToast._timeout = window.setTimeout(() => setToast(""), 2400);
  }, []);
  // eslint-disable-next-line
  showToast._timeout = showToast._timeout || null;

  const updateOnlineStatus = useCallback(() => {
    setOnline(navigator.onLine);
  }, []);

  const resetIfNewDay = useCallback((prevState) => {
    const today = getToday();
    if (prevState.lastDate !== today) {
      const next = { ...prevState, lastDate: today, todayScans: 0, todayCollected: [] };
      saveState(next);
      return next;
    }
    return prevState;
  }, []);

  useEffect(() => {
    setState((prev) => resetIfNewDay(prev));
  }, [resetIfNewDay]);

  useEffect(() => {
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, [updateOnlineStatus]);

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (selectedImageUrlRef.current) {
        URL.revokeObjectURL(selectedImageUrlRef.current);
      }
    };
  }, []);

  const setAiStatusState = useCallback((message, stateClass = "") => {
    setAiStatus({ message, state: stateClass });
  }, []);

  const ensureAiModel = useCallback(() => {
    if (aiModelRef.current) return Promise.resolve(aiModelRef.current);
    if (!window.mobilenet || !window.tf) {
      setAiStatusState("AI non disponibile. Controlla la connessione.", "error");
      return Promise.reject(new Error("AI libraries missing"));
    }
    if (!aiModelPromiseRef.current) {
      setAiStatusState("Caricamento modello AI…", "loading");
      aiModelPromiseRef.current = window.mobilenet
        .load({ version: 2, alpha: 1.0 })
        .then((model) => {
          aiModelRef.current = model;
          setAiStatusState("AI pronta.", "ready");
          return model;
        })
        .catch((error) => {
          setAiStatusState("AI non disponibile. Riprova più tardi.", "error");
          throw error;
        });
    }
    return aiModelPromiseRef.current;
  }, [setAiStatusState]);

  const prepareAiModel = useCallback(() => {
    return ensureAiModel().catch(() => null);
  }, [ensureAiModel]);

  const getCaptureCanvas = useCallback(() => {
    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement("canvas");
    }
    return captureCanvasRef.current;
  }, []);

  const syncCanvasSize = useCallback(() => {
    const canvas = getCaptureCanvas();
    const video = cameraFeedRef.current;
    if (!video) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }, [getCaptureCanvas]);

  const stopCameraStream = useCallback(() => {
    if (!cameraStreamRef.current) return;
    cameraStreamRef.current.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
  }, []);

  const loadImageFromFile = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve({ image, objectUrl });
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Invalid image"));
      };
      image.src = objectUrl;
    });
  }, []);

  const resetSelectedImage = useCallback(() => {
    selectedImageRef.current = null;
    if (selectedImageUrlRef.current) {
      URL.revokeObjectURL(selectedImageUrlRef.current);
      selectedImageUrlRef.current = "";
    }
    if (cameraFeedRef.current) {
      cameraFeedRef.current.removeAttribute("poster");
    }
  }, []);

  const handleFallbackSelection = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const { image, objectUrl } = await loadImageFromFile(file);
      stopCameraStream();
      if (selectedImageUrlRef.current) {
        URL.revokeObjectURL(selectedImageUrlRef.current);
      }
      selectedImageRef.current = image;
      selectedImageUrlRef.current = objectUrl;

      const video = cameraFeedRef.current;
      if (video) {
        video.srcObject = null;
        video.removeAttribute("src");
        video.load();
        video.setAttribute("poster", objectUrl);
      }

      currentRecognitionRef.current = null;
      setConfirmEnabled(false);
      setResultText("In attesa di analisi…");
      setResultConfidence("Confidenza AI: —");
      setResultBin("—");
      showToast("Foto caricata. Premi Analizza.");
      prepareAiModel();
    } catch {
      showToast("Immagine non valida. Riprova.");
    }
  }, [loadImageFromFile, prepareAiModel, showToast, stopCameraStream]);

  const ensureFallbackInput = useCallback(() => {
    if (fallbackInputRef.current) return fallbackInputRef.current;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.style.display = "none";
    input.addEventListener("change", handleFallbackSelection);
    document.body.appendChild(input);
    fallbackInputRef.current = input;
    return input;
  }, [handleFallbackSelection]);

  const requestFallbackCapture = useCallback(() => {
    const input = ensureFallbackInput();
    input.click();
  }, [ensureFallbackInput]);

  const requestCameraStream = useCallback(async () => {
    let lastError = null;
    for (const constraints of CAMERA_CONSTRAINTS) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;
        if (error?.name === "NotAllowedError" || error?.name === "SecurityError") break;
      }
    }
    throw lastError || new Error("Camera unavailable");
  }, []);

  const getCameraErrorMessage = useCallback((error) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      if (!window.isSecureContext) {
        return "Fotocamera web non disponibile: usa HTTPS oppure scatta/carica una foto.";
      }
      return "Fotocamera web non disponibile: scatta/carica una foto.";
    }
    if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
      return "Accesso alla fotocamera negato. Puoi comunque scattare/caricare una foto.";
    }
    if (error?.name === "NotFoundError" || error?.name === "OverconstrainedError") {
      return "Nessuna camera posteriore disponibile. Usa scatta/carica foto.";
    }
    if (error?.name === "NotReadableError") {
      return "Fotocamera occupata da un’altra app. Usa scatta/carica foto.";
    }
    return "Impossibile avviare la fotocamera. Usa scatta/carica foto.";
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(getCameraErrorMessage(null));
      requestFallbackCapture();
      return;
    }
    try {
      const stream = await requestCameraStream();
      stopCameraStream();
      resetSelectedImage();

      cameraStreamRef.current = stream;
      const video = cameraFeedRef.current;
      if (video) {
        video.srcObject = stream;
        video.addEventListener("loadedmetadata", syncCanvasSize, { once: true });
        video.play().catch(() => {});
      }

      currentRecognitionRef.current = null;
      setConfirmEnabled(false);
      setResultText("In attesa di analisi…");
      setResultConfidence("Confidenza AI: —");
      setResultBin("—");
      showToast("Fotocamera attiva. Inquadra il rifiuto!");
      prepareAiModel();
    } catch (error) {
      showToast(getCameraErrorMessage(error));
      requestFallbackCapture();
    }
  }, [getCameraErrorMessage, prepareAiModel, requestCameraStream, requestFallbackCapture, resetSelectedImage, showToast, stopCameraStream, syncCanvasSize]);

  const mapPredictionsToEcoMon = useCallback((predictions) => {
    const scores = new Map();

    predictions.forEach((prediction) => {
      const label = prediction.className.toLowerCase();
      const words = label.split(/[^a-zà-ÿ0-9]+/).filter(Boolean);

      words.forEach((word) => {
        const ids = AI_KEYWORD_WORDS.get(word);
        if (!ids) return;
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

    if (!scores.size) return null;

    let bestId = null;
    let bestScore = 0;
    scores.forEach((score, id) => {
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    });

    if (!bestId || bestScore < AI_MIN_CONFIDENCE) return null;

    const mon = ECO_MONS.find((item) => item.id === bestId);
    if (!mon) return null;

    return { mon, confidence: Math.round(bestScore * 100) };
  }, [AI_KEYWORD_PHRASES, AI_KEYWORD_WORDS]);

  const recognizeWaste = useCallback(async () => {
    setState((prev) => resetIfNewDay(prev));

    if (!cameraStreamRef.current && !selectedImageRef.current) {
      showToast("Attiva la fotocamera o scatta/carica una foto prima di analizzare.");
      return;
    }

    const video = cameraFeedRef.current;
    if (cameraStreamRef.current && (video?.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video?.videoWidth)) {
      showToast("La fotocamera non è ancora pronta. Riprova tra poco.");
      return;
    }

    currentRecognitionRef.current = null;
    setConfirmEnabled(false);
    setResultText("Analisi in corso…");
    setResultConfidence("Confidenza AI: —");
    setResultBin("—");

    let model;
    try {
      model = await ensureAiModel();
    } catch {
      showToast("Modello AI non disponibile.");
      return;
    }

    const canvas = getCaptureCanvas();
    if (cameraStreamRef.current) {
      syncCanvasSize();
    } else {
      canvas.width = selectedImageRef.current.naturalWidth;
      canvas.height = selectedImageRef.current.naturalHeight;
    }
    if (!canvas.width || !canvas.height) {
      showToast("La fotocamera non è ancora pronta. Riprova tra poco.");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (cameraStreamRef.current) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(selectedImageRef.current, 0, 0, canvas.width, canvas.height);
    }

    let predictions = [];
    try {
      predictions = await model.classify(canvas, 5);
    } catch {
      showToast("Errore durante il riconoscimento.");
      return;
    }

    const match = mapPredictionsToEcoMon(predictions);
    if (!match) {
      currentRecognitionRef.current = null;
      setConfirmEnabled(false);
      setResultText("Nessun rifiuto riconosciuto.");
      setResultConfidence("Confidenza AI: bassa");
      setResultBin("—");
      showToast("L’AI non ha riconosciuto il materiale.");
      return;
    }

    currentRecognitionRef.current = match.mon;
    setConfirmEnabled(true);
    setResultText(`${match.mon.material} · ${match.mon.name}`);
    setResultConfidence(`Confidenza AI: ${match.confidence}%`);
    setResultBin(`Bidone ${match.mon.bin}`);
    showToast(`Rilevato: ${match.mon.material}.`);
  }, [ensureAiModel, getCaptureCanvas, mapPredictionsToEcoMon, resetIfNewDay, showToast, syncCanvasSize]);

  const confirmDeposit = useCallback(() => {
    setState((prev) => {
      const next = resetIfNewDay(prev);
      const current = currentRecognitionRef.current;

      if (!current) {
        showToast("Nessun rifiuto riconosciuto. Premi Analizza.");
        return next;
      }
      if (next.todayScans >= MAX_DAILY_SCANS) {
        showToast("Limite giornaliero raggiunto. Torna domani!");
        return next;
      }
      if (next.todayCollected.includes(current.id)) {
        showToast("Hai già salvato questo Eco-Mon oggi! Cerca altri materiali.");
        return next;
      }

      const updated = {
        ...next,
        todayScans: next.todayScans + 1,
        todayCollected: [...next.todayCollected, current.id],
        unlocked: { ...next.unlocked, [current.id]: true }
      };
      saveState(updated);

      currentRecognitionRef.current = null;
      setConfirmEnabled(false);
      setModalMon(current);
      setModalOpen(true);
      return updated;
    });
  }, [resetIfNewDay, showToast]);

  const unlockedCount = Object.values(state.unlocked).filter(Boolean).length;
  const progressPercent = Math.min(100, (unlockedCount / ECO_MONS.length) * 100);

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">PWA · Edge AI · Gamification</p>
          <h1>EcoMon: Throw Them All!</h1>
          <p>
            Scansiona un rifiuto, scopri il bidone giusto e colleziona il tuo Eco-Mon. Ogni gesto corretto
            salva il pianeta e sblocca nuovi mostriciattoli.
          </p>
        </div>
        <div className="status" id="onlineStatus" style={{ color: online ? "#22c55e" : "#f87171" }}>
          {online ? "Online" : "Offline"}
        </div>
      </header>

      <main>
        <section className="card scanner">
          <div className="card-header">
            <div>
              <h2>Scanner EcoMon</h2>
              <p>Inquadra il rifiuto, premi “Analizza” per il riconoscimento AI e poi “Fatto!”.</p>
            </div>
            <div className="limit" id="dailyLimit">Scansioni di oggi: {state.todayScans}/{MAX_DAILY_SCANS}</div>
          </div>

          <div className="scanner-grid">
            <div className="camera">
              <video ref={cameraFeedRef} id="cameraFeed" autoPlay muted playsInline></video>
              <div className="camera-overlay">
                <span>Fotocamera pronta</span>
              </div>
            </div>
            <div className="controls">
              <button className="primary" id="startCamera" onClick={startCamera}>Attiva fotocamera</button>
              <div className={`ai-status ${aiStatus.state}`} id="aiStatus">{aiStatus.message}</div>
              <button className="secondary" id="analyzeBtn" onClick={recognizeWaste}>Analizza</button>
              <button className="primary" id="confirmBtn" onClick={confirmDeposit} disabled={!confirmEnabled}>Fatto!</button>
              <p className="hint">Suggerimento: illumina bene l’oggetto per aiutare il riconoscimento.</p>
            </div>
          </div>

          <div className="result" id="scanResult">
            <span className="label">Rilevato:</span>
            <strong id="resultText">{resultText}</strong>
            <span className="confidence" id="resultConfidence">{resultConfidence}</span>
            <span className="bin" id="resultBin">{resultBin}</span>
          </div>
        </section>

        <section className="card">
          <h2>Anti-cheat &amp; progressi</h2>
          <ul className="rules">
            <li>Massimo 3 rifiuti scannerizzabili al giorno.</li>
            <li>Lo stesso materiale non vale due volte nella stessa giornata.</li>
            <li>I tuoi Eco-Mon restano nel Pokedex per sempre.</li>
          </ul>
          <div className="progress">
            <div className="progress-bar" id="progressBar" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </section>

        <section className="card">
          <h2>Pokedex Eco-Mon</h2>
          <p>Completa la collezione salvando più materiali possibili.</p>
          <div className="pokedex" id="pokedexGrid">
            {ECO_MONS.map((mon) => {
              const isUnlocked = Boolean(state.unlocked[mon.id]);
              return (
                <div
                  key={mon.id}
                  className={`pokedex-card ${isUnlocked ? "" : "locked"}`}
                  style={{
                    borderColor: isUnlocked ? `${mon.color}55` : "rgba(148, 163, 184, 0.2)",
                    background: isUnlocked
                      ? `linear-gradient(135deg, ${mon.color}22, rgba(15, 23, 42, 0.95))`
                      : "rgba(15, 23, 42, 0.9)"
                  }}
                >
                  <strong>{isUnlocked ? mon.name : "???"}</strong>
                  <span className="badge">{mon.material}</span>
                  <p>{isUnlocked ? mon.description : "Sblocca questo Eco-Mon con una scansione."}</p>
                  <span className="badge">Bidone {mon.bin}</span>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <div className={`toast ${toast ? "show" : ""}`} id="toast">{toast}</div>

      <div className="modal" id="cardModal" aria-hidden={!modalOpen} onClick={(e) => {
        if (e.target.id === "cardModal") setModalOpen(false);
      }}>
        <div className="modal-content">
          <button className="close" id="closeModal" aria-label="Chiudi" onClick={() => setModalOpen(false)}>×</button>
          <div className="modal-card" id="modalCard">
            {modalMon && (
              <>
                <h3>{modalMon.name}</h3>
                <p>{modalMon.description}</p>
                <span className="badge">Materiale: {modalMon.material}</span>
                <span className="badge">Bidone: {modalMon.bin}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;