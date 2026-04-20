const path = require("node:path");
const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Country = require("../models/Country");
const Commodity = require("../models/Commodity");
const TradeRecord = require("../models/TradeRecord");
const { ensureWorldCountry } = require("../services/nationalTradeSupport");

/**
 * World Bank indicators:
 * - NE.EXP.GNFS.CD: Exports of goods and services (current US$)
 * - NE.IMP.GNFS.CD: Imports of goods and services (current US$)
 */
const WB_EXPORT_IND = "NE.EXP.GNFS.CD";
const WB_IMPORT_IND = "NE.IMP.GNFS.CD";
const WB_BASE = "https://api.worldbank.org/v2/country";
const SOURCE = "world_bank_api";
const WB_TIMEOUT_MS = Math.max(
  5000,
  Number.parseInt(process.env.TRADE_SYNC_HTTP_TIMEOUT_MS || "25000", 10) || 25000,
);
const WB_MAX_ATTEMPTS = Math.max(
  1,
  Number.parseInt(process.env.TRADE_SYNC_HTTP_ATTEMPTS || "3", 10) || 3,
);

function getReporterCodes() {
  const raw = process.env.TRADE_SYNC_COUNTRY_CODES || process.env.COMTRADE_REPORTER_CODES || "BD,US,IN,CN,DE";
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

const YEARS = Math.max(
  1,
  Number.parseInt(process.env.TRADE_SYNC_YEAR_SPAN || process.env.COMTRADE_NATIONAL_YEAR_SPAN || "12", 10) || 12,
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWorldBankSeriesWithRetry(iso2, indicator) {
  let attempt = 0;
  let delayMs = 1200;
  let lastErr = null;
  while (attempt < WB_MAX_ATTEMPTS) {
    try {
      return await fetchWorldBankSeries(iso2, indicator);
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      const code = err.code;
      const retriable =
        status === 429 ||
        (status >= 500 && status < 600) ||
        code === "ECONNABORTED" ||
        code === "ETIMEDOUT" ||
        code === "ECONNRESET" ||
        /timeout/i.test(String(err.message || ""));
      if (!retriable) break;
      await sleep(delayMs);
      delayMs *= 2;
      attempt += 1;
    }
  }
  throw lastErr;
}

async function fetchWorldBankSeries(iso2, indicator) {
  const url = `${WB_BASE}/${encodeURIComponent(iso2)}/indicator/${indicator}`;
  const res = await axios.get(url, {
    params: {
      format: "json",
      per_page: 2000,
    },
    timeout: WB_TIMEOUT_MS,
  });
  const rows = Array.isArray(res.data) ? res.data[1] : null;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({
      year: Number(r?.date),
      value: Number(r?.value),
      sourceUrl: `${url}?format=json&per_page=2000`,
    }))
    .filter((r) => Number.isFinite(r.year) && Number.isFinite(r.value) && r.value > 0)
    .sort((a, b) => a.year - b.year);
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }
  await mongoose.connect(process.env.MONGO_URI);

  let aggregateCommodity = await Commodity.findOne({ name: "All Commodities (HS TOTAL)" });
  if (!aggregateCommodity) {
    aggregateCommodity = await Commodity.create({
      name: "All Commodities (HS TOTAL)",
      category: "Aggregate",
      unit: "USD",
      currentPrice: null,
      priceHistory: [],
      source: SOURCE,
      sourceUrl: "https://api.worldbank.org/",
      asOf: new Date(),
      ingestedAt: new Date(),
      verified: true,
      qualityFlags: [],
    });
  }

  const worldPartner = await ensureWorldCountry();
  const reporterCodes = getReporterCodes();
  const minYear = new Date().getUTCFullYear() - YEARS;

  let upserts = 0;
  let skipped = 0;
  let failed = 0;

  for (const reporterCode of reporterCodes) {
    const reporter = await Country.findOne({ code: reporterCode });
    if (!reporter) {
      console.warn(`Reporter country ${reporterCode} not found in Country collection; skipped.`);
      continue;
    }

    console.log(`Syncing World Bank national totals for reporter=${reporterCode} (${YEARS} years target)…`);
    let exportsSeries = [];
    let importsSeries = [];
    try {
      [exportsSeries, importsSeries] = await Promise.all([
        fetchWorldBankSeriesWithRetry(reporterCode, WB_EXPORT_IND),
        fetchWorldBankSeriesWithRetry(reporterCode, WB_IMPORT_IND),
      ]);
    } catch (err) {
      failed += 1;
      console.warn(
        `Reporter ${reporterCode}: World Bank request failed after retries:`,
        err.response?.status || err.code || err.message,
      );
      continue;
    }

    const recentExports = exportsSeries.filter((r) => r.year >= minYear);
    const recentImports = importsSeries.filter((r) => r.year >= minYear);

    for (const row of recentExports) {
      const date = new Date(`${row.year}-12-31T00:00:00.000Z`);
      await TradeRecord.updateOne(
        {
          reporter: reporter._id,
          partner: worldPartner._id,
          commodity: aggregateCommodity._id,
          type: "export",
          date,
          source: SOURCE,
        },
        {
          $set: {
            volume: row.value,
            value: row.value,
            sourceUrl: row.sourceUrl,
            asOf: date,
            ingestedAt: new Date(),
            isVerified: true,
          },
        },
        { upsert: true },
      );
      upserts += 1;
    }

    for (const row of recentImports) {
      const date = new Date(`${row.year}-12-31T00:00:00.000Z`);
      await TradeRecord.updateOne(
        {
          reporter: reporter._id,
          partner: worldPartner._id,
          commodity: aggregateCommodity._id,
          type: "import",
          date,
          source: SOURCE,
        },
        {
          $set: {
            volume: row.value,
            value: row.value,
            sourceUrl: row.sourceUrl,
            asOf: date,
            ingestedAt: new Date(),
            isVerified: true,
          },
        },
        { upsert: true },
      );
      upserts += 1;
    }

    if (recentExports.length === 0 && recentImports.length === 0) {
      skipped += 1;
      console.log(`No World Bank rows for ${reporterCode}; skipped.`);
    }
  }

  console.log(
    `Synced ${upserts} verified national trade record(s) from World Bank; reporters=${reporterCodes.join(", ")}; yearSpan=${YEARS}.`,
  );
  if (skipped > 0) {
    console.log(`Skipped ${skipped} reporter(s) due to no World Bank data.`);
  }
  if (failed > 0) {
    console.log(`Failed ${failed} reporter(s) due to repeated API/network errors.`);
  }
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("syncTradeFlows failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
