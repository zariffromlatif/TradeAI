function normalize(value, min, max, invert = false) {
  if (max <= min) return 50;
  let s = ((value - min) / (max - min)) * 100;
  s = Math.max(0, Math.min(100, s));
  return invert ? 100 - s : s;
}

function computeBidScore({ quote, marketAvg, countryRiskScore = 50 }) {
  const priceScore =
    quote.offeredPrice > 0 && marketAvg > 0
      ? normalize(quote.offeredPrice, marketAvg * 0.7, marketAvg * 1.3, true)
      : 50;
  const riskScore = normalize(countryRiskScore, 0, 100, true); // lower risk => better
  const leadTimeScore = normalize(quote.leadTimeDays || 30, 7, 90, true);

  const w = { price: 0.55, risk: 0.3, leadTime: 0.15 };
  const composite =
    priceScore * w.price + riskScore * w.risk + leadTimeScore * w.leadTime;

  return {
    compositeScore: Number(composite.toFixed(2)),
    scoreBreakdown: {
      priceScore: Number(priceScore.toFixed(2)),
      riskScore: Number(riskScore.toFixed(2)),
      leadTimeScore: Number(leadTimeScore.toFixed(2)),
      weights: w,
    },
  };
}

module.exports = { computeBidScore };
