const path = require("node:path");
const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Commodity = require("../models/Commodity");

// Map DB commodity names -> Yahoo Finance symbols.
const COMMODITY_SYMBOLS = {
  Gold: "GC=F",
  "Crude Oil": "CL=F",
  "Natural Gas": "NG=F",
  Wheat: "ZW=F",
  Cotton: "CT=F",
};

const PROVIDER_NAME = "yahoo_finance";

async function fetchPriceFromProvider(symbol) {
  // Yahoo chart endpoint (no API key required for basic quote access).
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;

  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        Accept: "application/json",
        // Authorization: `Bearer ${process.env.PRICE_API_KEY}`,
      },
    });

    const result = res.data?.chart?.result?.[0];
    const meta = result?.meta || {};
    const regular = Number(meta.regularMarketPrice);
    const previousClose = Number(meta.previousClose);
    const close =
      Number(result?.indicators?.quote?.[0]?.close?.slice(-1)?.[0]) || NaN;

    const price = [regular, close, previousClose].find(
      (v) => Number.isFinite(v) && v > 0,
    );

    const ts = Number(meta.regularMarketTime);
    const asOfRaw = Number.isFinite(ts) ? new Date(ts * 1000) : new Date();

    if (!Number.isFinite(price) || price <= 0) return null;

    return {
      price,
      asOf: asOfRaw,
      sourceUrl: url,
    };
  } catch (err) {
    console.warn(
      `Price fetch failed for symbol=${symbol}:`,
      err.response?.status || err.message,
    );
    return null;
  }
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const commodities = await Commodity.find({
    name: { $in: Object.keys(COMMODITY_SYMBOLS) },
  });

  let updated = 0;

  for (const commodity of commodities) {
    const symbol = COMMODITY_SYMBOLS[commodity.name];
    if (!symbol) continue;

    const quote = await fetchPriceFromProvider(symbol);
    if (!quote) continue;

    // Append to history and update current snapshot
    const history = Array.isArray(commodity.priceHistory)
      ? [...commodity.priceHistory]
      : [];
    history.push({ date: quote.asOf, price: quote.price });

    // optional trim to last N points
    const MAX_POINTS = 365;
    if (history.length > MAX_POINTS) {
      history.splice(0, history.length - MAX_POINTS);
    }

    commodity.currentPrice = quote.price;
    commodity.priceHistory = history;

    // These fields require schema update in Commodity model (next step)
    commodity.source = PROVIDER_NAME;
    commodity.sourceUrl = quote.sourceUrl;
    commodity.asOf = quote.asOf;
    commodity.ingestedAt = new Date();
    commodity.verified = true;
    commodity.qualityFlags = [];

    await commodity.save();
    updated += 1;
  }

  console.log(`Commodity sync complete. Updated ${updated} record(s).`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("syncCommodityPrices failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
