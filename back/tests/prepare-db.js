// Prepara una base SQLite aislada para las pruebas (back/prisma/test.db).
// No toca dev.db: DATABASE_URL se inyecta por entorno y dotenv no la sobreescribe.
const { execSync } = require("node:child_process");
const path = require("node:path");

const backDir = path.join(__dirname, "..");

console.log("[test] Preparando base de datos aislada (prisma/test.db)…");

execSync("npx prisma db push --skip-generate --accept-data-loss", {
  cwd: backDir,
  env: { ...process.env, DATABASE_URL: "file:./test.db" },
  stdio: "inherit",
});
