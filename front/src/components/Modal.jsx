import { useEffect } from "react";

// Overlay base reutilizable: Escape y click-fuera cierran; click-dentro NO.
// Lo usan ProductForm y ConfirmDialog para no duplicar estructura ni estilos.
export default function Modal({ titulo, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    // bloquear scroll del fondo mientras el modal esta abierto
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{titulo}</h2>
          <button className="modal-x" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}