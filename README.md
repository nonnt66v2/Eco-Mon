# Eco-Mon: Throw Them All!

EcoMon è una PWA gamificata che insegna la raccolta differenziata con una caccia al tesoro nel mondo reale.
Il bambino inquadra un rifiuto, l’app suggerisce il bidone giusto e sblocca una carta collezionabile.

## Funzionalità demo

- Scanner PWA con fotocamera e riconoscimento AI on-device.
- Anti-cheat: massimo 3 rifiuti al giorno e blocco duplicati giornalieri.
- Pokedex persistente via `localStorage`.
- Modalità offline con service worker.

## Avvio locale

```bash
npm install
npm run start
```

Apri l’URL indicato dal server (es. `http://localhost:3000`).

## Note

- L’intelligenza artificiale usa un modello MobileNet nel browser per riconoscere il materiale.
- Il tipo di rifiuto non è selezionabile manualmente: viene assegnato solo dal riconoscimento AI.
- Per la presentazione, attiva la fotocamera e usa “Analizza” + “Fatto!” per mostrare il flusso completo.
