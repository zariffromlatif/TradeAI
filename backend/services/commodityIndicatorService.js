/**
 * Commodity Risk Indicator Service
 * Calculates commodity-specific risk indicators from trade data
 * Each commodity gets UNIQUE indicators based on its actual trade patterns
 */

const TradeRecord = require("../models/TradeRecord");
const Commodity = require("../models/Commodity");

const REAL_TRADE_MATCH = {
  isVerified: true,
  source: { $in: ["un_comtrade", "official_api", "world_bank_api", "seed_demo"] },
};

/**
 * Calculate Price Volatility for a commodity
 * Uses standard deviation of prices over the last 24 months
 */
async function calculatePriceVolatility(commodityId) {
  try {
    const commodity = await Commodity.findById(commodityId).select("priceHistory").lean();

    if (!commodity || !commodity.priceHistory || commodity.priceHistory.length < 2) {
      return 15; // Default volatility if no data
    }

    const prices = commodity.priceHistory
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-24) // Last 24 months
      .map(p => Number(p.price))
      .filter(p => Number.isFinite(p) && p > 0);

    if (prices.length < 2) return 15;

    const mean = prices.reduce((a, b) => a + b) / prices.length;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2)) / prices.length;
    const stdDev = Math.sqrt(variance);
    const volatility = (stdDev / mean) * 100;

    return Math.round(volatility * 100) / 100;
  } catch (err) {
    console.error("Error calculating price volatility:", err);
    return 15;
  }
}

/**
 * Calculate Supply Concentration (HHI Index)
 * Shows if commodity is supplied by many countries or few dominant suppliers
 * High HHI = risky (few suppliers), Low HHI = safe (many suppliers)
 */
async function calculateSupplyConcentration(commodityId) {
  try {
    const suppliers = await TradeRecord.aggregate([
      {
        $match: {
          commodity: commodityId,
          type: "export",
          ...REAL_TRADE_MATCH,
        },
      },
      {
        $group: {
          _id: "$reporter",
          totalValue: { $sum: "$value" },
        },
      },
      {
        $sort: { totalValue: -1 },
      },
    ]);

    if (suppliers.length === 0) return 0.5; // Default if no data

    const totalValue = suppliers.reduce((sum, s) => sum + s.totalValue, 0);
    let hhi = 0;

    suppliers.forEach((supplier) => {
      const marketShare = (supplier.totalValue / totalValue) * 100;
      hhi += Math.pow(marketShare, 2);
    });

    // Normalize to 0-1 scale (0 = diversified, 1 = concentrated)
    const normalizedHhi = hhi / 10000;
    return Math.round(normalizedHhi * 100) / 100;
  } catch (err) {
    console.error("Error calculating supply concentration:", err);
    return 0.5;
  }
}

/**
 * Calculate Supply Shock Risk
 * Based on concentration of production in geopolitically risky regions
 * Simplified: uses supply concentration as proxy
 */
async function calculateSupplyShockRisk(commodityId) {
  try {
    const concentration = await calculateSupplyConcentration(commodityId);
    // Convert HHI to 0-100 scale
    // High concentration = high risk
    return Math.round(concentration * 100);
  } catch (err) {
    console.error("Error calculating supply shock risk:", err);
    return 50;
  }
}

/**
 * Calculate Demand Volatility for a commodity
 * Uses variance in monthly trade volumes
 */
