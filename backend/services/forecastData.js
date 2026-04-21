const mongoose = require("mongoose");
const TradeRecord = require("../models/TradeRecord");
const { getNationalPartnerMatch } = require("./nationalTradeSupport");

async function getMonthlyVolumeSeries({ commodityId, countryId, type }) {
  const strictMatch = {
    commodity: new mongoose.Types.ObjectId(commodityId),
    type: type === "import" ? "import" : "export",
    isVerified: true,
    source: { $in: ["un_comtrade", "official_api", "world_bank_api"] },
  };
  if (countryId) strictMatch.reporter = new mongoose.Types.ObjectId(countryId);

  const aggregateRows = async (match) =>
    TradeRecord.aggregate([
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

  const strictNational = await getNationalPartnerMatch(strictMatch.commodity);
  const strictRows = await aggregateRows({ ...strictMatch, ...strictNational });
  const rows =
    strictRows.length > 0
      ? strictRows
      : await (async () => {
          // Fallback for demos/seeded datasets when verified official rows are unavailable.
          const relaxedMatch = {
            commodity: strictMatch.commodity,
            type: strictMatch.type,
          };
          if (strictMatch.reporter) relaxedMatch.reporter = strictMatch.reporter;
          const relaxedNational = await getNationalPartnerMatch(strictMatch.commodity, {
            relaxed: true,
          });
          return aggregateRows({ ...relaxedMatch, ...relaxedNational });
        })();

  return rows.map((r) => ({
    period: `${r._id.y}-${String(r._id.m).padStart(2, "0")}`,
    totalVolume: r.totalVolume ?? 0,
  }));
}

function detectSeriesFrequency(series) {
  if (!series.length) return "monthly";
  const months = new Set(series.map((s) => Number(String(s.period).slice(5, 7))));
  // If all observations are year-end months, treat as annual source data.
  if (months.size === 1 && months.has(12)) return "annual";
  return "monthly";
}

function normalizeSeriesForFrequency(series, frequency) {
  if (frequency !== "annual") return series;
  return series.map((s) => ({
    period: String(s.period).slice(0, 4),
    totalVolume: s.totalVolume,
  }));
}

function prepareVolumeSeriesForMl(series) {
  const frequency = detectSeriesFrequency(series);
  const normalizedSeries = normalizeSeriesForFrequency(series, frequency);
  return {
    seriesForMl: normalizedSeries,
    sourceFrequency: frequency,
    isInterpolated: false,
    expansionNote:
      frequency === "annual"
        ? "Source is annual; forecasting is performed on annual observations (no synthetic monthly interpolation)."
        : undefined,
  };
}

module.exports = {
  getMonthlyVolumeSeries,
  detectSeriesFrequency,
  normalizeSeriesForFrequency,
  prepareVolumeSeriesForMl,
};
