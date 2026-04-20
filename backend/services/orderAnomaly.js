const TradeRecord = require("../models/TradeRecord");

const QTY_HARD_CAP = 100_000;
const PRICE_DEVIATION_FROM_LIST = 0.2;
const Z_SIGMA = 2;

async function impliedPriceStats(commodityId) {
  const rows = await TradeRecord.find({
    commodity: commodityId,
    volume: { $gt: 0 },
  })
    .select("value volume")
    .limit(2000)
    .lean();

  const prices = rows
    .map((r) => r.value / r.volume)
    .filter((p) => Number.isFinite(p) && p > 0);

  if (prices.length < 5) return null;

  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance =
    prices.reduce((a, p) => a + (p - mean) ** 2, 0) / prices.length;
  const std = Math.sqrt(variance);

  return {
    mean,
    std,
    low: mean - Z_SIGMA * std,
    high: mean + Z_SIGMA * std,
    sampleSize: prices.length,
  };
}

async function volumeStats(commodityId, countryId) {
  const rows = await TradeRecord.find({
    commodity: commodityId,
    reporter: countryId,
  })
    .select("volume")
    .limit(2000)
    .lean();

  const vols = rows
    .map((r) => r.volume)
    .filter((v) => Number.isFinite(v) && v > 0);

  if (vols.length < 5) return null;

  vols.sort((a, b) => a - b);
  const p95 = vols[Math.floor(0.95 * (vols.length - 1))];

  return { p95, sampleSize: vols.length };
}

/**
 * @param {{ commodity: import("../models/Commodity").Model; country: import("mongoose").Types.ObjectId; quantity: number; pricePerUnit: number }} params
 */
async function evaluateSimulatedOrder({
  commodity,
  country,
  quantity,
  pricePerUnit,
}) {
  const flags = [];

  if (quantity > QTY_HARD_CAP) {
    flags.push(`Quantity exceeds ${QTY_HARD_CAP} threshold.`);
  }

  const upper = commodity.currentPrice * (1 + PRICE_DEVIATION_FROM_LIST);
  const lower = commodity.currentPrice * (1 - PRICE_DEVIATION_FROM_LIST);
  if (pricePerUnit > upper || pricePerUnit < lower) {
    flags.push(
      `Price per unit (${pricePerUnit}) deviates more than ${PRICE_DEVIATION_FROM_LIST * 100}% from listed market price (${commodity.currentPrice}).`,
    );
  }

  const histPrice = await impliedPriceStats(commodity._id);
  if (
    histPrice &&
    (pricePerUnit < histPrice.low || pricePerUnit > histPrice.high)
  ) {
    flags.push(
      `Price outside historical trade-implied band (~${histPrice.low.toFixed(2)}–${histPrice.high.toFixed(2)} USD/unit, n=${histPrice.sampleSize}).`,
    );
  }

  const histVol = await volumeStats(commodity._id, country);
  if (histVol && quantity > histVol.p95 * 3) {
    flags.push(
      `Quantity much larger than typical for this country–commodity (>3× historical ~95th percentile volume, n=${histVol.sampleSize}).`,
    );
  }

  const anomalyReason = flags.join(" ");
  return {
    isAnomaly: flags.length > 0,
    anomalyReason: anomalyReason.trim(),
    flags,
  };
}

module.exports = {
  evaluateSimulatedOrder,
  QTY_HARD_CAP,
  PRICE_DEVIATION_FROM_LIST,
};
