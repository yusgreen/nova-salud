import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { api } from "../services/api";
import { useProducts } from "../context/ProductContext";
import { useConfig } from "../context/ConfigContext";
import { formatearMoneda } from "../services/format";

const TIPOS_MOVIMIENTO = { INICIAL: "Inicial", AJUSTE: "Ajuste", VENTA: "Venta" };

function estadoInicial(initial, umbral) {
  return {
    nombre: initial?.nombre || "",
    descripcion: initial?.descripcion || "",
    precio: initial?.precio ?? "",
    precioCompra: initial?.precioCompra ?? "",
    stock: initial?.stock ?? "",
    stockMinimo: initial?.stockMinimo ?? umbral,
    unidad: initial?.unidad || "unidad",
    codigo: initial?.codigo || "",
    codigoBarras: initial?.codigoBarras || "",
    categoria: initial?.categoria || "",
    proveedor: initial?.proveedor || "",
    fechaVencimiento: initial?.fechaVencimiento ? String(initial.fechaVencimiento).slice(0, 10) : "",
    imagen: initial?.imagen || "",
  };
}

function iniciales(nombre = "") {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";
}

function fechaCorta(iso) {
  const fecha = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function Campo({ etiqueta, hint, error, children }) {
  return (
    <label className={error ? "campo-error" : ""}>
      {etiqueta}
      {children}
      {hint && <span className="campo-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export default function ProductForm({ initial, onClose }) {
  const { refrescar } = useProducts();
  const { config } = useConfig();
  const esEdicion = !!initial;

  const [form, setForm] = useState(() => estadoInicial(initial, config.umbralStockBajo));
  const baseRef = useRef(form);
  const [tocados, setTocados] = useState({});
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const [imagenError, setImagenError] = useState(false);
  const [movimientos, setMovimientos] = useState([]);

  const set = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (error) setError("");
  };
  const marcar = (campo) => setTocados((t) => ({ ...t, [campo]: true }));

  useEffect(() => {
    if (!esEdicion) return;
    let activo = true;
    api.get(`/products/${initial.id}/movimientos`)
      .then((d) => { if (activo) setMovimientos(d); })
      .catch(() => {});
    return () => { activo = false; };
  }, [esEdicion, initial?.id]);

  useEffect(() => { setImagenError(false); }, [form.imagen]);

  function validar() {
    const e = {};
    if (form.nombre.trim().length < 2 || form.nombre.trim().length > 100) {
      e.nombre = "Entre 2 y 100 caracteres";
    }
    if (form.precio === "" || !Number.isFinite(Number(form.precio)) || Number(form.precio) < 0) {
      e.precio = "Ingresa un precio de 0 o mayor";
    }
    if (form.precioCompra !== "" &&
        (!Number.isFinite(Number(form.precioCompra)) || Number(form.precioCompra) < 0)) {
      e.precioCompra = "Ingresa un costo de 0 o mayor";
    }
    if (form.stock === "" || !Number.isInteger(Number(form.stock)) || Number(form.stock) < 0) {
      e.stock = "Ingresa un stock entero de 0 o mayor";
    }
    if (form.stockMinimo === "" || !Number.isInteger(Number(form.stockMinimo)) || Number(form.stockMinimo) < 0) {
      e.stockMinimo = "Ingresa un mínimo entero de 0 o mayor";
    }
    if (!form.unidad.trim() || form.unidad.trim().length > 20) {
      e.unidad = "Entre 1 y 20 caracteres";
    }
    if (form.codigo.trim() && !/^[A-Za-z0-9_-]{2,30}$/.test(form.codigo.trim())) {
      e.codigo = "Letras, números, guion o guion bajo (2 a 30)";
    }
    if (form.codigoBarras.trim() && !/^[A-Za-z0-9-]{4,48}$/.test(form.codigoBarras.trim())) {
      e.codigoBarras = "Entre 4 y 48 caracteres alfanuméricos";
    }
    if (form.categoria.trim().length > 60) e.categoria = "Máximo 60 caracteres";
    if (form.proveedor.trim().length > 80) e.proveedor = "Máximo 80 caracteres";
    if (form.descripcion.trim().length > 500) e.descripcion = "Máximo 500 caracteres";
    if (form.imagen.trim().length > 500) e.imagen = "Máximo 500 caracteres";
    if (form.fechaVencimiento &&
        Number.isNaN(new Date(`${form.fechaVencimiento}T00:00:00`).getTime())) {
      e.fechaVencimiento = "Fecha inválida";
    }
    return e;
  }

  const errores = validar();
  const esValido = Object.keys(errores).length === 0;
  const sucio = JSON.stringify(form) !== JSON.stringify(baseRef.current);
  const verError = (campo) => ((intento || tocados[campo]) ? errores[campo] : "");

  function pedirCerrar() {
    if (busy) return;
    if (!sucio) return onClose();
    setConfirmarDescarte(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setIntento(true);
    if (!esValido) {
      setError("Revisa los campos marcados antes de guardar");
      return;
    }
    setError("");
    setBusy(true);

    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      precio: Number(form.precio),
      precioCompra: form.precioCompra === "" ? null : Number(form.precioCompra),
      stock: Number(form.stock),
      stockMinimo: Number(form.stockMinimo),
      unidad: form.unidad.trim() || "unidad",
      codigoBarras: form.codigoBarras.trim() || null,
      categoria: form.categoria.trim() || null,
      proveedor: form.proveedor.trim() || null,
      fechaVencimiento: form.fechaVencimiento || null,
      imagen: form.imagen.trim(),
    };
    if (form.codigo.trim()) payload.codigo = form.codigo.trim().toUpperCase();

    try {
      if (esEdicion) {
        await api.put(`/products/${initial.id}`, payload);
      } else {
        await api.post("/products", payload);
      }
      refrescar();
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar el producto");
    } finally {
      setBusy(false);
    }
  }

  const stockNum = Number(form.stock) || 0;
  const minimoNum = Number(form.stockMinimo) || 0;
  const nivel = stockNum <= 0 ? "out" : stockNum <= minimoNum ? "low" : "ok";
  const nivelTexto = nivel === "out" ? "Sin stock" : nivel === "low" ? "Stock bajo" : "Disponible";
  const precioNum = Number(form.precio) || 0;
  const costoNum = form.precioCompra === "" ? 0 : Number(form.precioCompra) || 0;
  const margen = costoNum > 0 && precioNum > 0 ? ((precioNum - costoNum) / precioNum) * 100 : null;

  return (
    <Modal wide titulo={esEdicion ? "Editar producto" : "Nuevo producto"} onClose={pedirCerrar}>
      <form className="form-grid producto-form" onSubmit={onSubmit} noValidate>
        <div className="producto-form-layout">
          <div className="producto-form-main">
            {error && <p className="status error">{error}</p>}

            <section className="form-section">
              <h3>Datos del producto</h3>
              <div className="form-row-2">
                <Campo etiqueta="Nombre *" error={verError("nombre")}>
                  <input
                    autoFocus
                    value={form.nombre}
                    onChange={(e) => set("nombre", e.target.value)}
                    onBlur={() => marcar("nombre")}
                    maxLength={100}
                  />
                </Campo>
                <Campo
                  etiqueta="Código"
                  hint={esEdicion ? "Vacío = conserva el actual" : "Vacío = se genera automático"}
                  error={verError("codigo")}
                >
                  <input
                    value={form.codigo}
                    onChange={(e) => set("codigo", e.target.value)}
                    onBlur={() => marcar("codigo")}
                    placeholder="P-0001"
                  />
                </Campo>
              </div>
              <div className="form-row-2">
                <Campo etiqueta="Categoría" error={verError("categoria")}>
                  <input
                    list="categorias-producto"
                    value={form.categoria}
                    onChange={(e) => set("categoria", e.target.value)}
                    onBlur={() => marcar("categoria")}
                    placeholder="Analgésico"
                  />
                </Campo>
                <Campo etiqueta="Proveedor" error={verError("proveedor")}>
                  <input
                    value={form.proveedor}
                    onChange={(e) => set("proveedor", e.target.value)}
                    onBlur={() => marcar("proveedor")}
                    placeholder="Distribuidora…"
                  />
                </Campo>
              </div>
              <Campo etiqueta="Descripción" error={verError("descripcion")}>
                <input
                  value={form.descripcion}
                  onChange={(e) => set("descripcion", e.target.value)}
                  onBlur={() => marcar("descripcion")}
                  maxLength={500}
                />
              </Campo>
            </section>

            <section className="form-section">
              <h3>Precio e inventario</h3>
              <div className="form-row-2">
                <Campo etiqueta={`Precio de venta (${config.moneda}) *`} error={verError("precio")}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precio}
                    onChange={(e) => set("precio", e.target.value)}
                    onBlur={() => marcar("precio")}
                  />
                </Campo>
                <Campo etiqueta={`Precio de compra (${config.moneda})`} error={verError("precioCompra")}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precioCompra}
                    onChange={(e) => set("precioCompra", e.target.value)}
                    onBlur={() => marcar("precioCompra")}
                  />
                </Campo>
              </div>
              <div className="form-row-3">
                <Campo etiqueta="Stock *" error={verError("stock")}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock}
                    onChange={(e) => set("stock", e.target.value)}
                    onBlur={() => marcar("stock")}
                  />
                </Campo>
                <Campo etiqueta="Stock mínimo *" error={verError("stockMinimo")}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.stockMinimo}
                    onChange={(e) => set("stockMinimo", e.target.value)}
                    onBlur={() => marcar("stockMinimo")}
                  />
                </Campo>
                <Campo etiqueta="Unidad *" error={verError("unidad")}>
                  <input
                    list="unidades-producto"
                    value={form.unidad}
                    onChange={(e) => set("unidad", e.target.value)}
                    onBlur={() => marcar("unidad")}
                  />
                </Campo>
              </div>
              <div className="form-row-2">
                <Campo etiqueta="Código de barras" error={verError("codigoBarras")}>
                  <input
                    value={form.codigoBarras}
                    onChange={(e) => set("codigoBarras", e.target.value)}
                    onBlur={() => marcar("codigoBarras")}
                    placeholder="7501234567890"
                  />
                </Campo>
                <Campo etiqueta="Fecha de vencimiento" error={verError("fechaVencimiento")}>
                  <input
                    type="date"
                    value={form.fechaVencimiento}
                    onChange={(e) => set("fechaVencimiento", e.target.value)}
                    onBlur={() => marcar("fechaVencimiento")}
                  />
                </Campo>
              </div>
            </section>

            <section className="form-section">
              <h3>Presentación</h3>
              <Campo
                etiqueta="Imagen (URL o ruta)"
                hint="Si no carga, se muestra el ícono con las iniciales"
                error={verError("imagen")}
              >
                <input
                  value={form.imagen}
                  onChange={(e) => set("imagen", e.target.value)}
                  onBlur={() => marcar("imagen")}
                  placeholder="/images/ejemplo.svg"
                />
              </Campo>
            </section>
          </div>

          <aside className="producto-preview" aria-label="Vista previa del producto">
            <span className="preview-kicker">Vista previa</span>
            <div className="preview-media">
              {form.imagen.trim() && !imagenError ? (
                <img src={form.imagen} alt="" onError={() => setImagenError(true)} />
              ) : (
                <span className="preview-fallback">{iniciales(form.nombre)}</span>
              )}
            </div>
            <div className="preview-title">
              <strong>{form.nombre.trim() || "Nombre del producto"}</strong>
              <span>{form.categoria.trim() || "Sin categoría"}</span>
            </div>
            <div className="preview-price">
              <strong>{formatearMoneda(precioNum, config.moneda)}</strong>
              <span className={`preview-badge ${nivel}`}>{nivelTexto}</span>
            </div>
            <ul className="preview-facts">
              <li><span>Código</span><strong>{form.codigo.trim().toUpperCase() || (esEdicion ? initial.codigo || "—" : "Automático")}</strong></li>
              {form.codigoBarras.trim() && (
                <li><span>Barras</span><strong>{form.codigoBarras.trim()}</strong></li>
              )}
              <li><span>Proveedor</span><strong>{form.proveedor.trim() || "—"}</strong></li>
              <li><span>Unidad</span><strong>{form.unidad.trim() || "unidad"}</strong></li>
              <li><span>Stock</span><strong>{stockNum} / mín. {minimoNum}</strong></li>
              {margen !== null && (
                <li><span>Margen</span><strong>{margen.toFixed(1)}%</strong></li>
              )}
              {form.fechaVencimiento && (
                <li><span>Vence</span><strong>{fechaCorta(form.fechaVencimiento)}</strong></li>
              )}
            </ul>

            {esEdicion && movimientos.length > 0 && (
              <div className="preview-movs">
                <span className="preview-kicker">Últimos movimientos</span>
                <ul>
                  {movimientos.slice(0, 5).map((m) => (
                    <li key={m.id}>
                      <span>{TIPOS_MOVIMIENTO[m.tipo] || m.tipo}</span>
                      <strong className={m.cantidad < 0 ? "neg" : "pos"}>
                        {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                      </strong>
                      <span className="muted small">{fechaCorta(m.creadoEn)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>

        <datalist id="categorias-producto">
          <option value="Analgésico" />
          <option value="Antibiótico" />
          <option value="Antiinflamatorio" />
          <option value="Suplemento" />
          <option value="Higiene" />
          <option value="Otros" />
        </datalist>
        <datalist id="unidades-producto">
          <option value="unidad" />
          <option value="caja" />
          <option value="blíster" />
          <option value="frasco" />
          <option value="ml" />
          <option value="g" />
        </datalist>

        {confirmarDescarte && (
          <div className="discard-bar" role="alert">
            <span>Tienes cambios sin guardar.</span>
            <div>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmarDescarte(false)}>
                Seguir editando
              </button>
              <button type="button" className="btn-primary btn-danger btn-sm" onClick={onClose}>
                Descartar
              </button>
            </div>
          </div>
        )}

        <div className="modal-foot">
          <button type="button" className="btn-ghost" onClick={pedirCerrar} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !esValido}>
            {busy ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear producto"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
