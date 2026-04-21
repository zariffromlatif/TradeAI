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
const {
  getMonthlyVolumeSeries,
  prepareVolumeSeriesForMl,
} = require("../services/forecastData");
const { getNationalPartnerMatch } = require("../services/nationalTradeSupport");

const ML_BASE = "http://127.0.0.1:8000";
const REAL_TRADE_MATCH = {
  isVerified: true,
  source: { $in: ["un_comtrade", "official_api", "world_bank_api"] },
};

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
    const h = Math.min(12, Math.max(1, Number(horizon) || 1));
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

    const flowType = String(type || "export").toLowerCase();
    if (flowType !== "import" && flowType !== "export") {
      return res.status(400).json({ message: "type must be import or export." });
    }

    const cA = await Country.findOne({ code: countryA.toUpperCase() });
    const cB = await Country.findOne({ code: countryB.toUpperCase() });

    if (!cA || !cB) {
      return res.status(404).json({ message: "One or both countries not found in the database." });
    }

    if (cA._id.equals(cB._id)) {
      return res.status(400).json({ message: "Select two different countries to compare." });
    }

    const aggRow = await Commodity.findOne({ name: "All Commodities (HS TOTAL)" })
      .select("_id")
      .lean();
    const hasVerifiedOfficialRows =
      (await TradeRecord.countDocuments(REAL_TRADE_MATCH)) > 0;
    const baseMatch = hasVerifiedOfficialRows ? REAL_TRADE_MATCH : {};

    const fetchSeriesForCommodity = async (commodityIdOrNull) => {
      const nationalExtra = await getNationalPartnerMatch(commodityIdOrNull, {
        relaxed: !hasVerifiedOfficialRows,
      });
      const buildMatch = (reporterId) => {
        const m = {
          reporter: reporterId,
          type: flowType,
          ...baseMatch,
          ...nationalExtra,
        };
        if (commodityIdOrNull) {
          m.commodity = commodityIdOrNull;
        }
        return m;
      };

      const monthlyPipeline = (reporterId) => [
        { $match: buildMatch(reporterId) },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
            },
            totalValue: { $sum: { $ifNull: ["$value", 0] } },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ];
      const [a, b] = await Promise.all([
        TradeRecord.aggregate(monthlyPipeline(cA._id)),
        TradeRecord.aggregate(monthlyPipeline(cB._id)),
      ]);
      return { seriesA: a, seriesB: b, nationalExtra };
    };

    let commodityOid = null;
    if (commodity && commodity !== "all") {
      commodityOid = new mongoose.Types.ObjectId(commodity);
    } else if (aggRow?._id) {
      commodityOid = aggRow._id;
    }

    let commodityFallbackApplied = false;
    let { seriesA, seriesB, nationalExtra } = await fetchSeriesForCommodity(commodityOid);

    // If selected commodity has no records, fallback to aggregate "all products" so users still get
    // a meaningful comparison rather than a blank chart.
    if (
      commodity &&
      commodity !== "all" &&
      seriesA.length === 0 &&
      seriesB.length === 0 &&
      aggRow?._id
    ) {
      commodityFallbackApplied = true;
      commodityOid = aggRow._id;
      ({ seriesA, seriesB, nationalExtra } = await fetchSeriesForCommodity(commodityOid));
    }

    const byDate = new Map();

    const ensureRow = (dateStr) => {
      let row = byDate.get(dateStr);
      if (!row) {
        row = { date: dateStr, [cA.code]: 0, [cB.code]: 0 };
        byDate.set(dateStr, row);
      }
      return row;
    };

    for (const row of seriesA) {
      const dateStr = `${row._id.year}-${String(row._id.month).padStart(2, "0")}`;
      ensureRow(dateStr)[cA.code] = Number(row.totalValue) || 0;
    }
    for (const row of seriesB) {
      const dateStr = `${row._id.year}-${String(row._id.month).padStart(2, "0")}`;
      ensureRow(dateStr)[cB.code] = Number(row.totalValue) || 0;
    }

    const formattedData = Array.from(byDate.keys())
      .sort()
      .map((k) => byDate.get(k));

    res.json({
      meta: {
        countryA: { code: cA.code, name: cA.name },
        countryB: { code: cB.code, name: cB.name },
        type: flowType,
        usesNationalTotals: Object.keys(nationalExtra).length > 0,
        commodityFallbackApplied,
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