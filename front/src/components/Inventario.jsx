import { useMemo, useState } from "react";
import { useProducts } from "../context/ProductContext";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";
import { formatearMoneda } from "../services/format";
import {
  diasHastaVencimiento,
  estadoVencimiento,
  formatearFechaVencimiento,
} from "../services/vencimientos";
import ProductForm from "./ProductForm";
import Modal from "./Modal";
import { SkeletonGrid } from "./Skeleton";
import { IlustracionInventarioVacio } from "./Illustrations";
export default function Inventario() {
  const { productos, loading, error, refrescar } = useProducts();
  const { puedeGestionarInventario } = useAuth();
  const { config } = useConfig();
  const { notificar } = useToast();

  const [modo, setModo] = useState(null);          // null | "crear" | "editar"
  const [editando, setEditando] = useState(null);  // producto o null
  const [filtroVencimiento, setFiltroVencimiento] = useState("todos");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const [recepcion, setRecepcion] = useState(null);
  const [cantEntrada, setCantEntrada] = useState("1");
  const [proveedorEntrada, setProveedorEntrada] = useState("");
  const [motivoEntrada, setMotivoEntrada] = useState("");
  const [errorEntrada, setErrorEntrada] = useState("");
  const [guardandoEntrada, setGuardandoEntrada] = useState(false);

  const productosActivos = useMemo(
    () => productos.filter((p) => p.activo !== false),
    [productos]
  );

  const bajoMinimo = useMemo(
    () => productosActivos.filter((p) => p.stock <= p.stockMinimo),
    [productosActivos]
  );

  const conteoVencimientos = useMemo(() => {
    let pronto = 0;
    let vencidos = 0;
    productosActivos.forEach((p) => {
      const estado = estadoVencimiento(p.fechaVencimiento);
      if (estado === "pronto") pronto += 1;
      if (estado === "vencido") vencidos += 1;
    });
    return { pronto, vencidos };
  }, [productosActivos]);

  const productosVisibles = useMemo(() => {
    let lista = mostrarInactivos ? productos : productosActivos;
    if (filtroVencimiento !== "todos") {
      lista = lista.filter(
        (p) => estadoVencimiento(p.fechaVencimiento) === filtroVencimiento
      );
    }
    return lista;
  }, [productos, productosActivos, mostrarInactivos, filtroVencimiento]);

  function abrirCrear() { setEditando(null); setModo("crear"); }
  function abrirEditar(p) { setEditando(p); setModo("editar"); }
  function cerrarForm() { setModo(null); setEditando(null); }

  async function toggleActivo(p) {
    try {
      await api.put(`/products/${p.id}/estado`, { activo: p.activo === false });
      notificar(
        p.activo === false ? `${p.nombre} activado` : `${p.nombre} desactivado`,
        "success"
      );
      refrescar();
    } catch (e) {
      notificar(e.message || "No se pudo cambiar el estado", "error");
    }
  }

  function abrirRecepcion(p) {
    setRecepcion(p);
    setCantEntrada("1");
    setProveedorEntrada(p.proveedor || "");
    setMotivoEntrada("");
    setErrorEntrada("");
  }

  function cerrarRecepcion() {
    if (guardandoEntrada) return;
    setRecepcion(null);
    setErrorEntrada("");
  }

  async function confirmarRecepcion(e) {
    e.preventDefault();
    setErrorEntrada("");
    const cantidad = Number(cantEntrada);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      setErrorEntrada("La cantidad debe ser un entero mayor a 0");
      return;
    }
    const motivo = motivoEntrada.trim();
    if (!motivo) {
      setErrorEntrada("El motivo o nota es obligatorio");
      return;
    }

    setGuardandoEntrada(true);
    try {
      await api.post(`/products/${recepcion.id}/entrada`, {
        cantidad,
        proveedor: proveedorEntrada.trim() || undefined,
        motivo,
      });
      notificar(`Stock de ${recepcion.nombre} actualizado`, "success");
      setRecepcion(null);
      refrescar();
    } catch (err) {
      setErrorEntrada(err.message || "No se pudo registrar la entrada");
    } finally {
      setGuardandoEntrada(false);
    }
  }

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
          <span className="summary-item">Vence pronto: <strong>{conteoVencimientos.pronto}</strong></span>
          <span className="summary-item danger">Vencidos: <strong>{conteoVencimientos.vencidos}</strong></span>
        </div>
        <div className="inv-head-actions">
          <label className="inv-filtro">
            Vencimiento
            <select
              value={filtroVencimiento}
              onChange={(e) => setFiltroVencimiento(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="pronto">Vence pronto (≤ 30 días)</option>
              <option value="vencido">Vencidos</option>
            </select>
          </label>
          <label className="inv-filtro">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
            />
            Mostrar inactivos
          </label>
          {puedeGestionarInventario && (
            <button className="btn-primary" onClick={abrirCrear}>+ Nuevo producto</button>
          )}
        </div>
      </div>

      {productos.length === 0 ? (
        <div className="empty-state">
          <IlustracionInventarioVacio className="empty-art" />
          <h3>Tu inventario está vacío</h3>
          <p className="muted">
            {puedeGestionarInventario
              ? "Crea tu primer producto para empezar a vender."
              : "Todavía no hay productos cargados para vender."}
          </p>
          {puedeGestionarInventario && (
            <button className="btn-primary" onClick={abrirCrear}>Crear primer producto</button>
          )}
        </div>
      ) : productosVisibles.length === 0 ? (
        <div className="empty-state">
          <IlustracionInventarioVacio className="empty-art" />
          <h3>Sin productos en este filtro</h3>
          <p className="muted">No hay productos con el estado de vencimiento seleccionado.</p>
          <button className="btn-ghost" onClick={() => setFiltroVencimiento("todos")}>Ver todos</button>
        </div>
      ) : (
      <section className="grid">
        {productosVisibles.map((p) => {
          const inactivo = p.activo === false;
          const alerta = !inactivo && p.stock <= p.stockMinimo;
          const estado = estadoVencimiento(p.fechaVencimiento);
          const dias = diasHastaVencimiento(p.fechaVencimiento);
          const tieneBadges = alerta || estado === "pronto" || estado === "vencido" || inactivo;
          return (
            <article key={p.id} className={`card ${alerta ? "alert" : ""} ${inactivo ? "card-inactive" : ""}`}>
              <div className="card-top">
                <div className="thumb">{p.nombre.charAt(0).toUpperCase()}</div>
                {tieneBadges && (
                  <div className="card-badges">
                    {inactivo && <span className="badge badge-inactive">Inactivo</span>}
                    {alerta && <span className="badge">Reponer</span>}
                    {estado === "vencido" && <span className="badge badge-danger">Vencido</span>}
                    {estado === "pronto" && <span className="badge">Vence pronto</span>}
                  </div>
                )}
              </div>
              <h3>{p.nombre}</h3>
              {(p.codigo || p.categoria) && (
                <p className="muted small card-meta">
                  {[p.codigo, p.categoria].filter(Boolean).join(" · ")}
                </p>
              )}
              <p className="muted">{p.descripcion}</p>
              <div className="price">{formatearMoneda(p.precio, config.moneda)}</div>
              <div className="stock">
                Stock: <strong>{p.stock}</strong> {p.unidad || ""} / mínimo: {p.stockMinimo}
              </div>
              {(estado === "pronto" || estado === "vencido") && (
                <p className={`venc-info ${estado}`}>
                  {estado === "vencido" ? "Venció" : "Vence"} el {formatearFechaVencimiento(p.fechaVencimiento)}
                  {dias !== null ? ` · ${dias < 0 ? `hace ${Math.abs(dias)} d` : `en ${dias} d`}` : ""}
                </p>
              )}

              {puedeGestionarInventario && (
                <div className="card-actions">
                  <button className="btn-ghost btn-sm" onClick={() => abrirEditar(p)}>Editar</button>
                  <button className="btn-ghost btn-sm" onClick={() => abrirRecepcion(p)}>Recibir</button>
                  <button
                    className={`btn-ghost btn-sm ${inactivo ? "" : "danger"}`}
                    onClick={() => toggleActivo(p)}
                  >
                    {inactivo ? "Activar" : "Desactivar"}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </section>
      )}

      {modo && (
        <ProductForm initial={editando} onClose={cerrarForm} />
      )}

      {recepcion && (
        <Modal titulo={`Recibir mercadería · ${recepcion.nombre}`} onClose={cerrarRecepcion}>
          <form className="form-grid" onSubmit={confirmarRecepcion}>
            <label>
              Cantidad
              <input
                type="number"
                min="1"
                step="1"
                value={cantEntrada}
                onChange={(e) => setCantEntrada(e.target.value)}
                required
                disabled={guardandoEntrada}
              />
            </label>
            <label>
              Proveedor (opcional)
              <input
                value={proveedorEntrada}
                onChange={(e) => setProveedorEntrada(e.target.value)}
                disabled={guardandoEntrada}
              />
            </label>
            <label>
              Motivo o nota
              <textarea
                value={motivoEntrada}
                onChange={(e) => setMotivoEntrada(e.target.value)}
                rows={3}
                required
                disabled={guardandoEntrada}
              />
            </label>
            {errorEntrada && <p className="field-error">{errorEntrada}</p>}
            <div className="modal-foot">
              <button type="button" className="btn-ghost" onClick={cerrarRecepcion} disabled={guardandoEntrada}>
                Cancelar
              </button>
              <button className="btn-primary" disabled={guardandoEntrada}>
                {guardandoEntrada ? "Registrando..." : "Registrar entrada"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}