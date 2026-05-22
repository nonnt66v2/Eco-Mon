# Eco-Mon: Throw Them All!

EcoMon è una PWA gamificata che insegna la raccolta differenziata con una caccia al tesoro nel mondo reale.
Il bambino inquadra un rifiuto, l’app suggerisce il bidone giusto e sblocca una carta collezionabile.

## Funzionalità demo

- Scanner PWA con fotocamera e riconoscimento AI on-device.
- Catalogo carte e stato giornaliero gestiti dal backend locale con SQLite.
- Anti-cheat: massimo 3 rifiuti al giorno e blocco duplicati giornalieri.
- Pokedex persistente salvato nel database locale.
- Modalità offline con service worker.

## Avvio locale

```bash
cd backend
python app.py
```

Il server Flask esegue automaticamente `backend/db/init_db.py` all'avvio e usa `backend/db/ecomon.sqlite3`.

In un secondo terminale:

```bash
cd frontend
npm install
npm run dev
```

Apri l’URL indicato dal server Vite. Le richieste `/api` vengono inoltrate al backend locale.

## Modulo OpenCV realtime (backend)

È disponibile un modulo separato per segmentazione e rilevamento realtime con OpenCV,
pensato per webcam, IP camera o file video. Questo flusso è indipendente dalla PWA.

### Installazione dipendenze

```bash
cd backend
pip install -r requirements.txt
```

### Esecuzione

```bash
python opencv_app.py --source 0
```

Esempi sorgenti:

- Webcam: `--source 0`
- File video: `--source ./video.mp4`
- IP camera: `--source rtsp://user:pass@ip/stream`

Opzioni utili:

- `--processing-scale 0.6` per ridurre la risoluzione di elaborazione.
- `--display-scale 1.0` per impostare la scala di output.
- `--window-name "OpenCV Realtime"` per personalizzare il titolo della finestra.
- `--min-area 800` per filtrare artefatti piccoli.
- `--disable-bg` per disattivare la background subtraction.
- `--show-mask` per visualizzare la maschera binaria.
- `--use-cuda` per tentare l’accelerazione GPU (se disponibile).

### Flusso di elaborazione

1. Preprocessing: scala di grigi, Gaussian/Median blur, CLAHE e normalizzazione.
2. Segmentazione: Otsu + adaptive threshold + soglie basate su istogramma, background subtraction, morfologia ed edge detection.
3. Riconoscimento: connected components, contorni, convex hull, bounding box, centroidi e area.
4. Stabilizzazione: tracking semplice tra frame con filtro sulle presenze consecutive.
5. Rendering: overlay in tempo reale con contorni, box, centroidi ed FPS.

## Note

- L’intelligenza artificiale usa un modello MobileNet nel browser per riconoscere il materiale.
- Il tipo di rifiuto non è selezionabile manualmente: viene assegnato solo dal riconoscimento AI.
- Per la presentazione, attiva la fotocamera e usa “Analizza” + “Fatto!” per mostrare il flusso completo.
- Su smartphone la webcam richiede HTTPS (oppure `localhost`): se non disponibile, l’app apre automaticamente lo scatto/caricamento foto come fallback.
