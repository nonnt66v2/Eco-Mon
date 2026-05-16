# Eco-Mon: Throw Them All!

EcoMon è una PWA gamificata che insegna la raccolta differenziata con una caccia al tesoro nel mondo reale.
Il bambino inquadra un rifiuto, l’app suggerisce il bidone giusto e sblocca una carta collezionabile.

## Funzionalità demo

- Scanner PWA con fotocamera (fallback demo con selezione manuale del materiale).
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

- L’intelligenza artificiale è simulata con una selezione manuale per facilitare la demo.
- Per la presentazione, attiva la fotocamera e usa “Analizza” + “Fatto!” per mostrare il flusso completo.
