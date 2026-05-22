export default function RewardModal({ modalOpen, modalMon, onClose }) {
  return (
    <div className="modal" id="cardModal" aria-hidden={!modalOpen} onClick={(event) => {
      if (event.target.id === "cardModal") onClose();
    }}>
      <div className="modal-content">
        <button className="close" id="closeModal" aria-label="Chiudi" onClick={onClose}>x</button>
        <div className="modal-card" id="modalCard">
          {modalMon && (
            <>
              <h3>{modalMon.name}</h3>
              <p>{modalMon.description}</p>
              {modalMon.rarity && <span className="badge">Rarità: {modalMon.rarity}</span>}
              <span className="badge">Materiale: {modalMon.material}</span>
              <span className="badge">Bidone: {modalMon.bin}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
