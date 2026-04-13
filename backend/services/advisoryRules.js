/**
 * F14 — Rule-based recommendations from risk + macro + optional price volatility.
 */

function logReturnSampleStd(prices) {
  const p = prices.map(Number).filter((x) => x > 0);
  if (p.length < 3) return null;
  const logRet = [];
  for (let i = 1; i < p.length; i += 1) {
    logRet.push(Math.log(p[i] / p[i - 1]));
  }
  if (logRet.length < 2) return null;
  const mean = logRet.reduce((a, b) => a + b, 0) / logRet.length;
  const variance =
    logRet.reduce((s, x) => s + (x - mean) ** 2, 0) / (logRet.length - 1);
  return Math.sqrt(variance);
}

function buildRecommendations(s) {
  const out = [];
  const rs = s.riskScore;
  const cat = (s.riskCategory || "").toUpperCase();

  const highRisk =
    rs != null && (rs >= 60 || cat === "HIGH" || cat === "CRITICAL");
  const moderateRisk =
    rs != null && !highRisk && (rs >= 40 || cat === "MODERATE");

  if (highRisk) {
    out.push({
      id: "elevated_country_risk",
      severity: "high",
      title: "Elevated country risk",
      detail: `Aggregate risk score is ${rs}/100 (${cat || "n/a"}). Review concentration of trade, payment terms, and counterparties tied to this market.`,
    });
  } else if (moderateRisk) {
    out.push({
      id: "moderate_country_risk",
      severity: "medium",
      title: "Moderate risk — increase monitoring",
      detail: `Risk score ${rs}/100 suggests balanced diligence: track macro indicators and order anomalies more frequently.`,
    });
  }

  if (s.tradeBalanceUsd != null && s.tradeBalanceUsd < -30) {
    out.push({
      id: "trade_deficit",
      severity: "medium",
      title: "Large trade deficit (macro)",
      detail: `Reported trade balance ~${s.tradeBalanceUsd}B USD. Large deficits can amplify external financing and currency stress — factor into contract currency and hedging discussions.`,
    });
  }

  if (s.inflation != null && s.inflation > 6) {
    out.push({
      id: "inflation_pressure",
      severity: "medium",
      title: "Elevated inflation",
      detail: `Inflation ~${s.inflation}% can erode margins on fixed-price contracts; consider price adjustment clauses or shorter tenors.`,
    });
  }

  if (s.priceVolatilityStd != null && s.priceVolatilityStd > 0.025) {
    const name = s.commodityName || "Selected commodity";
    out.push({
      id: "commodity_price_volatility",
      severity: "high",
      title: "High commodity price variability",
      detail: `${name}: sample std of log returns is ${s.priceVolatilityStd.toFixed(4)}. Treat as elevated price risk; align inventory and procurement timing with your risk appetite.`,
    });
  } else if (s.priceVolatilityStd != null && s.priceVolatilityStd > 0.012) {
    const name = s.commodityName || "Selected commodity";
    out.push({
      id: "commodity_price_volatility_mild",
      severity: "low",
      title: "Moderate commodity price swings",
      detail: `${name}: volatility proxy ${s.priceVolatilityStd.toFixed(4)} — routine monitoring is sufficient unless exposure is large.`,
    });
  }

  if (rs == null && out.length === 0) {
    out.push({
      id: "risk_unavailable",
      severity: "low",
      title: "Risk model unavailable",
      detail:
        "Could not compute ML risk score (is ml-service running on port 8000?). Macro and price-based rules still apply when data exists.",
    });
  }

  if (rs != null && !highRisk && !moderateRisk && out.length === 0) {
    out.push({
      id: "baseline_ok",
      severity: "low",
      title: "No rule-based alerts",
      detail: `Risk score ${rs}/100 is in a lower band and no other thresholds tripped. Continue periodic review.`,
    });
  }

  return out;
}

module.exports = { buildRecommendations, logReturnSampleStd };
