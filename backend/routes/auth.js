const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { requireAuth, attachUser } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

// POST /api/auth/register
router.post(
  "/register",
  [
    body("name").trim().notEmpty(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { name, email, password } = req.body;
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const count = await User.countDocuments();
      const role = count === 0 ? "admin" : "user";

      const hash = await bcrypt.hash(password, 10);
      const user = await User.create({
        name,
        email,
        password: hash,
        role,
      });

      const token = signToken(user);
      res.status(201).json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          tier: user.tier,
        },
      });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

// POST /api/auth/login
router.post(
  "/login",
  [body("email").isEmail().normalizeEmail(), body("password").notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = signToken(user);
      res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          tier: user.tier,
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// GET /api/auth/me — requires Bearer token
router.get("/me", requireAuth, attachUser, (req, res) => {
  res.json({
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    tier: req.user.tier,
  });
});

module.exports = router;
