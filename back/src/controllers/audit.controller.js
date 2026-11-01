const prisma = require("../prisma");

function parseDetalle(detalle) {
  if (!detalle) return null;
  try {
    return JSON.parse(detalle);
  } catch {
    return detalle;
  }
}

exports.getAuditLogs = async (req, res) => {
  try {
    const limiteRaw = Number(req.query.limite || 100);
    const limite = Math.min(Math.max(limiteRaw || 100, 1), 500);

    const where = {};
    if (req.query.accion) where.accion = String(req.query.accion);
    if (req.query.entidad) where.entidad = String(req.query.entidad);
    if (req.query.userId) {
    const userId = Number(req.query.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "El parámetro userId no es válido" });
    }
    where.userId = userId;
  }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { fecha: "desc" },
      take: limite,
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            rol: true,
          },
        },
      },
    });

    res.json(
      logs.map((l) => ({
        id: l.id,
        accion: l.accion,
        entidad: l.entidad,
        entidadId: l.entidadId,
        detalle: parseDetalle(l.detalle),
        ip: l.ip,
        userAgent: l.userAgent,
        fecha: l.fecha,
        usuario: l.user
          ? {
              id: l.user.id,
              nombre: l.user.nombre,
              rol: l.user.rol,
            }
          : null,
      }))
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al listar auditoría" });
  }
};