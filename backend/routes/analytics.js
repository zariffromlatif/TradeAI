const express = require("express");
const router = express.Router();
const TradeRecord = require("../models/TradeRecord");
const Country = require("../models/Country");
const axios = require("axios");
const PartnerProfile = require("../models/PartnerProfile");
const { getDashboardAggregates } = require("../services/dashboardStats");
const Commodity = require("../models/Commodity");
const FxRate = require("../models/FxRate");
const { getMonthlyVolumeSeries } = require("../services/forecastData");

const ML_BASE = "http://127.0.0.1:8000";
const REAL_TRADE_MATCH = {
  isVerified: true,
  source: { $in: ["un_comtrade", "official_api"] },
};

// GET /api/analytics/dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const { topExporters, topImporters, countriesTracked, tradeRecordCount } =
      await getDashboardAggregates();
    res.json({ topExporters, topImporters, countriesTracked, tradeRecordCount });
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
        { $match: { ...REAL_TRADE_MATCH, country: country._id } },
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
      { $match: { ...REAL_TRADE_MATCH, country: country._id } },
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

// POST /api/analytics/risk-score/batch
// F4 - Proxies batch risk scoring to avoid CORS/coupling with port 8000
router.post("/risk-score/batch", async (req, res) => {
  try {
    const response = await axios.post(`${ML_BASE}/api/risk-score/batch`, req.body);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ message: "ML Service batch endpoint unreachable" });
  }
});

// POST /api/analytics/forecast/volume — F7: monthly volume → ML forecast
router.post("/forecast/volume", async (req, res) => {
  try {
    const { commodity, country, type = "export", horizon = 1 } = req.body;
    if (!commodity) {
      return res.status(400).json({ message: "commodity (ObjectId) is required" });
    }
    const series = await getMonthlyVolumeSeries({
      commodityId: commodity,
      countryId: country || null,
      type,
    });
    if (!series.length) {
      return res.status(400).json({ message: "No trade rows for this filter" });
    }
    const values = series.map((s) => s.totalVolume);
    const h = Math.min(12, Math.max(1, Number(horizon) || 1));
    const response = await axios.post(`${ML_BASE}/api/forecast/trade-volume`, {
      values,
      horizon: h,
    });
    res.json({ ...response.data, series });
  } catch (err) {
    const msg =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      "Forecast failed";
    res.status(err.response?.status || 500).json({ message: String(msg) });
  }
});

router.post("/forecast/optimal-bid-range", async (req, res) => {
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

// POST /api/analytics/forecast/price-volatility — F7: priceHistory → volatility proxy
router.post("/forecast/price-volatility", async (req, res) => {
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
// F4 — Dual-selection analysis for comparative intelligence (Now with Commodity filter!)
router.get("/compare", async (req, res) => {
  try {
    const { countryA, countryB, type = "export", commodity } = req.query;

    if (!countryA || !countryB) {
      return res.status(400).json({ message: "Please provide both countryA and countryB codes." });
    }

    const cA = await Country.findOne({ code: countryA.toUpperCase() });
    const cB = await Country.findOne({ code: countryB.toUpperCase() });

    if (!cA || !cB) {
      return res.status(404).json({ message: "One or both countries not found in the database." });
    }

    // Set up our base match criteria
    const matchStage = {
      country: { $in: [cA._id, cB._id] },
      type: type,
      ...REAL_TRADE_MATCH,
    };

    // If a specific commodity was selected, add it to the filter
    if (commodity && commodity !== "all") {
      const mongoose = require("mongoose");
      matchStage.commodity = new mongoose.Types.ObjectId(commodity);
    }

    // Aggregation pipeline
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            country: "$country",
          },
          totalValue: { $sum: "$value" },
        },
      },
      {
        $group: {
          _id: { year: "$_id.year", month: "$_id.month" },
          records: {
            $push: {
              countryId: "$_id.country",
              value: "$totalValue",
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ];

    const results = await TradeRecord.aggregate(pipeline);

    // Format the payload for Recharts
    const formattedData = results.map((row) => {
      const dateStr = `${row._id.year}-${String(row._id.month).padStart(2, "0")}`;
      const dataPoint = { date: dateStr };

      const aRecord = row.records.find((r) => r.countryId.toString() === cA._id.toString());
      const bRecord = row.records.find((r) => r.countryId.toString() === cB._id.toString());

      dataPoint[cA.code] = aRecord ? aRecord.value : 0;
      dataPoint[cB.code] = bRecord ? bRecord.value : 0;

      return dataPoint;
    });

    res.json({
      meta: {
        countryA: { code: cA.code, name: cA.name },
        countryB: { code: cB.code, name: cB.name },
        type: type,
      },
      data: formattedData,
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