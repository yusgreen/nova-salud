// back/src/controllers/sale.controller.js
// El corazón del enunciado: registro de ventas atomico + descuento de stock
// + validacion de inventario + emision (preparada) de alerta por socket.

const prisma = require("../prisma");

// ---- GET /sales : historial de ventas (con lineas y quien atendio) ----
exports.getSales = async (req, res) => {
  try {
    const ventas = await prisma.venta.findMany({
      include: {
        // Traigo el producto de cada linea para que el front muestre nombre/imagen.
        detalles: { include: { producto: true } },
        // Select explicito: NUNCA traigo passwordHash de quien atendio (seguridad).
        atendidoPor: { select: { id: true, nombre: true, rol: true } },
      },
      orderBy: { fecha: "desc" },
    });
    res.json(ventas);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al listar ventas" });
  }
};

// ---- POST /sales : registrar una venta (atomica) ----
exports.createSale = async (req, res) => {
  // 1) Validacion de FORMA (fuera de la tx): estructura del body.
  const { detalles } = req.body || {};
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({ error: "detalles debe ser un array no vacio" });
  }

  // Agrupo por productoId sumando cantidades (blindaje 5).
  const agrupadas = Object.values(
    detalles.reduce((acc, d) => {
      const pid = Number(d.productoId);
      const cant = Number(d.cantidad);
      if (!Number.isInteger(pid) || pid <= 0) return acc;       // linea basura -> se ignora
      if (!Number.isInteger(cant) || cant <= 0) return acc;
      if (!acc[pid]) acc[pid] = { productoId: pid, cantidad: 0 };
      acc[pid].cantidad += cant;
      return acc;
    }, {})
  );

  if (agrupadas.length === 0) {
    return res.status(400).json({ error: "ninguna linea de venta valida" });
  }

  // El usuario que atiende sale del TOKEN, no del body (blindaje 2).
  const usuarioId = req.user.id;

  try {
    // 2) Transaccion INTERACTIVA (blindaje 4): leo y condiciono dentro de la tx.
    const resultado = await prisma.$transaction(async (tx) => {
      let total = 0;
      const lineasProcesadas = [];

      // 3) Por cada linea agrupada: leo producto de BD, valido stock, congelo precio.
      for (const l of agrupadas) {
        const p = await tx.producto.findUnique({ where: { id: l.productoId } });
        if (!p) throw new Error(`NEGOCIO:Producto ${l.productoId} no existe`);
        if (p.stock < l.cantidad) {
          throw new Error(
            `NEGOCIO:Stock insuficiente para "${p.nombre}" (hay ${p.stock}, piden ${l.cantidad})`
          );
        }
        // El precio que vale es el de la BD, NO el que mande el cliente (blindaje 1).
        const subtotal = p.precio * l.cantidad;
        total += subtotal;
        lineasProcesadas.push({
          productoId: p.id,
          cantidad: l.cantidad,
          precioUnitario: p.precio,   // congelado al momento de vender
          // guardo lo que necesito para el emit de alerta (C2) sin re-leer la BD:
          nombre: p.nombre,
          stockAnterior: p.stock,
          stockMinimo: p.stockMinimo,
        });
      }

            // 4) Creo la venta con sus lineas (nested write de Prisma).
      const venta = await tx.venta.create({
        data: {
          total,
          usuarioId,
          detalles: { create: lineasProcesadas.map(({ nombre, stockAnterior, stockMinimo, ...rest }) => rest) },
        },
      });

      // 4b) TRAIGO el nombre de quien atiende DENTRO de la tx, con select sin hash
      //     (coherente con la seguridad de C1: el evento nunca expone passwordHash).
      const atendido = await tx.usuario.findUnique({
        where: { id: usuarioId },
        select: { id: true, nombre: true, rol: true },
      });

      // 5) Descuento stock de cada producto (atomico: si algo falla arriba, nada se aplica).
      for (const l of lineasProcesadas) {
        await tx.producto.update({
          where: { id: l.productoId },
          data: { stock: { decrement: l.cantidad } },
        });
      }

      return { venta, lineasProcesadas, atendido };   // <- agregue atendido
    });

    const { venta, lineasProcesadas, atendido } = resultado;

    // 6) Emision de socket PREPARADA con optional chaining (blindaje 6).
    //    En C1 req.io es undefined -> no ejecuta, no revierte.
    //    En C2, al montar io + middleware attachIo, req.io existe y ESTOS emits cobran vida
    //    SIN editar una linea de este controller.
    const stockActualizado = lineasProcesadas.map((l) => ({
      id: l.productoId,
      nombre: l.nombre,
      stock: l.stockAnterior - l.cantidad,
    }));
    const alertas = lineasProcesadas
      .map((l) => ({
        id: l.productoId,
        nombre: l.nombre,
        stockNuevo: l.stockAnterior - l.cantidad,
        stockMinimo: l.stockMinimo,
      }))
      .filter((l) => l.stockNuevo <= l.stockMinimo);

    req.io?.emit("stock_actualizado", stockActualizado);
    req.io?.emit("alerta_bajo_stock", alertas);

    req.io?.emit("venta_registrada", {
      id: venta.id,
      fecha: venta.fecha,
      total,
      atendidoPor: atendido,
      detalles: lineasProcesadas.map((l) => ({
        productoId: l.productoId,
        producto: { nombre: l.nombre },
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
      })),
    });

    res.status(201).json({ venta, alertasGeneradas: alertas.length });
  } catch (e) {
    // Distingo error de negocio (400, mensaje limpio) de error de sistema (500).
    if (typeof e.message === "string" && e.message.startsWith("NEGOCIO:")) {
      return res.status(400).json({ error: e.message.replace("NEGOCIO:", "") });
    }
    console.error(e);
    res.status(500).json({ error: "Error al registrar la venta" });
  }
};