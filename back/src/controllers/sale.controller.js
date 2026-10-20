// back/src/controllers/sale.controller.js
// El corazón del enunciado: registro de ventas atomico + descuento de stock
// + validacion de inventario + emision (preparada) de alerta por socket.
const { auditar } = require("../utils/audit");
const prisma = require("../prisma");
const ExcelJS = require("exceljs");
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
const { detalles, nota } = req.body || {};  if (!Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({ error: "detalles debe ser un array no vacio" });
  }
  let notaLimpia = null;
if (typeof nota === "string" && nota.trim()) {
  notaLimpia = nota.trim().slice(0, 250);
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
          nota: notaLimpia,
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
      total: venta.total,
      atendidoPor: atendido,
     nota: venta.nota,          // ← AGREGÁ ESTA LÍNEA
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
    const ventas = await prisma.venta.findMany({
      include: {
        detalles: { include: { producto: true } },
        atendidoPor: { select: { id: true, nombre: true, rol: true } },
      },
      orderBy: { fecha: "desc" },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = "Nova Salud";
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
    st.value = `Generado: ${new Date().toLocaleString("es-PE")}  ·  ${ventas.length} ticket(s)  ·  Total S/ ${totalGeneral.toFixed(2)}`;
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
      r.getCell(7).numFmt = '"S/" #,##0.00';
      r.eachCell((c) => {
        c.border = box;
        if (i % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAY } };
      });
    });

    const tr = rs.addRow(["", "", "", "", "", "", totalGeneral, "TOTAL"]);
    tr.getCell(7).numFmt = '"S/" #,##0.00';
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
        r.getCell(5).numFmt = '"S/" #,##0.00';
        r.getCell(6).numFmt = '"S/" #,##0.00';
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
      },
      orderBy: { fecha: "desc" },
    });
    res.json(ventas);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al listar mi turno" });
  }
};
