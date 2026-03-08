const express = require("express");
const router = express.Router();
const TradeRecord = require("../models/TradeRecord");

// GET all trade records (with country & commodity populated)
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

// GET single trade record
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

// POST create trade record
router.post("/", async (req, res) => {
  try {
    const record = new TradeRecord(req.body);
    const saved = await record.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update trade record
router.put("/:id", async (req, res) => {
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
});

// DELETE trade record
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await TradeRecord.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Trade record not found" });
    res.json({ message: "Trade record deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
