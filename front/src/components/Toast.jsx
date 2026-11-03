import { useEffect } from "react";
import { useProducts } from "../context/ProductContext";

function ToastItem({ item, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.key), item.duracion ?? 7000);
    return () => clearTimeout(t);
  }, [item.key, item.duracion, onDismiss]);

  return (
    <div className={`toast ${item.tipo === "success" ? "toast-success" : item.tipo === "warning" ? "toast-warning" : item.tipo === "danger" ? "toast-danger" : "toast-info"}`}>
      <div className="toast-body">
        {item.titulo && <strong>{item.titulo}</strong>}
        <span className={item.titulo ? "text-muted" : undefined} style={{fontSize: item.titulo ? "var(--text-sm)" : undefined}}>{item.mensaje}</span>
      </div>
      <button className="toast-close" onClick={() => onDismiss(item.key)} aria-label="Cerrar">×</button>
    </div>
  );
}

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
    tipo: "warning",
    titulo: `Reponer: ${a.nombre}`,
    mensaje: `stock ${a.stockNuevo} / mínimo ${a.stockMinimo}`,
  }));

  return <ToastStack items={items} onDismiss={descartarAlerta} />;
}