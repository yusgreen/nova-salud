// Singleton del cliente Prisma. UN solo new PrismaClient() para toda la app.
// Si cada controller hiciera su propio new, abriríamos varias conexiones a la vez.
// Espejo del patron src/prisma/ que ya se usa en produccion (tu empresa), version JS/CommonJS.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

module.exports = prisma;