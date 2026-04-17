const mongoose = require("mongoose");
const TradeRecord = require("../models/TradeRecord");

async function getMonthlyVolumeSeries({ commodityId, countryId, type }) {
  const match = {
    commodity: new mongoose.Types.ObjectId(commodityId),
    type: type === "import" ? "import" : "export",
    isVerified: true,
    source: { $in: ["un_comtrade", "official_api"] },
  };
  if (countryId) match.country = new mongoose.Types.ObjectId(countryId);

  const rows = await TradeRecord.aggregate([
    { $match: match },
    {
      $group: {
        _id: { y: { $year: "$date" }, m: { $month: "$date" } },
        totalVolume: { $sum: "$volume" },
      },
    },
    { $sort: { "_id.y": 1, "_id.m": 1 } },
  ]);

  return rows.map((r) => ({
    period: `${r._id.y}-${String(r._id.m).padStart(2, "0")}`,
    totalVolume: r.totalVolume ?? 0,
  }));
}

module.exports = { getMonthlyVolumeSeries };
