import Modal from "./Modal";

export default function ConfirmDialog({ titulo, mensaje, onConfirm, onCancel, error, peligro, children, disabled }) {
  return (
    <Modal titulo={titulo} onClose={onCancel}>
      {error && <p className="status error">{error}</p>}
      <p className="confirm-message">{mensaje}</p>
      {children}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button
          className={`btn ${peligro ? "btn-danger" : "btn-primary"}`}
          onClick={onConfirm}
          disabled={disabled}
        >
          Confirmar
        </button>
      </div>
    </Modal>
  );
}
