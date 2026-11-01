// back/src/config/auth.js

const secret = process.env.JWT_SECRET || "dev-secret-nova-salud-cambiar";
const expiresIn = process.env.JWT_EXPIRES_IN || "1h";

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("[auth] JWT_SECRET no está definido en producción. No se permite fallback.");
  }
  console.warn(
    "[auth] JWT_SECRET no está definido en .env. Usando secreto de desarrollo. No usar en producción."
  );
}

module.exports = {
  secret,
  expiresIn,
};