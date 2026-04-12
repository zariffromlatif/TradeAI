const { requireAuth, requireAdmin } = require("../middleware/auth");
const { body, param, validationResult } = require("express-validator");
const express = require("express");
const router = express.Router();
const TradeRecord = require("../models/TradeRecord");

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

// GET all trade records (public)
router.get("/", async (req, res) => {
  try {
    const records = await TradeRecord.find()
      .populate("country", "name code")
      .populate("commodity", "name category");
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single trade record (public)
router.get("/:id", async (req, res) => {
  try {
    const record = await TradeRecord.findById(req.params.id)
      .populate("country", "name code")
      .populate("commodity", "name category");
    if (!record)
      return res.status(404).json({ message: "Trade record not found" });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create trade record — admin only
router.post(
  "/",
  requireAuth,
  requireAdmin,
  [
    body("country").isMongoId().withMessage("country must be a valid MongoDB id"),
    body("commodity").isMongoId().withMessage("commodity must be a valid MongoDB id"),
    body("type").isIn(["import", "export"]),
    body("volume").optional().isFloat({ gt: 0 }),
    body("value").optional().isFloat(),
    body("date").isISO8601().toDate(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const record = new TradeRecord(req.body);
      const saved = await record.save();
      res.status(201).json(saved);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

// PUT update trade record — admin only (partial updates)
router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  [
    param("id").isMongoId(),
    body("country").optional().isMongoId(),
    body("commodity").optional().isMongoId(),
    body("type").optional().isIn(["import", "export"]),
    body("volume").optional().isFloat({ gt: 0 }),
    body("value").optional().isFloat(),
    body("date").optional().isISO8601().toDate(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const updated = await TradeRecord.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      if (!updated)
        return res.status(404).json({ message: "Trade record not found" });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
);

// DELETE trade record — admin only
router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  [param("id").isMongoId()],
  handleValidation,
  async (req, res) => {
    try {
      const deleted = await TradeRecord.findByIdAndDelete(req.params.id);
      if (!deleted)
        return res.status(404).json({ message: "Trade record not found" });
      res.json({ message: "Trade record deleted" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

module.exports = router;