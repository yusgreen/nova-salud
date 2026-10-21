import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { SkeletonLines } from "./Skeleton";
const ACCIONES = [
  { v: "", l: "Todas" },
  { v: "LOGIN", l: "Login" },
  { v: "LOGIN_FALLIDO", l: "Login fallido" },
  { v: "REGISTER", l: "Registro" },
  { v: "SALE_CREATE", l: "Venta" },
  { v: "PRODUCT_CREATE", l: "Producto creado" },
  { v: "PRODUCT_UPDATE", l: "Producto editado" },
  { v: "PRODUCT_DELETE", l: "Producto borrado" },
];

function etiqueta(a) { return ACCIONES.find(x => x.v === a)?.l || a; }
function fecha(iso) {
  try { return new Date(iso).toLocaleString("es-PE", { day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit" }); }
  catch { return iso; }
}

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    let activo = true;
    api.get("/audit")
      .then((d) => { if (activo) { setLogs(d); setError(""); } })
      .catch((e) => { if (activo) setError(e.message || "No se pudo cargar la auditoría"); })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, []);

  const vistos = useMemo(
    () => (filtro ? logs.filter((l) => l.accion === filtro) : logs),
    [logs, filtro]
  );

if (loading) return <SkeletonLines count={6} />;  if (error) return <p className="status error">{error}</p>;

  return (
    <div>
      <div className="aud-toolbar">
        <label className="muted small">Filtrar por acción
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            {ACCIONES.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
          </select>
        </label>
        <span className="muted small">{vistos.length} registro(s)</span>
      </div>

      {vistos.length === 0 ? (
        <p className="muted">Sin registros para este filtro.</p>
      ) : (
        <div className="aud-scroll">
          <table className="aud-table">
            <thead>
              <tr><th>Fecha</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Entidad</th><th>Detalle</th><th>IP</th></tr>
            </thead>
            <tbody>
              {vistos.map((l) => (
                <tr key={l.id} className={l.accion === "LOGIN_FALLIDO" ? "aud-danger" : ""}>
                  <td className="nowrap">{fecha(l.fecha)}</td>
                  <td>{l.usuario?.nombre ?? "—"}</td>
                  <td><span className="chip-rol">{l.usuario?.rol ?? "—"}</span></td>
                  <td><span className={`aud-tag tag-${l.accion}`}>{etiqueta(l.accion)}</span></td>
                  <td>{l.entidad}{l.entidadId ? ` #${l.entidadId}` : ""}</td>
                  <td className="aud-detalle">{l.detalle ? JSON.stringify(l.detalle) : "—"}</td>
                  <td className="nowrap muted small">{l.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}