async function calculateDemandVolatility(commodityId) {
  try {
    const monthlyVolumes = await TradeRecord.aggregate([
      {
        $match: {
          commodity: commodityId,
          ...REAL_TRADE_MATCH,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          totalVolume: { $sum: "$volume" },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    if (monthlyVolumes.length < 2) return 12; // Default

    const volumes = monthlyVolumes.map(m => Number(m.totalVolume)).filter(v => v > 0);

    if (volumes.length < 2) return 12;

    const mean = volumes.reduce((a, b) => a + b) / volumes.length;
    const variance = volumes.reduce((a, b) => a + Math.pow(b - mean, 2)) / volumes.length;
    const stdDev = Math.sqrt(variance);
    const volatility = (stdDev / mean) * 100;

    return Math.round(volatility * 100) / 100;
  } catch (err) {
    console.error("Error calculating demand volatility:", err);
    return 12;
  }
}

/**
 * Calculate Market Liquidity Risk
 * Based on number of active traders and trade frequency
 * Few traders = illiquid (risky), Many traders = liquid (safe)
 */
async function calculateMarketLiquidityRisk(commodityId) {
  try {
    const traders = await TradeRecord.aggregate([
      {
        $match: {
          commodity: commodityId,
          ...REAL_TRADE_MATCH,
        },
      },
      {
        $group: {
          _id: null,
          uniqueReporters: { $addToSet: "$reporter" },
          uniquePartners: { $addToSet: "$partner" },
          tradeCount: { $sum: 1 },
        },
      },
    ]);

    if (traders.length === 0 || traders[0].tradeCount < 5) {
      return 75; // High risk if low trading activity
    }

    const activeTraders = traders[0].uniqueReporters.length + traders[0].uniquePartners.length;
    const tradeCount = traders[0].tradeCount;

    // Risk decreases with more traders and more trades
    // Formula: 100 - (number of traders / 10 + trade frequency bonus)
    let liquidityRisk = 100 - (Math.min(activeTraders / 10, 25)) - (Math.min(tradeCount / 50, 25));
    liquidityRisk = Math.max(0, Math.min(100, liquidityRisk));

    return Math.round(liquidityRisk * 100) / 100;
  } catch (err) {
    console.error("Error calculating market liquidity risk:", err);
    return 50;
  }
}

/**
 * Calculate Production Capacity Gap
 * How much of global demand does this commodity satisfy
 * Gap = what's demanded vs what's supplied
 */
async function calculateProductionCapacityGap(commodityId, countryId = null) {
  try {
    const exports = await TradeRecord.aggregate([
      {
        $match: {
          commodity: commodityId,
          type: "export",
          ...REAL_TRADE_MATCH,
        },
      },
      {
        $group: {
          _id: null,
          totalExportValue: { $sum: "$value" },
        },
      },
    ]);

    const imports = await TradeRecord.aggregate([
      {
        $match: {
          commodity: commodityId,
          type: "import",
          ...REAL_TRADE_MATCH,
        },
      },
      {
        $group: {
          _id: null,
          totalImportValue: { $sum: "$value" },
        },
      },
    ]);

    const totalExport = exports[0]?.totalExportValue || 0;
    const totalImport = imports[0]?.totalImportValue || 0;

    if (totalImport === 0) return 0;

    // If exports < imports, there's a capacity gap
    const gap = ((totalImport - totalExport) / totalImport) * 100;

    return Math.round(Math.max(0, gap) * 100) / 100;
  } catch (err) {
    console.error("Error calculating production capacity gap:", err);
    return 5;
  }
}

/**
 * Calculate Trade Dependency Ratio for a commodity in a country
 * % of country's imports that come from this commodity
 * High dependency = risky
 */
async function calculateTradeDependencyRatio(countryId, commodityId) {
  try {
    // Total imports for the country
    const countryImports = await TradeRecord.aggregate([
      {
        $match: {
          partner: countryId,
          type: "export",
          ...REAL_TRADE_MATCH,
        },
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: "$value" },
        },
      },
    ]);

    // Imports of this specific commodity
    const commodityImports = await TradeRecord.aggregate([
      {
        $match: {
          partner: countryId,
          commodity: commodityId,
          type: "export",
          ...REAL_TRADE_MATCH,
        },
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: "$value" },
        },
      },
    ]);

    const totalImports = countryImports[0]?.totalValue || 1;
    const commodityImportValue = commodityImports[0]?.totalValue || 0;

    const ratio = (commodityImportValue / totalImports) * 100;

    return Math.round(ratio * 100) / 100;
  } catch (err) {
    console.error("Error calculating trade dependency ratio:", err);
    return 5;
  }
}

/**
 * Calculate Supply Diversification Score
 * How many countries supply this commodity
 * More countries = safer (diversified), Few countries = risky
 */
async function calculateSupplyDiversification(commodityId) {
  try {
    const suppliers = await TradeRecord.aggregate([
      {
        $match: {
          commodity: commodityId,
          type: "export",
          ...REAL_TRADE_MATCH,
        },
      },
      {
        $group: {
          _id: "$reporter",
        },
      },
    ]);

    const numSuppliers = suppliers.length;

    // Score: more suppliers = higher score (lower risk)
    // Less than 3 suppliers = critical (80+ risk)
    // 3-5 suppliers = high (60-80 risk)
    // 5-10 suppliers = moderate (40-60 risk)
    // 10+ suppliers = low risk (20-40)
    let score = 50;

    if (numSuppliers < 3) score = 85;
    else if (numSuppliers < 5) score = 70;
    else if (numSuppliers < 10) score = 55;
    else if (numSuppliers >= 10) score = 35;

    return score;
  } catch (err) {
    console.error("Error calculating supply diversification:", err);
    return 50;
  }
}

/**
 * Get all commodity indicators at once
 * Efficiently fetches all indicators in a single call
 */
async function getAllCommodityIndicators(commodityId, countryId = null) {
  try {
    const [
      priceVol,
      supplyCon,
      supplyShock,
      demandVol,
      liquidityRisk,
      capGap,
      tradeDep,
      diversif,
    ] = await Promise.all([
      calculatePriceVolatility(commodityId),
      calculateSupplyConcentration(commodityId),
      calculateSupplyShockRisk(commodityId),
      calculateDemandVolatility(commodityId),
      calculateMarketLiquidityRisk(commodityId),
      calculateProductionCapacityGap(commodityId),
      countryId ? calculateTradeDependencyRatio(countryId, commodityId) : 0,
      calculateSupplyDiversification(commodityId),
    ]);

    return {
      price_volatility: priceVol,
      supply_concentration: supplyCon,
      supply_shock_risk: supplyShock,
      demand_volatility: demandVol,
      market_liquidity_risk: liquidityRisk,
      production_capacity_gap: capGap,
      trade_dependency_ratio: tradeDep,
      supply_diversification: diversif,
    };
  } catch (err) {
    console.error("Error getting all commodity indicators:", err);
    return null;
  }
}

module.exports = {
  calculatePriceVolatility,
  calculateSupplyConcentration,
  calculateSupplyShockRisk,
  calculateDemandVolatility,
  calculateMarketLiquidityRisk,
  calculateProductionCapacityGap,
  calculateTradeDependencyRatio,
  calculateSupplyDiversification,
  getAllCommodityIndicators,
};