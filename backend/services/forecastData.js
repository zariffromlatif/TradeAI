const mongoose = require("mongoose");
const TradeRecord = require("../models/TradeRecord");
const { getNationalPartnerMatch } = require("./nationalTradeSupport");

async function getMonthlyVolumeSeries({ commodityId, countryId, type }) {
  const match = {
    commodity: new mongoose.Types.ObjectId(commodityId),
    type: type === "import" ? "import" : "export",
    isVerified: true,
    source: { $in: ["un_comtrade", "official_api", "world_bank_api"] },
  };
  if (countryId) match.reporter = new mongoose.Types.ObjectId(countryId);

  const national = await getNationalPartnerMatch(match.commodity);
  Object.assign(match, national);

  const rows = await TradeRecord.aggregate([
    { $match: match },
    {
      $group: {
        _id: { y: { $year: "$date" }, m: { $month: "$date" } },
        totalVolume: {
          $sum: {
            $cond: [
              { $gt: [{ $ifNull: ["$volume", 0] }, 0] },
              "$volume",
              { $ifNull: ["$value", 0] },
            ],
          },
        },
      },
    },
    { $sort: { "_id.y": 1, "_id.m": 1 } },
  ]);

  return rows.map((r) => ({
    period: `${r._id.y}-${String(r._id.m).padStart(2, "0")}`,
    totalVolume: r.totalVolume ?? 0,
  }));
}

/**
 * Annual (or sparse) national series often has fewer than 4 points — ML needs at least 4. Expand each calendar year
 * into 12 months with even split so totals are preserved and lag-1 regression can run.
 */
function expandAnnualSeriesToMonthlyUniform(series) {
  if (!series.length) return [];
  const byYear = new Map();
  for (const r of series) {
    const y = Number(String(r.period).slice(0, 4));
    const m = Number(String(r.period).slice(5, 7));
    if (!Number.isFinite(y) || !Number.isFinite(m)) continue;
    if (!byYear.has(y)) byYear.set(y, new Map());
    const mm = byYear.get(y);
    mm.set(m, (mm.get(m) || 0) + (Number(r.totalVolume) || 0));
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const out = [];
  for (const y of years) {
    const months = byYear.get(y);
    const annualTotal = [...months.values()].reduce((a, b) => a + b, 0);
    const per = annualTotal / 12;
    for (let m = 1; m <= 12; m += 1) {
      out.push({
        period: `${y}-${String(m).padStart(2, "0")}`,
        totalVolume: per,
      });
    }
  }
  return out;
}

function prepareVolumeSeriesForMl(series) {
  if (series.length >= 4) {
    return { seriesForMl: series, expanded: false };
  }
  const expanded = expandAnnualSeriesToMonthlyUniform(series);
  if (expanded.length >= 4) {
    return { seriesForMl: expanded, expanded: true };
  }
  return { seriesForMl: series, expanded: false };
}

module.exports = {
  getMonthlyVolumeSeries,
  expandAnnualSeriesToMonthlyUniform,
  prepareVolumeSeriesForMl,
};
