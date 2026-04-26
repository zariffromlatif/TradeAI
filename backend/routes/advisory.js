const express = require("express");
const axios = require("axios");
const Country = require("../models/Country");
const Commodity = require("../models/Commodity");
const {
  buildRecommendations,
  logReturnSampleStd,
  buildAdvancedAdvisory,
} = require("../services/advisoryRules");
const RiskScore = require("../models/RiskScore");
const FxRate = require("../models/FxRate");

const router = express.Router();
const ML_BASE = "http://127.0.0.1:8000";

// POST /api/advisory/recommend — F14 rule-based advisory (uses ML for risk score)
router.post("/recommend", async (req, res) => {
  try {
    const { countryCode, commodity } = req.body;
    if (!countryCode || typeof countryCode !== "string") {
      return res.status(400).json({ message: "countryCode is required" });
    }

    const country = await Country.findOne({
      code: countryCode.trim().toUpperCase(),
    });
    if (!country) {
      return res.status(404).json({ message: "Country not found" });
    }

    let riskScore = null;
    let riskCategory = null;
    let riskLabel = null;

    const riskPayload = {
      country_code: country.code,
      country_name: country.name,
      indicators: {
        gdp_growth_rate: 3.0,
        inflation_rate: country.inflation ?? null,
        trade_balance_usd: country.tradeBalance ?? null,
      },
    };

    try {
      const riskRes = await axios.post(`${ML_BASE}/api/risk-score`, riskPayload, {
        timeout: 15000,
      });
      riskScore = riskRes.data?.aggregate_risk_score ?? null;
      riskCategory = riskRes.data?.risk_category ?? null;
      riskLabel = riskRes.data?.risk_label ?? null;
    } catch {
      // Partial advisory without ML
    }

    let priceVolatilityStd = null;
    let commodityName = null;
    let monthlyCommodityPrices = [];
    if (commodity) {
      const doc = await Commodity.findById(commodity).select("name priceHistory");
      if (doc) {
        commodityName = doc.name;
        const prices = [...(doc.priceHistory || [])]
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .map((p) => p.price);
        priceVolatilityStd = logReturnSampleStd(prices);
        const byMonth = new Map();
        (doc.priceHistory || []).forEach((p) => {
          const m = new Date(p.date).getUTCMonth();
          if (!byMonth.has(m)) byMonth.set(m, []);
          byMonth.get(m).push(Number(p.price));
        });
        monthlyCommodityPrices = Array.from(byMonth.entries()).map(([month, arr]) => ({
          month,
          avgPrice: arr.reduce((a, b) => a + b, 0) / arr.length,
        }));
      }
    }

    // Build alternative market routing universe using latest risk snapshots.
    const latestRiskRows = await RiskScore.aggregate([
      { $sort: { countryCode: 1, createdAt: -1 } },
      {
        $group: {
          _id: "$countryCode",
          countryName: { $first: "$countryName" },
          riskScore: { $first: "$aggregateRiskScore" },
          createdAt: { $first: "$createdAt" },
        },
      },
      { $sort: { riskScore: 1 } },
      { $limit: 20 },
    ]);

    // FX timing signal from latest rates
    let fxVolatility = null;
    const fxDoc = await FxRate.findOne({ pair: "USD/BDT" }).select("history").lean();
    const rates = [...(fxDoc?.history || [])]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((x) => Number(x.rate))
      .filter((x) => Number.isFinite(x) && x > 0);
    if (rates.length >= 4) {
      const logRet = [];
      for (let i = 1; i < rates.length; i += 1) {
        logRet.push(Math.log(rates[i] / rates[i - 1]));
      }
      if (logRet.length >= 2) {
        const mean = logRet.reduce((a, b) => a + b, 0) / logRet.length;
        const variance =
          logRet.reduce((s, x) => s + (x - mean) ** 2, 0) / (logRet.length - 1);
        fxVolatility = Math.sqrt(variance);
      }
    }

    const signals = {
      riskScore,
      riskCategory,
      riskLabel,
      inflation: country.inflation ?? null,
      tradeBalanceUsd: country.tradeBalance ?? null,
      priceVolatilityStd,
      commodityName,
    };

    const recommendations = buildRecommendations(signals);
    const advancedRecommendations = buildAdvancedAdvisory({
      signals,
      commodityName,
      monthlyCommodityPrices,
      countryRiskUniverse: latestRiskRows.map((r) => ({
        countryCode: r._id,
        countryName: r.countryName,
        riskScore: Number(r.riskScore),
      })),
      fxVolatility,
    });

    res.json({
      country: {
        code: country.code,
        name: country.name,
        region: country.region,
      },
      signals: {
        riskScore: signals.riskScore,
        riskCategory: signals.riskCategory,
        riskLabel: signals.riskLabel,
        inflation: signals.inflation,
        tradeBalanceUsd: signals.tradeBalanceUsd,
        priceVolatilityStd: signals.priceVolatilityStd,
        commodityName: signals.commodityName,
      },
      recommendations,
      advancedRecommendations,
      recommendationGroups: {
        executionWindow: advancedRecommendations.filter((r) => r.type === "execution_window"),
        alternativeRouting: advancedRecommendations.filter((r) => r.type === "alternative_routing"),
        fxTiming: advancedRecommendations.filter((r) => r.type === "fx_timing"),
      },
      advisoryInputs: {
        monthlyCommodityPrices,
        fxVolatility,
        routingUniverseSize: latestRiskRows.length,
      },
      disclaimer:
        "Educational decision-support only — not financial, legal, or investment advice.",
      engine: "f15-rules-synthesis-v2",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
