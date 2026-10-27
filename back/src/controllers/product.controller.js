const prisma = require("../prisma");
const { auditar } = require("../utils/audit");

const CAMPOS_PRODUCTO = [
  "nombre", "descripcion", "precio", "imagen", "stock", "stockMinimo",
  "codigo", "codigoBarras", "categoria", "proveedor", "unidad",
  "precioCompra", "fechaVencimiento",
];

const CAMPOS_AUDITABLES = [
  "nombre", "descripcion", "precio", "imagen", "stock", "stockMinimo",
  "codigo", "codigoBarras", "categoria", "proveedor", "unidad",
  "precioCompra", "fechaVencimiento",
];

function filtrarCampos(body) {
  const data = {};
  for (const c of CAMPOS_PRODUCTO) if (body[c] !== undefined) data[c] = body[c];
  return data;
}

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function esEnteroNoNegativo(valor) {
  return Number.isInteger(valor) && valor >= 0;
}

function esNumeroNoNegativo(valor) {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0;
}

function normalizar(data) {
  if (typeof data.nombre === "string") data.nombre = data.nombre.trim();
  if (typeof data.descripcion === "string") data.descripcion = data.descripcion.trim();
  if (typeof data.imagen === "string") data.imagen = data.imagen.trim();
  if (typeof data.categoria === "string") data.categoria = data.categoria.trim() || null;
  if (typeof data.proveedor === "string") data.proveedor = data.proveedor.trim() || null;
  if (typeof data.unidad === "string") data.unidad = data.unidad.trim() || "unidad";
  if (typeof data.codigo === "string") data.codigo = data.codigo.trim().toUpperCase() || null;
  if (typeof data.codigoBarras === "string") data.codigoBarras = data.codigoBarras.trim().toUpperCase() || null;
  if (data.fechaVencimiento === "") data.fechaVencimiento = null;
  if (typeof data.fechaVencimiento === "string") {
    const fecha = new Date(data.fechaVencimiento);
    data.fechaVencimiento = Number.isNaN(fecha.getTime()) ? data.fechaVencimiento : fecha;
  }
  return data;
}

function validarProducto(data, { parcial = false } = {}) {
  if (!parcial || data.nombre !== undefined) {
    if (typeof data.nombre !== "string" || data.nombre.length < 2 || data.nombre.length > 100) {
      return "nombre debe tener entre 2 y 100 caracteres";
    }
  }
  if (data.descripcion !== undefined && (typeof data.descripcion !== "string" || data.descripcion.length > 500)) {
    return "descripcion debe ser texto de hasta 500 caracteres";
  }
  if (!parcial || data.precio !== undefined) {
    if (!esNumeroNoNegativo(data.precio)) {
      return "precio debe ser un número mayor o igual a 0";
    }
  }
  if (!parcial || data.stock !== undefined) {
    if (!esEnteroNoNegativo(data.stock)) {
      return "stock debe ser un entero mayor o igual a 0";
    }
  }
  if (data.stockMinimo !== undefined && !esEnteroNoNegativo(data.stockMinimo)) {
    return "stockMinimo debe ser un entero mayor o igual a 0";
  }
  if (data.imagen !== undefined && (typeof data.imagen !== "string" || data.imagen.length > 500)) {
    return "imagen debe ser texto de hasta 500 caracteres";
  }
  if (data.codigo !== undefined && data.codigo !== null &&
      (typeof data.codigo !== "string" || !/^[A-Z0-9_-]{2,30}$/.test(data.codigo))) {
    return "codigo debe tener entre 2 y 30 caracteres (letras, números, guion o guion bajo)";
  }
  if (data.codigoBarras !== undefined && data.codigoBarras !== null &&
      (typeof data.codigoBarras !== "string" || !/^[A-Z0-9-]{4,48}$/.test(data.codigoBarras))) {
    return "codigoBarras debe tener entre 4 y 48 caracteres alfanuméricos";
  }
  if (data.categoria !== undefined && data.categoria !== null &&
      (typeof data.categoria !== "string" || data.categoria.length > 60)) {
    return "categoria debe ser texto de hasta 60 caracteres";
  }
  if (data.proveedor !== undefined && data.proveedor !== null &&
      (typeof data.proveedor !== "string" || data.proveedor.length > 80)) {
    return "proveedor debe ser texto de hasta 80 caracteres";
  }
  if (data.unidad !== undefined && (typeof data.unidad !== "string" || !data.unidad || data.unidad.length > 20)) {
    return "unidad debe ser texto de hasta 20 caracteres";
  }
  if (data.precioCompra !== undefined && data.precioCompra !== null && !esNumeroNoNegativo(data.precioCompra)) {
    return "precioCompra debe ser un número mayor o igual a 0";
  }
  if (data.fechaVencimiento !== undefined && data.fechaVencimiento !== null &&
      !(data.fechaVencimiento instanceof Date)) {
    return "fechaVencimiento debe ser una fecha válida";
  }
  return null;
}

async function conflictoUnico(data, excluirId = null) {
  for (const campo of ["codigo", "codigoBarras"]) {
    const valor = data[campo];
    if (valor === undefined || valor === null) continue;
    const where = { [campo]: valor };
    if (excluirId !== null) where.id = { not: excluirId };
    const existe = await prisma.producto.findFirst({ where, select: { id: true } });
    if (existe) return `${campo} ${valor} ya está en uso`;
  }
  return null;
}

