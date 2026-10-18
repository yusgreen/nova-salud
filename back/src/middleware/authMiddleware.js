// back/src/middleware/authMiddleware.js

const jwt = require("jsonwebtoken");
const { secret } = require("../config/auth");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // { id, rol }
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido o expirado" });
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