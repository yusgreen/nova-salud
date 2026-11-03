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
import { SkeletonStack } from "./Skeleton";
import { IconPlus, IconSearch } from "./Icons";
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
  const [busqueda, setBusqueda] = useState("");

  const [recepcion, setRecepcion] = useState(null);
  const [cantEntrada, setCantEntrada] = useState("1");
  const [proveedorEntrada, setProveedorEntrada] = useState("");
  const [motivoEntrada, setMotivoEntrada] = useState("");
  const [errorEntrada, setErrorEntrada] = useState("");
  const [guardandoEntrada, setGuardandoEntrada] = useState(false);
  const [eliminando, setEliminando] = useState(null);
  const [errorEliminar, setErrorEliminar] = useState("");

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
    const q = busqueda.trim().toLowerCase();
    if (q) {
      lista = lista.filter((p) =>
        [p.nombre, p.codigo, p.codigoBarras]
          .filter(Boolean)
          .some((valor) => String(valor).toLowerCase().includes(q))
      );
    }
    return lista;
  }, [productos, productosActivos, mostrarInactivos, filtroVencimiento, busqueda]);

  function limpiarFiltros() {
    setFiltroVencimiento("todos");
    setBusqueda("");
  }

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

  if (loading) return <SkeletonStack count={6} variant="row" />;
  if (error) return <p className="status error">{error}. Verifica el backend en puerto 4000.</p>;

  return (
    <>
      <div className="inventory">
        <header className="inv-header">
          <div>
            <p className="kicker">Inventario</p>
            <h2 className="inv-title">Productos</h2>
          </div>
          <div className="stat-strip">
            <span className="stat-chip"><strong>{productosActivos.length}</strong> productos</span>
            <span className={`stat-chip ${bajoMinimo.length > 0 ? "is-warning" : ""}`}>
              <strong>{bajoMinimo.length}</strong> bajo mínimo
            </span>
            <span className={`stat-chip ${conteoVencimientos.pronto > 0 ? "is-warning" : ""}`}>
              <strong>{conteoVencimientos.pronto}</strong> vencen pronto
            </span>
            {conteoVencimientos.vencidos > 0 && (
              <span className="stat-chip is-danger">
                <strong>{conteoVencimientos.vencidos}</strong> vencidos
              </span>
            )}
          </div>
        </header>

        <div className="inv-toolbar">
          <div className="inv-filters">
            <label className="inv-filter inv-filter-search">
              Buscar
              <span className="input-icon">
                <IconSearch aria-hidden="true" />
                <input
                  className="input"
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre o código…"
                />
              </span>
            </label>
            <label className="inv-filter">
              Vencimiento
              <select
                className="select"
                value={filtroVencimiento}
                onChange={(e) => setFiltroVencimiento(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="pronto">Vence pronto (≤ 30 días)</option>
                <option value="vencido">Vencidos</option>
              </select>
            </label>
            <label className="inv-check">
              <input
                type="checkbox"
                checked={mostrarInactivos}
                onChange={(e) => setMostrarInactivos(e.target.checked)}
              />
              Mostrar inactivos
            </label>
          </div>
          {puedeGestionarInventario && (
            <button className="btn btn-primary" onClick={abrirCrear}>
              <IconPlus className="icon-sm" aria-hidden="true" />
              Nuevo producto
            </button>
          )}
        </div>

        {productos.length === 0 ? (
          <div className="empty-state">
            <IlustracionInventarioVacio className="empty-art" />
            <h3 className="empty-state-title">Tu inventario está vacío</h3>
            <p className="empty-state-message">
              {puedeGestionarInventario
                ? "Crea tu primer producto para empezar a vender."
                : "Todavía no hay productos cargados para vender."}
            </p>
            {puedeGestionarInventario && (
              <button className="btn btn-primary" onClick={abrirCrear}>
                Crear primer producto
              </button>
            )}
          </div>
        ) : productosVisibles.length === 0 ? (
          <div className="empty-state">
            <IlustracionInventarioVacio className="empty-art" />
            <h3 className="empty-state-title">
              {busqueda.trim() ? "Sin resultados" : "Sin productos en este filtro"}
            </h3>
            <p className="empty-state-message">
              {busqueda.trim()
                ? `No encontramos productos para “${busqueda.trim()}”.`
                : "No hay productos con el estado de vencimiento seleccionado."}
            </p>
            <button className="btn btn-secondary" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table inv-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Estado</th>
                  <th className="num">Precio</th>
                  <th className="num">Stock</th>
                  <th className="num">Mínimo</th>
                  <th>Vencimiento</th>
                  {puedeGestionarInventario && <th className="inv-col-actions">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {productosVisibles.map((p) => {
                  const inactivo = p.activo === false;
                  const alerta = !inactivo && p.stock <= p.stockMinimo;
                  const estado = estadoVencimiento(p.fechaVencimiento);
                  const dias = diasHastaVencimiento(p.fechaVencimiento);
                  const tieneBadges = alerta || estado === "pronto" || estado === "vencido" || inactivo;
                  const meta = [p.codigo, p.categoria].filter(Boolean).join(" · ");
                  const diasTexto =
                    dias === null
                      ? ""
                      : dias < 0
                        ? `Hace ${Math.abs(dias)} d`
                        : dias === 0
                          ? "Hoy"
                          : `En ${dias} d`;
                  return (
                    <tr key={p.id} className={`inv-row ${inactivo ? "is-inactive" : ""}`}>
                      <td>
                        <div className="inv-product">
                          <span className="inv-thumb" aria-hidden="true">
                            {p.nombre.charAt(0).toUpperCase()}
                          </span>
                          <div className="inv-product-info">
                            <span className="inv-product-name">{p.nombre}</span>
                            {(meta || p.descripcion) && (
                              <span className="inv-product-meta" title={p.descripcion || undefined}>
                                {meta || p.descripcion}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {tieneBadges ? (
                          <div className="inv-badges">
                            {inactivo && <span className="badge badge-neutral">Inactivo</span>}
                            {alerta && <span className="badge badge-warning">Reponer</span>}
                            {estado === "vencido" && <span className="badge badge-danger">Vencido</span>}
                            {estado === "pronto" && <span className="badge badge-warning">Vence pronto</span>}
                          </div>
                        ) : (
                          <span className="inv-status is-ok">Disponible</span>
                        )}
                      </td>
                      <td className="num">{formatearMoneda(p.precio, config.moneda)}</td>
                      <td className="num">
                        <strong>{p.stock}</strong>
                        {p.unidad ? <span className="inv-unit"> {p.unidad}</span> : null}
                      </td>
                      <td className="num">{p.stockMinimo}</td>
                      <td>
                        {p.fechaVencimiento ? (
                          <div className="inv-venc">
                            <span>{formatearFechaVencimiento(p.fechaVencimiento)}</span>
                            <span className={`inv-venc-days ${estado || ""}`}>{diasTexto || "—"}</span>
                          </div>
                        ) : (
                          <span className="text-subtle">—</span>
                        )}
                      </td>
                      {puedeGestionarInventario && (
                        <td>
                          <div className="inv-actions">
                            <button className="btn btn-secondary btn-sm" onClick={() => abrirEditar(p)}>
                              Editar
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => abrirRecepcion(p)}>
                              Recibir
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => toggleActivo(p)}
                            >
                              {inactivo ? "Activar" : "Desactivar"}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modo && (
        <ProductForm initial={editando} onClose={cerrarForm} />
      )}

      {recepcion && (
        <Modal titulo={`Recibir mercadería · ${recepcion.nombre}`} onClose={cerrarRecepcion}>
          <form className="form-grid" onSubmit={confirmarRecepcion}>
            <label className="field">
              <span className="label">Cantidad</span>
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                value={cantEntrada}
                onChange={(e) => setCantEntrada(e.target.value)}
                required
                disabled={guardandoEntrada}
              />
            </label>
            <label className="field">
              <span className="label">Proveedor (opcional)</span>
              <input
                className="input"
                value={proveedorEntrada}
                onChange={(e) => setProveedorEntrada(e.target.value)}
                disabled={guardandoEntrada}
              />
            </label>
            <label className="field">
              <span className="label">Motivo o nota</span>
              <textarea
                className="textarea"
                value={motivoEntrada}
                onChange={(e) => setMotivoEntrada(e.target.value)}
                rows={3}
                required
                disabled={guardandoEntrada}
              />
            </label>
            {errorEntrada && <p className="field-error">{errorEntrada}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={cerrarRecepcion} disabled={guardandoEntrada}>
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={guardandoEntrada}>
                {guardandoEntrada ? "Registrando..." : "Registrar entrada"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
