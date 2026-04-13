const TradeRecord = require("../models/TradeRecord");

/**
 * Same aggregates as GET /api/analytics/dashboard (for JSON + PDF reports).
 */
async function getDashboardAggregates() {
  const exportStats = await TradeRecord.aggregate([
    { $match: { type: "export" } },
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
    { $match: { type: "import" } },
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

  return { topExporters: exportStats, topImporters: importStats };
}

module.exports = { getDashboardAggregates };
