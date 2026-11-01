// back/src/routes/products.js

const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/product.controller");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

// Lectura pública: cualquiera puede ver inventario.
router.get("/", ctrl.getProducts);
router.get("/:id/movimientos", requireAuth, requireRole("admin", "farmaceutico"), ctrl.getMovimientos);
router.get("/:id", ctrl.getProduct);

// Escritura protegida: solo admin o farmaceutico.
router.post("/", requireAuth, requireRole("admin", "farmaceutico"), ctrl.createProduct);
router.put("/:id", requireAuth, requireRole("admin", "farmaceutico"), ctrl.updateProduct);
router.put("/:id/estado", requireAuth, requireRole("admin", "farmaceutico"), ctrl.updateProduct);
router.post("/:id/entrada", requireAuth, requireRole("admin", "farmaceutico"), ctrl.receiveStock);
router.post("/:id/entradas", requireAuth, requireRole("admin", "farmaceutico"), ctrl.receiveStock);
router.post("/:id/receive", requireAuth, requireRole("admin", "farmaceutico"), ctrl.receiveStock);
router.delete("/:id", requireAuth, requireRole("admin", "farmaceutico"), ctrl.deleteProduct);

module.exports = router;