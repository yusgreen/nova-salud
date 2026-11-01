// back/src/controllers/sale.controller.js
// El corazón del enunciado: registro de ventas atomico + descuento de stock
// + validacion de inventario + emision (preparada) de alerta por socket.
const { auditar } = require("../utils/audit");
const prisma = require("../prisma");
const ExcelJS = require("exceljs");

// Fechas opcionales: acepta YYYY-MM-DD (día completo) o un ISO completo.
function parseFechaFiltro(valor, finDelDia) {
  if (valor === undefined || valor === null || valor === "") return undefined;
  const texto = String(valor).trim();
  if (!texto) return undefined;

  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(texto);
  const fecha = soloFecha
    ? new Date(`${texto}T${finDelDia ? "23:59:59.999" : "00:00:00.000"}`)
    : new Date(texto);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// Filtros opcionales de GET /sales y GET /sales/export.
function construirFiltroVentas(query = {}) {
  const desde = parseFechaFiltro(query.desde, false);
  const hasta = parseFechaFiltro(query.hasta, true);

  if (desde === null) return { error: "El parámetro desde no es una fecha válida" };
  if (hasta === null) return { error: "El parámetro hasta no es una fecha válida" };
  if (desde && hasta && desde > hasta) {
    return { error: "El rango de fechas no es válido" };
  }

  const where = {};
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = desde;
    if (hasta) where.fecha.lte = hasta;
  }

  if (query.usuarioId !== undefined && query.usuarioId !== "") {
    const id = Number(query.usuarioId);
    if (!Number.isInteger(id) || id <= 0) {
      return { error: "El parámetro usuarioId no es válido" };
    }
    where.usuarioId = id;
  }

  return { where };
}

function rangoDiaCierre(fechaStr) {
  let texto = fechaStr;
  if (!texto) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(hoy);
    fin.setHours(23, 59, 59, 999);
    return { fecha: hoy.toISOString().slice(0, 10), inicio: hoy, fin };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(texto))) {
    return null;
  }

  const inicio = new Date(`${texto}T00:00:00.000`);
  const fin = new Date(`${texto}T23:59:59.999`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null;

  return { fecha: String(texto), inicio, fin };
}

// ---- GET /sales/cierre : cierre de caja por fecha y usuario ----
exports.getCierreCaja = async (req, res) => {
  try {
    const rango = rangoDiaCierre(req.query.fecha);
    if (!rango) {
      return res.status(400).json({ error: "La fecha no es válida" });
    }

    const esGestor = req.user.rol === "admin" || req.user.rol === "farmaceutico";
    let usuarioId = null;

    if (esGestor && req.query.usuarioId !== undefined && req.query.usuarioId !== "") {
      const id = Number(req.query.usuarioId);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "El parámetro usuarioId no es válido" });
      }
      usuarioId = id;
    } else if (!esGestor) {
      usuarioId = req.user.id;
    }

    const where = {
      fecha: { gte: rango.inicio, lte: rango.fin },
    };
    if (usuarioId) where.usuarioId = usuarioId;

    const ventas = await prisma.venta.findMany({
      where,
      include: {
        detalles: { include: { producto: true } },
        atendidoPor: { select: { id: true, nombre: true, rol: true } },
        anuladaPor: { select: { id: true, nombre: true, rol: true } },
      },
      orderBy: { fecha: "asc" },
    });

    const completadas = ventas.filter((v) => v.estado !== "ANULADA");
    const anuladas = ventas.filter((v) => v.estado === "ANULADA");

    const porMetodoMap = {};
    completadas.forEach((v) => {
      const metodo = v.metodoPago || "EFECTIVO";
      if (!porMetodoMap[metodo]) {
        porMetodoMap[metodo] = { metodo, total: 0, cantidad: 0 };
      }
      porMetodoMap[metodo].total += Number(v.total || 0);
      porMetodoMap[metodo].cantidad += 1;
    });

    const porMetodo = Object.values(porMetodoMap).map((item) => ({
      ...item,
      total: Math.round(item.total * 100) / 100,
    }));

    const totalGeneral = completadas.reduce(
      (suma, v) => suma + Number(v.total || 0),
      0
    );
    const efectivoEsperado = completadas
      .filter((v) => (v.metodoPago || "EFECTIVO") === "EFECTIVO")
      .reduce((suma, v) => {
        if (v.montoRecibido != null) {
          return suma + (Number(v.montoRecibido) - Number(v.vuelto || 0));
        }
        return suma + Number(v.total || 0);
      }, 0);

    let usuario = null;
    if (usuarioId) {
      usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { id: true, nombre: true, rol: true },
      });
    }

    return res.json({
      fecha: rango.fecha,
      usuario,
      resumen: {
        cantidadVentas: completadas.length,
        totalGeneral: Math.round(totalGeneral * 100) / 100,
        porMetodo,
        efectivoEsperado: Math.round(efectivoEsperado * 100) / 100,
        anuladas: {
          cantidad: anuladas.length,
          total: Math.round(
            anuladas.reduce((suma, v) => suma + Number(v.total || 0), 0) * 100
          ) / 100,
        },
      },
      ventas,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error al generar el cierre de caja" });
  }
};

