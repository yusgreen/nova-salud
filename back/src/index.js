// back/src/index.js  (version C2: Express + Socket.io montados, orden correcto)

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const productRoutes = require("./routes/products");
const authRoutes = require("./routes/auth");
const salesRoutes = require("./routes/sales");
const { setIo, attachIo } = require("./middleware/attachIo");
const registerSocketHandlers = require("./sockets/inventorySocket");

const app = express();

app.use(cors());
app.use(express.json());

// 1) Server HTTP + Socket.io creados TEMPRANO (el http.createServer del eslabon A
//    paga su dividendo aca: io se monta sobre el mismo server, sin refactor).
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },   // en produccion se restringe el origin (mejora futura, seccion 11)
});
setIo(io);                       // 2) guarda la ref para attachIo
registerSocketHandlers(io);      // 3) registra el "quien escucha" (esqueleto)

// 4) attachIo ANTES de las rutas: cada request lleva req.io puesto al entrar al controller.
app.use(attachIo);

// 5) Recien aca las rutas (leen req.io gracias al paso 4).
app.use("/auth", authRoutes);
app.use("/users", require("./routes/users"));
app.use("/products", productRoutes);
app.use("/sales", salesRoutes);
app.use("/audit", require("./routes/audit"));
app.use("/settings", require("./routes/settings"));

app.get("/", (req, res) => {
  res.json({ ok: true, service: "nova-salud-api" });
});

// Solo escuchamos cuando el archivo se ejecuta directamente (npm run dev / node src/index.js).
// Al importarlo desde las pruebas, exportamos app/server sin abrir un puerto fijo.
if (require.main === module) {
  const PORT = process.env.PORT || 4000;

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Nova Salud API en http://0.0.0.0:${PORT} + Socket.io listo`);
  });
}

module.exports = { app, server, io };