// back/src/routes/sales.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/sale.controller");
const { requireAuth } = require("../middleware/authMiddleware");

// Vender es operacion de caja: los TRES roles (admin, farmaceutico, cajero) pueden.
// Por eso solo requireAuth, sin requireRole. Contraste con /products, que es
// administracion de inventario y si exige requireRole("admin","farmaceutico").
router.get("/", requireAuth, ctrl.getSales);
router.post("/", requireAuth, ctrl.createSale);

module.exports = router;