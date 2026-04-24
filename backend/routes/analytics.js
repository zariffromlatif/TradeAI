const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const TradeRecord = require("../models/TradeRecord");
const Country = require("../models/Country");
const Commodity = require("../models/Commodity");
const axios = require("axios");
const {
  getAllCommodityIndicators,
} = require("../services/commodityIndicatorService");

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

// GET /api/analytics/trade-balance
router.get("/trade-balance", async (req, res) => {
  try {
    const { country, region } = req.query;
    
    // Build the aggregation pipeline
    const pipeline = [
      {
        $lookup: {
          from: "countries",
          localField: "country",
          foreignField: "_id",
          as: "countryInfo"
        }
      },
      { $unwind: "$countryInfo" }
    ];

    // Optional filters
    const matchStage = {};
    if (country) {
      matchStage["countryInfo.code"] = country.toUpperCase();
    }
    if (region) {
      matchStage["countryInfo.region"] = new RegExp(region, 'i');
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Group by year, month, and type
    pipeline.push({
      $group: {
        _id: {
          year: { $year: "$date" },
          month: { $month: "$date" },
          type: "$type"
        },
        totalValue: { $sum: "$value" }
      }
    });

    // Sub-group to combine export and import into a single document per year/month
    pipeline.push({
      $group: {
        _id: { year: "$_id.year", month: "$_id.month" },
        exportValue: {
          $sum: {
            $cond: [{ $eq: ["$_id.type", "export"] }, "$totalValue", 0]
          }
        },
        importValue: {
          $sum: {
            $cond: [{ $eq: ["$_id.type", "import"] }, "$totalValue", 0]
          }
        }
      }
    });

    // Project final cleanly structured payload
    pipeline.push({
      $project: {
        _id: 0,
        year: "$_id.year",
        month: "$_id.month",
        exportValue: 1,
        importValue: 1,
        balance: { $subtract: ["$exportValue", "$importValue"] }
      }
    });

    // Chronological order
    pipeline.push({
      $sort: { year: 1, month: 1 }
    });

    const results = await TradeRecord.aggregate(pipeline);
    res.json(results);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/country/:code?monthly=true
// F1 — country-wise import/export aggregates
router.get("/country/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const monthly =
      req.query.monthly === "1" ||
      req.query.monthly === "true" ||
      req.query.monthly === "yes";

    const country = await Country.findOne({ code });
    if (!country) {
      return res.status(404).json({ message: "Country not found" });
    }

    if (!monthly) {
      const byType = await TradeRecord.aggregate([
        { $match: { country: country._id } },
        {
          $group: {
            _id: "$type",
            totalValue: { $sum: "$value" },
            totalVolume: { $sum: "$volume" },
            recordCount: { $sum: 1 },
          },
        },
      ]);

      const row = (t) =>
        byType.find((x) => x._id === t) || {
          totalValue: 0,
          totalVolume: 0,
          recordCount: 0,
        };
      const imports = row("import");
      const exports = row("export");

      return res.json({
        country: {
          id: country._id,
          name: country.name,
          code: country.code,
          region: country.region,
        },
        import: {
          totalValue: imports.totalValue,
          totalVolume: imports.totalVolume,
          recordCount: imports.recordCount,
        },
        export: {
          totalValue: exports.totalValue,
          totalVolume: exports.totalVolume,
          recordCount: exports.recordCount,
        },
        tradeBalanceValue: exports.totalValue - imports.totalValue,
      });
    }

    const series = await TradeRecord.aggregate([
      { $match: { country: country._id } },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            type: "$type",
          },
          totalValue: { $sum: "$value" },
          totalVolume: { $sum: "$volume" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    return res.json({
      country: {
        id: country._id,
        name: country.name,
        code: country.code,
        region: country.region,
      },
      monthlyByType: series,
    });
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

    console.log("🔍 DEBUG: Country object from DB:", JSON.stringify(country, null, 2));

    const payload = {
      country_code: country.code,
      country_name: country.name,
      indicators: {
        gdp_growth_rate: country.gdpGrowthRate ?? 3.5,
        inflation_rate: country.inflation ?? 4.2,
        unemployment_rate: country.unemployment ?? 5.5,
        trade_balance_usd: country.tradeBalance ?? 0,
        export_growth_rate: country.exportGrowth ?? 2.1,
        import_dependency_ratio: country.importDependency ?? 25,
        debt_to_gdp_ratio: country.debtToGdp ?? 65,
        foreign_reserves_months: country.foreignReserves ?? 3.5,
        fx_volatility_index: country.fxVolatility ?? 35,
        current_account_balance_pct: country.currentAccount ?? -2.5,
      },
    };

    console.log("📤 DEBUG: Payload being sent to ML:", JSON.stringify(payload, null, 2));

    const response = await axios.post(`${ML_BASE}/api/risk-score`, payload);

    // Create dimension_scores object for breakdown panel
    const data = response.data;
    const dimensionScores = {
      economic_stability: data.economic_stability_score || 50,
      trade_stability: data.trade_stability_score || 50,
      fiscal_health: data.fiscal_health_score || 50,
      market_volatility: data.market_volatility_score || 50,
    };

    res.json({
      ...data,
      dimension_scores: dimensionScores,
    });
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

// ============================================
// COMMODITY-SPECIFIC RISK SCORING ENDPOINTS
// ============================================

// GET /api/analytics/commodity-risk/:country/:commodity
// Returns commodity-specific risk score for a country
// Each commodity gets UNIQUE risk based on its trade patterns
router.get("/commodity-risk/:country/:commodity", async (req, res) => {
  try {
    const countryCode = req.params.country.toUpperCase();
    const commodityId = req.params.commodity;

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(commodityId)) {
      return res.status(400).json({ message: "Invalid commodity ID" });
    }

    const country = await Country.findOne({ code: countryCode });
    const commodity = await Commodity.findById(commodityId);

    if (!country || !commodity) {
      return res.status(404).json({ message: "Country or commodity not found" });
    }

    // CALCULATE unique indicators for this commodity
    const indicators = await getAllCommodityIndicators(commodity._id, country._id);

    if (!indicators) {
      return res.status(500).json({ message: "Failed to calculate commodity indicators" });
    }

    // Call ML service with UNIQUE commodity indicators
    const mlResponse = await axios.post(`${ML_BASE}/api/commodity-risk-score`, {
      country_code: country.code,
      country_name: country.name,
      commodity_code: commodity._id.toString(),
      commodity_name: commodity.name,
      indicators: indicators,
    });

    // Map commodity response to match country risk response format for frontend
    const data = mlResponse.data;

    // Create dimension_scores object for breakdown panel
    const dimensionScores = {
      economic_stability: data.supply_risk_score || 50,
      trade_stability: data.market_risk_score || 50,
      fiscal_health: data.structural_risk_score || 50,
      market_volatility: data.market_risk_score || 50,
    };

    res.json({
      country_code: country.code,
      country_name: country.name,
      aggregate_risk_score: data.aggregate_risk_score || 50,
      risk_category: data.risk_category || "MODERATE",
      risk_label: data.risk_label || "MODERATE",

      // Map commodity dimensions to country dimension names for consistent UI
      economic_stability_score: data.supply_risk_score || 50,
      trade_stability_score: data.market_risk_score || 50,
      fiscal_health_score: data.structural_risk_score || 50,
      market_volatility_score: data.market_risk_score || 50,

      // Include dimension_scores for breakdown panel
      dimension_scores: dimensionScores,

      // Commodity-specific fields
      commodity: {
        id: commodity._id,
        name: commodity.name,
        category: commodity.category,
      },
      country: {
        code: country.code,
        name: country.name,
      },

      // Include all original data from ML service
      ...data,
      indicators: indicators,
      indicators_used: (data.indicators_used || 0),
      indicators_missing: (data.indicators_missing || 0),
      confidence: data.confidence || "MEDIUM",
      model_version: data.model_version || "commodity-risk-v1.0.0",
    });
  } catch (err) {
    console.error("Commodity risk error:", err.message);
    res.status(500).json({ message: err.message || "Failed to calculate commodity risk" });
  }
});

// GET /api/analytics/country/:code/commodities
// Returns all commodities with their risk scores for a country
router.get("/country/:code/commodities", async (req, res) => {
  try {
    const countryCode = req.params.code.toUpperCase();

    const country = await Country.findOne({ code: countryCode });
    if (!country) {
      return res.status(404).json({ message: "Country not found" });
    }

    // Get all commodities traded by this country
    const commodities = await TradeRecord.aggregate([
      { $match: { country: country._id } },
      { $group: { _id: "$commodity" } },
    ]);

    if (commodities.length === 0) {
      return res.json({
        country: { code: country.code, name: country.name },
        commodities: [],
      });
    }

    // Get full commodity details
    const commodityIds = commodities.map((c) => c._id);
    const commodityDocs = await Commodity.find({ _id: { $in: commodityIds } });

    // Calculate risk for each commodity
    const commodityRisks = await Promise.all(
      commodityDocs.map(async (commodity) => {
        try {
          const indicators = await getAllCommodityIndicators(commodity._id, country._id);

          // Get ML risk score
          const mlResponse = await axios.post(`${ML_BASE}/api/commodity-risk-score`, {
            country_code: country.code,
            country_name: country.name,
            commodity_code: commodity._id.toString(),
            commodity_name: commodity.name,
            indicators: indicators,
          });

          return {
            commodity: {
              id: commodity._id,
              name: commodity.name,
              category: commodity.category,
            },
            risk_score: mlResponse.data.aggregate_risk_score || 0,
            risk_category: mlResponse.data.risk_category || "MODERATE",
            indicators: indicators,
          };
        } catch (err) {
          console.error(`Error calculating risk for commodity ${commodity.name}:`, err.message);
          return {
            commodity: {
              id: commodity._id,
              name: commodity.name,
              category: commodity.category,
            },
            risk_score: null,
            risk_category: "ERROR",
            error: err.message,
          };
        }
      })
    );

    // Sort by risk score (highest first)
    commodityRisks.sort((a, b) => {
      if (a.risk_score === null || a.risk_score === undefined) return 1;
      if (b.risk_score === null || b.risk_score === undefined) return -1;
      return b.risk_score - a.risk_score;
    });

    res.json({
      country: {
        code: country.code,
        name: country.name,
      },
      total_commodities: commodityRisks.length,
      commodities: commodityRisks,
    });
  } catch (err) {
    console.error("Commodity list error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/analytics/combined-risk
// Calculate combined risk: 60% country risk + 40% commodity risk
router.post("/combined-risk", async (req, res) => {
  try {
    const { country_code, commodity_id } = req.body;

    if (!country_code || !commodity_id) {
      return res.status(400).json({ message: "country_code and commodity_id are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(commodity_id)) {
      return res.status(400).json({ message: "Invalid commodity ID" });
    }

    const country = await Country.findOne({ code: country_code.toUpperCase() });
    const commodity = await Commodity.findById(commodity_id);

    if (!country || !commodity) {
      return res.status(404).json({ message: "Country or commodity not found" });
    }

    // Get country risk
    const countryRiskPayload = {
      country_code: country.code,
      country_name: country.name,
      indicators: {
        gdp_growth_rate: country.gdpGrowthRate ?? 3.5,
        inflation_rate: country.inflation ?? 4.2,
        unemployment_rate: country.unemployment ?? 5.5,
        trade_balance_usd: country.tradeBalance ?? 0,
        export_growth_rate: country.exportGrowth ?? 2.1,
        import_dependency_ratio: country.importDependency ?? 25,
        debt_to_gdp_ratio: country.debtToGdp ?? 65,
        foreign_reserves_months: country.foreignReserves ?? 3.5,
        fx_volatility_index: country.fxVolatility ?? 35,
        current_account_balance_pct: country.currentAccount ?? -2.5,
      },
    };

    const countryRiskResponse = await axios.post(`${ML_BASE}/api/risk-score`, countryRiskPayload);
    const countryRisk = countryRiskResponse.data.aggregate_risk_score;

    // Get commodity risk
    const commodityIndicators = await getAllCommodityIndicators(commodity._id, country._id);

    const commodityRiskPayload = {
      country_code: country.code,
      country_name: country.name,
      commodity_code: commodity._id.toString(),
      commodity_name: commodity.name,
      indicators: commodityIndicators,
    };

    const commodityRiskResponse = await axios.post(
      `${ML_BASE}/api/commodity-risk-score`,
      commodityRiskPayload
    );
    const commodityRisk = commodityRiskResponse.data.aggregate_risk_score;

    // Calculate weighted combined risk: 60% country + 40% commodity
    const combinedRisk = countryRisk * 0.6 + commodityRisk * 0.4;

    // Determine risk category
    const getRiskCategory = (score) => {
      if (score < 25) return "LOW";
      if (score < 50) return "MODERATE";
      if (score < 75) return "HIGH";
      return "CRITICAL";
    };

    res.json({
      country: {
        code: country.code,
        name: country.name,
        risk_score: Math.round(countryRisk * 100) / 100,
        risk_category: getRiskCategory(countryRisk),
      },
      commodity: {
        id: commodity._id,
        name: commodity.name,
        risk_score: Math.round(commodityRisk * 100) / 100,
        risk_category: getRiskCategory(commodityRisk),
      },
      combined_risk: {
        score: Math.round(combinedRisk * 100) / 100,
        category: getRiskCategory(combinedRisk),
        calculation: {
          country_contribution: Math.round(countryRisk * 0.6 * 100) / 100,
          commodity_contribution: Math.round(commodityRisk * 0.4 * 100) / 100,
          weights: {
            country: 0.6,
            commodity: 0.4,
          },
        },
      },
      indicators: {
        commodity_indicators: commodityIndicators,
      },
    });
  } catch (err) {
    console.error("Combined risk error:", err.message);
    res.status(500).json({ message: err.message || "Failed to calculate combined risk" });
  }
});

// ============================================
// FORECAST ENDPOINTS
// ============================================

// POST /api/analytics/forecast/volume
// Forecasts trade volume for a commodity over specified horizon
router.post("/forecast/volume", async (req, res) => {
  try {
    const { commodity, type, horizon, fxPair, country } = req.body;

    if (!commodity || !type || !horizon || !fxPair) {
      return res.status(400).json({
        message: "Required fields: commodity, type, horizon, fxPair"
      });
    }

    // Validate commodity exists
    const commodityDoc = await Commodity.findById(commodity);
    if (!commodityDoc) {
      return res.status(404).json({ message: "Commodity not found" });
    }

    // Build query for historical trade data
    let matchStage = {
      commodity: new mongoose.Types.ObjectId(commodity),
      type: type,
    };

    // Add country filter if provided
    if (country) {
      matchStage.country = new mongoose.Types.ObjectId(country);
    }

    // Get historical trade data for this commodity
    const historicalData = await TradeRecord.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          totalVolume: { $sum: "$volume" },
          totalValue: { $sum: "$value" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Format historical data as series
    const series = historicalData.map((d) => ({
      period: `${d._id.year}-${String(d._id.month).padStart(2, "0")}`,
      totalVolume: d.totalVolume,
      totalValue: d.totalValue,
    }));

    // Call ML service for forecast
    let forecast = [];
    let intervals = [];
    let method = "ARIMA-VAR";
    let note = "Forecasted using historical trade patterns";
    let metrics = { mae: null, rmse: null, backtest_points: series.length };

    try {
      const mlResponse = await axios.post(`${ML_BASE}/api/forecast/volume`, {
        commodity_id: commodity,
        trade_type: type,
        horizon: Number(horizon),
        fx_pair: fxPair,
        historical_data: series,
      });

      forecast = mlResponse.data.forecast || [];
      intervals = mlResponse.data.intervals || [];
      method = mlResponse.data.method || method;
      note = mlResponse.data.note || note;
      metrics = mlResponse.data.metrics || metrics;
    } catch (mlErr) {
      console.warn("ML service unavailable for volume forecast, using fallback");
      // Fallback: generate simple forecast based on average of last 3 months
      if (series.length > 0) {
        const lastThree = series.slice(-3);
        const avgVolume =
          lastThree.reduce((sum, s) => sum + s.totalVolume, 0) / lastThree.length;

        for (let i = 1; i <= Number(horizon); i++) {
          forecast.push({
            step: i,
            value: Math.round(avgVolume * (1 + Math.random() * 0.1 - 0.05)),
          });

          intervals.push({
            step: i,
            lower80: Math.round(avgVolume * 0.85),
            upper80: Math.round(avgVolume * 1.15),
            lower95: Math.round(avgVolume * 0.75),
            upper95: Math.round(avgVolume * 1.25),
          });
        }
        method = "Moving Average (Fallback)";
        note = "ML service unavailable; using simple moving average";
      }
    }

    res.json({
      commodity: {
        id: commodityDoc._id,
        name: commodityDoc.name,
        category: commodityDoc.category,
      },
      series,
      forecast,
      intervals,
      method,
      note,
      sourceFrequency: "monthly",
      isInterpolated: false,
      sourceNote: "Data from trade records database",
      metrics,
      horizonMonths: Number(horizon),
    });
  } catch (err) {
    console.error("Volume forecast error:", err.message);
    res.status(500).json({ message: err.message || "Failed to forecast volume" });
  }
});

// POST /api/analytics/forecast/price-volatility
// Calculates FX pair volatility and trends
router.post("/forecast/price-volatility", async (req, res) => {
  try {
    const { fxPair } = req.body;

    if (!fxPair) {
      return res.status(400).json({ message: "fxPair is required" });
    }

    // Call ML service for volatility calculation
    let result = {
      pair: fxPair,
      log_return_sample_std: 0,
      rolling_window: 20,
      return_count: 0,
      rolling_volatility: [],
      note: "FX volatility calculated from historical rates",
    };

    try {
      const mlResponse = await axios.post(`${ML_BASE}/api/forecast/volatility`, {
        fx_pair: fxPair,
      });

      result = {
        ...result,
        ...mlResponse.data,
      };
    } catch (mlErr) {
      console.warn("ML service unavailable for volatility forecast, using fallback");
      // Fallback response with reasonable defaults
      result.log_return_sample_std = (Math.random() * 0.05 + 0.01).toFixed(4);
      result.return_count = 252; // ~1 year of trading days
      result.rolling_volatility = Array.from({ length: 10 }, (_, i) => ({
        date: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        volatility: (Math.random() * 0.08 + 0.02).toFixed(4),
      }));
      result.note =
        "ML service unavailable; using simulated historical volatility patterns";
    }

    res.json(result);
  } catch (err) {
    console.error("Volatility forecast error:", err.message);
    res.status(500).json({ message: err.message || "Failed to forecast volatility" });
  }
});

module.exports = router;
