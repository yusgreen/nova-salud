import { useEffect, useMemo, useState } from "react";
import { useSales } from "../context/SalesContext";
import { useProducts } from "../context/ProductContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { useCountUp } from "../hooks/useCountUp";
import { SkeletonGrid } from "./Skeleton";

function money(n) { return `S/ ${Number(n || 0).toFixed(2)}`; }

export default function Dashboard() {
  const { usuario, puedeGestionarInventario } = useAuth();
  const { ventas: ventasGerente, loading: loadingGerente, error: errorGerente } = useSales();
  const { productos } = useProducts();

  // El cajero NO puede llamar GET /sales (403, y el SalesContext lo guarda por rol).
  // Por eso trae SU turno via GET /sales/mi-turno con fetch local (simetrico a Auditoria.jsx).
  const [misVentas, setMisVentas] = useState([]);
  const [loadingCajero, setLoadingCajero] = useState(true);
  const [errorCajero, setErrorCajero] = useState("");
  useEffect(() => {
    if (puedeGestionarInventario) { setLoadingCajero(false); return; }   // gerente no usa este fetch
    let activo = true;
    api.get("/sales/mi-turno")
      .then((d) => { if (activo) { setMisVentas(d); setErrorCajero(""); } })
      .catch((e) => { if (activo) setErrorCajero(e.message || "No se pudo cargar tu turno"); })
      .finally(() => { if (activo) setLoadingCajero(false); });
    return () => { activo = false; };
  }, [puedeGestionarInventario]);

  const ventas = puedeGestionarInventario ? ventasGerente : misVentas;
  const loading = puedeGestionarInventario ? loadingGerente : loadingCajero;
  const error = puedeGestionarInventario ? errorGerente : errorCajero;

  // "Hoy" definido UNA sola vez, con la hora local del navegador (ver decisión arriba).
  const metricas = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const inicioHoy = d;

    const hoy = (ventas || []).filter((v) => new Date(v.fecha) >= inicioHoy);
    const totalHoy = hoy.reduce((s, v) => s + Number(v.total || 0), 0);
    const unidadesHoy = hoy.reduce(
      (s, v) => s + (v.detalles || []).reduce((a, l) => a + Number(l.cantidad || 0), 0), 0
    );
    const ticketPromedio = hoy.length ? totalHoy / hoy.length : 0;

    // Producto más vendido HOY (agrupa líneas por nombre). Empate: toma el primero del map (nota §11).
    const porProducto = {};
    hoy.forEach((v) => (v.detalles || []).forEach((l) => {
      const nombre = l.producto?.nombre || "(eliminado)";
      porProducto[nombre] = (porProducto[nombre] || 0) + Number(l.cantidad || 0);
    }));
    let topProducto = null, topCant = 0;
    Object.entries(porProducto).forEach(([nombre, cant]) => {
      if (cant > topCant) { topCant = cant; topProducto = nombre; }
    });

    const criticos = (productos || []).filter((p) => p.stock <= p.stockMinimo);

    return { ventasHoy: hoy.length, totalHoy, unidadesHoy, ticketPromedio, topProducto, topCant, criticos };
   }, [ventas, productos]);

  // P2: count-up. Declarados ANTES de los returns tempranos para no condicionar hooks.
  // topProducto (string) y criticos.length (señal de acción) NO se animan a propósito.
  const nVentas = useCountUp(metricas.ventasHoy);
  const nUnidades = useCountUp(metricas.unidadesHoy);
  const nTotal = useCountUp(metricas.totalHoy);
  const nTicket = useCountUp(metricas.ticketPromedio);

  if (loading) return <SkeletonGrid count={4} />;
  if (error) return <p className="status error">{error}</p>;

  const m = metricas;
  if (!puedeGestionarInventario) {
    return (
      <div className="dash">
        <p className="muted small">Tu turno de hoy · {usuario?.nombre}</p>
        <div className="dash-grid">
          <div className="dash-card"><span className="dash-num">{nVentas}</span><span className="dash-label">Ventas hoy</span></div>
          <div className="dash-card"><span className="dash-num">{nUnidades}</span><span className="dash-label">Unidades</span></div>
          <div className="dash-card"><span className="dash-num">{money(nTotal)}</span><span className="dash-label">Recaudado</span></div>
          <div className="dash-card"><span className="dash-num">{m.ventasHoy ? money(nTicket) : "—"}</span><span className="dash-label">Ticket promedio</span></div>
        </div>
      </div>
    );
  }
  return (
    <div className="dash">
      <div className="dash-grid">
        <div className="dash-card">
          <span className="dash-num">{m.ventasHoy}</span>
          <span className="dash-label">Ventas de hoy</span>
        </div>
        <div className="dash-card">
          <span className="dash-num">{money(m.totalHoy)}</span>
          <span className="dash-label">Recaudado hoy</span>
        </div>
        <div className="dash-card">
          <span className="dash-num">{m.ventasHoy ? money(m.ticketPromedio) : "—"}</span>
          <span className="dash-label">Ticket promedio</span>
        </div>
        <div className="dash-card">
          <span className="dash-num">{m.unidadesHoy}</span>
          <span className="dash-label">Unidades vendidas</span>
        </div>
        <div className="dash-card dash-wide">
          <span className="dash-num dash-num-sm">{m.topProducto ?? "Sin ventas hoy"}</span>
          <span className="dash-label">Más vendido {m.topProducto ? `· ${m.topCant} u.` : ""}</span>
        </div>
        <div className={`dash-card ${m.criticos.length ? "dash-alert" : ""}`}>
          <span className="dash-num">{m.criticos.length}</span>
          <span className="dash-label">Requieren reposición</span>
        </div>
      </div>

      {m.criticos.length > 0 && (
        <div className="dash-list">
          <p className="muted small">Stock en o bajo mínimo:</p>
          <ul>
            {m.criticos.map((p) => (
              <li key={p.id}><span className="dash-li-nombre">{p.nombre}</span> <span className="muted small">stock {p.stock} / mín {p.stockMinimo}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}