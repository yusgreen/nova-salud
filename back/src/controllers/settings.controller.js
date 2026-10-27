const prisma = require("../prisma");
const { auditar } = require("../utils/audit");

const CAMPOS = [
  "nombreNegocio",
  "lema",
  "moneda",
  "umbralStockBajo",
  "mostrarAyudaDemo",
];

async function obtenerConfiguracion() {
  return prisma.configuracion.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

function validar(data) {
  if (data.nombreNegocio !== undefined) {
    if (
      typeof data.nombreNegocio !== "string" ||
      data.nombreNegocio.length < 2 ||
      data.nombreNegocio.length > 60
    ) {
      return "nombreNegocio debe tener entre 2 y 60 caracteres";
    }
  }

  if (data.lema !== undefined) {
    if (typeof data.lema !== "string" || data.lema.length > 120) {
      return "lema debe ser texto de hasta 120 caracteres";
    }
  }

  if (data.moneda !== undefined) {
    if (typeof data.moneda !== "string" || !/^[^\s]{1,4}$/.test(data.moneda)) {
      return "moneda debe ser un símbolo de 1 a 4 caracteres sin espacios";
    }
  }

  if (data.umbralStockBajo !== undefined) {
    const valor = data.umbralStockBajo;
    if (!Number.isInteger(valor) || valor < 0 || valor > 100000) {
      return "umbralStockBajo debe ser un entero entre 0 y 100000";
    }
  }

  if (data.mostrarAyudaDemo !== undefined) {
    if (typeof data.mostrarAyudaDemo !== "boolean") {
      return "mostrarAyudaDemo debe ser verdadero o falso";
    }
  }

  return null;
}

exports.getSettings = async (req, res) => {
  try {
    res.json(await obtenerConfiguracion());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener la configuración" });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const data = {};
    for (const campo of CAMPOS) {
      if (req.body?.[campo] !== undefined) data[campo] = req.body[campo];
    }

    if (data.nombreNegocio !== undefined && typeof data.nombreNegocio === "string") {
      data.nombreNegocio = data.nombreNegocio.trim();
    }
    if (data.lema !== undefined && typeof data.lema === "string") {
      data.lema = data.lema.trim();
    }
    if (data.moneda !== undefined && typeof data.moneda === "string") {
      data.moneda = data.moneda.trim();
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No se enviaron campos para actualizar" });
    }

    const invalido = validar(data);
    if (invalido) return res.status(400).json({ error: invalido });

    await obtenerConfiguracion();

    const config = await prisma.configuracion.update({
      where: { id: 1 },
      data,
    });

    await auditar({
      req,
      accion: "CONFIG_UPDATE",
      entidad: "Configuracion",
      entidadId: 1,
      detalle: data,
    });

    res.json(config);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al actualizar la configuración" });
  }
};
