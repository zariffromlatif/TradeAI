const express = require("express");
const router = express.Router();
const Commodity = require("../models/Commodity");

// GET all commodities
router.get("/", async (req, res) => {
  try {
    const commodities = await Commodity.find();
    res.json(commodities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single commodity
router.get("/:id", async (req, res) => {
  try {
    const commodity = await Commodity.findById(req.params.id);
    if (!commodity)
      return res.status(404).json({ message: "Commodity not found" });
    res.json(commodity);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create commodity
router.post("/", async (req, res) => {
  try {
    const commodity = new Commodity(req.body);
    const saved = await commodity.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update commodity
router.put("/:id", async (req, res) => {
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
});

// DELETE commodity
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Commodity.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Commodity not found" });
    res.json({ message: "Commodity deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
