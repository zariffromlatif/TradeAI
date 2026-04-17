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

  const exportStats = await TradeRecord.aggregate([
    { $match: { ...realTradeMatch, type: "export" } },
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
    { $match: { ...realTradeMatch, type: "import" } },
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
  const tradeRecordCount = await TradeRecord.countDocuments(realTradeMatch);

  return {
    topExporters: exportStats,
    topImporters: importStats,
    countriesTracked,
    tradeRecordCount,
  };
}

module.exports = { getDashboardAggregates };
