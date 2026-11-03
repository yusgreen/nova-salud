import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { formatearMoneda } from "../services/format";
import { descargarVentasExcel } from "../services/export";
import { SkeletonLines } from "./Skeleton";
import Modal from "./Modal";
import Comprobante from "./Comprobante";

function hoyISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function etiquetaMetodo(metodo) {
  if (metodo === "TARJETA") return "Tarjeta";
  if (metodo === "YAPE_PLIN") return "Yape/Plin";
  return "Efectivo";
}

export default function CierreCaja() {
  const { usuario, isAdmin, esFarmaceutico, puedeGestionarInventario } = useAuth();
  const { config } = useConfig();
  const gestor = isAdmin || esFarmaceutico;

  const [fecha, setFecha] = useState(hoyISO());
  const [usuarioId, setUsuarioId] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportando, setExportando] = useState(false);
  const [msgExport, setMsgExport] = useState("");
  const [ticket, setTicket] = useState(null);

  useEffect(() => {
    if (!gestor) {
      setUsuarioId(String(usuario?.id || ""));
      return;
    }
    let activo = true;
    api
      .get("/sales")
      .then((ventas) => {
        if (!activo) return;
        const mapa = new Map();
        (ventas || []).forEach((v) => {
          if (v.atendidoPor) mapa.set(v.atendidoPor.id, v.atendidoPor);
        });
        setUsuarios([...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      })
      .catch(() => {
        if (activo) setUsuarios([]);
      });
    return () => {
      activo = false;
    };
  }, [gestor, usuario?.id]);

  useEffect(() => {
    let activo = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ fecha });
    if (usuarioId) params.set("usuarioId", usuarioId);
    api
      .get(`/sales/cierre?${params.toString()}`)
      .then((d) => {
        if (activo) setData(d);
      })
      .catch((e) => {
        if (activo) setError(e.message || "No se pudo generar el cierre");
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, [fecha, usuarioId]);

  const resumen = data?.resumen;
  const ventas = data?.ventas || [];

  async function onExport() {
    setMsgExport("");
    setExportando(true);
    try {
      await descargarVentasExcel({
        desde: fecha,
        hasta: fecha,
        usuarioId: usuarioId || undefined,
      });
      setMsgExport("Excel generado ✓");
    } catch (e) {
      setMsgExport(e.message || "No se pudo exportar");
    } finally {
      setExportando(false);
    }
  }

  if (loading && !data) return <SkeletonLines count={6} />;
  if (error) return <p className="status error">{error}</p>;

  const anuladas = resumen?.anuladas?.cantidad ?? 0;

  return (
    <div className="cierre cierre-print">
      <header className="page-head">
        <div>
          <p className="kicker">Cierre</p>
          <h2 className="page-title">Cierre de caja</h2>
          <p className="page-sub">Resumen de ventas por fecha y usuario.</p>
        </div>
        <div className="filter-row no-print">
          <label className="filter-field">
            Fecha
            <input
              className="input"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
          <label className="filter-field">
            Usuario
            <select
              className="select"
              value={usuarioId}
              onChange={(e) => setUsuarioId(e.target.value)}
              disabled={!gestor}
            >
              {gestor && <option value="">Todos</option>}
              {!gestor && usuario && (
                <option value={usuario.id}>{usuario.nombre}</option>
              )}
              {gestor &&
                usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} · {u.rol}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </header>

      <div className="kpi-grid">
        <article className="kpi">
          <span className="kpi-label">Ventas completadas</span>
          <strong className="kpi-value">{resumen?.cantidadVentas ?? 0}</strong>
        </article>
        <article className="kpi">
          <span className="kpi-label">Total general</span>
          <strong className="kpi-value font-mono">
            {formatearMoneda(resumen?.totalGeneral ?? 0, config.moneda)}
          </strong>
        </article>
        <article className="kpi">
          <span className="kpi-label">Efectivo esperado</span>
          <strong className="kpi-value font-mono">
            {formatearMoneda(resumen?.efectivoEsperado ?? 0, config.moneda)}
          </strong>
          <span className="kpi-hint">Para cuadre de caja</span>
        </article>
        <article className={`kpi ${anuladas > 0 ? "is-danger" : ""}`}>
          <span className="kpi-label">Anuladas</span>
          <strong className="kpi-value font-mono">
            {formatearMoneda(resumen?.anuladas?.total ?? 0, config.moneda)}
          </strong>
          <span className="kpi-hint">{anuladas} ticket(s)</span>
        </article>
      </div>

      <section className="card methods-card">
        <div className="card-header">
          <h3 className="card-title">Por método de pago</h3>
        </div>
        {(resumen?.porMetodo || []).length === 0 ? (
          <p className="methods-empty">Sin ventas completadas.</p>
        ) : (
          <ul className="methods-list">
            {(resumen?.porMetodo || []).map((m) => (
              <li key={m.metodo}>
                <span className="method-name">{etiquetaMetodo(m.metodo)}</span>
                <span className="text-muted small">{m.cantidad} venta(s)</span>
                <strong className="method-total font-mono">
                  {formatearMoneda(m.total, config.moneda)}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="toolbar-row no-print">
        <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
          Imprimir
        </button>
        {puedeGestionarInventario && (
          <button type="button" className="btn btn-primary" onClick={onExport} disabled={exportando}>
            {exportando ? "Generando..." : "Exportar a Excel"}
          </button>
        )}
        {msgExport && <p className="status small">{msgExport}</p>}
      </div>

      <section className="cierre-detail">
        <h3 className="section-title">Detalle</h3>
        {ventas.length === 0 ? (
          <p className="text-muted small">Sin ventas en este rango.</p>
        ) : (
          <div className="table-wrap">
            <table className="table cierre-detail-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Usuario</th>
                  <th>Método</th>
                  <th className="num">Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => {
                  const anulada = v.estado === "ANULADA";
                  return (
                    <tr key={v.id} className={anulada ? "is-void" : ""}>
                      <td className="font-mono">#{v.id}</td>
                      <td>{v.atendidoPor?.nombre || "—"}</td>
                      <td>{etiquetaMetodo(v.metodoPago)}</td>
                      <td className="num">
                        <span className="sale-total">{formatearMoneda(v.total, config.moneda)}</span>
                      </td>
                      <td>
                        {anulada ? (
                          <span className="badge badge-danger">Anulada</span>
                        ) : (
                          <span className="status-dot is-ok">Completada</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {ticket && (
        <Modal titulo="Comprobante de venta" onClose={() => setTicket(null)}>
          <Comprobante venta={ticket} onClose={() => setTicket(null)} />
        </Modal>
      )}
    </div>
  );
}
