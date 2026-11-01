// back/src/middleware/authMiddleware.js

const jwt = require("jsonwebtoken");
const prisma = require("../prisma");
const { secret } = require("../config/auth");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  const token = header.split(" ")[1];
  let decoded;

  try {
    decoded = jwt.verify(token, secret);
  } catch (error) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }

  try {
    // Consulto la BD para que un usuario desactivado no pueda seguir usando
    // un token vigente y para que los cambios de rol se apliquen al instante.
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { id: true, rol: true, activo: true },
    });

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: "Sesión no válida" });
    }

    req.user = { id: usuario.id, rol: usuario.rol };
    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al validar la sesión" });
  }
}

function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ error: "Permiso insuficiente" });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};