const express = require("express");
const axios = require("axios");
const Country = require("../models/Country");
const Commodity = require("../models/Commodity");
const {
  buildRecommendations,
  logReturnSampleStd,
} = require("../services/advisoryRules");

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
    if (commodity) {
      const doc = await Commodity.findById(commodity).select("name priceHistory");
      if (doc) {
        commodityName = doc.name;
        const prices = [...(doc.priceHistory || [])]
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .map((p) => p.price);
        priceVolatilityStd = logReturnSampleStd(prices);
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
      disclaimer:
        "Educational decision-support only — not financial, legal, or investment advice.",
      engine: "f14-rules-express-v1",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
