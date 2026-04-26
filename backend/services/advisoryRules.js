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

function monthName(i) {
  const labels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return labels[i] || `M${i + 1}`;
}

function buildAdvancedAdvisory({
  signals,
  commodityName,
  monthlyCommodityPrices = [],
  countryRiskUniverse = [],
  fxVolatility = null,
}) {
  const recommendations = [];

  // 1) Optimal execution window based on monthly average commodity prices.
  if (monthlyCommodityPrices.length >= 4) {
    const sorted = [...monthlyCommodityPrices].sort((a, b) => a.avgPrice - b.avgPrice);
    const bestTwo = sorted.slice(0, 2).sort((a, b) => a.month - b.month);
    const worst = sorted[sorted.length - 1];
    const savingsPct =
      worst?.avgPrice > 0
        ? ((worst.avgPrice - bestTwo[0].avgPrice) / worst.avgPrice) * 100
        : null;
    recommendations.push({
      id: "optimal_execution_window",
      type: "execution_window",
      severity: "medium",
      title: "Optimal execution window",
      detail: `Based on monthly seasonal averages, ${commodityName || "selected commodity"} is usually cheaper in ${monthName(bestTwo[0].month)}-${monthName(bestTwo[1].month)}${savingsPct != null ? ` (up to ${savingsPct.toFixed(1)}% below yearly peak months)` : ""}.`,
      confidence: monthlyCommodityPrices.length >= 8 ? "HIGH" : "MEDIUM",
    });
  }

  // 2) Alternative market routing from risk universe.
  if (countryRiskUniverse.length >= 2 && signals?.riskScore != null) {
    const alternatives = countryRiskUniverse
      .filter((x) => x.riskScore < signals.riskScore)
      .sort((a, b) => a.riskScore - b.riskScore)
      .slice(0, 2);
    if (alternatives.length > 0) {
      recommendations.push({
        id: "alternative_market_routing",
        type: "alternative_routing",
        severity: alternatives[0].riskScore <= 40 ? "low" : "medium",
        title: "Alternative market routing",
        detail: `${alternatives.map((a) => `${a.countryName} (risk ${a.riskScore.toFixed(1)})`).join(", ")} show lower current risk than the selected market (risk ${signals.riskScore.toFixed(1)}). Consider routing/source diversification.`,
        confidence: countryRiskUniverse.length >= 6 ? "HIGH" : "MEDIUM",
      });
    }
  }

  // 3) FX timing advice from volatility metric.
  if (fxVolatility != null) {
    const lowBand = 0.012;
    const highBand = 0.025;
    if (fxVolatility <= lowBand) {
      recommendations.push({
        id: "fx_timing_low_vol",
        type: "fx_timing",
        severity: "low",
        title: "FX conversion window favorable",
        detail: `Forecast FX volatility is currently low (${fxVolatility.toFixed(4)}). Near-term conversion/settlement windows are relatively stable.`,
        confidence: "MEDIUM",
      });
    } else if (fxVolatility >= highBand) {
      recommendations.push({
        id: "fx_timing_high_vol",
        type: "fx_timing",
        severity: "high",
        title: "FX timing risk elevated",
        detail: `Forecast FX volatility is elevated (${fxVolatility.toFixed(4)}). Consider phased conversions, hedging, or shorter quote validity windows.`,
        confidence: "MEDIUM",
      });
    } else {
      recommendations.push({
        id: "fx_timing_neutral",
        type: "fx_timing",
        severity: "medium",
        title: "FX timing neutral",
        detail: `Forecast FX volatility (${fxVolatility.toFixed(4)}) is moderate. Use standard hedging controls and monitor threshold alerts.`,
        confidence: "MEDIUM",
      });
    }
  }

  return recommendations;
}

module.exports = { buildRecommendations, logReturnSampleStd, buildAdvancedAdvisory };
