import { useEffect, useMemo, useState } from "react";
import { useSales } from "../context/SalesContext";
import { useConfig } from "../context/ConfigContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { usePreferencias } from "../context/PreferenciasContext";
import { descargarVentasExcel } from "../services/export";
import { formatearMoneda } from "../services/format";
import { SkeletonStack } from "./Skeleton";
import { IlustracionVentasVacio } from "./Illustrations";
import Modal from "./Modal";
import Comprobante from "./Comprobante";
import ConfirmDialog from "./ConfirmDialog";

const FILAS_POR_DEFECTO = 10;

function fechaLegible(iso) {
  try {
    return new Date(iso).toLocaleString("es-PE", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function Ventas() {
  const { ventas, loading, error } = useSales();
  const { config } = useConfig();
  const { isAdmin, esFarmaceutico } = useAuth();
  const { notificar } = useToast();
  const { prefs } = usePreferencias();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [pagina, setPagina] = useState(1);
  const [exportando, setExportando] = useState(false);
  const [msgExport, setMsgExport] = useState("");
  const [ticket, setTicket] = useState(null);
  const [anulando, setAnulando] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [errorAnulacion, setErrorAnulacion] = useState("");
  const [anulandoBusy, setAnulandoBusy] = useState(false);

  const porPagina = Math.max(1, Number(prefs.filasPorPagina) || FILAS_POR_DEFECTO);
  const hayFiltros = Boolean(desde || hasta || usuarioId);

  // Los usuarios del filtro salen del historial completo, no del resultado filtrado.
  const usuarios = useMemo(() => {
    const mapa = new Map();
    ventas.forEach((v) => {
      const u = v.atendidoPor;
      if (u && (u.rol === "admin" || u.rol === "farmaceutico")) mapa.set(u.id, u);
    });
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [ventas]);

  const filtradas = useMemo(() => {
    const inicio = desde ? new Date(`${desde}T00:00:00`) : null;
    const fin = hasta ? new Date(`${hasta}T23:59:59.999`) : null;

    return ventas.filter((v) => {
      const fecha = new Date(v.fecha);
      if (inicio && fecha < inicio) return false;
      if (fin && fecha > fin) return false;
      if (usuarioId && String(v.atendidoPor?.id) !== usuarioId) return false;
      return true;
    });
  }, [ventas, desde, hasta, usuarioId]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtradas.slice(
    (paginaActual - 1) * porPagina,
    paginaActual * porPagina
  );

  useEffect(() => {
    setPagina(1);
  }, [desde, hasta, usuarioId, porPagina]);

  useEffect(() => {
    setPagina((p) => Math.min(p, totalPaginas));
  }, [totalPaginas]);

  function limpiarFiltros() {
    setDesde("");
    setHasta("");
    setUsuarioId("");
  }

  function pedirAnular(venta) {
    setMotivoAnulacion("");
    setErrorAnulacion("");
    setAnulando(venta);
  }

  async function confirmarAnulacion() {
    if (!anulando || anulandoBusy) return;
    const motivo = motivoAnulacion.trim();
    if (motivo.length < 5) {
      setErrorAnulacion("El motivo debe tener al menos 5 caracteres");
      return;
    }

    setAnulandoBusy(true);
    setErrorAnulacion("");
    try {
      await api.post(`/sales/${anulando.id}/anular`, { motivo });
      notificar(`Venta #${anulando.id} anulada`, "success");
      setAnulando(null);
      setMotivoAnulacion("");
    } catch (e) {
      setErrorAnulacion(e.message || "No se pudo anular la venta");
    } finally {
      setAnulandoBusy(false);
    }
  }

  async function onExport() {
    setMsgExport("");
    setExportando(true);
    try {
      // Envío los límites en ISO con la hora local del navegador para que el
      // backend filtre exactamente el mismo rango que se ve en pantalla.
      await descargarVentasExcel({
        desde: desde ? new Date(`${desde}T00:00:00`).toISOString() : "",
        hasta: hasta ? new Date(`${hasta}T23:59:59.999`).toISOString() : "",
        usuarioId,
      });
      setMsgExport("Excel generado ✓");
    } catch (e) {
      setMsgExport(e.message || "No se pudo exportar");
    } finally {
      setExportando(false);
    }
  }

  if (loading) return <SkeletonStack count={6} />;
  if (error) return <p className="status error">{error}</p>;

  if (ventas.length === 0) return (
    <div className="empty-state">
      <IlustracionVentasVacio className="empty-art" />
      <h3>Todavía no hay ventas</h3>
      <p className="muted">Las ventas que registres desde Caja van a aparecer aquí, con su detalle y total.</p>
    </div>
  );

  return (
    <div>
      <div className="ventas-filtros">
        <label>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <label>
          Atendido por
          <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={limpiarFiltros}
          disabled={!hayFiltros}
        >
          Limpiar
        </button>
      </div>

      <div className="ventas-toolbar">
        <span className="muted small">
          {filtradas.length} ticket(s) · página {paginaActual} de {totalPaginas}
        </span>
        <button
          className="btn-primary btn-sm"
          onClick={onExport}
          disabled={exportando || filtradas.length === 0}
        >
          {exportando ? "Generando…" : "Exportar Excel"}
        </button>
      </div>
      {msgExport && <p className="status small">{msgExport}</p>}

      {filtradas.length === 0 ? (
        <div className="empty-state">
          <IlustracionVentasVacio className="empty-art" />
          <h3>Sin ventas con esos filtros</h3>
          <p className="muted">Prueba con otro rango de fechas o cambia el usuario que atendió.</p>
          <button className="btn-ghost" onClick={limpiarFiltros}>Limpiar filtros</button>
        </div>
      ) : (
        <>
          <div className="ventas-list">
            {visibles.map((v) => {
              const items = v.detalles.reduce((acc, l) => acc + l.cantidad, 0);
              const anulada = v.estado === "ANULADA";
              return (
                <article key={v.id} className={`venta-card ${anulada ? "venta-anulada" : ""}`}>
                  <header className="venta-head">
                    <div>
                      <span className="venta-id">Ticket #{v.id}</span>
                      <span className="muted small">{fechaLegible(v.fecha)}</span>
                      {anulada && <span className="badge-anulada">Anulada</span>}
                    </div>
                    <div className="venta-meta">
                      <span className="chip-rol">{v.atendidoPor?.nombre} — {v.atendidoPor?.rol}</span>
                      <strong className="venta-total">{formatearMoneda(v.total, config.moneda)}</strong>
                    </div>
                  </header>

                  {anulada && v.motivoAnulacion && (
                    <p className="venta-motivo">
                      Motivo: {v.motivoAnulacion}
                      {v.anuladaPor?.nombre ? ` — por ${v.anuladaPor.nombre}` : ""}
                    </p>
                  )}

                  {v.nota && (
                    <p className="venta-nota">Nota: {v.nota}</p>
                  )}

                  <table className="venta-table">
                    <thead>
                      <tr><th>Producto</th><th className="num">Cant.</th><th className="num">P. unit.</th><th className="num">Subtotal</th></tr>
                    </thead>
                    <tbody>
                      {v.detalles.map((l) => (
                        <tr key={l.productoId}>
                          <td>{l.producto?.nombre ?? "(producto eliminado)"}</td>
                          <td className="num">{l.cantidad}</td>
                          <td className="num">{formatearMoneda(l.precioUnitario, config.moneda)}</td>
                          <td className="num">{formatearMoneda(l.cantidad * l.precioUnitario, config.moneda)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <footer className="venta-foot">
                    <span className="muted small">
                      {items} unidad(es) en {v.detalles.length} línea(s)
                      {v.metodoPago ? ` — ${v.metodoPago === "TARJETA" ? "Tarjeta" : v.metodoPago === "YAPE_PLIN" ? "Yape/Plin" : "Efectivo"}` : ""}
                    </span>
                    <div className="venta-foot-actions">
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => setTicket(v)}
                      >
                        Imprimir
                      </button>
                      {!anulada && (isAdmin || esFarmaceutico) && (
                        <button
                          type="button"
                          className="btn-ghost btn-sm btn-danger-text"
                          onClick={() => pedirAnular(v)}
                        >
                          Anular
                        </button>
                      )}
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>

          {totalPaginas > 1 && (
            <div className="paginacion">
              <button
                className="btn-ghost btn-sm"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaActual === 1}
              >
                Anterior
              </button>
              <span className="muted small">Página {paginaActual} de {totalPaginas}</span>
              <button
                className="btn-ghost btn-sm"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaActual === totalPaginas}
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
      {ticket && (
        <Modal titulo="Comprobante de venta" onClose={() => setTicket(null)}>
          <Comprobante venta={ticket} onClose={() => setTicket(null)} />
        </Modal>
      )}

      {anulando && (
        <ConfirmDialog
          titulo="Anular venta"
          mensaje={`¿Anular el ticket #${anulando.id}? El stock de cada línea se repondrá.`}
          error={errorAnulacion}
          peligro
          disabled={anulandoBusy || motivoAnulacion.trim().length < 5}
          onCancel={() => {
            if (!anulandoBusy) {
              setAnulando(null);
              setMotivoAnulacion("");
              setErrorAnulacion("");
            }
          }}
          onConfirm={confirmarAnulacion}
        >
          <label className="form-grid" style={{ marginTop: 8 }}>
            Motivo de anulación
            <textarea
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              maxLength={250}
              rows={3}
              placeholder="Ej.: error en el cobro, cliente desistió..."
              disabled={anulandoBusy}
            />
          </label>
        </ConfirmDialog>
      )}
    </div>
  );
}
