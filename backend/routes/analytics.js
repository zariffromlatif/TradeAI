const express = require("express");
const router = express.Router();
const TradeRecord = require("../models/TradeRecord");
const axios = require("axios");

// GET /api/analytics/dashboard
// Returns top exporters, top importers, and total trade value per country
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

// GET /api/analytics/risk/:country — bridge to ML service
router.get("/risk/:country", async (req, res) => {
  try {
    const response = await axios.get(
      `http://127.0.0.1:8000/api/risk/${req.params.country}`,
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ message: "ML Service unreachable" });
  }
});

module.exports = router;
