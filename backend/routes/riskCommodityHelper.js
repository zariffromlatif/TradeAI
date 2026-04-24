/**
 * TradeAI - Commodity-Aware Risk Score Routes
 * Add these TWO updated routes to backend/routes/analytics.js
 *
 * Replace your existing:
 *   POST /api/analytics/risk-score
 *   POST /api/analytics/risk/:country/breakdown
 *
 * These new versions fetch commodity signals from MongoDB
 * and pass them to FastAPI so each country gets a
 * different score per commodity.
 */

const mongoose = require("mongoose");
const axios    = require("axios");
const Commodity = require("../models/Commodity");
const TradeRecord = require("../models/TradeRecord");

const ML_BASE = "http://127.0.0.1:8000";

// ── Helper: compute commodity signals from MongoDB ────────────
async function getCommoditySignals(commodityId, countryId) {
  if (!commodityId) return null;

  let doc;
  try {
    doc = await Commodity.findById(commodityId).select("name currentPrice priceHistory").lean();
  } catch {
    return null;
  }
  if (!doc) return null;

  // 1. Sort price history chronologically
  const prices = [...(doc.priceHistory || [])]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((p) => Number(p.price))
    .filter((n) => Number.isFinite(n) && n > 0);

  // 2. Price volatility std (log returns)
  let priceVolatilityStd = null;
  if (prices.length >= 3) {
    const logRets = [];
    for (let i = 1; i < prices.length; i++) {
      const r = Math.log(prices[i] / prices[i - 1]);
      if (Number.isFinite(r)) logRets.push(r);
    }
    if (logRets.length >= 2) {
      const mean = logRets.reduce((a, b) => a + b, 0) / logRets.length;
      const variance = logRets.reduce((s, r) => s + (r - mean) ** 2, 0) / (logRets.length - 1);
      priceVolatilityStd = Math.sqrt(variance);
    }
  }

  // 3. Price trend over last 6 months
  let priceTrendPct = null;
  if (prices.length >= 6) {
    const n = prices.length;
    const old = prices[n - 6];
    const now = prices[n - 1];
    if (old > 0) priceTrendPct = ((now - old) / old) * 100;
  }

  // 4. Trade volume trend for this country + commodity
  let tradeVolumeTrend = null;
  if (countryId) {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const commodityOid = new mongoose.Types.ObjectId(commodityId);

      // Build match — try both reporter and country fields for compatibility
      const buildMatch = (startDate, endDate, countryField) => ({
        commodity: commodityOid,
        [countryField]: new mongoose.Types.ObjectId(countryId),
        date: { $gte: startDate, $lt: endDate },
      });

      const getVol = async (startDate, endDate) => {
        for (const field of ["reporter", "country"]) {
          try {
            const rows = await TradeRecord.aggregate([
              { $match: buildMatch(startDate, endDate, field) },
              { $group: { _id: null, total: { $sum: "$volume" } } },
            ]);
            if (rows.length && rows[0].total > 0) return rows[0].total;
          } catch { /* try next field */ }
        }
        return 0;
      };

      const recentVol = await getVol(sixMonthsAgo, new Date());
      const prevVol   = await getVol(twelveMonthsAgo, sixMonthsAgo);

      if (prevVol > 0) {
        tradeVolumeTrend = ((recentVol - prevVol) / prevVol) * 100;
      }
    } catch { /* skip */ }
  }

  return {
    commodity_id:          String(commodityId),
    commodity_name:        doc.name,
    price_volatility_std:  priceVolatilityStd !== null ? Number(priceVolatilityStd.toFixed(6)) : null,
    price_trend_pct:       priceTrendPct      !== null ? Number(priceTrendPct.toFixed(2))      : null,
    current_price:         doc.currentPrice   || null,
    trade_volume_trend:    tradeVolumeTrend   !== null ? Number(tradeVolumeTrend.toFixed(2))   : null,
  };
}


// ── POST /api/analytics/risk-score ───────────────────────────────────────────
// FR8 — Full proxy with optional commodity enrichment
// Replace your existing POST /risk-score route with this one
async function handleRiskScore(req, res) {
  try {
    const { commodityId, countryId, ...rest } = req.body;

    // Enrich with commodity signals if commodityId provided
    const commoditySignals = await getCommoditySignals(commodityId, countryId);

    const mlPayload = {
      ...rest,
      ...(commoditySignals && { commodity: commoditySignals }),
    };

    const response = await axios.post(`${ML_BASE}/api/risk-score`, mlPayload);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ message: "ML Service unreachable" });
  }
}


// ── POST /api/analytics/risk/:country/breakdown ───────────────────────────────
// FR9 — Full proxy with optional commodity enrichment
// Replace your existing POST /risk/:country/breakdown route with this one
async function handleRiskBreakdown(req, res) {
  try {
    const { commodityId, countryId, ...rest } = req.body;

    const commoditySignals = await getCommoditySignals(commodityId, countryId);

    const mlPayload = {
      ...rest,
      ...(commoditySignals && { commodity: commoditySignals }),
    };

    const response = await axios.post(
      `${ML_BASE}/api/risk/${req.params.country}/breakdown`,
      mlPayload,
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ message: "ML Service unreachable" });
  }
}

module.exports = { handleRiskScore, handleRiskBreakdown, getCommoditySignals };