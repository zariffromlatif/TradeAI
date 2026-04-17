const path = require("node:path");
const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Country = require("../models/Country");
const Commodity = require("../models/Commodity");
const TradeRecord = require("../models/TradeRecord");

const REPORTER_ISO2 = "BD";
const REPORTER_M49 = "050";
const PERIOD = String(new Date().getUTCFullYear() - 1);
const FALLBACK_YEARS = [
  PERIOD,
  String(Number(PERIOD) - 1),
  String(Number(PERIOD) - 2),
];
const REQUEST_SPACING_MS = 1200;
const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 60000;

const M49_BY_ISO2 = {
  BD: "050",
  CN: "156",
  IN: "356",
  US: "840",
  DE: "276",
  GB: "826",
  AE: "784",
};

function getApiKey() {
  const key = process.env.COMTRADE_API_KEY;
  if (!key || key.trim() === "" || key === "your_key_here") {
    throw new Error(
      "COMTRADE_API_KEY is missing/placeholder in backend/.env. Add a real key first.",
    );
  }
  return key.trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry({ url, params, headers }) {
  let attempt = 0;
  let delayMs = 1500;
  let lastErr = null;

  while (attempt < MAX_ATTEMPTS) {
    try {
      const res = await axios.get(url, {
        params,
        timeout: REQUEST_TIMEOUT_MS,
        headers,
      });
      return res;
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      const code = err.code;
      const isNetworkTimeout =
        code === "ECONNABORTED" ||
        code === "ETIMEDOUT" ||
        /timeout/i.test(String(err.message || ""));
      const isRetriableStatus = status === 429 || (status >= 500 && status < 600);
      const isRetriable = isRetriableStatus || isNetworkTimeout;
      if (!isRetriable) break;

      const retryAfterSec = Number(err.response?.headers?.["retry-after"]);
      const waitMs =
        status === 429 && Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000
          : delayMs;
      await sleep(waitMs);
      delayMs *= 2;
      attempt += 1;
    }
  }

  throw lastErr;
}

async function fetchTradeValueUsd({
  apiKey,
  reporterM49,
  partnerM49,
  flowCode,
  period,
}) {
  const requests = [
    {
      url: "https://comtradeapi.un.org/data/v1/get/C/A/HS",
      params: {
        reporterCode: reporterM49,
        partnerCode: partnerM49,
        flowCode,
        period,
        cmdCode: "TOTAL",
        customsCode: "C00",
      },
      headers: {
        Accept: "application/json",
        "Ocp-Apim-Subscription-Key": apiKey,
      },
    },
    {
      url: "https://comtradeapi.un.org/data/v1/get/C/A/HS",
      params: {
        reporterCode: reporterM49,
        partnerCode: partnerM49,
        flowCode,
        period,
        cmdCode: "TOTAL",
      },
      headers: {
        Accept: "application/json",
        "Ocp-Apim-Subscription-Key": apiKey,
      },
    },
    {
      url: "https://comtradeapi.un.org/public/v1/preview/C/A/HS",
      params: {
        reporter: reporterM49,
        partner: partnerM49,
        flow: flowCode === "M" ? "import" : "export",
        period,
        cmdCode: "TOTAL",
      },
      headers: {
        Accept: "application/json",
        "Ocp-Apim-Subscription-Key": apiKey,
      },
    },
  ];

  for (const req of requests) {
    let res;
    try {
      res = await requestWithRetry(req);
    } catch (err) {
      console.warn(
        `Comtrade request variant failed (${flowCode}/${period}):`,
        err.response?.status || err.code || err.message,
      );
      await sleep(REQUEST_SPACING_MS);
      continue;
    }

    const rows =
      res.data?.data ||
      res.data?.dataset ||
      res.data?.Data ||
      [];

    if (!Array.isArray(rows) || rows.length === 0) {
      await sleep(REQUEST_SPACING_MS);
      continue;
    }

    const total = rows.reduce((sum, r) => {
      const v = Number(r.primaryValue ?? r.tradeValue ?? r.value ?? 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);

    await sleep(REQUEST_SPACING_MS);
    return {
      value: total > 0 ? total : null,
      hasData: true,
      sourceUrl: `${req.url}?${new URLSearchParams(req.params).toString()}`,
    };
  }

  return { value: null, hasData: false, sourceUrl: null };
}

async function fetchWithYearFallback({
  apiKey,
  reporterM49,
  partnerM49,
  flowCode,
}) {
  for (const year of FALLBACK_YEARS) {
    const result = await fetchTradeValueUsd({
      apiKey,
      reporterM49,
      partnerM49,
      flowCode,
      period: year,
    });
    if (result.hasData) {
      return { value: result.value, period: year, sourceUrl: result.sourceUrl };
    }
  }
  return { value: null, period: null, sourceUrl: null };
}

async function run() {
  const apiKey = getApiKey();
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const reporter = await Country.findOne({ code: REPORTER_ISO2 });
  if (!reporter) {
    throw new Error(`Reporter country ${REPORTER_ISO2} not found in Country collection.`);
  }

  let aggregateCommodity = await Commodity.findOne({ name: "All Commodities (HS TOTAL)" });
  if (!aggregateCommodity) {
    aggregateCommodity = await Commodity.create({
      name: "All Commodities (HS TOTAL)",
      category: "Aggregate",
      unit: "USD",
      currentPrice: null,
      priceHistory: [],
      source: "un_comtrade",
      sourceUrl: "https://comtradeapi.un.org/",
      asOf: new Date(`${PERIOD}-12-31T00:00:00.000Z`),
      ingestedAt: new Date(),
      verified: true,
      qualityFlags: [],
    });
  }

  const partners = await Country.find({
    code: { $ne: REPORTER_ISO2, $in: Object.keys(M49_BY_ISO2) },
  });

  let upserts = 0;
  let skipped = 0;

  for (const partner of partners) {
    const partnerM49 = M49_BY_ISO2[partner.code];
    if (!partnerM49) continue;

    // M = imports of reporter from partner, X = exports of reporter to partner
    const importFlow = await fetchWithYearFallback({
      apiKey,
      reporterM49: REPORTER_M49,
      partnerM49,
      flowCode: "M",
    });
    const exportFlow = await fetchWithYearFallback({
      apiKey,
      reporterM49: REPORTER_M49,
      partnerM49,
      flowCode: "X",
    });

    if (importFlow.value != null && importFlow.period) {
      const date = new Date(`${importFlow.period}-12-31T00:00:00.000Z`);
      await TradeRecord.updateOne(
        {
          country: partner._id,
          commodity: aggregateCommodity._id,
          type: "import",
          date,
          source: "un_comtrade",
        },
        {
          $set: {
            volume: null,
            value: importFlow.value,
            sourceUrl:
              importFlow.sourceUrl ||
              `https://comtradeapi.un.org/data/v1/get/C/A/HS?reporterCode=${REPORTER_M49}&partnerCode=${partnerM49}&flowCode=M&period=${importFlow.period}&cmdCode=TOTAL`,
            asOf: date,
            ingestedAt: new Date(),
            isVerified: true,
          },
        },
        { upsert: true },
      );
      upserts += 1;
    }

    if (exportFlow.value != null && exportFlow.period) {
      const date = new Date(`${exportFlow.period}-12-31T00:00:00.000Z`);
      await TradeRecord.updateOne(
        {
          country: partner._id,
          commodity: aggregateCommodity._id,
          type: "export",
          date,
          source: "un_comtrade",
        },
        {
          $set: {
            volume: null,
            value: exportFlow.value,
            sourceUrl:
              exportFlow.sourceUrl ||
              `https://comtradeapi.un.org/data/v1/get/C/A/HS?reporterCode=${REPORTER_M49}&partnerCode=${partnerM49}&flowCode=X&period=${exportFlow.period}&cmdCode=TOTAL`,
            asOf: date,
            ingestedAt: new Date(),
            isVerified: true,
          },
        },
        { upsert: true },
      );
      upserts += 1;
    }

    if (
      (importFlow.value == null || !importFlow.period) &&
      (exportFlow.value == null || !exportFlow.period)
    ) {
      skipped += 1;
      console.log(`No official rows returned for partner ${partner.code}; skipped.`);
    }
  }

  console.log(
    `Synced ${upserts} verified trade flow record(s) from UN Comtrade (${FALLBACK_YEARS.join(", ")} fallback years).`,
  );
  if (skipped > 0) {
    console.log(`Skipped ${skipped} partner(s) due to no data in fallback years.`);
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
