const express = require("express");
const router = express.Router();
const Country = require("../models/Country");

// GET all countries
router.get("/", async (req, res) => {
  try {
    const countries = await Country.find();
    res.json(countries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single country
router.get("/:id", async (req, res) => {
  try {
    const country = await Country.findById(req.params.id);
    if (!country) return res.status(404).json({ message: "Country not found" });
    res.json(country);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create country
router.post("/", async (req, res) => {
  try {
    const country = new Country(req.body);
    const saved = await country.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update country
router.put("/:id", async (req, res) => {
  try {
    const updated = await Country.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) return res.status(404).json({ message: "Country not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE country
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Country.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Country not found" });
    res.json({ message: "Country deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
