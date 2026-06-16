const express = require("express");

const {
  getSignupOptions,
  checkEmail,
  register,
  login,
  getMe,
} = require("../controllers/authController");

const {
  authenticate,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/signup-options", getSignupOptions);

router.get("/check-email", checkEmail);

router.post("/register", register);

router.post("/login", login);

router.get("/me", authenticate, getMe);

module.exports = router;