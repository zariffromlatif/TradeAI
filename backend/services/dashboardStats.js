const TradeRecord = require("../models/TradeRecord");
const Country = require("../models/Country");

/**
 * Same aggregates as GET /api/analytics/dashboard (for JSON + PDF reports).
 */
async function getDashboardAggregates() {
  const realTradeMatch = {
    isVerified: true,
    source: { $in: ["un_comtrade", "official_api"] },
  };
  const verifiedCount = await TradeRecord.countDocuments(realTradeMatch);
  const matchBase =
    verifiedCount > 0 ? realTradeMatch : {};

  const exportStats = await TradeRecord.aggregate([
    { $match: { ...matchBase, type: "export" } },
    { $group: { _id: "$country", totalExportValue: { $sum: "$value" } } },
    { $sort: { totalExportValue: -1 } },
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
    { $group: { _id: "$country", totalImportValue: { $sum: "$value" } } },
    { $sort: { totalImportValue: -1 } },
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
