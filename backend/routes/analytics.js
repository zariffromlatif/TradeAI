const express = require("express");
const router = express.Router();
const TradeRecord = require("../models/TradeRecord");
const Country = require("../models/Country");
const axios = require("axios");

const ML_BASE = "http://127.0.0.1:8000";

// GET /api/analytics/dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const exportStats = await TradeRecord.aggregate([
      { $match: { type: "export" } },
      { $group: { _id: "$country", totalExportValue: { $sum: "$value" } } },
      { $sort: { totalExportValue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "countries",
          localField: "_id",
          foreignField: "_id",
          as: "countryInfo",
        },
      },
      { $unwind: "$countryInfo" },
      { $project: { country: "$countryInfo.name", totalExportValue: 1 } },
    ]);

    const importStats = await TradeRecord.aggregate([
      { $match: { type: "import" } },
      { $group: { _id: "$country", totalImportValue: { $sum: "$value" } } },
      { $sort: { totalImportValue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "countries",
          localField: "_id",
          foreignField: "_id",
          as: "countryInfo",
        },
      },
      { $unwind: "$countryInfo" },
      { $project: { country: "$countryInfo.name", totalImportValue: 1 } },
    ]);

    res.json({ topExporters: exportStats, topImporters: importStats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/risk/:country
// Looks up country from DB, builds indicator payload from stored data, calls ML service
router.get("/risk/:country", async (req, res) => {
  try {
    const country = await Country.findOne({
      code: req.params.country.toUpperCase(),
    });
    if (!country)
      return res.status(404).json({ message: "Country not found in database" });

    const payload = {
      country_code: country.code,
      country_name: country.name,
      indicators: {
        gdp_growth_rate: 3.0,
        inflation_rate: country.inflation ?? null,
        trade_balance_usd: country.tradeBalance ?? null,
      },
    };

    const response = await axios.post(`${ML_BASE}/api/risk-score`, payload);
    res.json(response.data);
  } catch (err) {
    res
      .status(500)
      .json({ message: "ML Service unreachable or country not found" });
  }
});

// POST /api/analytics/risk-score
// Full proxy — frontend sends all indicators, bridges to ML service FR8
router.post("/risk-score", async (req, res) => {
  try {
    const response = await axios.post(`${ML_BASE}/api/risk-score`, req.body);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ message: "ML Service unreachable" });
  }
});

// POST /api/analytics/risk/:country/breakdown
// Full proxy — bridges to ML service FR9 breakdown endpoint
router.post("/risk/:country/breakdown", async (req, res) => {
  try {
    const response = await axios.post(
      `${ML_BASE}/api/risk/${req.params.country}/breakdown`,
      req.body,
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ message: "ML Service unreachable" });
  }
});

module.exports = router;