function codigoAutomatico(id) {
  return `P-${String(id).padStart(4, "0")}`;
}

async function siguienteCodigo() {
  const ultimo = await prisma.producto.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  let n = (ultimo?.id || 0) + 1;
  let codigo = codigoAutomatico(n);
  while (await prisma.producto.findUnique({ where: { codigo }, select: { id: true } })) {
    n += 1;
    codigo = codigoAutomatico(n);
  }
  return codigo;
}

function cambiosEntre(antes, despues) {
  const cambios = {};
  for (const campo of CAMPOS_AUDITABLES) {
    if (despues[campo] === undefined) continue;
    const a = antes[campo] instanceof Date ? antes[campo].toISOString() : antes[campo];
    const d = despues[campo] instanceof Date ? despues[campo].toISOString() : despues[campo];
    if (String(a ?? "") !== String(d ?? "")) cambios[campo] = { antes: a ?? null, despues: d ?? null };
  }
  return cambios;
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

exports.getMovimientos = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "id invalido" });
    const existe = await prisma.producto.findUnique({ where: { id }, select: { id: true } });
    if (!existe) return res.status(404).json({ error: "Producto no encontrado" });
    const movimientos = await prisma.movimientoStock.findMany({
      where: { productoId: id },
      orderBy: { creadoEn: "desc" },
      take: 20,
    });
    res.json(movimientos);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al listar movimientos" });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const data = normalizar(filtrarCampos(req.body));
    if (data.descripcion === undefined) data.descripcion = "";
    if (data.imagen === undefined) data.imagen = "";
    if (data.unidad === undefined) data.unidad = "unidad";

    if (!data.nombre || data.precio === undefined || data.stock === undefined) {
      return res.status(400).json({ error: "nombre, precio y stock son obligatorios" });
    }
    const invalido = validarProducto(data);
    if (invalido) return res.status(400).json({ error: invalido });

    if (!data.codigo) data.codigo = await siguienteCodigo();
    const conflicto = await conflictoUnico(data);
    if (conflicto) return res.status(409).json({ error: conflicto });

    const producto = await prisma.$transaction(async (tx) => {
      const creado = await tx.producto.create({ data });
      if (creado.stock > 0) {
        await tx.movimientoStock.create({
          data: {
            productoId: creado.id,
            usuarioId: req.user.id,
            tipo: "INICIAL",
            cantidad: creado.stock,
            stockAnterior: 0,
            stockNuevo: creado.stock,
            motivo: "Stock inicial",
          },
        });
      }
      return creado;
    });

    await auditar({
      req,
      userId: req.user.id,
      accion: "PRODUCT_CREATE",
      entidad: "Producto",
      entidadId: producto.id,
      detalle: {
        nombre: producto.nombre,
        codigo: producto.codigo,
        precio: producto.precio,
        stock: producto.stock,
      },
    });
    res.status(201).json(producto);
  } catch (e) {
    console.error(e);
    if (e.code === "P2002") {
      return res.status(409).json({ error: "El código o código de barras ya está en uso" });
    }
    res.status(500).json({ error: "Error al crear producto" });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "id invalido" });
    const existe = await prisma.producto.findUnique({ where: { id } });
    if (!existe) return res.status(404).json({ error: "Producto no encontrado" });

    const data = normalizar(filtrarCampos(req.body));
    const invalido = validarProducto(data, { parcial: true });
    if (invalido) return res.status(400).json({ error: invalido });

    const conflicto = await conflictoUnico(data, id);
    if (conflicto) return res.status(409).json({ error: conflicto });

    const cambios = cambiosEntre(existe, data);

    const producto = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.producto.update({ where: { id }, data });
      if (data.stock !== undefined && data.stock !== existe.stock) {
        await tx.movimientoStock.create({
          data: {
            productoId: id,
            usuarioId: req.user.id,
            tipo: "AJUSTE",
            cantidad: actualizado.stock - existe.stock,
            stockAnterior: existe.stock,
            stockNuevo: actualizado.stock,
            motivo: "Edición de producto",
          },
        });
      }
      return actualizado;
    });

    await auditar({
      req,
      accion: "PRODUCT_UPDATE",
      entidad: "Producto",
      entidadId: producto.id,
      detalle: { nombre: producto.nombre, cambios },
    });
    res.json(producto);
  } catch (e) {
    console.error(e);
    if (e.code === "P2002") {
      return res.status(409).json({ error: "El código o código de barras ya está en uso" });
    }
    res.status(500).json({ error: "Error al actualizar producto" });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "id invalido" });
    const existe = await prisma.producto.findUnique({ where: { id } });
    if (!existe) return res.status(404).json({ error: "Producto no encontrado" });

    const ventas = await prisma.detalleVenta.count({ where: { productoId: id } });
    if (ventas > 0) {
      return res.status(409).json({
        error: `No se puede eliminar: este producto tiene ${ventas} venta(s) en el historial. ` +
               `Para preservar la trazabilidad de las ventas, el borrado esta bloqueado.`,
      });
    }
    await auditar({
      req,
      accion: "PRODUCT_DELETE",
      entidad: "Producto",
      entidadId: id,
      detalle: { nombre: existe.nombre, codigo: existe.codigo },
    });

    await prisma.producto.delete({ where: { id } });
    res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
};
