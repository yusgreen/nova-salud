// back/src/routes/sales.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/sale.controller");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

// VENDER es operacion de caja: los TRES roles pueden (requireAuth a secas).
router.post("/", requireAuth, ctrl.createSale);

// VER HISTORIAL es operacion de auditoria/gestion: solo admin y farmaceutico.
// Mismo recurso /sales, dos middlewares distintos segun la operacion.
// El front oculta el tab, pero el back es el arbitro (403 si el cajero insiste por API).
router.get("/mi-turno", requireAuth, ctrl.getMyTurn);   // requireAuth, SIN requireRole: todo rol autenticado
router.get("/", requireAuth, requireRole("admin", "farmaceutico"), ctrl.getSales);
router.get("/export", requireAuth, requireRole("admin", "farmaceutico"), ctrl.exportSalesExcel);
module.exports = router;