# Eco-Mon: Throw Them All!

EcoMon è una PWA gamificata che insegna la raccolta differenziata con una caccia al tesoro nel mondo reale.
Il bambino inquadra un rifiuto, l’app suggerisce il bidone giusto e sblocca una carta collezionabile.

## Funzionalità demo

- Scanner PWA con fotocamera e riconoscimento AI on-device.
- Catalogo carte e stato giornaliero gestiti dal backend locale con SQLite.
- Anti-cheat: massimo 3 rifiuti al giorno e blocco duplicati giornalieri.
- Pokedex persistente salvato nel database locale.
- Modalità offline con service worker.

### Installazione
```bash 

cd frontend/ && npm install  && cd ../backend/ && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```
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

## Note

- L’intelligenza artificiale applica prima una segmentazione semantica del frame e poi usa MobileNet nel browser per riconoscere meglio il materiale.
- Il tipo di rifiuto non è selezionabile manualmente: viene assegnato solo dal riconoscimento AI.
- Per la presentazione, attiva la fotocamera e usa “Analizza” + “Fatto!” per mostrare il flusso completo.
- Su smartphone la webcam richiede HTTPS (oppure `localhost`): se non disponibile, l’app apre automaticamente lo scatto/caricamento foto come fallback.
