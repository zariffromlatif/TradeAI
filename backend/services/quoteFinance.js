function toNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function quoteProfitability({
  unitSellPrice,
  unitProcurementCost,
  qty,
  fxRate = 1,
  freight = 0,
  insurance = 0,
  duties = 0,
}) {
  const q = Math.max(0, toNum(qty));
  const sell = toNum(unitSellPrice) * q;
  const cost = toNum(unitProcurementCost) * q;
  const extra = toNum(freight) + toNum(insurance) + toNum(duties);
  const revenueBase = sell * toNum(fxRate, 1);
  const totalCost = cost * toNum(fxRate, 1) + extra;
  const grossMargin = revenueBase - totalCost;
  const marginPct = revenueBase > 0 ? (grossMargin / revenueBase) * 100 : 0;

  return {
    revenueBase: Number(revenueBase.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),
    grossMargin: Number(grossMargin.toFixed(2)),
    marginPct: Number(marginPct.toFixed(2)),
  };
}

function landedCost({ acceptedBidPrice, freight, insurance, customsDuties }) {
  const total =
    toNum(acceptedBidPrice) +
    toNum(freight) +
    toNum(insurance) +
    toNum(customsDuties);
  return {
    acceptedBidPrice: toNum(acceptedBidPrice),
    freight: toNum(freight),
    insurance: toNum(insurance),
    customsDuties: toNum(customsDuties),
    finalLandedCost: Number(total.toFixed(2)),
  };
}

module.exports = { quoteProfitability, landedCost };
