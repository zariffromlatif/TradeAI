const path = require("node:path");
const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const PartnerProfile = require("../models/PartnerProfile");

/**
 * Replace this with real UN Comtrade fetch logic.
 * Return latest metrics for one partner pair.
 */
async function fetchOfficialMetrics({ reporterCode, partnerCode }) {
  // NOTE:
  // - This is a practical template. Comtrade endpoint params can vary by plan/version.
  // - If your account/key is required, add header: { "Ocp-Apim-Subscription-Key": process.env.COMTRADE_API_KEY }

  const year = new Date().getUTCFullYear() - 1; // last full year (safer than current partial year)
  const sourceUrl = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporter=${reporterCode}&partner=${partnerCode}&flow=all&period=${year}`;

  try {
    const res = await axios.get(sourceUrl, {
      timeout: 20000,
      headers: {
        Accept: "application/json",
        // Uncomment if your plan requires a key:
        // "Ocp-Apim-Subscription-Key": process.env.COMTRADE_API_KEY,
      },
    });

    // Adjust depending on actual payload shape from your endpoint.
    // Common shapes include res.data.data or res.data.dataset
    const rows = res.data?.data || res.data?.dataset || [];
    if (!Array.isArray(rows) || rows.length === 0) return null;

    // Try to infer import/export values from common field names.
    let importValue = 0;
    let exportValue = 0;

    for (const r of rows) {
      const flowRaw = String(r.flowDesc || r.flow || r.flowCode || "")
        .trim()
        .toUpperCase();

      // value field candidates
      const v =
        Number(r.primaryValue ?? r.tradeValue ?? r.value ?? 0) || 0;

      // UN Comtrade often returns flowCode: M (import), X (export)
      if (flowRaw === "M" || flowRaw.includes("IMPORT")) importValue += v;
      if (flowRaw === "X" || flowRaw.includes("EXPORT")) exportValue += v;
    }

    // If endpoint returns only one partner pair, shares cannot be computed directly
    // unless you also fetch total BD import/export world values.
    // So we return trade values first; share can be computed in a second call.
    if (importValue <= 0 && exportValue <= 0) return null;

    return {
      asOf: new Date(`${year}-12-31T00:00:00.000Z`),
      source: "un_comtrade",
      sourceUrl,
      importTradeValueUsd: importValue > 0 ? Number(importValue.toFixed(2)) : null,
      exportTradeValueUsd: exportValue > 0 ? Number(exportValue.toFixed(2)) : null,
      // Keep these null until you compute against world totals:
      importSharePercent: null,
      exportSharePercent: null,
    };
  } catch (err) {
    // Log and continue without breaking all partners
    console.warn(
      `Comtrade fetch failed for ${reporterCode}-${partnerCode}:`,
      err.response?.status || err.message
    );
    return null;
  }
}

function upsertStat(stats, nextStat) {
  const idx = stats.findIndex((s) => s.metric === nextStat.metric);
  if (idx >= 0) {
    stats[idx] = { ...stats[idx], ...nextStat };
  } else {
    stats.push(nextStat);
  }
  return stats;
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const rows = await PartnerProfile.find({ reporterCode: "BD" });
  let verifiedUpdates = 0;

  for (const row of rows) {
    const official = await fetchOfficialMetrics({
      reporterCode: row.reporterCode,
      partnerCode: row.partnerCode,
    });

    // If no official data found, leave as curated/unverified
    if (!official) continue;

    const stats = Array.isArray(row.stats) ? [...row.stats] : [];

    if (typeof official.importTradeValueUsd === "number") {
      upsertStat(stats, {
        metric: "import_trade_value_usd",
        value: official.importTradeValueUsd,
        minValue: null,
        maxValue: null,
        period: "latest_available",
        source: official.source,
        sourceUrl: official.sourceUrl,
        asOf: official.asOf,
      });
    }
    
    if (typeof official.exportTradeValueUsd === "number") {
      upsertStat(stats, {
        metric: "export_trade_value_usd",
        value: official.exportTradeValueUsd,
        minValue: null,
        maxValue: null,
        period: "latest_available",
        source: official.source,
        sourceUrl: official.sourceUrl,
        asOf: official.asOf,
      });
    }
    
    // keep these only if you compute shares:
    if (typeof official.importSharePercent === "number") {
      upsertStat(stats, {
        metric: "import_share_percent",
        value: official.importSharePercent,
        minValue: null,
        maxValue: null,
        period: "latest_available",
        source: official.source,
        sourceUrl: official.sourceUrl,
        asOf: official.asOf,
      });
    }
    
    if (typeof official.exportSharePercent === "number") {
      upsertStat(stats, {
        metric: "export_share_percent",
        value: official.exportSharePercent,
        minValue: null,
        maxValue: null,
        period: "latest_available",
        source: official.source,
        sourceUrl: official.sourceUrl,
        asOf: official.asOf,
      });
    }

    row.stats = stats;
    row.sourceType = "hybrid"; // curated + official metrics
    row.verified = true;
    await row.save();
    verifiedUpdates += 1;
  }

  console.log(`Verified/updated ${verifiedUpdates} partner profile(s).`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Verification failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
