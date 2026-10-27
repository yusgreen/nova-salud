const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/settings.controller");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

router.get("/", ctrl.getSettings);

router.put(
  "/",
  requireAuth,
  requireRole("admin"),
  ctrl.updateSettings
);

module.exports = router;
