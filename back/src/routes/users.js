// back/src/routes/users.js

const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/user.controller");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

// Gestion de usuarios: exclusivo del administrador.
router.use(requireAuth, requireRole("admin"));

router.get("/", ctrl.getUsers);
router.post("/", ctrl.createUser);
router.put("/:id/estado", ctrl.updateUserStatus);
router.put("/:id", ctrl.updateUser);

module.exports = router;
