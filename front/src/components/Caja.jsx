import { useMemo, useState } from "react";
import { api } from "../services/api";
import { useSale } from "../context/SaleContext";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductContext";

export default function Caja() {
  const { lineas, agregar, cambiarCantidad, quitar, limpiar, total, unidades } = useSale();
  const { usuario } = useAuth();
  const { productos, loading, error } = useProducts(); // <- lista desde el contexto, no fetch local

  const [busqueda, setBusqueda] = useState("");
  const [msgExito, setMsgExito] = useState("");
  const [msgError, setMsgError] = useState("");
  const [busy, setBusy] = useState(false);

  const [nota, setNota] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter(
      (p) => p.nombre.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q)
    );
  }, [productos, busqueda]);

  async function registrarVenta() {
  if (lineas.length === 0) return;
  setBusy(true); setMsgError(""); setMsgExito("");
  try {
    // El front manda solo QUE y CUANTO. Ni precio ni total: eso los decide el back (C1-2).
    const detalles = lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad }));
    const data = await api.post("/sales", { detalles, nota: nota.trim() || undefined });
    // Pinto el total REAL de la respuesta. El stock de la lista bajara SOLO via socket,
    // sin refetch manual: eso demuestra el tiempo real de F3.
    setMsgExito(`Venta registrada. Total S/ ${Number(data.venta.total).toFixed(2)} · Atendió: ${usuario?.nombre}`);
    limpiar();
    setNota("");   // limpia la nota para el siguiente ticket (limpiar() solo toca el SaleContext)
  } catch (e) {
    // 400 de stock insuficiente (o 401 si expiro el token): muestro el mensaje del back
    // y NO limpio el ticket, para que el cajero ajuste la cantidad.
    setMsgError(e.message || "No se pudo registrar la venta");
  } finally {
    setBusy(false);
  }
}

  return (
    <div className="caja-layout">
      <section className="caja-panel">
        <div className="caja-head">
          <h2>Atención de venta</h2>
          <input
            className="search"
            placeholder="Buscar medicamento…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {loading && <p className="status">Cargando productos…</p>}
        {error && <p className="status error">{error}</p>}

        {!loading && !error && (
          <ul className="producto-lista">
            {filtrados.map((p) => {
              const enVenta = lineas.find((l) => l.productoId === p.id);
              const agotado = p.stock <= 0;
              const limiteAlcanzado = enVenta && enVenta.cantidad >= p.stock;
              return (
                <li key={p.id} className={`producto-row ${agotado ? "agotado" : ""}`}>
                  <div className="producto-info">
                    <span className="producto-nombre">{p.nombre}</span>
                    <span className="muted small">
                      S/ {Number(p.precio).toFixed(2)} · stock {p.stock}
                    </span>
                  </div>
                  <button
                    className="btn-add"
                    disabled={agotado || limiteAlcanzado}
                    onClick={() => agregar(p)}
                    title={
                      agotado
                        ? "Sin stock"
                        : limiteAlcanzado
                          ? "Límite de stock alcanzado"
                          : "Agregar a la venta"
                    }
                  >
                    {agotado
                      ? "Agotado"
                      : limiteAlcanzado
                        ? `Máx (${enVenta.cantidad})`
                        : enVenta
                          ? `+ (${enVenta.cantidad})`
                          : "+ Agregar"}
                  </button>
                </li>
              );
            })}
            {filtrados.length === 0 && <p className="muted">Sin resultados para “{busqueda}”.</p>}
          </ul>
        )}
      </section>

      <aside className="caja-panel venta-panel">
        <div className="caja-head">
          <h2>Ticket actual</h2>
          <span className="summary-item">{unidades} u.</span>
        </div>

        {msgExito && <p className="status ok">{msgExito}</p>}
        {msgError && <p className="status error">{msgError}</p>}

        {lineas.length === 0 ? (
          <p className="muted">Agrega productos para comenzar la venta.</p>
        ) : (
          <ul className="linea-lista">
            {lineas.map((l) => (
              <li key={l.productoId} className="linea-row">
                <div className="linea-info">
                  <span className="producto-nombre">{l.nombre}</span>
                  <span className="muted small">S/ {Number(l.precio).toFixed(2)} c/u</span>
                </div>
                <div className="linea-controls">
                  <button className="btn-step" onClick={() => cambiarCantidad(l.productoId, -1)}>−</button>
                  <span className="linea-cant">{l.cantidad}</span>
                  <button
                    className="btn-step"
                    onClick={() => cambiarCantidad(l.productoId, +1)}
                    disabled={l.cantidad >= l.stockDisponible}
                    title={l.cantidad >= l.stockDisponible ? "Límite de stock" : ""}
                  >+</button>
                  <button className="btn-quitar" onClick={() => quitar(l.productoId)} title="Quitar línea">✕</button>
                </div>
                <div className="linea-subtotal">S/ {(l.precio * l.cantidad).toFixed(2)}</div>
              </li>
            ))}
          </ul>
        )}

        <div className="total-box">
          <span>Total</span>
          <strong>S/ {Number(total).toFixed(2)}</strong>
        </div>

        <label className="nota-field">
          Nota del ticket (opcional)
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej.: paciente alérgico a penicilina, receta N° 123…"
            maxLength={250}
            rows={2}
          />
        </label>

        <button className="btn-primary btn-block" onClick={registrarVenta} disabled={busy || lineas.length === 0}>
          {busy ? "Registrando…" : "Registrar venta"}
        </button>
        {lineas.length > 0 && (
          <button className="btn-ghost btn-block" onClick={limpiar} disabled={busy}>
            Vaciar ticket
          </button>
        )}
      </aside>
    </div>
  );
}