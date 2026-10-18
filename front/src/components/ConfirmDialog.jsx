import Modal from "./Modal";

export default function ConfirmDialog({ titulo, mensaje, onConfirm, onCancel, error, peligro }) {
  return (
    <Modal titulo={titulo} onClose={onCancel}>
      {error && <p className="status error">{error}</p>}
      <p className="confirm-msg">{mensaje}</p>
      <div className="modal-foot">
        <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className={`btn-primary ${peligro ? "btn-danger" : ""}`} onClick={onConfirm}>
          Confirmar
        </button>
      </div>
    </Modal>
  );
}