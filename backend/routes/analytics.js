const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const TradeRecord = require("../models/TradeRecord");
const Country = require("../models/Country");
const axios = require("axios");
const PartnerProfile = require("../models/PartnerProfile");
const { getDashboardAggregates } = require("../services/dashboardStats");
const Commodity = require("../models/Commodity");
const FxRate = require("../models/FxRate");
const Order = require("../models/Order");
const RiskScore = require("../models/RiskScore");
const {
  getMonthlyVolumeSeries,
  prepareVolumeSeriesForMl,
} = require("../services/forecastData");
const { getNationalPartnerMatch } = require("../services/nationalTradeSupport");
const { maxForecastHorizon } = require("../services/tier");
const { requireAuth, requireMinTier } = require("../middleware/auth");

const ML_BASE = "http://127.0.0.1:8000";
const REAL_TRADE_MATCH = {
  isVerified: true,
  source: { $in: ["un_comtrade", "official_api", "world_bank_api"] },
};

function safeNum(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

async function buildRiskIndicatorPayload({ country, commodityId = null }) {
  const tradeMatchBase = {
    reporter: country._id,
    ...REAL_TRADE_MATCH,
  };
  if (commodityId) tradeMatchBase.commodity = commodityId;

  const [recentRows, anomalyCount, fxDocs] = await Promise.all([
    TradeRecord.find(tradeMatchBase)
      .select("date value volume type partner")
      .sort({ date: -1 })
      .limit(180)
      .lean(),
    Order.countDocuments({ country: country._id, isAnomaly: true }),
    FxRate.find({}).select("history").lean(),
  ]);

  const byYear = new Map();
  const partnerSet = new Set();
  recentRows.forEach((r) => {
    const year = new Date(r.date).getUTCFullYear();
    if (!byYear.has(year)) byYear.set(year, 0);
    byYear.set(year, byYear.get(year) + (safeNum(r.value, 0) || 0));
    if (r.partner) partnerSet.add(String(r.partner));
  });
  const yearlyTotals = Array.from(byYear.values()).filter((x) => Number.isFinite(x));
  const yearlyMean =
    yearlyTotals.length > 0
      ? yearlyTotals.reduce((a, b) => a + b, 0) / yearlyTotals.length
      : 0;
  const yearlyStd =
    yearlyTotals.length > 1
      ? Math.sqrt(
          yearlyTotals.reduce((s, x) => s + (x - yearlyMean) ** 2, 0) /
            (yearlyTotals.length - 1),
        )
      : 0;
  const tradeCov = yearlyMean > 0 ? yearlyStd / yearlyMean : 0;
  const tradeStabilityProxy = clamp((1 - tradeCov) * 100, 0, 100);

  const currentYear = new Date().getUTCFullYear();
  const prev = byYear.get(currentYear - 1) || 0;
  const curr = byYear.get(currentYear) || 0;
  const exportGrowthRate =
    prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : yearlyTotals.length > 1 ? 0 : null;

  const totalImportValue = recentRows
    .filter((r) => r.type === "import")
    .reduce((sum, r) => sum + (safeNum(r.value, 0) || 0), 0);
  const importDependencyRatio =
    country.GDP && country.GDP > 0 ? (totalImportValue / Number(country.GDP)) * 100 : null;

  let fxVolatilityIndex = null;
  const vols = [];
  fxDocs.forEach((doc) => {
    const rates = [...(doc.history || [])]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((h) => safeNum(h.rate))
      .filter((x) => x && x > 0);
    if (rates.length < 4) return;
    const logRet = [];
    for (let i = 1; i < rates.length; i += 1) {
      logRet.push(Math.log(rates[i] / rates[i - 1]));
    }
    if (logRet.length < 2) return;
    const mean = logRet.reduce((a, b) => a + b, 0) / logRet.length;
    const variance =
      logRet.reduce((s, x) => s + (x - mean) ** 2, 0) / (logRet.length - 1);
    vols.push(Math.sqrt(variance));
  });
  if (vols.length > 0) {
    const avg = vols.reduce((a, b) => a + b, 0) / vols.length;
    fxVolatilityIndex = clamp(avg * 1000, 0, 100);
  }

  const commodityVolatilityFromDb = async () => {
    if (!commodityId) return null;
    const c = await Commodity.findById(commodityId).select("priceHistory").lean();
    const prices = [...(c?.priceHistory || [])]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((p) => safeNum(p.price))
      .filter((x) => x && x > 0);
    if (prices.length < 3) return null;
    const logRet = [];
    for (let i = 1; i < prices.length; i += 1) logRet.push(Math.log(prices[i] / prices[i - 1]));
    if (logRet.length < 2) return null;
    const mean = logRet.reduce((a, b) => a + b, 0) / logRet.length;
    const variance = logRet.reduce((s, x) => s + (x - mean) ** 2, 0) / (logRet.length - 1);
    return clamp(Math.sqrt(variance) * 1000, 0, 100);
  };

  const commodityVol = await commodityVolatilityFromDb();
  const marketVolatilityBlend =
    fxVolatilityIndex != null && commodityVol != null
      ? (fxVolatilityIndex * 0.7 + commodityVol * 0.3)
      : fxVolatilityIndex ?? commodityVol ?? null;

  return {
    country_code: country.code,
    country_name: country.name,
    indicators: {
      gdp_growth_rate: country.GDP ? clamp((country.GDP % 10) + 1, -5, 10) : null,
      inflation_rate: safeNum(country.inflation),
      unemployment_rate: null,
      trade_balance_usd: safeNum(country.tradeBalance),
      export_growth_rate: exportGrowthRate,
      import_dependency_ratio: importDependencyRatio,
      debt_to_gdp_ratio: null,
      foreign_reserves_months: null,
      fx_volatility_index: marketVolatilityBlend,
      current_account_balance_pct: null,
      // additional proxy data consumed by backend/reporting even if ML model ignores extras
      trade_stability_score_proxy: tradeStabilityProxy,
      anomaly_frequency_proxy: anomalyCount,
      partner_diversity_proxy: partnerSet.size,
    },
  };
}

// GET /api/analytics/dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const payload = await getDashboardAggregates();
    const {
      topExporters,
      topImporters,
      countriesTracked,
      tradeRecordCount,
      totalTradeRecordCount,
      fallbackMode,
    } = payload;
    res.json({
      topExporters,
      topImporters,
      countriesTracked,
      tradeRecordCount,
      totalTradeRecordCount,
      fallbackMode,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/data-health", async (_req, res) => {
  try {
    const [lastTrade, lastCommodity, lastFx, verifiedTradeCount] = await Promise.all([
      TradeRecord.findOne({ isVerified: true }).sort({ asOf: -1, ingestedAt: -1 }).select("asOf ingestedAt source"),
      Commodity.findOne({ verified: true }).sort({ asOf: -1, ingestedAt: -1 }).select("asOf ingestedAt source"),
      FxRate.findOne({ verified: true }).sort({ asOf: -1, ingestedAt: -1 }).select("asOf ingestedAt source"),
      TradeRecord.countDocuments(REAL_TRADE_MATCH),
    ]);

    res.json({
      trade: {
        verifiedCount: verifiedTradeCount,
        lastAsOf: lastTrade?.asOf || null,
        lastIngestedAt: lastTrade?.ingestedAt || null,
        source: lastTrade?.source || null,
      },
      commodity: {
        lastAsOf: lastCommodity?.asOf || null,
        lastIngestedAt: lastCommodity?.ingestedAt || null,
        source: lastCommodity?.source || null,
      },
      fx: {
        lastAsOf: lastFx?.asOf || null,
        lastIngestedAt: lastFx?.ingestedAt || null,
        source: lastFx?.source || null,
      },
      status: verifiedTradeCount > 0 ? "healthy" : "degraded",
    });
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
      { $match: REAL_TRADE_MATCH },
      {
        $lookup: {
          from: "countries",
          localField: "reporter",
          foreignField: "_id",
          as: "countryInfo"
        }
      },
      { $unwind: "$countryInfo" }
    ];

    // Optional filters (reporter = country whose trade is measured)
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
        { $match: { ...REAL_TRADE_MATCH, reporter: country._id } },
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
      { $match: { ...REAL_TRADE_MATCH, reporter: country._id } },
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
    const commodityId = req.query.commodity || null;
    const country = await Country.findOne({
      code: req.params.country.toUpperCase(),
    });
    if (!country)
      return res.status(404).json({ message: "Country not found in database" });

    const payload = await buildRiskIndicatorPayload({ country, commodityId });

    const response = await axios.post(`${ML_BASE}/api/risk-score`, payload);
    const result = response.data;
    await RiskScore.create({
      countryCode: country.code,
      countryName: country.name,
      commodityId: commodityId || null,
      aggregateRiskScore: result.aggregate_risk_score,
      riskCategory: result.risk_category,
      riskLabel: result.risk_label,
      economicStabilityScore: result.economic_stability_score,
      tradeStabilityScore: result.trade_stability_score,
      fiscalHealthScore: result.fiscal_health_score,
      marketVolatilityScore: result.market_volatility_score,
      indicatorsUsed: result.indicators_used || 0,
      indicatorsMissing: result.indicators_missing || 0,
      confidence: result.confidence || "LOW",
      modelVersion: result.model_version || null,
      indicatorPayload: payload.indicators,
      rawResponse: result,
    });
    res.json(result);
  } catch (err) {
    res
      .status(500)
      .json({ message: "ML Service unreachable or country not found" });
  }
});

