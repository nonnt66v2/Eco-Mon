import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../style/App.css';
import HomeSection from './components/sections/HomeSection';
import ScannerSection from './components/sections/ScannerSection';
import PokedexSection from './components/sections/PokedexSection';
import BottomNav from './components/navigation/BottomNav';
import ToastMessage from './components/feedback/ToastMessage';
import RewardModal from './components/feedback/RewardModal';
import {
  buildAiKeywordMaps,
  createDefaultState
} from './utils/stateUtils';
import {
  confirmScan,
  fetchConfig,
  fetchCatalog,
  fetchGameState,
  resetGameState
} from './utils/backendApi';

const DEFAULT_RUNTIME_CONFIG = {
  storageKey: 'ecomon-state',
  aiMinConfidence: 0.4,
  autoScanIntervalMs: 1000,
  noDetectionResetMs: 10000,
  cameraConstraints: [
    { video: { facingMode: { ideal: 'environment' } } },
    { video: { facingMode: 'environment' } },
    { video: true }
  ]
};

const DEFAULT_CATALOG = { ecoMons: [], aiKeywords: [], maxDailyScans: 3 };
const DEEPLAB_BASE = "pascal";
const DEEPLAB_QUANTIZATION_BYTES = 2;
const BACKGROUND_DIM_FACTOR = 0.2;
const BACKGROUND_LABEL_PATTERN = /(?:^|\b)(background|bg)(?:\b|$)/i;

