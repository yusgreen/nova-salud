import { useMemo, useState } from "react";
import { useProducts } from "../context/ProductContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import ProductForm from "./ProductForm";
import ConfirmDialog from "./ConfirmDialog";
import { SkeletonGrid } from "./Skeleton";
export default function Inventario() {
  const { productos, loading, error, refrescar } = useProducts();
  const { puedeGestionarInventario } = useAuth();

  const [modo, setModo] = useState(null);          // null | "crear" | "editar"
  const [editando, setEditando] = useState(null);  // producto o null
  const [eliminando, setEliminando] = useState(null); // producto o null
  const [errorEliminar, setErrorEliminar] = useState("");

  const bajoMinimo = useMemo(
    () => productos.filter((p) => p.stock <= p.stockMinimo),
    [productos]
  );

  function abrirCrear() { setEditando(null); setModo("crear"); }
  function abrirEditar(p) { setEditando(p); setModo("editar"); }
  function cerrarForm() { setModo(null); setEditando(null); }

  function abrirEliminar(p) { setErrorEliminar(""); setEliminando(p); }
  function cerrarEliminar() { setEliminando(null); setErrorEliminar(""); }

  async function confirmarEliminar() {
    if (!eliminando) return;
    try {
      await api.delete(`/products/${eliminando.id}`);
      refrescar();
      cerrarEliminar();
    } catch (e) {
      // Aqui llega el 409 del back (producto con ventas) como mensaje humano.
      setErrorEliminar(e.message || "No se pudo eliminar el producto");
    }
  }

  if (loading) return <SkeletonGrid count={4} />;  if (error) return <p className="status error">{error}. Verifica el backend en puerto 4000.</p>;

  return (
    <>
      <div className="inv-head">
        <div className="summary">
          <span className="summary-item">Productos: <strong>{productos.length}</strong></span>
          <span className="summary-item danger">Bajo mínimo: <strong>{bajoMinimo.length}</strong></span>
        </div>
        {puedeGestionarInventario && (
          <button className="btn-primary" onClick={abrirCrear}>+ Nuevo producto</button>
        )}
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

              {puedeGestionarInventario && (
                <div className="card-actions">
                  <button className="btn-ghost btn-sm" onClick={() => abrirEditar(p)}>Editar</button>
                  <button className="btn-ghost btn-sm danger" onClick={() => abrirEliminar(p)}>Eliminar</button>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {modo && (
        <ProductForm initial={editando} onClose={cerrarForm} />
      )}

      {eliminando && (
        <ConfirmDialog
          titulo="Eliminar producto"
          mensaje={`¿Seguro que deseas eliminar "${eliminando.nombre}"? Esta acción no se puede deshacer.`}
          peligro
          error={errorEliminar}
          onConfirm={confirmarEliminar}
          onCancel={cerrarEliminar}
        />
      )}
    </>
  );
}