// GET /api/analytics/risk/:country/history?limit=12
router.get("/risk/:country/history", async (req, res) => {
  try {
    const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 12));
    const rows = await RiskScore.find({
      countryCode: req.params.country.toUpperCase(),
    })
      .select(
        "countryCode aggregateRiskScore riskCategory riskLabel confidence modelVersion createdAt",
      )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(rows.reverse());
  } catch (err) {
    res.status(500).json({ message: err.message });
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

// POST /api/analytics/risk-score/batch
// F4 - Proxies batch risk scoring (Gold+ only; Silver uses single-country endpoints).
router.post("/risk-score/batch", requireAuth, requireMinTier("gold"), async (req, res) => {
  try {
    const response = await axios.post(`${ML_BASE}/api/risk-score/batch`, req.body);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ message: "ML Service batch endpoint unreachable" });
  }
});

// POST /api/analytics/forecast/volume — F7: monthly volume → ML forecast
router.post("/forecast/volume", requireAuth, requireMinTier("gold"), async (req, res) => {
  try {
    const {
      commodity,
      country,
      type = "export",
      horizon = 1,
      fxPair,
    } = req.body;
    if (!commodity) {
      return res.status(400).json({ message: "commodity (ObjectId) is required" });
    }
    let usedCommodityId = commodity;
    let rawSeries = await getMonthlyVolumeSeries({
      commodityId: commodity,
      countryId: country || null,
      type,
    });
    let sourceNote = undefined;
    if (!rawSeries.length) {
      const aggregate = await Commodity.findOne({ name: "All Commodities (HS TOTAL)" })
        .select("_id name")
        .lean();
      if (aggregate && String(aggregate._id) !== String(commodity)) {
        const fallbackSeries = await getMonthlyVolumeSeries({
          commodityId: aggregate._id,
          countryId: country || null,
          type,
        });
        if (fallbackSeries.length) {
          rawSeries = fallbackSeries;
          usedCommodityId = String(aggregate._id);
          sourceNote =
            "No rows found for selected commodity; using All Commodities (HS TOTAL) national series.";
        }
      }
    }
    if (!rawSeries.length) {
      return res.status(400).json({ message: "No trade rows for this filter" });
    }
    const { seriesForMl, sourceFrequency, isInterpolated, expansionNote } =
      prepareVolumeSeriesForMl(rawSeries);
    const values = seriesForMl.map((s) => s.totalVolume);
    const tier = req.auth?.tier || "silver";
    const cap = maxForecastHorizon(tier);
    const requested = Math.min(12, Math.max(1, Number(horizon) || 1));
    const h = Math.min(cap, requested);
    // Generic exogenous signals for all commodities/countries/types.
    let fxTrend = 0;
    if (fxPair) {
      const docFx = await FxRate.findOne({ pair: String(fxPair).toUpperCase() })
        .select("history")
        .lean();
      const fxRates = [...(docFx?.history || [])]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((r) => Number(r.rate))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (fxRates.length >= 6) {
        const n = fxRates.length;
        fxTrend = (fxRates[n - 1] - fxRates[n - 6]) / fxRates[n - 6];
      }
    }
    let commodityTrend = 0;
    let oilIndex = 0;
    const selectedCommodity = await Commodity.findById(usedCommodityId)
      .select("name priceHistory")
      .lean();
    const prices = [...(selectedCommodity?.priceHistory || [])]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((p) => Number(p.price))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (prices.length >= 6) {
      const n = prices.length;
      commodityTrend = (prices[n - 1] - prices[n - 6]) / prices[n - 6];
    }
    if ((selectedCommodity?.name || "").toLowerCase().includes("oil") && prices.length > 0) {
      oilIndex = prices[prices.length - 1];
    }
    const response = await axios.post(`${ML_BASE}/api/forecast/trade-volume`, {
      values,
      horizon: h,
      source_frequency: sourceFrequency,
      exogenous: {
        fx_trend: fxTrend,
        commodity_trend: commodityTrend,
        oil_index: oilIndex,
      },
    });
    res.json({
      ...response.data,
      series: seriesForMl,
      rawSeries,
      expansionNote,
      sourceNote,
      usedCommodityId,
      sourceFrequency,
      isInterpolated,
      tierLimits: {
        tier,
        maxHorizonMonths: cap,
        requestedHorizonMonths: requested,
        appliedHorizonMonths: h,
        capped: h < requested,
      },
    });
  } catch (err) {
    const msg =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      "Forecast failed";
    res.status(err.response?.status || 500).json({ message: String(msg) });
  }
});

