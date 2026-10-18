import { useEffect } from "react";
import { useProducts } from "../context/ProductContext";

// Cada alerta es su propio componente para poder programar su cierre independiente.
// Un solo useEffect global con timeouts por item seria mas fragil; esto es React-idiomatico.
function AlertItem({ alerta, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(alerta.key), 7000); // se va sola a los 7s
    return () => clearTimeout(t);                            // cleanup si se desmonta antes
  }, [alerta.key, onDismiss]);

  return (
    <div className="toast toast-alert">
      <div className="toast-body">
        <strong>Reponer: {alerta.nombre}</strong>
        <span className="muted small">
          stock {alerta.stockNuevo} / mínimo {alerta.stockMinimo}
        </span>
      </div>
      <button className="toast-x" onClick={() => onDismiss(alerta.key)} aria-label="Cerrar">×</button>
    </div>
  );
}

export default function Toast() {
  const { alertas, descartarAlerta } = useProducts();
  if (alertas.length === 0) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {alertas.map((a) => (
        <AlertItem key={a.key} alerta={a} onDismiss={descartarAlerta} />
      ))}
    </div>
  );
}