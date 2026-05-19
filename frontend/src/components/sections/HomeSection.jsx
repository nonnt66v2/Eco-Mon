export default function HomeSection({
  online,
  progressPercent,
  maxDailyScans,
  todayScans,
  sectionRef
}) {
  return (
    <section className="panel home-panel" data-section="home" ref={sectionRef}>
      <div className="home-hero card">
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
      </div>

      <section className="card">
        <div className="card-header">
          <h2>Anti-cheat &amp; progressi</h2>
          <div className="limit" id="dailyLimit">Scansioni di oggi: {todayScans}/{maxDailyScans}</div>
        </div>
        <ul className="rules">
          <li>Massimo 3 rifiuti scannerizzabili al giorno.</li>
          <li>Lo stesso materiale non vale due volte nella stessa giornata.</li>
          <li>I tuoi Eco-Mon restano nel Pokedex per sempre.</li>
        </ul>
        <div className="progress">
          <div className="progress-bar" id="progressBar" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </section>
    </section>
  );
}