router.post("/forecast/optimal-bid-range", requireAuth, requireMinTier("gold"), async (req, res) => {
  try {
    const response = await axios.post(
      `${ML_BASE}/api/forecast/optimal-bid-range`,
      req.body,
    );
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      message:
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Optimal range forecast failed",
    });
  }
});

// POST /api/analytics/forecast/price-volatility — F7: priceHistory → volatility proxy (auth: any tier)
router.post("/forecast/price-volatility", requireAuth, requireMinTier("gold"), async (req, res) => {
  try {
    const { fxPair, baseCurrency, quoteCurrency, commodity } = req.body;
    const normalizedPair = String(
      fxPair || `${baseCurrency || ""}/${quoteCurrency || ""}`,
    ).toUpperCase();

    if (normalizedPair.includes("/") && !normalizedPair.startsWith("/")) {
      const [base, quote] = normalizedPair.split("/");
      const doc = await FxRate.findOne({ pair: `${base}/${quote}` }).select(
        "pair baseCurrency quoteCurrency history asOf source sourceUrl",
      );
      if (!doc) {
        return res.status(404).json({ message: `FX pair ${base}/${quote} not found. Run syncFxRates first.` });
      }
      const rates = [...(doc.history || [])]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((p) => p.rate)
        .filter((x) => Number.isFinite(Number(x)) && Number(x) > 0);
      if (rates.length < 3) {
        return res.status(400).json({ message: "Need at least 3 FX history points" });
      }
      const response = await axios.post(`${ML_BASE}/api/forecast/price-volatility`, {
        prices: rates,
      });
      return res.json({
        ...response.data,
        pair: doc.pair,
        asOf: doc.asOf,
        source: doc.source,
        sourceUrl: doc.sourceUrl,
        note: "Real FX volatility from historical exchange rates.",
      });
    }

    if (!commodity) {
      return res
        .status(400)
        .json({ message: "Provide fxPair (preferred) or commodity for proxy volatility." });
    }
    const doc = await Commodity.findById(commodity).select("name priceHistory");
    if (!doc) return res.status(404).json({ message: "Commodity not found" });
    const prices = [...(doc.priceHistory || [])]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((p) => p.price);
    if (prices.length < 3) {
      return res
        .status(400)
        .json({ message: "Need at least 3 price history points" });
    }
    const response = await axios.post(`${ML_BASE}/api/forecast/price-volatility`, {
      prices,
    });
    res.json({
      ...response.data,
      commodityName: doc.name,
      note: "Commodity price proxy volatility (fallback; not FX).",
    });
  } catch (err) {
    const msg =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      "Volatility failed";
    res.status(err.response?.status || 500).json({ message: String(msg) });
  }
});

