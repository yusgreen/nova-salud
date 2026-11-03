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
import { IconAlerta } from "./Icons";

const ETIQUETA_METODO = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  YAPE_PLIN: "Yape/Plin",
};

function PanelAlertas({ criticos = [], vencimientos }) {
  const tieneCriticos = criticos.length > 0;
  const tieneVencimientos = Boolean(vencimientos && vencimientos.total > 0);
  if (!tieneCriticos && !tieneVencimientos) return null;

  const totalAvisos = criticos.length + (vencimientos?.total || 0);

  return (
    <section className="alert-panel" aria-labelledby="panel-alertas">
      <div className="alert-panel-head">
        <h3 className="alert-panel-title" id="panel-alertas">
          <IconAlerta className="icon-sm" aria-hidden="true" />
          Requieren atención
        </h3>
        <span className="badge badge-warning">
          {totalAvisos} aviso{totalAvisos === 1 ? "" : "s"}
        </span>
      </div>
      <div className="alert-panel-grid">
        {tieneCriticos && (
          <div className="alert-block">
            <div className="alert-block-head">
              <span className="alert-block-title">Stock en o bajo mínimo</span>
              <span className="badge badge-warning">{criticos.length}</span>
            </div>
            <ul className="alert-list">
              {criticos.map((p) => (
                <li key={p.id}>
                  <span className="alert-name">{p.nombre}</span>
                  <span className="alert-meta font-mono">
                    {p.stock} / mín {p.stockMinimo}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {tieneVencimientos && (
          <div className="alert-block">
            <div className="alert-block-head">
              <span className="alert-block-title">Vencimientos</span>
              <span className="alert-block-badges">
                {vencimientos.porVencer > 0 && (
                  <span className="badge badge-warning">{vencimientos.porVencer} por vencer</span>
                )}
                {vencimientos.vencidos > 0 && (
                  <span className="badge badge-danger">{vencimientos.vencidos} vencidos</span>
                )}
              </span>
            </div>
            <ul className="alert-list">
              {vencimientos.cercanos.map((p) => (
                <li key={p.id}>
                  <span className="alert-name">{p.nombre}</span>
                  <span className={`badge ${p.estado === "vencido" ? "badge-danger" : "badge-warning"}`}>
                    {p.estado === "vencido" ? "Vencido" : "Vence pronto"}
                  </span>
                  <span className="alert-meta">
                    {p.dias < 0 ? `Hace ${Math.abs(p.dias)} d` : p.dias === 0 ? "Hoy" : `En ${p.dias} d`}
                    {" · "}
                    {formatearFechaVencimiento(p.fechaVencimiento)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function RecaudoPorMetodo({ datos, money }) {
  if (!datos || datos.length === 0) return null;
  return (
    <section className="card methods-card">
      <div className="card-header">
        <h3 className="card-title">Recaudado por método</h3>
      </div>
      <ul className="methods-list">
        {datos.map(({ metodo, total }) => (
          <li key={metodo}>
            <span className="method-name">{ETIQUETA_METODO[metodo] || metodo}</span>
            <strong className="method-total font-mono">{money(total)}</strong>
          </li>
        ))}
      </ul>
    </section>
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

    // Vencimientos: ignoro productos sin fecha o con fecha inválida.
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
  const encabezado = (
    <header className="dashboard-head">
      <div>
        <p className="kicker">Panel de control</p>
        <h2 className="dashboard-title">{saludo}, {usuario?.nombre?.split(" ")[0]}</h2>
        <p className="dashboard-subtitle">{config.nombreNegocio} · Resumen de hoy</p>
      </div>
    </header>
  );

  if (!puedeGestionarInventario) {
    return (
      <div className="dashboard">
        {encabezado}
        <PanelAlertas vencimientos={m.vencimientos} />
        <div className="kpi-grid">
          <article className="kpi">
            <span className="kpi-label">Ventas hoy</span>
            <strong className="kpi-value">{nVentas}</strong>
            <span className="kpi-hint">{usuario?.nombre}</span>
          </article>
          <article className="kpi">
            <span className="kpi-label">Unidades</span>
            <strong className="kpi-value">{nUnidades}</strong>
            <span className="kpi-hint">vendidas hoy</span>
          </article>
          <article className="kpi">
            <span className="kpi-label">Recaudado</span>
            <strong className="kpi-value font-mono">{money(nTotal)}</strong>
            <span className="kpi-hint">en tu turno</span>
          </article>
          <article className="kpi">
            <span className="kpi-label">Ticket promedio</span>
            <strong className="kpi-value font-mono">{m.ventasHoy ? money(nTicket) : "—"}</strong>
            <span className="kpi-hint">{m.ventasHoy ? "por venta" : "sin ventas"}</span>
          </article>
        </div>
        <RecaudoPorMetodo datos={m.porMetodo} money={money} />
      </div>
    );
  }

  return (
    <div className="dashboard">
      {encabezado}
      <PanelAlertas criticos={m.criticos} vencimientos={m.vencimientos} />
      <div className="kpi-grid">
        <article className="kpi">
          <span className="kpi-label">Ventas de hoy</span>
          <strong className="kpi-value">{m.ventasHoy}</strong>
        </article>
        <article className="kpi">
          <span className="kpi-label">Recaudado hoy</span>
          <strong className="kpi-value font-mono">{money(m.totalHoy)}</strong>
        </article>
        <article className="kpi">
          <span className="kpi-label">Ticket promedio</span>
          <strong className="kpi-value font-mono">{m.ventasHoy ? money(m.ticketPromedio) : "—"}</strong>
        </article>
        <article className="kpi">
          <span className="kpi-label">Unidades vendidas</span>
          <strong className="kpi-value">{m.unidadesHoy}</strong>
        </article>
        <article className="kpi is-wide">
          <span className="kpi-label">Más vendido hoy</span>
          <strong className="kpi-value is-text">{m.topProducto ?? "Sin ventas hoy"}</strong>
          {m.topProducto && <span className="kpi-hint">{m.topCant} unidades</span>}
        </article>
      </div>
      <RecaudoPorMetodo datos={m.porMetodo} money={money} />
    </div>
  );
}