function App() {
  const [runtimeConfig, setRuntimeConfig] = useState(DEFAULT_RUNTIME_CONFIG);
  const [catalog, setCatalog] = useState(DEFAULT_CATALOG);
  const { wordMap: AI_KEYWORD_WORDS, phraseList: AI_KEYWORD_PHRASES } = useMemo(
    () => buildAiKeywordMaps(catalog.aiKeywords),
    [catalog.aiKeywords]
  );
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

  const [state, setState] = useState(createDefaultState());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMon, setModalMon] = useState(null);
  const [activeSection, setActiveSection] = useState("home");

  const currentRecognitionRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const aiModelRef = useRef(null);
  const aiModelPromiseRef = useRef(null);
  const segmentationModelRef = useRef(null);
  const segmentationModelPromiseRef = useRef(null);
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

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const [catalogResponse, stateResponse, configResponse] = await Promise.allSettled([
        fetchCatalog(),
        fetchGameState(),
        fetchConfig()
      ]);

      if (!active) return;

      if (configResponse.status === 'fulfilled') {
        setRuntimeConfig({
          ...DEFAULT_RUNTIME_CONFIG,
          ...configResponse.value,
          cameraConstraints: Array.isArray(configResponse.value.cameraConstraints) && configResponse.value.cameraConstraints.length
            ? configResponse.value.cameraConstraints
            : DEFAULT_RUNTIME_CONFIG.cameraConstraints
        });
      }

      if (catalogResponse.status === 'fulfilled') {
        setCatalog({
          ecoMons: Array.isArray(catalogResponse.value.ecoMons) ? catalogResponse.value.ecoMons : DEFAULT_CATALOG.ecoMons,
          aiKeywords: Array.isArray(catalogResponse.value.aiKeywords) ? catalogResponse.value.aiKeywords : DEFAULT_CATALOG.aiKeywords,
          maxDailyScans: Number(catalogResponse.value.maxDailyScans) || DEFAULT_CATALOG.maxDailyScans
        });
      }

      if (stateResponse.status === 'fulfilled') {
        setState(stateResponse.value.state || createDefaultState());
      } else {
        setState(createDefaultState());
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

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

  const ensureSegmentationModel = useCallback(() => {
    if (segmentationModelRef.current) return Promise.resolve(segmentationModelRef.current);
    if (!window.deeplab || !window.tf) {
      return Promise.resolve(null);
    }
    if (!segmentationModelPromiseRef.current) {
      segmentationModelPromiseRef.current = window.deeplab
        .load({ base: DEEPLAB_BASE, quantizationBytes: DEEPLAB_QUANTIZATION_BYTES })
        .then((model) => {
          segmentationModelRef.current = model;
          return model;
        })
        .catch(() => {
          segmentationModelPromiseRef.current = null;
          return null;
        });
    }
    return segmentationModelPromiseRef.current;
  }, []);

  const prepareSegmentationModel = useCallback(() => {
    return ensureSegmentationModel().catch(() => null);
  }, [ensureSegmentationModel]);

  const preprocessWithSegmentation = useCallback(async (canvas) => {
    const model = await ensureSegmentationModel();
    if (!model) return;

    const width = canvas.width;
    const height = canvas.height;
    if (!width || !height) return;

    let segmentation;
    try {
      segmentation = await model.segment(canvas);
    } catch {
      return;
    }

    const segmentationMap = segmentation?.segmentationMap;
    if (!segmentationMap || segmentationMap.length !== width * height) {
      console.warn("Segmentation map size mismatch, skipping preprocessing.");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    const backgroundIds = new Set(
      Object.entries(segmentation?.legend || {})
        .filter(([, label]) => {
          return BACKGROUND_LABEL_PATTERN.test(String(label).trim());
        })
        .map(([classId]) => Number(classId))
    );
    if (!backgroundIds.size) backgroundIds.add(0);
    const classLookupSize = Math.max(...backgroundIds) + 1;
    const isBackgroundClass = new Uint8Array(classLookupSize);
    backgroundIds.forEach((classId) => {
      if (classId >= 0 && classId < classLookupSize) {
        isBackgroundClass[classId] = 1;
      }
    });

    for (let i = 0; i < segmentationMap.length; i += 1) {
      const classId = segmentationMap[i];
      if (classId < 0 || classId >= classLookupSize || !isBackgroundClass[classId]) continue;
      const offset = i * 4;
      pixels[offset] = Math.round(pixels[offset] * BACKGROUND_DIM_FACTOR);
      pixels[offset + 1] = Math.round(pixels[offset + 1] * BACKGROUND_DIM_FACTOR);
      pixels[offset + 2] = Math.round(pixels[offset + 2] * BACKGROUND_DIM_FACTOR);
    }

    ctx.putImageData(imageData, 0, 0);
  }, [ensureSegmentationModel]);

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
      prepareSegmentationModel();
    } catch {
      showToast("Immagine non valida. Riprova.");
    }
  }, [loadImageFromFile, prepareAiModel, prepareSegmentationModel, showToast, stopCameraStream]);

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
    for (const constraints of runtimeConfig.cameraConstraints) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;
        if (error?.name === "NotAllowedError" || error?.name === "SecurityError") break;
      }
    }
    throw lastError || new Error("Camera unavailable");
  }, [runtimeConfig.cameraConstraints]);

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
      prepareSegmentationModel();
    } catch (error) {
      showToast(getCameraErrorMessage(error));
      requestFallbackCapture();
    }
  }, [getCameraErrorMessage, prepareAiModel, prepareSegmentationModel, requestCameraStream, requestFallbackCapture, resetSelectedImage, showToast, stopCameraStream, syncCanvasSize]);

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

    if (!bestId || bestScore < runtimeConfig.aiMinConfidence) return null;

    const mon = catalog.ecoMons.find((item) => item.id === bestId);
    if (!mon) return null;

    return { mon, confidence: Math.round(bestScore * 100) };
  }, [AI_KEYWORD_PHRASES, AI_KEYWORD_WORDS, catalog.ecoMons, runtimeConfig.aiMinConfidence]);

  const recognizeWaste = useCallback(async (fromAutoScan = false) => {
    if (recognitionInProgressRef.current) return;
    recognitionInProgressRef.current = true;

    try {
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

      await preprocessWithSegmentation(canvas);

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
          if (elapsed < runtimeConfig.noDetectionResetMs) return;

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
  }, [ensureAiModel, getCaptureCanvas, mapPredictionsToEcoMon, preprocessWithSegmentation, runtimeConfig.noDetectionResetMs, showToast, syncCanvasSize]);

  useEffect(() => {
    if (!cameraActive) return undefined;

    const runAutoScan = () => {
      void recognizeWaste(true);
    };

    runAutoScan();
    const intervalId = window.setInterval(runAutoScan, runtimeConfig.autoScanIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [cameraActive, recognizeWaste, runtimeConfig.autoScanIntervalMs]);

  const confirmDeposit = useCallback(async () => {
    const current = currentRecognitionRef.current;

    if (!current) {
      showToast("Nessun rifiuto riconosciuto. Premi Analizza.");
      return;
    }

    try {
      const response = await confirmScan(current.id);
      setState(response.state);
      currentRecognitionRef.current = null;
      setConfirmEnabled(false);
      setModalMon(response.card || current);
      setModalOpen(true);
    } catch (error) {
      showToast(error.message || "Impossibile salvare la carta.");
    }
  }, [showToast]);

  const scrollToSection = useCallback((sectionId) => {
    const section = sectionRefs.current[sectionId];
    if (!section) return;
    setActiveSection(sectionId);
    section.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, []);

  const resetDebugData = useCallback(async () => {
    const video = cameraFeedRef.current;
    stopCameraStream();
    setCameraActive(false);
    resetSelectedImage();
    if (video) {
      video.srcObject = null;
      video.removeAttribute("src");
      video.load();
    }

    try {
      const response = await resetGameState();
      setState(response.state || createDefaultState());
    } catch {
      setState(createDefaultState());
    }
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
  const progressPercent = Math.min(100, (unlockedCount / catalog.ecoMons.length) * 100);

  return (
    <>
      <div className="app-shell">
        <div className="carousel" ref={carouselRef} aria-label="Sezioni EcoMon">
          <HomeSection
            online={online}
            progressPercent={progressPercent}
            maxDailyScans={catalog.maxDailyScans}
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
            ecoMons={catalog.ecoMons}
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
