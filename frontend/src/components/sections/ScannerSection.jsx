export default function ScannerSection({
  sectionRef,
  cameraFeedRef,
  startCamera,
  aiStatus,
  confirmDeposit,
  confirmEnabled,
  resetDebugData,
  resultText,
  resultConfidence,
  resultBin
}) {
  return (
    <section className="panel scan-panel" data-section="scan" ref={sectionRef}>
      <section className="card scanner">
        <div className="card-header">
          <div>
            <h2>Scanner EcoMon</h2>
            <p>Inquadra il rifiuto: con la fotocamera attiva la scansione parte in automatico, poi premi "Fatto!".</p>
          </div>
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
            <button className="primary" id="confirmBtn" onClick={confirmDeposit} disabled={!confirmEnabled}>Fatto!</button>
            <button className="debug" id="debugResetBtn" onClick={resetDebugData}>Reset dati locali (debug)</button>
            <p className="hint">Suggerimento: illumina bene l'oggetto. La fotocamera continua a scandire mentre resta attiva.</p>
          </div>
        </div>

        <div className="result" id="scanResult">
          <span className="label">Rilevato:</span>
          <strong id="resultText">{resultText}</strong>
          <span className="confidence" id="resultConfidence">{resultConfidence}</span>
          <span className="bin" id="resultBin">{resultBin}</span>
        </div>
      </section>
    </section>
  );
}
