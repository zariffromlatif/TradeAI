const TradeRecord = require("../models/TradeRecord");
const Country = require("../models/Country");
const Commodity = require("../models/Commodity");
const { getNationalPartnerMatch } = require("./nationalTradeSupport");

/**
 * Same aggregates as GET /api/analytics/dashboard (for JSON + PDF reports).
 */
async function getDashboardAggregates() {
  const realTradeMatch = {
    isVerified: true,
    source: { $in: ["un_comtrade", "official_api", "world_bank_api"] },
  };
  const verifiedCount = await TradeRecord.countDocuments(realTradeMatch);

  const agg = await Commodity.findOne({ name: "All Commodities (HS TOTAL)" })
    .select("_id")
    .lean();
  const nationalExtra = await getNationalPartnerMatch(agg?._id || null);

  let matchBase = {};
  if (verifiedCount > 0) {
    matchBase = {
      ...realTradeMatch,
      ...(agg ? { commodity: agg._id } : {}),
    };
    if (Object.keys(nationalExtra).length) {
      matchBase = { ...matchBase, ...nationalExtra };
    }
  }

  // Secondary sort by _id so ties are deterministic (MongoDB order is undefined when totals match).
  const exportStats = await TradeRecord.aggregate([
    { $match: { ...matchBase, type: "export" } },
    {
      $group: {
        _id: "$reporter",
        totalExportValue: { $sum: { $ifNull: ["$value", 0] } },
      },
    },
    { $sort: { totalExportValue: -1, _id: 1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "countries",
        localField: "_id",
        foreignField: "_id",
        as: "countryInfo",
      },
    },
    { $unwind: "$countryInfo" },
    { $project: { country: "$countryInfo.name", totalExportValue: 1 } },
  ]);

  const importStats = await TradeRecord.aggregate([
    { $match: { ...matchBase, type: "import" } },
    {
      $group: {
        _id: "$reporter",
        totalImportValue: { $sum: { $ifNull: ["$value", 0] } },
      },
    },
    { $sort: { totalImportValue: -1, _id: 1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "countries",
        localField: "_id",
        foreignField: "_id",
        as: "countryInfo",
      },
    },
    { $unwind: "$countryInfo" },
    { $project: { country: "$countryInfo.name", totalImportValue: 1 } },
  ]);

  const countriesTracked = await Country.countDocuments();
  const tradeRecordCount = verifiedCount;
  const totalTradeRecordCount = await TradeRecord.countDocuments();

  return {
    topExporters: exportStats,
    topImporters: importStats,
    countriesTracked,
    tradeRecordCount,
    totalTradeRecordCount,
    fallbackMode: verifiedCount === 0 ? "all_records" : "verified_only",
  };
}

module.exports = { getDashboardAggregates };
