import { useSales } from "../context/SalesContext";

function fechaLegible(iso) {
  try {
    return new Date(iso).toLocaleString("es-PE", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function Ventas() {
  const { ventas, loading, error } = useSales();   // <- ya no hace fetch propio

  if (loading) return <p className="status">Cargando historial…</p>;
  if (error) return <p className="status error">{error}</p>;
  if (ventas.length === 0)
    return <p className="muted">Todavía no hay ventas registradas.</p>;

  return (
    <div className="ventas-list">
      {ventas.map((v) => {
        const items = v.detalles.reduce((acc, l) => acc + l.cantidad, 0);
        return (
          <article key={v.id} className="venta-card">
            <header className="venta-head">
              <div>
                <span className="venta-id">Ticket #{v.id}</span>
                <span className="muted small">{fechaLegible(v.fecha)}</span>
              </div>
              <div className="venta-meta">
                <span className="chip-rol">{v.atendidoPor?.nombre} · {v.atendidoPor?.rol}</span>
                <strong className="venta-total">S/ {Number(v.total).toFixed(2)}</strong>
              </div>
            </header>

            <table className="venta-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Cant.</th>
                  <th className="num">P. unit.</th>
                  <th className="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {v.detalles.map((l) => (
                  <tr key={l.productoId}>   {/* productoId existe en GET y en evento */}
                    <td>{l.producto?.nombre ?? "(producto eliminado)"}</td>
                    <td className="num">{l.cantidad}</td>
                    <td className="num">S/ {Number(l.precioUnitario).toFixed(2)}</td>
                    <td className="num">S/ {(l.cantidad * l.precioUnitario).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <footer className="venta-foot muted small">
              {items} unidad(es) en {v.detalles.length} línea(s)
            </footer>
          </article>
        );
      })}
    </div>
  );
}