import { useEffect } from "react";
import { useProducts } from "../context/ProductContext";

// Cada alerta es su propio componente para poder programar su cierre independiente.
// Un solo useEffect global con timeouts por item seria mas fragil; esto es React-idiomatico.
function ToastItem({ item, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.key), item.duracion ?? 7000);
    return () => clearTimeout(t);
  }, [item.key, item.duracion, onDismiss]);

  return (
    <div className={`toast toast-${item.tipo || "alert"}`}>
      <div className="toast-body">
        {item.titulo && <strong>{item.titulo}</strong>}
        <span className={item.titulo ? "muted small" : undefined}>{item.mensaje}</span>
      </div>
      <button className="toast-x" onClick={() => onDismiss(item.key)} aria-label="Cerrar">×</button>
    </div>
  );
}

// Pila reutilizable: la usan las alertas de stock y los avisos globales.
export function ToastStack({ items, onDismiss }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((item) => (
        <ToastItem key={item.key} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default function Toast() {
  const { alertas, descartarAlerta } = useProducts();
  const items = alertas.map((a) => ({
    key: a.key,
    tipo: "alert",
    titulo: `Reponer: ${a.nombre}`,
    mensaje: `stock ${a.stockNuevo} / mínimo ${a.stockMinimo}`,
  }));

  return <ToastStack items={items} onDismiss={descartarAlerta} />;
}
