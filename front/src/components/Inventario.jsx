import { useMemo } from "react";
import { useProducts } from "../context/ProductContext";

export default function Inventario() {
  const { productos, loading, error } = useProducts();

  const bajoMinimo = useMemo(
    () => productos.filter((p) => p.stock <= p.stockMinimo),
    [productos]
  );

  if (loading) return <p className="status">Cargando inventario...</p>;
  if (error) return <p className="status error">{error}. Verifica el backend en puerto 4000.</p>;

  return (
    <>
      <div className="summary">
        <span className="summary-item">Productos: <strong>{productos.length}</strong></span>
        <span className="summary-item danger">Bajo mínimo: <strong>{bajoMinimo.length}</strong></span>
      </div>
      <section className="grid">
        {productos.map((p) => {
          const alerta = p.stock <= p.stockMinimo;
          return (
            <article key={p.id} className={`card ${alerta ? "alert" : ""}`}>
              <div className="card-top">
                <div className="thumb">{p.nombre.charAt(0).toUpperCase()}</div>
                {alerta && <span className="badge">Reponer</span>}
              </div>
              <h3>{p.nombre}</h3>
              <p className="muted">{p.descripcion}</p>
              <div className="price">S/ {Number(p.precio).toFixed(2)}</div>
              <div className="stock">Stock: <strong>{p.stock}</strong> / mínimo: {p.stockMinimo}</div>
            </article>
          );
        })}
      </section>
    </>
  );
}