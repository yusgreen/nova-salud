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

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function fraseDelPanel({ ventasHoy, totalHoy, topProducto, topCant }, money, esCajero) {
  const donde = esCajero ? "en tu turno" : "hoy";
  if (!ventasHoy) {
    return esCajero
      ? "Aún no registras ventas en este turno. ¡Empecemos!"
      : "Todavía no hay ventas hoy. Buen momento para revisar el stock.";
  }

  const ventas = `${ventasHoy} ${ventasHoy === 1 ? "venta" : "ventas"}`;
  const recaudado = money(totalHoy);
  let frase;
  if (ventasHoy < 5) {
    frase = `Buen arranque: ${ventas} y ${recaudado} ${donde}.`;
  } else if (ventasHoy < 15) {
    frase = `Buen ritmo: ${ventas} y ${recaudado} recaudado ${donde}.`;
  } else {
    frase = `¡Excelente jornada! ${ventas} y ${recaudado} recaudado ${donde}.`;
  }
  if (topProducto) {
    frase += ` Lo más vendido: ${topProducto} (${topCant} u.).`;
  }
  return frase;
}

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
  return (
    <section className="card methods-card">
      <div className="card-header">
        <h3 className="card-title">Recaudado por método</h3>
      </div>
      {!datos || datos.length === 0 ? (
        <p className="chart-empty">Sin ventas registradas hoy.</p>
      ) : (
        <ul className="methods-list">
          {datos.map(({ metodo, total }) => (
            <li key={metodo}>
              <span className="method-name">{ETIQUETA_METODO[metodo] || metodo}</span>
              <strong className="method-total font-mono">{money(total)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GraficoVentasSemana({ serie, money }) {
  const totalSemana = serie.reduce((s, d) => s + d.total, 0);
  const max = Math.max(...serie.map((d) => d.total), 0);

  return (
    <section className="card chart-card">
      <div className="card-header chart-head">
        <h3 className="card-title">Ventas de los últimos 7 días</h3>
        <span className="chart-total font-mono">{money(totalSemana)}</span>
      </div>
      {max === 0 ? (
        <p className="chart-empty">Sin ventas registradas en los últimos 7 días.</p>
      ) : (
        <div
          className="chart-bars"
          role="img"
          aria-label={`Recaudado por día en los últimos 7 días, total ${money(totalSemana)}`}
        >
          {serie.map((d) => {
            const alto = d.total > 0 ? Math.max((d.total / max) * 100, 6) : 0;
            return (
              <div
                className="chart-col"
                key={d.iso}
                title={`${d.etiqueta}: ${money(d.total)} · ${d.cantidad} ${d.cantidad === 1 ? "venta" : "ventas"}`}
              >
                <div className="chart-bar-wrap">
                  <div className="chart-bar" style={{ height: `${alto}%` }} />
                </div>
                <span className="chart-label">{d.etiqueta}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MiniCalendarioSemanal({ serie, money }) {
  const total = serie.reduce((s, d) => s + d.total, 0);

  return (
    <section className="card chart-card">
      <div className="card-header chart-head">
        <h3 className="card-title">Ventas de la semana</h3>
        <span className="chart-total font-mono">{money(total)}</span>
      </div>
      <div className="week-cal" role="img" aria-label={`Ventas por día de los últimos 7 días, total ${money(total)}`}>
        {serie.map((d) => (
          <div
            className={`week-day${d.esHoy ? " is-today" : ""}`}
            key={d.iso}
            title={`${d.etiqueta} ${d.dia}: ${money(d.total)} · ${d.cantidad} ${d.cantidad === 1 ? "venta" : "ventas"}`}
          >
            <span className="week-dow">{d.etiqueta}</span>
            <span className="week-num">{d.dia}</span>
            <span className="week-amount font-mono">{d.total > 0 ? money(d.total) : "—"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function GraficoTopProductos({ items }) {
  const max = Math.max(...items.map((i) => i.cant), 0);

  return (
    <section className="card chart-card">
      <div className="card-header chart-head">
        <h3 className="card-title">Productos más vendidos</h3>
        <span className="chart-hint">últimos 7 días</span>
      </div>
      {items.length === 0 ? (
        <p className="chart-empty">Sin ventas registradas en los últimos 7 días.</p>
      ) : (
        <ul className="hbar-list">
          {items.map((i) => (
            <li className="hbar-row" key={i.nombre}>
              <span className="hbar-name" title={i.nombre}>{i.nombre}</span>
              <span className="hbar-track">
                <span className="hbar-fill" style={{ width: `${(i.cant / max) * 100}%` }} />
              </span>
              <span className="hbar-value font-mono">{i.cant}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { usuario, puedeGestionarInventario, esFarmaceutico } = useAuth();
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

    // Serie de los últimos 7 días (incluye hoy) para el gráfico del gerente.
    const inicioSerie = new Date(inicioHoy);
    inicioSerie.setDate(inicioSerie.getDate() - 6);
    const serieSemana = Array.from({ length: 7 }, (_, i) => {
      const fecha = new Date(inicioSerie);
      fecha.setDate(inicioSerie.getDate() + i);
      return {
        iso: fecha.toISOString(),
        etiqueta: DIAS_CORTOS[fecha.getDay()],
        dia: fecha.getDate(),
        esHoy: i === 6,
        total: 0,
        cantidad: 0,
      };
    });
    const enSerie = (ventas || []).filter(
      (v) => v.estado !== "ANULADA" && new Date(v.fecha) >= inicioSerie
    );
    enSerie.forEach((v) => {
      const f = new Date(v.fecha); f.setHours(0, 0, 0, 0);
      const idx = Math.round((f - inicioSerie) / 86400000);
      if (idx >= 0 && idx < 7) {
        serieSemana[idx].total += Number(v.total || 0);
        serieSemana[idx].cantidad += 1;
      }
    });

    // Top productos de la última semana.
    const porProductoSemana = {};
    enSerie.forEach((v) => (v.detalles || []).forEach((l) => {
      const nombre = l.producto?.nombre || "(eliminado)";
      porProductoSemana[nombre] = (porProductoSemana[nombre] || 0) + Number(l.cantidad || 0);
    }));
    const topProductos = Object.entries(porProductoSemana)
      .map(([nombre, cant]) => ({ nombre, cant }))
      .sort((a, b) => b.cant - a.cant)
      .slice(0, 5);

    return {
      ventasHoy: hoy.length,
      totalHoy,
      unidadesHoy,
      ticketPromedio,
      topProducto,
      topCant,
      criticos,
      serieSemana,
      topProductos,
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
  const frasePanel = fraseDelPanel(m, money, false);
  const encabezado = (
    <header className="dashboard-head">
      <div>
        <p className="kicker">Panel de control</p>
        <h2 className="dashboard-title">
          {esFarmaceutico ? "Control de inventario" : "Resumen de la farmacia"}
        </h2>
        <p className="dashboard-subtitle">{frasePanel}</p>
      </div>
    </header>
  );

  if (!puedeGestionarInventario) {
    return (
      <div className="dashboard">
        <header className="dashboard-head is-cajero">
          <div>
            <p className="kicker">Panel de control</p>
            <h2 className="dashboard-title">Tu turno de hoy</h2>
            <p className="dashboard-subtitle">{fraseDelPanel(m, money, true)}</p>
          </div>
          {/* Ilustración: cobro y venta */}
          <div className="cashier-illustration" aria-hidden="true">
            <svg viewBox="0 0 240 170" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="240" height="170" rx="18" fill="var(--action-soft)" opacity="0.85" />

              {/* Sombra */}
              <ellipse cx="104" cy="160" rx="64" ry="8" fill="#0f172a" opacity="0.07" />

              {/* Recibo */}
              <path d="M92 30 a4 4 0 0 1 4 -4 h34 a4 4 0 0 1 4 4 v52 l-7 -5 -7 5 -7 -5 -7 5 -7 -5 -7 5 z" fill="var(--bg-elevated)" stroke="var(--border-strong)" strokeWidth="1.5" />
              <rect x="100" y="38" width="28" height="3" rx="1.5" fill="var(--border-strong)" />
              <rect x="100" y="46" width="20" height="3" rx="1.5" fill="var(--border-strong)" />
              <rect x="100" y="54" width="24" height="3" rx="1.5" fill="var(--border-strong)" />

              {/* Caja registradora */}
              <rect x="44" y="72" width="118" height="74" rx="10" fill="var(--bg-elevated)" stroke="var(--border-strong)" strokeWidth="1.5" />
              <rect x="58" y="82" width="90" height="38" rx="6" fill="#d1fae5" />
              <text x="103" y="107" textAnchor="middle" fill="#059669" fontSize="17" fontWeight="700" fontFamily="ui-monospace, monospace">$0.00</text>
              <rect x="58" y="128" width="12" height="8" rx="2" fill="var(--border-strong)" />
              <rect x="74" y="128" width="12" height="8" rx="2" fill="var(--border-strong)" />
              <rect x="90" y="128" width="12" height="8" rx="2" fill="var(--border-strong)" />
              <rect x="106" y="128" width="12" height="8" rx="2" fill="var(--border-strong)" />
              <rect x="34" y="146" width="138" height="18" rx="5" fill="var(--bg-muted)" stroke="var(--border-strong)" strokeWidth="1.2" />
              <rect x="94" y="152" width="18" height="4" rx="2" fill="var(--border-strong)" />

              {/* Bolsa de compra */}
              <path d="M186 60 v-6 a13 13 0 0 1 26 0 v6" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
              <rect x="180" y="60" width="38" height="44" rx="7" fill="#34d399" />
              <path d="M199 88 C194 84 188 80 188 75 C188 71 192 69 195 71 C197 72 198 74 199 76 C200 74 201 72 203 71 C206 69 210 71 210 75 C210 80 204 84 199 88 Z" fill="#ffffff" opacity="0.95" />

              {/* Monedas */}
              <circle cx="196" cy="150" r="13" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" />
              <circle cx="214" cy="138" r="10" fill="#fcd34d" stroke="#f59e0b" strokeWidth="1.2" />
              <circle cx="182" cy="140" r="8" fill="#fde68a" stroke="#f59e0b" strokeWidth="1" />

              {/* Destellos */}
              <path d="M34 30 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 z" fill="#fbbf24" />
              <path d="M214 34 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="#fb7185" opacity="0.85" />
              <circle cx="30" cy="120" r="4" fill="#34d399" opacity="0.5" />
            </svg>
          </div>
        </header>
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
      <div className="charts-grid">
        <RecaudoPorMetodo datos={m.porMetodo} money={money} />
        <MiniCalendarioSemanal serie={m.serieSemana} money={money} />
        <GraficoVentasSemana serie={m.serieSemana} money={money} />
        <GraficoTopProductos items={m.topProductos} />
      </div>
    </div>
  );
}
