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

  const montoRecibidoNumero =
    metodoPago === "EFECTIVO" && montoRecibido !== "" ? Number(montoRecibido) : null;
  const montoValido = montoRecibidoNumero !== null && Number.isFinite(montoRecibidoNumero);
  const vuelto =
    metodoPago === "EFECTIVO" && montoRecibido !== "" && montoValido
      ? montoRecibidoNumero - total
      : null;
  const montoInsuficiente =
    metodoPago === "EFECTIVO" &&
    montoRecibido !== "" &&
    montoValido &&
    montoRecibidoNumero < total;
  const vueltoPositivo = vuelto !== null && vuelto > 0;

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
      const monto = Number(montoRecibido);
      if (Number.isFinite(monto)) payload.montoRecibido = monto;
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
    <div className="pos">
      <header className="pos-header">
        <div>
          <p className="kicker">Punto de venta</p>
          <h2 className="pos-title">Caja</h2>
        </div>
        <div className="stat-strip">
          <span className="stat-chip"><strong>{disponibles}</strong> disponibles</span>
          <span className={`stat-chip ${stockBajo > 0 ? "is-warning" : ""}`}>
            <strong>{stockBajo}</strong> stock bajo
          </span>
          {agotados > 0 && (
            <span className="stat-chip is-danger"><strong>{agotados}</strong> agotados</span>
          )}
        </div>
      </header>

      <div className="pos-grid">
        <section className="card pos-catalog" aria-label="Catálogo de productos">
          <div className="pos-panel-head">
            <div>
              <h3 className="pos-panel-title">Productos</h3>
              <p className="text-muted">{filtrados.length} resultado{filtrados.length === 1 ? "" : "s"}</p>
            </div>
          </div>

          <div className="pos-search">
            <IconSearch className="pos-search-icon" aria-hidden="true" />
            <input
              className="input"
              placeholder="Buscar por nombre, código o descripción…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar producto"
            />
            {busqueda && (
              <button
                className="pos-search-clear"
                onClick={() => setBusqueda("")}
                aria-label="Limpiar búsqueda"
                type="button"
              >
                ✕
              </button>
            )}
          </div>

          {loading && <div className="pos-list"><SkeletonStack count={5} variant="row" /></div>}
          {error && <p className="status error pos-error">{error}</p>}

          {!loading && !error && (
            filtrados.length === 0 ? (
              <div className="pos-empty">
                <IconSearch className="icon-lg" aria-hidden="true" />
                <strong>Sin resultados</strong>
                <span>{busqueda ? `No hay coincidencias para “${busqueda}”.` : "No hay productos disponibles."}</span>
              </div>
            ) : (
              <ul className="pos-list">
                {filtrados.map((p) => {
                  const enVenta = lineas.find((l) => l.productoId === p.id);
                  const agotado = p.stock <= 0;
                  const limiteAlcanzado = enVenta && enVenta.cantidad >= p.stock;
                  const bajo = !agotado && p.stock <= (p.stockMinimo ?? 0);
                  const stockBadge = agotado ? "badge-danger" : bajo ? "badge-warning" : "badge-neutral";
                  const deshabilitado = agotado || limiteAlcanzado;
                  return (
                    <li key={p.id} className={`pos-item ${agotado ? "is-out" : ""}`}>
                      <span className="pos-avatar" aria-hidden="true">{iniciales(p.nombre)}</span>
                      <div className="pos-item-info">
                        <span className="pos-item-name">{p.nombre}</span>
                        <div className="pos-item-meta">
                          <span className="badge badge-neutral font-mono">
                            {formatearMoneda(p.precio, config.moneda)}
                          </span>
                          <span className={`badge ${stockBadge}`}>
                            {agotado ? "Sin stock" : `${p.stock} en stock`}
                          </span>
                          {enVenta && (
                            <span className="badge badge-info">En ticket: {enVenta.cantidad}</span>
                          )}
                        </div>
                      </div>
                      <button
                        className={`btn btn-sm pos-add ${deshabilitado ? "btn-secondary" : "btn-primary"}`}
                        disabled={deshabilitado}
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
                            <IconPlus className="icon-sm" aria-hidden="true" />
                            Agregar
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </section>

        <aside className="card pos-ticket" aria-label="Ticket actual">
          <div className="pos-panel-head">
            <div>
              <p className="kicker">Cobro</p>
              <h3 className="pos-panel-title">Ticket actual</h3>
            </div>
            <span className="badge badge-neutral">{unidades} u.</span>
          </div>

          <div className="pos-messages" aria-live="polite">
            {msgExito && <p className="status ok">{msgExito}</p>}
            {msgError && <p className="status error">{msgError}</p>}
          </div>

          {lineas.length === 0 ? (
            <div className="pos-empty">
              <IconCaja className="icon-lg" aria-hidden="true" />
              <strong>El ticket está vacío</strong>
              <span>Agrega productos del catálogo para comenzar la venta.</span>
            </div>
          ) : (
            <ul className="pos-lines">
              {lineas.map((l) => (
                <li key={l.productoId} className="pos-line">
                  <div className="pos-line-info">
                    <span className="pos-line-name">{l.nombre}</span>
                    <span className="text-muted small font-mono">
                      {formatearMoneda(l.precio, config.moneda)} c/u
                    </span>
                  </div>
                  <div className="pos-line-controls">
                    <button
                      className="btn btn-secondary btn-icon"
                      onClick={() => cambiarCantidad(l.productoId, -1)}
                      aria-label={`Quitar una unidad de ${l.nombre}`}
                    >
                      −
                    </button>
                    <span className="pos-line-qty" aria-label={`Cantidad: ${l.cantidad}`}>
                      {l.cantidad}
                    </span>
                    <button
                      className="btn btn-secondary btn-icon"
                      onClick={() => cambiarCantidad(l.productoId, +1)}
                      disabled={l.cantidad >= l.stockDisponible}
                      title={l.cantidad >= l.stockDisponible ? "Límite de stock" : ""}
                      aria-label={`Agregar una unidad de ${l.nombre}`}
                    >
                      +
                    </button>
                    <button
                      className="btn btn-ghost btn-icon pos-remove"
                      onClick={() => quitar(l.productoId)}
                      title="Quitar línea"
                      aria-label={`Quitar ${l.nombre} del ticket`}
                    >
                      <IconTrash className="icon-sm" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="pos-line-total font-mono">
                    {formatearMoneda(l.precio * l.cantidad, config.moneda)}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="pos-totals">
            <div className="pos-total-row">
              <span>Total a cobrar</span>
              <strong className="font-mono">{formatearMoneda(total, config.moneda)}</strong>
            </div>
            <div className="pos-total-meta">
              <span>{lineas.length} producto{lineas.length === 1 ? "" : "s"}</span>
              <span>{unidades} unidad{unidades === 1 ? "" : "es"}</span>
            </div>
          </div>

          <label className="pos-note">
            <span className="pos-note-head">
              <span>Nota del ticket (opcional)</span>
              <span className="pos-note-count">{nota.length}/250</span>
            </span>
            <textarea
              className="textarea"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej.: paciente alérgico a penicilina, receta N° 123…"
              maxLength={250}
              rows={2}
            />
          </label>

          <div className="pos-payment">
            <label className="label">Método de pago
              <select
                className="select"
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
              <div className="pos-payment-row">
                <label className="label">Recibido
                  <input
                    className="input"
                    type="number"
                    min={total}
                    step="0.01"
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    placeholder={formatearMoneda(total, config.moneda)}
                    disabled={busy}
                  />
                </label>
                <div className={`pos-change ${montoInsuficiente ? "is-danger" : vueltoPositivo ? "is-positive" : ""}`}>
                  <span>Vuelto</span>
                  <strong className="font-mono">
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

          <div className="pos-actions">
            <button
              className="btn btn-primary btn-block"
              onClick={registrarVenta}
              disabled={busy || lineas.length === 0 || montoInsuficiente}
            >
              {busy ? "Registrando…" : `Cobrar ${formatearMoneda(total, config.moneda)}`}
            </button>
            {lineas.length > 0 && (
              <button className="btn btn-ghost btn-block" onClick={limpiar} disabled={busy}>
                Vaciar ticket
              </button>
            )}
          </div>
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
