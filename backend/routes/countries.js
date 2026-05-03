const { requireAuth, requireAdmin } = require("../middleware/auth");
const { body, param, validationResult } = require("express-validator");
const express = require("express");
const router = express.Router();
const Country = require("../models/Country");

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });
  next();
}

// GET all countries (public)
router.get("/", async (req, res) => {
  try {
    const countries = await Country.find();
    res.json(countries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single country (public)
router.get("/:id", async (req, res) => {
  try {
    const country = await Country.findById(req.params.id);
    if (!country) return res.status(404).json({ message: "Country not found" });
    res.json(country);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create country — admin only
router.post(
  "/",
  requireAuth,
  requireAdmin,
  [
    body("name").trim().notEmpty(),
    body("code").trim().notEmpty().isLength({ min: 2, max: 3 }),
    body("region").optional().trim(),
    body("GDP").optional().isFloat(),
    body("inflation").optional().isFloat(),
    body("tradeBalance").optional().isFloat(),
    body("destructionDate").optional().isISO8601(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const country = new Country(req.body);
      const saved = await country.save();
      res.status(201).json(saved);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

// PUT update country — admin only (partial updates allowed)
router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  [
    param("id").isMongoId(),
    body("name").optional().trim().notEmpty(),
    body("code").optional().trim().notEmpty().isLength({ min: 2, max: 3 }),
    body("region").optional().trim(),
    body("GDP").optional().isFloat(),
    body("inflation").optional().isFloat(),
    body("tradeBalance").optional().isFloat(),
    body("destructionDate").optional().isISO8601(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const updated = await Country.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!updated)
        return res.status(404).json({ message: "Country not found" });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

// DELETE country — admin only
router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  [param("id").isMongoId()],
  handleValidation,
  async (req, res) => {
    try {
      const deleted = await Country.findByIdAndDelete(req.params.id);
      if (!deleted)
        return res.status(404).json({ message: "Country not found" });
      res.json({ message: "Country deleted" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

module.exports = router;
