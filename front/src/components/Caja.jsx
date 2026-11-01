import { useMemo, useState } from "react";
import { api } from "../services/api";
import { useSale } from "../context/SaleContext";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductContext";
import { useConfig } from "../context/ConfigContext";
import { formatearMoneda } from "../services/format";
import { SkeletonStack } from "./Skeleton";
import { IconCaja, IconPlus, IconSearch, IconTrash } from "./Icons";
import Modal from "./Modal";
import Comprobante from "./Comprobante";

function iniciales(nombre = "") {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

export default function Caja() {
  const { lineas, agregar, cambiarCantidad, quitar, limpiar, total, unidades } = useSale();
  const { usuario } = useAuth();
  const { config } = useConfig();
  const { productos, loading, error } = useProducts(); // <- lista desde el contexto, no fetch local
  const productosActivos = useMemo(() => productos.filter((p) => p.activo !== false), [productos]);

  const [busqueda, setBusqueda] = useState("");
  const [msgExito, setMsgExito] = useState("");
  const [msgError, setMsgError] = useState("");
  const [busy, setBusy] = useState(false);

  const [nota, setNota] = useState("");
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [comprobante, setComprobante] = useState(null);

  const vuelto =
    metodoPago === "EFECTIVO" && montoRecibido !== ""
      ? Number(montoRecibido) - total
      : null;
  const montoInsuficiente =
    metodoPago === "EFECTIVO" &&
    montoRecibido !== "" &&
    Number(montoRecibido) < total;

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productosActivos;
    return productosActivos.filter((p) =>
      [p.nombre, p.descripcion, p.codigo, p.codigoBarras, p.categoria]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(q))
    );
  }, [productosActivos, busqueda]);

  async function registrarVenta() {
  if (lineas.length === 0) return;
  setBusy(true); setMsgError(""); setMsgExito("");
  try {
    // El front manda solo QUE y CUANTO. Ni precio ni total: eso los decide el back (C1-2).
    const detalles = lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad }));
    const payload = {
      detalles,
      nota: nota.trim() || undefined,
      metodoPago,
    };
    if (metodoPago === "EFECTIVO" && montoRecibido !== "") {
      payload.montoRecibido = Number(montoRecibido);
    }
    const data = await api.post("/sales", payload);
    // Pinto el total REAL de la respuesta. El stock de la lista bajara SOLO via socket,
    // sin refetch manual: eso demuestra el tiempo real de F3.
    setMsgExito(`Venta registrada. Total ${formatearMoneda(data.venta.total, config.moneda)} — Atendió: ${usuario?.nombre}`);
    setComprobante(data.venta);
    limpiar();
    setNota("");
    setMetodoPago("EFECTIVO");
    setMontoRecibido("");   // limpia la nota para el siguiente ticket (limpiar() solo toca el SaleContext)
  } catch (e) {
    // 400 de stock insuficiente (o 401 si expiro el token): muestro el mensaje del back
    // y NO limpio el ticket, para que el cajero ajuste la cantidad.
    setMsgError(e.message || "No se pudo registrar la venta");
  } finally {
    setBusy(false);
  }
}

  const disponibles = productosActivos.filter((p) => p.stock > 0).length;
  const stockBajo = productosActivos.filter(
    (p) => p.stock > 0 && p.stock <= (p.stockMinimo ?? 0)
  ).length;
  const agotados = productosActivos.filter((p) => p.stock <= 0).length;

  return (
    <div className="caja-page">
      <div className="caja-layout">
        <section className="caja-panel productos-panel">
          <div className="caja-head">
            <div>
              <p className="caja-kicker">Punto de venta</p>
              <h2>Atención de venta</h2>
            </div>
            <div className="caja-stats">
              <span className="caja-stat">
                <b>{disponibles}</b> disponibles
              </span>
              <span className={`caja-stat ${stockBajo > 0 ? "warn" : ""}`}>
                <b>{stockBajo}</b> stock bajo
              </span>
              {agotados > 0 && (
                <span className="caja-stat danger">
                  <b>{agotados}</b> agotados
                </span>
              )}
            </div>
          </div>

          <div className="search-wrap">
            <IconSearch className="search-icon" aria-hidden="true" />
            <input
              className="search"
              placeholder="Buscar por nombre, código o descripción…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar producto"
            />
            {busqueda && (
              <button
                className="search-clear"
                onClick={() => setBusqueda("")}
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          {loading && <SkeletonStack count={5} variant="row" />}
          {error && <p className="status error">{error}</p>}

          {!loading && !error && (
            <ul className="producto-lista">
              {filtrados.map((p) => {
                const enVenta = lineas.find((l) => l.productoId === p.id);
                const agotado = p.stock <= 0;
                const limiteAlcanzado = enVenta && enVenta.cantidad >= p.stock;
                const bajo = !agotado && p.stock <= (p.stockMinimo ?? 0);
                return (
                  <li key={p.id} className={`producto-row ${agotado ? "agotado" : ""}`}>
                    <span className="producto-avatar" aria-hidden="true">
                      {iniciales(p.nombre)}
                    </span>
                    <div className="producto-info">
                      <span className="producto-nombre">{p.nombre}</span>
                      <div className="producto-meta">
                        <span className="chip chip-precio">{formatearMoneda(p.precio, config.moneda)}</span>
                        <span className={`chip chip-stock ${agotado ? "out" : bajo ? "low" : ""}`}>
                          {agotado ? "Sin stock" : `${p.stock} en stock`}
                        </span>
                        {enVenta && (
                          <span className="chip chip-ticket">En ticket: {enVenta.cantidad}</span>
                        )}
                      </div>
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
                      {agotado ? (
                        "Agotado"
                      ) : limiteAlcanzado ? (
                        "Máximo"
                      ) : (
                        <>
                          <IconPlus className="btn-add-icon" aria-hidden="true" />
                          Agregar
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
              {filtrados.length === 0 && (
                <li className="producto-vacio">
                  <IconSearch className="empty-icon" aria-hidden="true" />
                  <span>Sin resultados para “{busqueda}”.</span>
                </li>
              )}
            </ul>
          )}
        </section>

        <aside className="caja-panel ticket-panel">
          <div className="caja-head">
            <div>
              <p className="caja-kicker">Cobro</p>
              <h2>Ticket actual</h2>
            </div>
            <span className="ticket-count">{unidades} u.</span>
          </div>

          <div className="caja-mensajes" aria-live="polite">
            {msgExito && <p className="status ok">{msgExito}</p>}
            {msgError && <p className="status error">{msgError}</p>}
          </div>

          {lineas.length === 0 ? (
            <div className="ticket-empty">
              <IconCaja className="empty-icon" aria-hidden="true" />
              <strong>El ticket está vacío</strong>
              <span>Agrega productos del catálogo para comenzar la venta.</span>
            </div>
          ) : (
            <ul className="linea-lista">
              {lineas.map((l) => (
                <li key={l.productoId} className="linea-row">
                  <div className="linea-info">
                    <span className="producto-nombre">{l.nombre}</span>
                    <span className="muted small">{formatearMoneda(l.precio, config.moneda)} c/u</span>
                  </div>
                  <div className="linea-controls">
                    <button
                      className="btn-step"
                      onClick={() => cambiarCantidad(l.productoId, -1)}
                      aria-label={`Quitar una unidad de ${l.nombre}`}
                    >
                      −
                    </button>
                    <span className="linea-cant" aria-label={`Cantidad: ${l.cantidad}`}>
                      {l.cantidad}
                    </span>
                    <button
                      className="btn-step"
                      onClick={() => cambiarCantidad(l.productoId, +1)}
                      disabled={l.cantidad >= l.stockDisponible}
                      title={l.cantidad >= l.stockDisponible ? "Límite de stock" : ""}
                      aria-label={`Agregar una unidad de ${l.nombre}`}
                    >
                      +
                    </button>
                    <button
                      className="btn-quitar"
                      onClick={() => quitar(l.productoId)}
                      title="Quitar línea"
                      aria-label={`Quitar ${l.nombre} del ticket`}
                    >
                      <IconTrash className="btn-quitar-icon" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="linea-subtotal">
                    {formatearMoneda(l.precio * l.cantidad, config.moneda)}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="ticket-summary">
            <div className="total-box">
              <span>Total a cobrar</span>
              <strong>{formatearMoneda(total, config.moneda)}</strong>
            </div>
            <div className="ticket-meta">
              <span>
                {lineas.length} producto{lineas.length === 1 ? "" : "s"}
              </span>
              <span>
                {unidades} unidad{unidades === 1 ? "" : "es"}
              </span>
            </div>
          </div>

          <label className="nota-field">
            <span className="nota-label-row">
              <span>Nota del ticket (opcional)</span>
              <span className="nota-count">{nota.length}/250</span>
            </span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej.: paciente alérgico a penicilina, receta N° 123…"
              maxLength={250}
              rows={2}
            />
          </label>

          <div className="caja-pago">
            <label>
              Método de pago
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                disabled={busy}
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="YAPE_PLIN">Yape/Plin</option>
              </select>
            </label>

            {metodoPago === "EFECTIVO" && (
              <div className="caja-pago-row">
                <label>
                  Recibido
                  <input
                    type="number"
                    min={total}
                    step="0.01"
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    placeholder={formatearMoneda(total, config.moneda)}
                    disabled={busy}
                  />
                </label>
                <div className={`vuelto ${montoInsuficiente ? "insuficiente" : ""}`}>
                  <span>Vuelto</span>
                  <strong>
                    {montoInsuficiente
                      ? "Monto insuficiente"
                      : vuelto === null
                        ? "—"
                        : formatearMoneda(vuelto, config.moneda)}
                  </strong>
                </div>
              </div>
            )}
          </div>

          <button
            className="btn-primary btn-block"
            onClick={registrarVenta}
            disabled={busy || lineas.length === 0 || montoInsuficiente}
          >
            {busy ? "Registrando…" : `Cobrar ${formatearMoneda(total, config.moneda)}`}
          </button>
          {lineas.length > 0 && (
            <button className="btn-ghost btn-block" onClick={limpiar} disabled={busy}>
              Vaciar ticket
            </button>
          )}
        </aside>
      </div>

      {comprobante && (
        <Modal titulo="Comprobante de venta" onClose={() => setComprobante(null)}>
          <Comprobante venta={comprobante} onClose={() => setComprobante(null)} />
        </Modal>
      )}
    </div>
  );
}