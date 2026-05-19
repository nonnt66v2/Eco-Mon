import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../style/App.css';
import HomeSection from './components/HomeSection';
import ScannerSection from './components/ScannerSection';
import PokedexSection from './components/PokedexSection';
import BottomNav from './components/BottomNav';
import ToastMessage from './components/ToastMessage';
import RewardModal from './components/RewardModal';
import {
  AI_MIN_CONFIDENCE,
  AUTO_SCAN_INTERVAL_MS,
  CAMERA_CONSTRAINTS,
  ECO_MONS,
  MAX_DAILY_SCANS,
  NO_DETECTION_RESET_MS,
  STORAGE_KEY
} from './components/ecomonData';
import {
  buildAiKeywordMaps,
  createDefaultState,
  getToday,
  loadState,
  saveState
} from './components/stateUtils';

function App() {
  const { wordMap: AI_KEYWORD_WORDS, phraseList: AI_KEYWORD_PHRASES } = useMemo(buildAiKeywordMaps, []);
  const sectionOrder = useMemo(() => ["home", "scan", "dex"], []);

  const cameraFeedRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const fallbackInputRef = useRef(null);
  const carouselRef = useRef(null);
  const sectionRefs = useRef({});

  const [aiStatus, setAiStatus] = useState({ message: "AI pronta a iniziare. Attiva la fotocamera.", state: "" });
  const [confirmEnabled, setConfirmEnabled] = useState(false);
  const [resultText, setResultText] = useState("In attesa di analisi…");
  const [resultConfidence, setResultConfidence] = useState("Confidenza AI: —");
  const [resultBin, setResultBin] = useState("—");
  const [cameraActive, setCameraActive] = useState(false);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);

  const [state, setState] = useState(loadState);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMon, setModalMon] = useState(null);
  const [activeSection, setActiveSection] = useState("home");

  const currentRecognitionRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const aiModelRef = useRef(null);
  const aiModelPromiseRef = useRef(null);
  const selectedImageRef = useRef(null);
  const selectedImageUrlRef = useRef("");
  const recognitionInProgressRef = useRef(false);
  const lastDetectionAtRef = useRef(0);

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

  useEffect(() => {
    const root = carouselRef.current;
    if (!root) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleEntry?.target?.dataset?.section) {
          setActiveSection(visibleEntry.target.dataset.section);
        }
      },
      { root, threshold: [0.45, 0.6, 0.8] }
    );

    sectionOrder.forEach((sectionId) => {
      const element = sectionRefs.current[sectionId];
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [sectionOrder]);

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
      setCameraActive(false);
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
      lastDetectionAtRef.current = 0;
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
      setCameraActive(true);
      const video = cameraFeedRef.current;
      if (video) {
        video.srcObject = stream;
        video.addEventListener("loadedmetadata", syncCanvasSize, { once: true });
        video.play().catch(() => {});
      }

      currentRecognitionRef.current = null;
      lastDetectionAtRef.current = 0;
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

  const recognizeWaste = useCallback(async (fromAutoScan = false) => {
    if (recognitionInProgressRef.current) return;
    recognitionInProgressRef.current = true;

    try {
      setState((prev) => resetIfNewDay(prev));

      if (!cameraStreamRef.current && !selectedImageRef.current) {
        if (!fromAutoScan) showToast("Attiva la fotocamera o scatta/carica una foto prima di analizzare.");
        return;
      }

      const video = cameraFeedRef.current;
      if (cameraStreamRef.current && (video?.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video?.videoWidth)) {
        if (!fromAutoScan) showToast("La fotocamera non è ancora pronta. Riprova tra poco.");
        return;
      }

      if (!fromAutoScan) {
        setResultText("Analisi in corso…");
      }

      const previousRecognition = currentRecognitionRef.current;
      const previousTypeId = previousRecognition?.id ?? null;

      let model;
      try {
        model = await ensureAiModel();
      } catch {
        if (!fromAutoScan) showToast("Modello AI non disponibile.");
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
        if (!fromAutoScan) showToast("La fotocamera non è ancora pronta. Riprova tra poco.");
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
        if (!fromAutoScan) showToast("Errore durante il riconoscimento.");
        return;
      }

      const match = mapPredictionsToEcoMon(predictions);
      if (!match) {
        if (previousTypeId !== null) {
          const now = Date.now();
          const elapsed = now - lastDetectionAtRef.current;
          if (elapsed < NO_DETECTION_RESET_MS) return;

          currentRecognitionRef.current = null;
          lastDetectionAtRef.current = 0;
          setConfirmEnabled(false);
          setResultText("Nessun rifiuto riconosciuto.");
          setResultConfidence("Confidenza AI: bassa");
          setResultBin("—");
          if (!fromAutoScan) showToast("L’AI non ha riconosciuto il materiale.");
          return;
        }

        setConfirmEnabled(false);
        setResultText("Nessun rifiuto riconosciuto.");
        setResultConfidence("Confidenza AI: bassa");
        setResultBin("—");
        if (!fromAutoScan) showToast("L’AI non ha riconosciuto il materiale.");
        return;
      }

      const nextTypeId = match.mon.id;
      if (previousTypeId === nextTypeId) return;

      lastDetectionAtRef.current = Date.now();
      currentRecognitionRef.current = match.mon;
      setConfirmEnabled(true);
      setResultText(`${match.mon.material} · ${match.mon.name}`);
      setResultConfidence(`Confidenza AI: ${match.confidence}%`);
      setResultBin(`Bidone ${match.mon.bin}`);
      showToast(`Rilevato: ${match.mon.material}.`);
    } finally {
      recognitionInProgressRef.current = false;
    }
  }, [ensureAiModel, getCaptureCanvas, mapPredictionsToEcoMon, resetIfNewDay, showToast, syncCanvasSize]);

  useEffect(() => {
    if (!cameraActive) return undefined;

    const runAutoScan = () => {
      void recognizeWaste(true);
    };

    runAutoScan();
    const intervalId = window.setInterval(runAutoScan, AUTO_SCAN_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [cameraActive, recognizeWaste]);

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

  const scrollToSection = useCallback((sectionId) => {
    const section = sectionRefs.current[sectionId];
    if (!section) return;
    setActiveSection(sectionId);
    section.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, []);

  const resetDebugData = useCallback(() => {
    const video = cameraFeedRef.current;
    stopCameraStream();
    setCameraActive(false);
    resetSelectedImage();
    if (video) {
      video.srcObject = null;
      video.removeAttribute("src");
      video.load();
    }

    const freshState = createDefaultState();
    localStorage.removeItem(STORAGE_KEY);
    saveState(freshState);

    setState(freshState);
    currentRecognitionRef.current = null;
    lastDetectionAtRef.current = 0;
    setConfirmEnabled(false);
    setResultText("In attesa di analisi…");
    setResultConfidence("Confidenza AI: —");
    setResultBin("—");
    setModalOpen(false);
    setModalMon(null);
    showToast("Dati locali azzerati (debug).");
    scrollToSection("home");
  }, [resetSelectedImage, scrollToSection, showToast, stopCameraStream]);

  const unlockedCount = Object.values(state.unlocked).filter(Boolean).length;
  const progressPercent = Math.min(100, (unlockedCount / ECO_MONS.length) * 100);

  return (
    <>
      <div className="app-shell">
        <div className="carousel" ref={carouselRef} aria-label="Sezioni EcoMon">
          <HomeSection
            online={online}
            progressPercent={progressPercent}
            maxDailyScans={MAX_DAILY_SCANS}
            todayScans={state.todayScans}
            sectionRef={(element) => { sectionRefs.current.home = element; }}
          />

          <ScannerSection
            sectionRef={(element) => { sectionRefs.current.scan = element; }}
            cameraFeedRef={cameraFeedRef}
            startCamera={startCamera}
            aiStatus={aiStatus}
            confirmDeposit={confirmDeposit}
            confirmEnabled={confirmEnabled}
            resetDebugData={resetDebugData}
            resultText={resultText}
            resultConfidence={resultConfidence}
            resultBin={resultBin}
          />

          <PokedexSection
            sectionRef={(element) => { sectionRefs.current.dex = element; }}
            ecoMons={ECO_MONS}
            unlocked={state.unlocked}
          />
        </div>

        <BottomNav activeSection={activeSection} onNavigate={scrollToSection} />
      </div>

      <ToastMessage toast={toast} />

      <RewardModal
        modalOpen={modalOpen}
        modalMon={modalMon}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

export default App;