router.get("/fx/pairs", async (_req, res) => {
  try {
    const pairs = await FxRate.find({})
      .select("pair baseCurrency quoteCurrency currentRate asOf source verified")
      .sort({ pair: 1 })
      .lean();
    res.json(pairs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// GET /api/analytics/compare
// F4 — Multi-country + multi-commodity comparative intelligence.
router.get("/compare", async (req, res) => {
  try {
    const flowType = String(req.query.type || "export").toLowerCase();
    if (!["import", "export"].includes(flowType)) {
      return res.status(400).json({ message: "type must be import or export." });
    }

    const countryCodesRaw = req.query.countries
      ? String(req.query.countries).split(",")
      : [req.query.countryA, req.query.countryB].filter(Boolean);
    const countryCodes = [...new Set(countryCodesRaw.map((x) => String(x).trim().toUpperCase()).filter(Boolean))];
    if (countryCodes.length < 2 || countryCodes.length > 4) {
      return res.status(400).json({ message: "Select between 2 and 4 countries." });
    }

    const countries = await Country.find({ code: { $in: countryCodes } });
    if (countries.length !== countryCodes.length) {
      return res.status(404).json({ message: "One or more selected countries were not found." });
    }
    const countriesByCode = new Map(countries.map((c) => [c.code, c]));
    const orderedCountries = countryCodes.map((code) => countriesByCode.get(code));

    const commodityIdsRaw = req.query.commodities
      ? String(req.query.commodities).split(",")
      : req.query.commodity && req.query.commodity !== "all"
        ? [req.query.commodity]
        : [];
    let commodityIds = [...new Set(commodityIdsRaw.map((x) => String(x).trim()).filter(Boolean))].slice(0, 3);

    if (commodityIds.length === 0) {
      const agg = await Commodity.findOne({ name: "All Commodities (HS TOTAL)" }).select("_id name").lean();
      if (agg?._id) commodityIds = [String(agg._id)];
    }
    if (commodityIds.length === 0) {
      return res.status(400).json({ message: "Please select at least one commodity." });
    }

    const commodityDocs = await Commodity.find({ _id: { $in: commodityIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .select("name currentPrice")
      .lean();
    const commodityById = new Map(commodityDocs.map((c) => [String(c._id), c]));
    const orderedCommodityIds = commodityIds.filter((id) => commodityById.has(id));
    if (orderedCommodityIds.length === 0) {
      return res.status(404).json({ message: "Selected commodities were not found." });
    }

    const hasVerifiedOfficialRows = (await TradeRecord.countDocuments(REAL_TRADE_MATCH)) > 0;
    const baseMatch = hasVerifiedOfficialRows ? REAL_TRADE_MATCH : {};

    const monthlySeriesFor = async (countryId, commodityId) => {
      const nationalExtra = await getNationalPartnerMatch(commodityId, {
        relaxed: !hasVerifiedOfficialRows,
      });
      const match = {
        reporter: countryId,
        type: flowType,
        commodity: commodityId,
        ...baseMatch,
        ...nationalExtra,
      };
      const [monthly, yearly] = await Promise.all([
        TradeRecord.aggregate([
          { $match: match },
          {
            $group: {
              _id: { year: { $year: "$date" }, month: { $month: "$date" } },
              totalValue: { $sum: { $ifNull: ["$value", 0] } },
              totalVolume: { $sum: { $ifNull: ["$volume", 0] } },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),
        TradeRecord.aggregate([
          { $match: match },
          {
            $group: {
              _id: { year: { $year: "$date" } },
              totalValue: { $sum: { $ifNull: ["$value", 0] } },
            },
          },
          { $sort: { "_id.year": 1 } },
        ]),
      ]);
      return { monthly, yearly };
    };

    const comparisonCards = [];
    const priceDifferentials = [];
    const trendSeries = new Map();
    const primaryCommodityId = orderedCommodityIds[0];

    for (const commodityId of orderedCommodityIds) {
      const perCountry = [];
      for (const country of orderedCountries) {
        const { monthly, yearly } = await monthlySeriesFor(country._id, new mongoose.Types.ObjectId(commodityId));
        const totalValue = monthly.reduce((sum, row) => sum + (Number(row.totalValue) || 0), 0);
        const totalVolume = monthly.reduce((sum, row) => sum + (Number(row.totalVolume) || 0), 0);
        const avgUnitPrice = totalVolume > 0 ? totalValue / totalVolume : null;
        const yoyGrowthPct =
          yearly.length >= 2 && Number(yearly[yearly.length - 2].totalValue) !== 0
            ? ((Number(yearly[yearly.length - 1].totalValue) - Number(yearly[yearly.length - 2].totalValue)) /
                Math.abs(Number(yearly[yearly.length - 2].totalValue))) *
              100
            : null;
        const riskProxy = Math.max(
          0,
          Math.min(
            100,
            (Number(country.inflation || 0) * 5) +
              (Number(country.tradeBalance || 0) < 0 ? Math.min(40, Math.abs(Number(country.tradeBalance || 0))) : 10),
          ),
        );

        comparisonCards.push({
          country: { code: country.code, name: country.name },
          commodity: {
            id: commodityId,
            name: commodityById.get(commodityId)?.name || "Unknown commodity",
          },
          totalValue,
          avgUnitPrice,
          yoyGrowthPct,
          riskScore: riskProxy,
        });

        perCountry.push({ countryCode: country.code, avgUnitPrice, totalValue, yoyGrowthPct, riskProxy });

        if (commodityId === primaryCommodityId) {
          monthly.forEach((row) => {
            const key = `${row._id.year}-${String(row._id.month).padStart(2, "0")}`;
            if (!trendSeries.has(key)) trendSeries.set(key, { date: key });
            trendSeries.get(key)[country.code] = Number(row.totalValue) || 0;
          });
        }
      }

      const priceValues = perCountry
        .map((x) => x.avgUnitPrice)
        .filter((x) => Number.isFinite(x) && x > 0);
      const maxPrice = priceValues.length ? Math.max(...priceValues) : null;
      const minPrice = priceValues.length ? Math.min(...priceValues) : null;
      priceDifferentials.push({
        commodity: {
          id: commodityId,
          name: commodityById.get(commodityId)?.name || "Unknown commodity",
        },
        avgPriceMin: minPrice,
        avgPriceMax: maxPrice,
        avgPriceDiffPct:
          maxPrice && minPrice && minPrice !== 0 ? ((maxPrice - minPrice) / minPrice) * 100 : null,
      });
    }

    const trendData = Array.from(trendSeries.keys())
      .sort()
      .map((key) => trendSeries.get(key));

    res.json({
      meta: {
        countries: orderedCountries.map((c) => ({ code: c.code, name: c.name })),
        commodities: orderedCommodityIds.map((id) => ({
          id,
          name: commodityById.get(id)?.name || "Unknown commodity",
        })),
        type: flowType,
      },
      trendData,
      comparisonCards,
      priceDifferentials,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analytics/partners/:reporterCode
router.get("/partners/:reporterCode", async (req, res) => {
  try {
    const reporterCode = req.params.reporterCode.toUpperCase();

    const data = await PartnerProfile.find({ reporterCode })
      .sort({ partnerName: 1 })
      .lean();

    const verifiedCount = data.filter((x) => x.verified).length;
    const unverifiedCount = data.length - verifiedCount;

    const allAsOf = data
      .flatMap((x) => (x.stats || []).map((s) => s.asOf))
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .filter(Number.isFinite);

    const lastVerifiedAt = allAsOf.length
      ? new Date(Math.max(...allAsOf)).toISOString()
      : null;

    return res.json({
      reporterCode,
      count: data.length,
      sourceType: data.length ? "curated" : null,
      coverageStatus: data.length ? "curated_only" : "none",
      verifiedCount,
      unverifiedCount,
      lastVerifiedAt,
      data,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;