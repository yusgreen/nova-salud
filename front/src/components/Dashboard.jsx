import { useMemo } from "react";
import { useSales } from "../context/SalesContext";
import { useProducts } from "../context/ProductContext";
import { useAuth } from "../context/AuthContext";

function money(n) { return `S/ ${Number(n || 0).toFixed(2)}`; }

export default function Dashboard() {
  const { puedeGestionarInventario } = useAuth();
  const { ventas, loading, error } = useSales();
  const { productos } = useProducts();

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

  if (loading) return <p className="status">Cargando panel…</p>;
  if (error) return <p className="status error">{error}</p>;

  const m = metricas;
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