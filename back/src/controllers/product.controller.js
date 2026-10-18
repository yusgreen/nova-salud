const prisma = require("../prisma");  // el singleton: la unica linea de Prisma que ellos escriben

// Whitelist: solo estos campos pueden entrar desde el cliente.
// Si mandan { nombre:"x", hacker:"y" }, Prisma lanzaria error de campo
// desconocido -> 500 feo. Con whitelist, "hacker" se ignora en silencio.
const CAMPOS_PRODUCTO = ["nombre", "descripcion", "precio", "imagen", "stock", "stockMinimo"];

function filtrarCampos(body) {
  const data = {};
  for (const c of CAMPOS_PRODUCTO) if (body[c] !== undefined) data[c] = body[c];
  return data;
}

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;  // /products/abc -> null -> 400
}

exports.getProducts = async (req, res) => {
  try {
    const productos = await prisma.producto.findMany({ orderBy: { id: "asc" } });
    res.json(productos);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al listar productos" });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "id invalido" });
    const producto = await prisma.producto.findUnique({ where: { id } });
    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(producto);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener producto" });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const data = filtrarCampos(req.body);
     if (data.imagen === undefined) data.imagen = ""; // default: el front puede omitir imagen
    // Validacion en BACKEND (condicion 1 del enunciado): nunca confiar en el front.
    if (!data.nombre || data.precio === undefined || data.stock === undefined) {
      return res.status(400).json({ error: "nombre, precio y stock son obligatorios" });
    }
    const producto = await prisma.producto.create({ data });
    res.status(201).json(producto);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al crear producto" });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "id invalido" });
    const existe = await prisma.producto.findUnique({ where: { id } });
    if (!existe) return res.status(404).json({ error: "Producto no encontrado" });
    const data = filtrarCampos(req.body);
    const producto = await prisma.producto.update({ where: { id }, data });
    res.json(producto);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al actualizar producto" });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "id invalido" });
    const existe = await prisma.producto.findUnique({ where: { id } });
    if (!existe) return res.status(404).json({ error: "Producto no encontrado" });

    // POLITICA (a): bloquear borrado si el producto tiene ventas historicas.
    // Contamos ANTES de borrar para no depender del error de FK de Prisma (P2003),
    // que daria un 500 sin mensaje humano. El back es el arbitro de la trazabilidad.
    const ventas = await prisma.detalleVenta.count({ where: { productoId: id } });
    if (ventas > 0) {
      return res.status(409).json({
        error: `No se puede eliminar: este producto tiene ${ventas} venta(s) en el historial. ` +
               `Para preservar la trazabilidad de las ventas, el borrado esta bloqueado.`,
      });
    }

    await prisma.producto.delete({ where: { id } });
    res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
};