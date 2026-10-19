const prisma = require("../prisma");

function serializarDetalle(detalle) {
  if (detalle === undefined || detalle === null) return null;
  if (typeof detalle === "string") return detalle;
  try {
    return JSON.stringify(detalle);
  } catch {
    return null;
  }
}

async function auditar({
  req,
  userId,
  accion,
  entidad = null,
  entidadId = null,
  detalle = null,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? req?.user?.id ?? null,
        accion,
        entidad,
        entidadId,
        detalle: serializarDetalle(detalle),
        ip: req?.ip ?? null,
        userAgent: req?.headers?.["user-agent"] ?? null,
      },
    });
  } catch (e) {
    // La auditoría nunca debe tumbar la acción principal.
    console.error("Error auditando:", e.message);
  }
}

module.exports = { auditar };