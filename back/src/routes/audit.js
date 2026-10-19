const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/audit.controller");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

// Auditoría: solo admin y farmacéutico.
// El front la ocultará, pero el backend es el árbitro.
router.get(
  "/",
  requireAuth,
  requireRole("admin", "farmaceutico"),
  ctrl.getAuditLogs
);

module.exports = router;