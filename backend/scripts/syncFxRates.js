const path = require("node:path");
const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const FxRate = require("../models/FxRate");

const PAIRS = [
  ["USD", "BDT"],
  ["USD", "CNY"],
  ["USD", "INR"],
  ["USD", "EUR"],
  ["USD", "GBP"],
  ["USD", "AED"],
];

async function fetchFxSeries(base, quote) {
  const symbol = `${base}${quote}=X`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const res = await axios.get(url, {
    params: { range: "1y", interval: "1d" },
    timeout: 30000,
  });
  const result = res.data?.chart?.result?.[0];
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const history = timestamps
    .map((ts, idx) => ({
      date: new Date(Number(ts) * 1000),
      rate: Number(closes[idx]),
    }))
    .filter((x) => Number.isFinite(x.rate) && x.rate > 0 && !Number.isNaN(x.date.getTime()))
    .sort((a, b) => a.date - b.date);
  return {
    history,
    sourceUrl: `${url}?range=1y&interval=1d`,
    source: "yahoo_finance",
  };
}

async function run() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI missing in backend/.env");
  await mongoose.connect(process.env.MONGO_URI);
  let upserts = 0;

  for (const [base, quote] of PAIRS) {
    const pair = `${base}/${quote}`;
    const { history, sourceUrl, source } = await fetchFxSeries(base, quote);
    if (!history.length) {
      console.log(`No FX rows for ${pair}.`);
      continue;
    }
    const last = history[history.length - 1];
    await FxRate.updateOne(
      { pair },
      {
        $set: {
          pair,
          baseCurrency: base,
          quoteCurrency: quote,
          currentRate: last.rate,
          history,
          source,
          sourceUrl,
          asOf: last.date,
          ingestedAt: new Date(),
          verified: true,
          qualityFlags: [],
        },
      },
      { upsert: true },
    );
    upserts += 1;
  }

  console.log(`Synced ${upserts} FX pair record(s).`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("syncFxRates failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
