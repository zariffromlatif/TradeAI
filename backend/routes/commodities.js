const { requireAuth, requireAdmin } = require("../middleware/auth");
const { body, param, validationResult } = require("express-validator");
const express = require("express");
const router = express.Router();
const Commodity = require("../models/Commodity");
const STALE_HOURS = 24;

function withFreshnessMeta(commodityDoc) {
  const row = commodityDoc.toObject ? commodityDoc.toObject() : commodityDoc;
  const asOfMs = row.asOf ? new Date(row.asOf).getTime() : NaN;
  const isStale =
    !Number.isFinite(asOfMs) ||
    Date.now() - asOfMs > STALE_HOURS * 60 * 60 * 1000;
  return {
    ...row,
    isStale,
  };
}

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

// GET all commodities (public)
router.get("/", async (req, res) => {
  try {
    const commodities = await Commodity.find();
    res.json(commodities.map(withFreshnessMeta));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single commodity (public)
router.get("/:id", async (req, res) => {
  try {
    const commodity = await Commodity.findById(req.params.id);
    if (!commodity)
      return res.status(404).json({ message: "Commodity not found" });
    res.json(withFreshnessMeta(commodity));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create commodity — admin only
router.post(
  "/",
  requireAuth,
  requireAdmin,
  [
    body("name").trim().notEmpty(),
    body("category").optional().trim(),
    body("unit").optional().trim(),
    body("currentPrice").optional().isFloat(),
    body("priceHistory").optional().isArray(),
    body("priceHistory.*.date").optional().isISO8601().toDate(),
    body("priceHistory.*.price").optional().isFloat(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const commodity = new Commodity(req.body);
      const saved = await commodity.save();
      res.status(201).json(saved);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

// PUT update commodity — admin only (partial updates)
router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  [
    param("id").isMongoId(),
    body("name").optional().trim().notEmpty(),
    body("category").optional().trim(),
    body("unit").optional().trim(),
    body("currentPrice").optional().isFloat(),
    body("priceHistory").optional().isArray(),
    body("priceHistory.*.date").optional().isISO8601().toDate(),
    body("priceHistory.*.price").optional().isFloat(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const updated = await Commodity.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!updated)
        return res.status(404).json({ message: "Commodity not found" });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

// DELETE commodity — admin only
router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  [param("id").isMongoId()],
  handleValidation,
  async (req, res) => {
    try {
      const deleted = await Commodity.findByIdAndDelete(req.params.id);
      if (!deleted)
        return res.status(404).json({ message: "Commodity not found" });
      res.json({ message: "Commodity deleted" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

module.exports = router;