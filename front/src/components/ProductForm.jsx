import { useState } from "react";
import Modal from "./Modal";
import { api } from "../services/api";
import { useProducts } from "../context/ProductContext";

// initial = null -> creacion (POST). initial = producto -> edicion (PUT).
export default function ProductForm({ initial, onClose }) {
  const { refrescar } = useProducts();
  const esEdicion = !!initial;

  const [nombre, setNombre] = useState(initial?.nombre || "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion || "");
  const [precio, setPrecio] = useState(initial?.precio ?? "");
  const [stock, setStock] = useState(initial?.stock ?? "");
  const [stockMinimo, setStockMinimo] = useState(initial?.stockMinimo ?? "");
  const [imagen, setImagen] = useState(initial?.imagen || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    // Validacion ligera de UX; la verdad final la da el back (whitelist + 400).
    if (!nombre.trim()) return setError("El nombre es obligatorio");
    if (Number(precio) < 0 || precio === "") return setError("El precio debe ser 0 o mayor");
    if (Number(stock) < 0 || stock === "") return setError("El stock debe ser 0 o mayor");
    if (Number(stockMinimo) < 0 || stockMinimo === "") return setError("El minimo debe ser 0 o mayor");

    setBusy(true);
    const payload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      precio: Number(precio),
      stock: Number(stock),
      stockMinimo: Number(stockMinimo),
      imagen: imagen.trim(), // puede ser "" ; el back pone default si no viene
    };

    try {
      if (esEdicion) {
        await api.put(`/products/${initial.id}`, payload);
      } else {
        await api.post("/products", payload);
      }
      refrescar(); // el CRUD de producto NO emite socket; refrescamos por fetch
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar el producto");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal titulo={esEdicion ? "Editar producto" : "Nuevo producto"} onClose={onClose}>
      <form className="form-grid" onSubmit={onSubmit}>
        {error && <p className="status error">{error}</p>}
        <label>Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label>Descripción
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </label>
        <div className="form-row">
          <label>Precio (S/)
            <input type="number" step="0.01" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} required />
          </label>
          <label>Stock
            <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} required />
          </label>
          <label>Stock mínimo
            <input type="number" min="0" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} required />
          </label>
        </div>
        <label>Ruta de imagen (opcional)
          <input value={imagen} onChange={(e) => setImagen(e.target.value)} placeholder="/images/ejemplo.svg" />
        </label>
        <div className="modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear producto"}
          </button>
        </div>
      </form>
    </Modal>
  );
}