// ---- GET /sales : historial de ventas (con lineas y quien atendio) ----
exports.getSales = async (req, res) => {
  try {
    const filtro = construirFiltroVentas(req.query);
    if (filtro.error) return res.status(400).json({ error: filtro.error });

    const ventas = await prisma.venta.findMany({
      where: filtro.where,
      include: {
        // Traigo el producto de cada linea para que el front muestre nombre/imagen.
        detalles: { include: { producto: true } },
        // Select explicito: NUNCA traigo passwordHash de quien atendio (seguridad).
        atendidoPor: { select: { id: true, nombre: true, rol: true } },
        anuladaPor: { select: { id: true, nombre: true, rol: true } },
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
  const { detalles, nota } = req.body || {};
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({ error: "detalles debe ser un array no vacio" });
  }

  let notaLimpia = null;
  if (typeof nota === "string" && nota.trim()) {
    notaLimpia = nota.trim().slice(0, 250);
  }

  // Validacion estricta: si UNA linea es invalida, se rechaza TODA la venta.
  // Ignorarla en silencio podria registrar un ticket incompleto sin avisar.
  const lineaInvalida = detalles.some((d) => {
    const pid = Number(d?.productoId);
    const cant = Number(d?.cantidad);
    return !Number.isInteger(pid) || pid <= 0 || !Number.isInteger(cant) || cant <= 0;
  });

  if (lineaInvalida) {
    return res.status(400).json({
      error: "Cada línea requiere productoId y cantidad enteros positivos",
    });
  }

  // Agrupo por productoId sumando cantidades (blindaje 5).
  const agrupadas = Object.values(
    detalles.reduce((acc, d) => {
      const pid = Number(d.productoId);
      const cant = Number(d.cantidad);
      if (!acc[pid]) acc[pid] = { productoId: pid, cantidad: 0 };
      acc[pid].cantidad += cant;
      return acc;
    }, {})
  );

  const METODOS_PAGO = ["EFECTIVO", "TARJETA", "YAPE_PLIN"];
  const metodoPago = String(req.body?.metodoPago || "EFECTIVO").trim().toUpperCase();
  if (!METODOS_PAGO.includes(metodoPago)) {
    return res.status(400).json({ error: "metodoPago no es válido" });
  }

  let montoRecibido = undefined;
  if (
    req.body?.montoRecibido !== undefined &&
    req.body?.montoRecibido !== null &&
    req.body?.montoRecibido !== ""
  ) {
    const monto = Number(req.body.montoRecibido);
    if (!Number.isFinite(monto) || monto < 0) {
      return res.status(400).json({ error: "montoRecibido no es válido" });
    }
    montoRecibido = monto;
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
        if (p.activo === false) {
          throw new Error(`NEGOCIO:El producto "${p.nombre}" está inactivo y no se puede vender`);
        }
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

      const totalRedondeado = Math.round(total * 100) / 100;

      let vuelto = null;
      if (metodoPago === "EFECTIVO" && montoRecibido !== undefined) {
        if (montoRecibido < totalRedondeado) {
          throw new Error("NEGOCIO:Monto recibido insuficiente");
        }
        vuelto = Math.round((montoRecibido - totalRedondeado) * 100) / 100;
      }

            // 4) Creo la venta con sus lineas (nested write de Prisma).
      const venta = await tx.venta.create({
        data: {
          total: totalRedondeado,
          usuarioId,
          nota: notaLimpia,
          metodoPago,
          montoRecibido: metodoPago === "EFECTIVO" ? (montoRecibido ?? null) : null,
          vuelto,
          detalles: { create: lineasProcesadas.map(({ nombre, stockAnterior, stockMinimo, ...rest }) => rest) },
        },
        include: {
          detalles: { include: { producto: true } },
          atendidoPor: { select: { id: true, nombre: true, rol: true } },
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
        await tx.movimientoStock.create({
          data: {
            productoId: l.productoId,
            usuarioId,
            tipo: "VENTA",
            cantidad: -l.cantidad,
            stockAnterior: l.stockAnterior,
            stockNuevo: l.stockAnterior - l.cantidad,
            motivo: `Venta #${venta.id}`,
          },
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
      total: venta.total,
      metodoPago: venta.metodoPago,
      montoRecibido: venta.montoRecibido,
      vuelto: venta.vuelto,
      atendidoPor: atendido,
     nota: venta.nota,
      detalles: lineasProcesadas.map((l) => ({
        productoId: l.productoId,
        producto: { nombre: l.nombre },
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
      })),
    });

    await auditar({
      req,
      accion: "SALE_CREATE",
      entidad: "Venta",
      entidadId: venta.id,
      detalle: {
        total: venta.total,
        metodoPago: venta.metodoPago,
        vuelto: venta.vuelto,
        cantidadLineas: lineasProcesadas.length,
        nota: notaLimpia,
      },
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

// ---- GET /sales/export : descarga un .xlsx con plantilla de dos hojas ----
exports.exportSalesExcel = async (req, res) => {
  try {
    const filtro = construirFiltroVentas(req.query);
    if (filtro.error) return res.status(400).json({ error: filtro.error });

    const ventas = await prisma.venta.findMany({
      where: { ...filtro.where, estado: "COMPLETADA" },
      include: {
        detalles: { include: { producto: true } },
        atendidoPor: { select: { id: true, nombre: true, rol: true } },
        anuladaPor: { select: { id: true, nombre: true, rol: true } },
      },
      orderBy: { fecha: "desc" },
    });

    const config = await prisma.configuracion.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    const moneda = config.moneda;
    const formatoMoneda = `"${moneda.replace(/"/g, "")}" #,##0.00`;

    const wb = new ExcelJS.Workbook();
    wb.creator = config.nombreNegocio;
    wb.created = new Date();

    // Paleta coherente con la marca (teal). ARGB con alpha FF.
    const TEAL = "FF0F766E", TEAL_SOFT = "FFCCFBF1", GRAY = "FFF1F5F9", WHITE = "FFFFFFFF";
    const BORDER = { style: "thin", color: { argb: "FFCBD5E1" } };
    const box = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

    // ---------- Hoja 1: Resumen (una fila por ticket) ----------
    const rs = wb.addWorksheet("Resumen", { views: [{ state: "frozen", ySplit: 3 }] });
    rs.mergeCells("A1:H1");
    const t = rs.getCell("A1");
    t.value = "Nova Salud — Reporte de ventas";
    t.font = { bold: true, size: 14, color: { argb: TEAL } };
    t.alignment = { horizontal: "center", vertical: "middle" };
    rs.getRow(1).height = 24;

    rs.mergeCells("A2:H2");
    const totalGeneral = ventas.reduce((s, v) => s + v.total, 0);
    const st = rs.getCell("A2");
    st.value = `Generado: ${new Date().toLocaleString("es-PE")}  ·  ${ventas.length} ticket(s)  ·  Total ${moneda} ${totalGeneral.toFixed(2)}`;
    st.font = { size: 10, color: { argb: "FF64748B" } };
    st.alignment = { horizontal: "center" };

    const hr = rs.getRow(3);
    hr.values = ["Ticket", "Fecha", "Atendió", "Rol", "Líneas", "Unidades", "Total", "Nota"];
    hr.height = 20;
    hr.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
      c.font = { bold: true, color: { argb: WHITE } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = box;
    });

    ventas.forEach((v, i) => {
      const items = v.detalles.reduce((a, l) => a + l.cantidad, 0);
      const r = rs.addRow([
        v.id, new Date(v.fecha), v.atendidoPor?.nombre || "—", v.atendidoPor?.rol || "—",
        v.detalles.length, items, v.total, v.nota || "",
      ]);
      r.getCell(2).numFmt = "dd/mm/yyyy hh:mm";
      r.getCell(7).numFmt = formatoMoneda;
      r.eachCell((c) => {
        c.border = box;
        if (i % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAY } };
      });
    });

    const tr = rs.addRow(["", "", "", "", "", "", totalGeneral, "TOTAL"]);
    tr.getCell(7).numFmt = formatoMoneda;
    tr.font = { bold: true };
    tr.eachCell((c) => { c.border = { top: { style: "medium", color: { argb: TEAL } }, ...box }; });

    rs.columns = [{ width: 8 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 8 }, { width: 10 }, { width: 14 }, { width: 36 }];

    // ---------- Hoja 2: Detalle (una fila por línea de venta) ----------
    const dt = wb.addWorksheet("Detalle", { views: [{ state: "frozen", ySplit: 2 }] });
    dt.mergeCells("A1:F1");
    const d1 = dt.getCell("A1");
    d1.value = "Nova Salud — Detalle por línea";
    d1.font = { bold: true, size: 12, color: { argb: TEAL } };
    d1.alignment = { horizontal: "center" };
    dt.getRow(1).height = 20;

    const dhr = dt.getRow(2);
    dhr.values = ["Ticket", "Fecha", "Producto", "Cant.", "P. unit.", "Subtotal"];
    dhr.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
      c.font = { bold: true, color: { argb: WHITE } };
      c.alignment = { horizontal: "center" };
      c.border = box;
    });

    let idx = 0;
    ventas.forEach((v) => {
      v.detalles.forEach((l) => {
        const r = dt.addRow([
          v.id, new Date(v.fecha), l.producto?.nombre || "(producto eliminado)",
          l.cantidad, l.precioUnitario, l.cantidad * l.precioUnitario,
        ]);
        r.getCell(2).numFmt = "dd/mm/yyyy hh:mm";
        r.getCell(5).numFmt = formatoMoneda;
        r.getCell(6).numFmt = formatoMoneda;
        r.eachCell((c) => {
          c.border = box;
          if (idx % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_SOFT } };
        });
        idx++;
      });
    });
    dt.columns = [{ width: 8 }, { width: 18 }, { width: 30 }, { width: 8 }, { width: 12 }, { width: 12 }];

    const buf = await wb.xlsx.writeBuffer();
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="nova-salud-ventas.xlsx"',
    });
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al generar el Excel" });
  }
};

// ---- GET /sales/mi-turno : ventas del USUARIO AUTENTICADO (cualquier rol) ----
// Sin filtro de fecha en el back: el "hoy" se define en el front (hora local del
// navegador), igual que el panel del gerente. Una sola definicion de "hoy".
exports.getMyTurn = async (req, res) => {
  try {
    const ventas = await prisma.venta.findMany({
      where: { usuarioId: req.user.id },
      include: {
        detalles: { include: { producto: true } },
        atendidoPor: { select: { id: true, nombre: true, rol: true } },
        anuladaPor: { select: { id: true, nombre: true, rol: true } },
      },
      orderBy: { fecha: "desc" },
    });
    res.json(ventas);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al listar mi turno" });
  }
};

// ---- POST /sales/:id/anular : anula una venta y repone stock (solo admin/farmaceutico) ----
exports.anularSale = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "id inválido" });
  }

  const motivo = String(req.body?.motivo || "").trim();
  if (motivo.length < 5) {
    return res.status(400).json({ error: "El motivo debe tener al menos 5 caracteres" });
  }
  if (motivo.length > 250) {
    return res.status(400).json({ error: "El motivo no puede superar los 250 caracteres" });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const venta = await tx.venta.findUnique({
        where: { id },
        include: {
          detalles: true,
          atendidoPor: { select: { id: true, nombre: true, rol: true } },
        },
      });

      if (!venta) {
        return { status: 404, error: "Venta no encontrada" };
      }

      if (venta.estado === "ANULADA") {
        return { status: 409, error: "La venta ya está anulada" };
      }

      const stockActualizado = [];
      for (const linea of venta.detalles) {
        const producto = await tx.producto.findUnique({
          where: { id: linea.productoId },
          select: { id: true, nombre: true, stock: true, stockMinimo: true },
        });

        if (!producto) {
          throw new Error(`NEGOCIO:Producto ${linea.productoId} no existe`);
        }

        const stockNuevo = producto.stock + linea.cantidad;

        await tx.producto.update({
          where: { id: producto.id },
          data: { stock: { increment: linea.cantidad } },
        });

        await tx.movimientoStock.create({
          data: {
            productoId: producto.id,
            usuarioId: req.user.id,
            tipo: "ANULACION",
            cantidad: linea.cantidad,
            stockAnterior: producto.stock,
            stockNuevo,
            motivo: `Anulación venta #${venta.id}`,
          },
        });

        stockActualizado.push({
          id: producto.id,
          nombre: producto.nombre,
          stock: stockNuevo,
        });
      }

      const anulada = await tx.venta.update({
        where: { id: venta.id },
        data: {
          estado: "ANULADA",
          anuladaPorId: req.user.id,
          anuladaEn: new Date(),
          motivoAnulacion: motivo,
        },
        include: {
          detalles: { include: { producto: true } },
          atendidoPor: { select: { id: true, nombre: true, rol: true } },
          anuladaPor: { select: { id: true, nombre: true, rol: true } },
        },
      });

      return { venta: anulada, stockActualizado };
    });

    if (resultado.error) {
      return res.status(resultado.status).json({ error: resultado.error });
    }

    const { venta, stockActualizado } = resultado;

    req.io?.emit("stock_actualizado", stockActualizado);
    req.io?.emit("venta_anulada", {
      id: venta.id,
      estado: venta.estado,
      anuladaEn: venta.anuladaEn,
      motivoAnulacion: venta.motivoAnulacion,
      anuladaPor: venta.anuladaPor,
    });

    await auditar({
      req,
      userId: req.user.id,
      accion: "SALE_VOID",
      entidad: "Venta",
      entidadId: venta.id,
      detalle: {
        total: venta.total,
        motivo,
        cantidadLineas: venta.detalles.length,
      },
    });

    return res.json({ venta });
  } catch (e) {
    if (typeof e.message === "string" && e.message.startsWith("NEGOCIO:")) {
      return res.status(400).json({ error: e.message.replace("NEGOCIO:", "") });
    }
    console.error(e);
    return res.status(500).json({ error: "Error al anular la venta" });
  }
};
