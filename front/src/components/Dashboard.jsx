import { useEffect, useMemo, useState } from "react";
import { useSales } from "../context/SalesContext";
import { useProducts } from "../context/ProductContext";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { api } from "../services/api";
import { formatearMoneda } from "../services/format";
import {
  diasHastaVencimiento,
  estadoVencimiento,
  formatearFechaVencimiento,
} from "../services/vencimientos";
import { useCountUp } from "../hooks/useCountUp";
import { SkeletonGrid } from "./Skeleton";
import { IlustracionPulso } from "./Illustrations";

function ListaVencimientos({ datos }) {
  if (!datos || datos.cercanos.length === 0) return null;
  return (
    <div className="dash-list">
      <p className="muted small">
        Próximos vencimientos · {datos.porVencer} por vencer · {datos.vencidos} vencidos
      </p>
      <ul>
        {datos.cercanos.map((p) => (
          <li key={p.id}>
            <span className="dash-li-nombre">{p.nombre}</span>{" "}
            <span className={`venc-chip ${p.estado}`}>
              {p.estado === "vencido" ? "Vencido" : "Vence pronto"}
            </span>{" "}
            <span className="muted small">
              {p.dias < 0 ? `hace ${Math.abs(p.dias)} d` : `en ${p.dias} d`} · {formatearFechaVencimiento(p.fechaVencimiento)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const { usuario, puedeGestionarInventario } = useAuth();
  const { config } = useConfig();
  const { ventas: ventasGerente, loading: loadingGerente, error: errorGerente } = useSales();
  const { productos } = useProducts();

  const money = (n) => formatearMoneda(n, config.moneda);

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

    const hoy = (ventas || []).filter(
      (v) => v.estado !== "ANULADA" && new Date(v.fecha) >= inicioHoy
    );
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

    const criticos = (productos || []).filter(
      (p) => p.activo !== false && p.stock <= p.stockMinimo
    );

    // Vencimientos: ignoro productos sin fecha o con fecha invǭlida.
    const vencimientos = (productos || [])
      .filter((p) => p.activo !== false)
      .map((p) => ({
        ...p,
        dias: diasHastaVencimiento(p.fechaVencimiento),
        estado: estadoVencimiento(p.fechaVencimiento),
      }))
      .filter((p) => p.estado === "pronto" || p.estado === "vencido")
      .sort((a, b) => a.dias - b.dias);
    const vencidos = vencimientos.filter((p) => p.estado === "vencido").length;

    const porMetodo = {};
    hoy.forEach((v) => {
      const metodo = v.metodoPago || "EFECTIVO";
      porMetodo[metodo] = (porMetodo[metodo] || 0) + Number(v.total || 0);
    });

    return {
      ventasHoy: hoy.length,
      totalHoy,
      unidadesHoy,
      ticketPromedio,
      topProducto,
      topCant,
      criticos,
      porMetodo: Object.entries(porMetodo).map(([metodo, total]) => ({
        metodo,
        total,
      })),
      vencimientos: {
        total: vencimientos.length,
        porVencer: vencimientos.length - vencidos,
        vencidos,
        cercanos: vencimientos.slice(0, 5),
      },
    };
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
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  const hero = (
    <div className="dash-hero">
      <div>
        <p className="dash-hero-kicker">Panel de control</p>
        <h2>{saludo}, {usuario?.nombre?.split(" ")[0]}</h2>
        <p className="muted small">{config.nombreNegocio} · Resumen de hoy</p>
      </div>
      <IlustracionPulso className="dash-hero-art" />
    </div>
  );

  if (!puedeGestionarInventario) {
    return (
      <div className="dash">
        {hero}
        <p className="muted small">Tu turno de hoy · {usuario?.nombre}</p>
        <div className="dash-grid">
          <div className="dash-card"><span className="dash-num">{nVentas}</span><span className="dash-label">Ventas hoy</span></div>
          <div className="dash-card"><span className="dash-num">{nUnidades}</span><span className="dash-label">Unidades</span></div>
          <div className="dash-card"><span className="dash-num">{money(nTotal)}</span><span className="dash-label">Recaudado</span></div>
          <div className="dash-card"><span className="dash-num">{m.ventasHoy ? money(nTicket) : "—"}</span><span className="dash-label">Ticket promedio</span></div>
          <div className={`dash-card ${m.vencimientos.total ? "dash-alert" : ""}`}>
            <span className="dash-num">{m.vencimientos.total}</span>
            <span className="dash-label">Por vencer / vencidos</span>
          </div>
        </div>
        {m.porMetodo.length > 0 && (
          <div className="dash-metodos">
            <p className="muted small">Recaudado por método</p>
            <ul>
              {m.porMetodo.map(({ metodo, total }) => (
                <li key={metodo}>
                  <span>
                    {metodo === "TARJETA"
                      ? "Tarjeta"
                      : metodo === "YAPE_PLIN"
                        ? "Yape/Plin"
                        : "Efectivo"}
                  </span>
                  <strong>{money(total)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ListaVencimientos datos={m.vencimientos} />
      </div>
    );
  }
  return (
    <div className="dash">
      {hero}
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
        <div className={`dash-card ${m.vencimientos.total ? "dash-alert" : ""}`}>
          <span className="dash-num">{m.vencimientos.total}</span>
          <span className="dash-label">Por vencer / vencidos</span>
        </div>
      </div>

      {m.porMetodo.length > 0 && (
        <div className="dash-metodos">
          <p className="muted small">Recaudado por método</p>
          <ul>
            {m.porMetodo.map(({ metodo, total }) => (
              <li key={metodo}>
                <span>
                  {metodo === "TARJETA"
                    ? "Tarjeta"
                    : metodo === "YAPE_PLIN"
                      ? "Yape/Plin"
                      : "Efectivo"}
                </span>
                <strong>{money(total)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      <ListaVencimientos datos={m.vencimientos} />
    </div>
  );
}