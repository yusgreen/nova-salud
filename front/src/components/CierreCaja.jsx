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

  return (
    <div className="cierre-page cierre-print">
      <header className="cierre-head">
        <div>
          <h2>Cierre de caja</h2>
          <p className="muted">Resumen de ventas por fecha y usuario.</p>
        </div>
        <div className="cierre-filtros">
          <label>
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
          <label>
            Usuario
            <select
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

      <div className="cierre-resumen">
        <div className="cierre-card">
          <span className="cierre-num">{resumen?.cantidadVentas ?? 0}</span>
          <span className="cierre-label">Ventas completadas</span>
        </div>
        <div className="cierre-card">
          <span className="cierre-num">
            {formatearMoneda(resumen?.totalGeneral ?? 0, config.moneda)}
          </span>
          <span className="cierre-label">Total general</span>
        </div>
        <div className="cierre-card">
          <span className="cierre-num">
            {formatearMoneda(resumen?.efectivoEsperado ?? 0, config.moneda)}
          </span>
          <span className="cierre-label">Efectivo esperado</span>
        </div>
        <div className="cierre-card">
          <span className="cierre-num">{resumen?.anuladas?.cantidad ?? 0}</span>
          <span className="cierre-label">
            Anuladas ({formatearMoneda(resumen?.anuladas?.total ?? 0, config.moneda)})
          </span>
        </div>
      </div>

      <div className="cierre-metodos">
        <h3>Por método de pago</h3>
        {(resumen?.porMetodo || []).length === 0 ? (
          <p className="muted small">Sin ventas completadas.</p>
        ) : (
          <ul>
            {(resumen?.porMetodo || []).map((m) => (
              <li key={m.metodo}>
                <span>{etiquetaMetodo(m.metodo)}</span>
                <span className="muted small">{m.cantidad} venta(s)</span>
                <strong>{formatearMoneda(m.total, config.moneda)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="cierre-acciones">
        <button type="button" className="btn-ghost" onClick={() => window.print()}>
          Imprimir
        </button>
        {puedeGestionarInventario && (
          <button type="button" className="btn-primary" onClick={onExport} disabled={exportando}>
            {exportando ? "Generando..." : "Exportar a Excel"}
          </button>
        )}
        {msgExport && <p className="status small">{msgExport}</p>}
      </div>

      <div className="cierre-lista">
        <h3>Detalle</h3>
        {ventas.length === 0 ? (
          <p className="muted small">Sin ventas en este rango.</p>
        ) : (
          <table className="cierre-table">
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
              {ventas.map((v) => (
                <tr key={v.id} className={v.estado === "ANULADA" ? "anulada" : ""}>
                  <td>#{v.id}</td>
                  <td>{v.atendidoPor?.nombre || "—"}</td>
                  <td>{etiquetaMetodo(v.metodoPago)}</td>
                  <td className="num">{formatearMoneda(v.total, config.moneda)}</td>
                  <td>{v.estado === "ANULADA" ? "Anulada" : "Completada"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {ticket && (
        <Modal titulo="Comprobante de venta" onClose={() => setTicket(null)}>
          <Comprobante venta={ticket} onClose={() => setTicket(null)} />
        </Modal>
      )}
    </div>
  );
}
