// back/src/routes/auth.js

const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/authMiddleware");

router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
router.get("/me", requireAuth, ctrl.me);
router.put("/me", requireAuth, ctrl.updateMe);
router.put("/password", requireAuth, ctrl.changePassword);

module.exports = router;