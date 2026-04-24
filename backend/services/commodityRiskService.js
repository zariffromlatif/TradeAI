// NEW FILE: backend/services/commodityIndicatorService.js

const TradeRecord = require("../models/TradeRecord");
const Commodity = require("../models/Commodity");

// Calculate price volatility from trade records
async function calculatePriceVolatility(commodityId) {
  const records = await TradeRecord.find({ commodity: commodityId })
    .select("value volume date")
    .sort({ date: -1 })
    .limit(24); // Last 24 months
  
  const prices = records.map(r => r.value / r.volume);
  const mean = prices.reduce((a,b) => a+b) / prices.length;
  const variance = prices.reduce((a,b) => a + Math.pow(b - mean, 2)) / prices.length;
  const volatility = (Math.sqrt(variance) / mean) * 100;
  
  return Math.round(volatility * 100) / 100;
}

// Calculate supply concentration (HHI index)
async function calculateSupplyConcentration(commodityId) {
  const suppliers = await TradeRecord.aggregate([
    { $match: { commodity: commodityId, type: "export" } },
    { $group: { _id: "$reporter", totalValue: { $sum: "$value" } } },
    { $sort: { totalValue: -1 } }
  ]);
  
  const total = suppliers.reduce((sum, s) => sum + s.totalValue, 0);
  let hhi = 0;
  
  suppliers.forEach(s => {
    const marketShare = (s.totalValue / total) * 100;
    hhi += Math.pow(marketShare, 2);
  });
  
  return hhi / 10000; // Normalize to 0-1
}

// Calculate trade dependency for commodity in a country
async function calculateTradeDependencyRatio(countryId, commodityId) {
  const countryTotal = await TradeRecord.aggregate([
    { $match: { reporter: countryId } },
    { $group: { _id: null, totalValue: { $sum: "$value" } } }
  ]);
  
  const commodityImport = await TradeRecord.aggregate([
    { $match: { partner: countryId, commodity: commodityId, type: "export" } },
    { $group: { _id: null, totalValue: { $sum: "$value" } } }
  ]);
  
  const ratio = (commodityImport[0]?.totalValue || 0) / (countryTotal[0]?.totalValue || 1);
  return ratio * 100;
}

module.exports = {
  calculatePriceVolatility,
  calculateSupplyConcentration,
  calculateTradeDependencyRatio
};