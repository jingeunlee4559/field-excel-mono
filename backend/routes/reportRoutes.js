const express = require("express");

const {
  getSummary,
  getManagerReport,
} = require("../controllers/reportController");

const { authenticate, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/summary",
  authenticate,
  authorize("MANAGER", "SYSTEM_ADMIN"),
  getSummary
);

router.get(
  "/manager",
  authenticate,
  authorize("MANAGER", "SYSTEM_ADMIN"),
  getManagerReport
);

module.exports = router;