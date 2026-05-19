export default function BottomNav({ activeSection, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="Navigazione sezioni">
      <button className={`nav-item ${activeSection === "home" ? "active" : ""}`} onClick={() => onNavigate("home")} type="button">
        <span className="nav-icon">⌂</span>
        <span className="nav-label">Home</span>
      </button>
      <button className={`nav-item nav-item--scan ${activeSection === "scan" ? "active" : ""}`} onClick={() => onNavigate("scan")} type="button">
        <span className="nav-icon">◉</span>
        <span className="nav-label">Scan</span>
      </button>
      <button className={`nav-item ${activeSection === "dex" ? "active" : ""}`} onClick={() => onNavigate("dex")} type="button">
        <span className="nav-icon">≣</span>
        <span className="nav-label">Eco-Dex</span>
      </button>
    </nav>
  );
}
