export default function PokedexSection({ sectionRef, ecoMons, unlocked }) {
  return (
    <section className="panel dex-panel" data-section="dex" ref={sectionRef}>
      <section className="card">
        <h2>Pokedex Eco-Mon</h2>
        <p>Completa la collezione salvando piu materiali possibili.</p>
        <div className="pokedex" id="pokedexGrid">
          {ecoMons.map((mon) => {
            const isUnlocked = Boolean(unlocked[mon.id]);
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
                {isUnlocked && mon.rarity && <span className="badge">Rarità {mon.rarity}</span>}
                <span className="badge">{mon.material}</span>
                <p>{isUnlocked ? mon.description : "Sblocca questo Eco-Mon con una scansione."}</p>
                <span className="badge">Bidone {mon.bin}</span>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
