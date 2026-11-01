import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { SkeletonLines } from "./Skeleton";
import { IlustracionAuditoriaVacia } from "./Illustrations";

const ETIQUETA_ACCION = {
  LOGIN: "Inició sesión",
  LOGIN_FALLIDO: "Intento fallido de acceso",
  REGISTER: "Registró usuario",
  SALE_CREATE: "Registró una venta",
  SALE_VOID: "Anuló una venta",
  PRODUCT_CREATE: "Creó un producto",
  PRODUCT_UPDATE: "Editó un producto",
  PRODUCT_DELETE: "Eliminó un producto",
  CONFIG_UPDATE: "Cambió la configuración",
  PROFILE_UPDATE: "Actualizó su perfil",
  PASSWORD_CHANGE: "Cambió su contraseña",
  USER_CREATE: "Creó un usuario",
  USER_UPDATE: "Actualizó un usuario",
  USER_STATUS: "Cambió el estado de un usuario",
  STOCK_ENTRY: "Recibió mercadería",
};

const ETIQUETA_CAMPO = {
  email: "Correo",
  rol: "Rol",
  nombre: "Nombre",
  nombreNegocio: "Nombre del negocio",
  lema: "Lema",
  moneda: "Moneda",
  umbralStockBajo: "Umbral de stock bajo",
  mostrarAyudaDemo: "Mostrar credenciales demo",
  codigo: "Código",
  precio: "Precio",
  stock: "Stock",
  stockMinimo: "Stock mínimo",
  categoria: "Categoría",
  proveedor: "Proveedor",
  motivo: "Motivo",
  cantidad: "Cantidad",
  stockAnterior: "Stock anterior",
  stockNuevo: "Stock nuevo",
  total: "Total",
  metodoPago: "Método de pago",
  vuelto: "Vuelto",
  cantidadLineas: "Líneas",
  nota: "Nota",
};

function etiquetaAccion(a) {
  return ETIQUETA_ACCION[a] || a;
}

function etiquetaCampo(clave) {
  return ETIQUETA_CAMPO[clave] || clave;
}

function formatearValor(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function paresDetalle(detalle) {
  if (!detalle) return [];
  if (typeof detalle === "string") return [detalle];
  const pares = [];
  for (const [clave, valor] of Object.entries(detalle)) {
    if (clave === "cambios" && valor && typeof valor === "object") {
      for (const [c, v] of Object.entries(valor)) {
        if (v && typeof v === "object" && ("antes" in v || "despues" in v)) {
          pares.push(`${etiquetaCampo(c)}: ${formatearValor(v.antes)} → ${formatearValor(v.despues)}`);
        } else {
          pares.push(`${etiquetaCampo(c)}: ${formatearValor(v)}`);
        }
      }
    } else if (valor && typeof valor === "object" && ("antes" in valor || "despues" in valor)) {
      pares.push(`${etiquetaCampo(clave)}: ${formatearValor(valor.antes)} → ${formatearValor(valor.despues)}`);
    } else {
      pares.push(`${etiquetaCampo(clave)}: ${formatearValor(valor)}`);
    }
  }
  return pares;
}

function fecha(iso) {
  try {
    return new Date(iso).toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

const ACCIONES = [
  "",
  "LOGIN",
  "LOGIN_FALLIDO",
  "REGISTER",
  "SALE_CREATE",
  "SALE_VOID",
  "PRODUCT_CREATE",
  "PRODUCT_UPDATE",
  "PRODUCT_DELETE",
  "CONFIG_UPDATE",
  "PROFILE_UPDATE",
  "PASSWORD_CHANGE",
  "USER_CREATE",
  "USER_UPDATE",
  "USER_STATUS",
  "STOCK_ENTRY",
].map((v) => ({ v, l: v ? etiquetaAccion(v) : "Todas" }));

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    let activo = true;
    api
      .get("/audit")
      .then((d) => {
        if (activo) {
          setLogs(d);
          setError("");
        }
      })
      .catch((e) => {
        if (activo) setError(e.message || "No se pudo cargar la auditoría");
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const vistos = useMemo(
    () => (filtro ? logs.filter((l) => l.accion === filtro) : logs),
    [logs, filtro]
  );

  if (loading) return <SkeletonLines count={6} />;
  if (error) return <p className="status error">{error}</p>;

  return (
    <div>
      <div className="aud-toolbar">
        <label className="muted small">
          Filtrar por acción
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            {ACCIONES.map((a) => (
              <option key={a.v} value={a.v}>{a.l}</option>
            ))}
          </select>
        </label>
        <span className="muted small">{vistos.length} registro(s)</span>
      </div>

      {vistos.length === 0 ? (
        <div className="empty-state compact">
          <IlustracionAuditoriaVacia className="empty-art" />
          <h3>{logs.length === 0 ? "Todavía no hay movimientos" : "Sin registros para este filtro"}</h3>
          <p className="muted">
            {logs.length === 0
              ? "Las acciones importantes del sistema se van a registrar aquí."
              : "Prueba con otra acción o vuelve a “Todas”."}
          </p>
        </div>
      ) : (
        <div className="aud-scroll">
          <table className="aud-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Detalle</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {vistos.map((l) => (
                <tr key={l.id} className={l.accion === "LOGIN_FALLIDO" ? "aud-danger" : ""}>
                  <td className="nowrap">{fecha(l.fecha)}</td>
                  <td className="nowrap">{l.usuario?.nombre ?? "—"}</td>
                  <td className="nowrap">
                    <span className="chip-rol">{l.usuario?.rol ?? "—"}</span>
                  </td>
                  <td className="nowrap">
                    <span className={`aud-tag tag-${l.accion}`}>{etiquetaAccion(l.accion)}</span>
                  </td>
                  <td className="nowrap">
                    {l.entidad}
                    {l.entidadId ? ` #${l.entidadId}` : ""}
                  </td>
                  <td className="aud-detalle">
                    <div className="aud-detalle-list">
                      {paresDetalle(l.detalle).length
                        ? paresDetalle(l.detalle).map((t, i) => <span key={i}>{t}</span>)
                        : "—"}
                    </div>
                  </td>
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
