"""
TradeAI - ML Service (ml-service/main.py)
Member C workspace — FR8: Automated Risk Scoring + FR9: Risk Interpretability

Run with: python -m uvicorn main:app --reload
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from sklearn.linear_model import LinearRegression

import numpy as np
from sklearn.preprocessing import MinMaxScaler
from pydantic import BaseModel, Field

app = FastAPI(
    title="TradeAI ML Service",
    description="ML microservice — Risk Scoring (FR8) + Interpretability (FR9)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MacroIndicators(BaseModel):
    gdp_growth_rate:             Optional[float] = Field(None, description="Annual GDP growth %")
    inflation_rate:              Optional[float] = Field(None, description="CPI inflation %")
    unemployment_rate:           Optional[float] = Field(None, description="Unemployment % of labor force")
    trade_balance_usd:           Optional[float] = Field(None, description="Trade balance USD billions")
    export_growth_rate:          Optional[float] = Field(None, description="Annual export growth %")
    import_dependency_ratio:     Optional[float] = Field(None, description="Imports as % of GDP")
    debt_to_gdp_ratio:           Optional[float] = Field(None, description="Government debt as % of GDP")
    foreign_reserves_months:     Optional[float] = Field(None, description="FX reserves in months of import cover")
    fx_volatility_index:         Optional[float] = Field(None, description="Currency volatility 0-100")
    current_account_balance_pct: Optional[float] = Field(None, description="Current account as % of GDP")


class RiskScoreRequest(BaseModel):
    country_code: str = Field(..., min_length=2, max_length=3)
    country_name: str
    indicators:   MacroIndicators

    class Config:
        json_schema_extra = {
            "example": {
                "country_code": "BGD",
                "country_name": "Bangladesh",
                "indicators": {
                    "gdp_growth_rate": 6.0,
                    "inflation_rate": 9.5,
                    "unemployment_rate": 5.3,
                    "trade_balance_usd": -20.5,
                    "export_growth_rate": 8.2,
                    "import_dependency_ratio": 22.4,
                    "debt_to_gdp_ratio": 39.0,
                    "foreign_reserves_months": 4.5,
                    "fx_volatility_index": 38.0,
                    "current_account_balance_pct": -3.2
                }
            }
        }

class VolumeForecastRequest(BaseModel):
    values: list[float] = Field(..., min_length=1)
    horizon: int = Field(1, ge=1, le=12)


class PriceVolatilityRequest(BaseModel):
    prices: list[float] = Field(..., min_length=3)

class OptimalRangeRequest(BaseModel):
    historical_prices: list[float] = Field(..., min_length=5)
    fx_volatility: float = 0.0
    shipping_cost_index: float = 1.0
@app.post("/api/forecast/optimal-bid-range")
async def optimal_bid_range(body: OptimalRangeRequest):
    p = np.array([float(x) for x in body.historical_prices if np.isfinite(float(x))], dtype=float)
    if len(p) < 5:
        raise HTTPException(status_code=400, detail="Need at least 5 valid historical prices")
    base_mean = float(np.mean(p))
    base_std = float(np.std(p, ddof=1)) if len(p) > 1 else 0.0
    # widen range under high FX volatility / shipping pressure
    volatility_factor = 1.0 + min(max(body.fx_volatility, 0.0), 1.0) * 0.5
    shipping_factor = min(max(body.shipping_cost_index, 0.7), 1.5)
    adj_std = base_std * volatility_factor * shipping_factor
    low = max(0.0, base_mean - 1.0 * adj_std)
    high = base_mean + 1.0 * adj_std
    return {
        "recommended_min": round(low, 2),
        "recommended_max": round(high, 2),
        "reference_mean": round(base_mean, 2),
        "reference_std": round(base_std, 4),
        "confidence": "MEDIUM" if len(p) < 20 else "HIGH",
        "note": "Heuristic optimal range based on historical bid prices, FX volatility and shipping index."
    }


INDICATOR_CONFIG = [
    {"field": "gdp_growth_rate",             "label": "GDP Growth Rate (%)",              "dimension": "economic_stability", "weight": 0.45, "invert": True,  "ref_min": -5.0,  "ref_max": 10.0},
    {"field": "inflation_rate",              "label": "Inflation Rate (%)",               "dimension": "economic_stability", "weight": 0.35, "invert": False, "ref_min": 0.0,   "ref_max": 50.0},
    {"field": "unemployment_rate",           "label": "Unemployment Rate (%)",            "dimension": "economic_stability", "weight": 0.20, "invert": False, "ref_min": 0.0,   "ref_max": 30.0},
    {"field": "trade_balance_usd",           "label": "Trade Balance (USD Billions)",     "dimension": "trade_stability",    "weight": 0.35, "invert": True,  "ref_min": -200.0,"ref_max": 200.0},
    {"field": "export_growth_rate",          "label": "Export Growth Rate (%)",           "dimension": "trade_stability",    "weight": 0.35, "invert": True,  "ref_min": -20.0, "ref_max": 30.0},
    {"field": "import_dependency_ratio",     "label": "Import Dependency (% of GDP)",     "dimension": "trade_stability",    "weight": 0.30, "invert": False, "ref_min": 0.0,   "ref_max": 80.0},
    {"field": "debt_to_gdp_ratio",           "label": "Debt-to-GDP Ratio (%)",            "dimension": "fiscal_health",      "weight": 0.55, "invert": False, "ref_min": 0.0,   "ref_max": 150.0},
    {"field": "foreign_reserves_months",     "label": "Foreign Reserves (Months)",        "dimension": "fiscal_health",      "weight": 0.45, "invert": True,  "ref_min": 0.0,   "ref_max": 12.0},
    {"field": "fx_volatility_index",         "label": "FX Volatility Index (0-100)",      "dimension": "market_volatility",  "weight": 0.60, "invert": False, "ref_min": 0.0,   "ref_max": 100.0},
    {"field": "current_account_balance_pct", "label": "Current Account Balance (% GDP)",  "dimension": "market_volatility",  "weight": 0.40, "invert": True,  "ref_min": -15.0, "ref_max": 15.0},
]

DIMENSION_WEIGHTS = {
    "economic_stability": 0.35,
    "trade_stability":    0.30,
    "fiscal_health":      0.20,
    "market_volatility":  0.15,
}


def normalize(value: float, cfg: dict) -> float:
    clipped = np.clip(value, cfg["ref_min"], cfg["ref_max"])
    scaler = MinMaxScaler(feature_range=(0, 100))
    scaler.fit([[cfg["ref_min"]], [cfg["ref_max"]]])
    score = scaler.transform([[clipped]])[0][0]
    return round(float(100 - score if cfg["invert"] else score), 2)


def risk_level(score: float) -> str:
    if score < 25:   return "LOW"
    elif score < 50: return "MODERATE"
    elif score < 75: return "HIGH"
    else:            return "CRITICAL"


def risk_label_str(score: float) -> str:
    return {"LOW": "Low Risk", "MODERATE": "Moderate Risk",
            "HIGH": "High Risk", "CRITICAL": "Critical Risk"}[risk_level(score)]


def interpret(field: str, raw: float, score: float) -> str:
    good = risk_level(score) in ["LOW", "MODERATE"]
    msgs = {
        "gdp_growth_rate":             f"GDP growth of {raw:.1f}% signals {'strong' if good else 'weak'} economic momentum.",
        "inflation_rate":              f"Inflation at {raw:.1f}% is {'manageable' if good else 'elevated, pressuring purchasing power'}.",
        "unemployment_rate":           f"Unemployment at {raw:.1f}% reflects a {'stable' if good else 'stressed'} labour market.",
        "trade_balance_usd":           f"Trade balance of ${raw:.1f}B indicates {'a healthy position' if good else 'a significant deficit risk'}.",
        "export_growth_rate":          f"Export growth of {raw:.1f}% {'supports' if good else 'undermines'} trade competitiveness.",
        "import_dependency_ratio":     f"Import dependency at {raw:.1f}% of GDP {'is manageable' if good else 'creates supply chain vulnerability'}.",
        "debt_to_gdp_ratio":           f"Debt-to-GDP of {raw:.1f}% is {'sustainable' if good else 'a fiscal stress indicator'}.",
        "foreign_reserves_months":     f"{raw:.1f} months of import cover {'provides adequate buffer' if good else 'is insufficient for external shocks'}.",
        "fx_volatility_index":         f"FX volatility index of {raw:.1f} indicates {'stable' if good else 'unstable'} currency conditions.",
        "current_account_balance_pct": f"Current account at {raw:.1f}% of GDP is {'favourable' if good else 'a balance-of-payments risk'}.",
    }
    return msgs.get(field, f"Score: {score:.1f}/100")


def run_scoring(country_code: str, country_name: str, indicators: MacroIndicators):
    breakdown = []
    dim_scores = {d: [] for d in DIMENSION_WEIGHTS}
    used = missing = 0

    for cfg in INDICATOR_CONFIG:
        raw = getattr(indicators, cfg["field"], None)
        if raw is None:
            missing += 1
            norm = 50.0
            interp = f"{cfg['label']}: data unavailable - neutral score (50) applied."
        else:
            used += 1
            norm = normalize(raw, cfg)
            interp = interpret(cfg["field"], raw, norm)

        breakdown.append({
            "indicator":             cfg["label"],
            "dimension":             cfg["dimension"],
            "raw_value":             raw,
            "normalized_score":      norm,
            "weight":                cfg["weight"],
            "weighted_contribution": round(norm * cfg["weight"], 4),
            "risk_level":            risk_level(norm),
            "interpretation":        interp,
        })
        dim_scores[cfg["dimension"]].append((norm, cfg["weight"]))

    def wavg(pairs):
        tw = sum(w for _, w in pairs)
        return round(sum(s * w for s, w in pairs) / tw, 2) if tw else 50.0

    eco = wavg(dim_scores["economic_stability"])
    trd = wavg(dim_scores["trade_stability"])
    fis = wavg(dim_scores["fiscal_health"])
    mkt = wavg(dim_scores["market_volatility"])

    aggregate = max(1.0, min(100.0, round(
        eco * DIMENSION_WEIGHTS["economic_stability"] +
        trd * DIMENSION_WEIGHTS["trade_stability"] +
        fis * DIMENSION_WEIGHTS["fiscal_health"] +
        mkt * DIMENSION_WEIGHTS["market_volatility"], 2
    )))

    total = used + missing
    confidence = "HIGH" if used/total >= 0.8 else "MEDIUM" if used/total >= 0.5 else "LOW"

    return {
        "country_code":             country_code,
        "country_name":             country_name,
        "aggregate_risk_score":     aggregate,
        "risk_category":            risk_level(aggregate),
        "risk_label":               risk_label_str(aggregate),
        "economic_stability_score": eco,
        "trade_stability_score":    trd,
        "fiscal_health_score":      fis,
        "market_volatility_score":  mkt,
        "indicator_breakdown":      breakdown,
        "indicators_used":          used,
        "indicators_missing":       missing,
        "confidence":               confidence,
        "model_version":            "risk-scorer-v1.0.0",
        "computed_at":              datetime.now(timezone.utc).isoformat(),
    }


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/")
def health():
    return {"service": "TradeAI ML Layer", "status": "running", "version": "1.0.0"}


# ── FR8: Single Country Risk Score ────────────────────────────────────────────
@app.post("/api/risk-score")
async def risk_score(payload: RiskScoreRequest):
    """FR8 - Compute aggregate country risk score (1-100). Higher = more risky."""
    try:
        return run_scoring(payload.country_code.upper(), payload.country_name, payload.indicators)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── FR8: Batch Scoring (for Comparative Tool FR4) ─────────────────────────────
@app.post("/api/risk-score/batch")
async def risk_score_batch(payloads: list[RiskScoreRequest]):
    """Batch score up to 20 countries - used by Comparative Intelligence Tool (FR4)."""
    if len(payloads) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 countries per batch.")
    results = []
    for p in payloads:
        try:
            results.append(run_scoring(p.country_code.upper(), p.country_name, p.indicators))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error on {p.country_code}: {e}")
    return results


# ── FR9: Risk Interpretability Panel ─────────────────────────────────────────
@app.post("/api/risk/{country_code}/breakdown")
async def risk_breakdown(country_code: str, payload: RiskScoreRequest):
    """
    FR9 - Risk Interpretability Panel.
    Returns full per-indicator breakdown explaining exactly what drives the aggregate score.
    Endpoint per teammate spec: POST /api/risk/:country_code/breakdown
    """
    if country_code.upper() != payload.country_code.upper():
        raise HTTPException(status_code=400, detail="country_code in URL must match body.")
    try:
        result = run_scoring(country_code.upper(), payload.country_name, payload.indicators)
        return {
            "country_code":         result["country_code"],
            "country_name":         result["country_name"],
            "aggregate_risk_score": result["aggregate_risk_score"],
            "risk_label":           result["risk_label"],
            "confidence":           result["confidence"],
            "dimension_scores": {
                "economic_stability": result["economic_stability_score"],
                "trade_stability":    result["trade_stability_score"],
                "fiscal_health":      result["fiscal_health_score"],
                "market_volatility":  result["market_volatility_score"],
            },
            "dimension_weights":    DIMENSION_WEIGHTS,
            "indicator_breakdown":  result["indicator_breakdown"],
            "computed_at":          result["computed_at"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/forecast/trade-volume")
async def forecast_trade_volume(body: VolumeForecastRequest):
    """F7 — lag-1 linear regression on monthly total volumes; naive fallback if short series."""
    v = [float(x) for x in body.values if x is not None and np.isfinite(float(x))]
    if len(v) < 1:
        raise HTTPException(status_code=400, detail="No valid volume values")
    h = body.horizon
    if len(v) < 4:
        last = max(0.0, v[-1])
        fc = [{"step": i + 1, "value": round(last, 2)} for i in range(h)]
        return {
            "method": "naive_last",
            "historical_values": v,
            "forecast": fc,
            "note": "Series too short for regression; repeated last observation.",
        }
    X = np.array([[v[i]] for i in range(len(v) - 1)])
    y = np.array(v[1:])
    model = LinearRegression().fit(X, y)
    preds = []
    cur = v[-1]
    for step in range(h):
        nxt = float(model.predict([[cur]])[0])
        nxt = max(0.0, nxt)
        preds.append({"step": step + 1, "value": round(nxt, 2)})
        cur = nxt
    return {
        "method": "lag1_linear_regression",
        "historical_values": v,
        "forecast": preds,
        "model_version": "f7-volume-v1",
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }
@app.post("/api/forecast/price-volatility")
async def forecast_price_volatility(body: PriceVolatilityRequest):
    """F7 — log-return volatility from commodity price history (proxy, not FX)."""
    p = np.array([float(x) for x in body.prices], dtype=float)
    if np.any(p <= 0):
        raise HTTPException(status_code=400, detail="All prices must be positive")
    log_ret = np.diff(np.log(p))
    log_ret = log_ret[np.isfinite(log_ret)]
    if len(log_ret) < 2:
        raise HTTPException(status_code=400, detail="Not enough valid returns")
    overall = float(np.std(log_ret, ddof=1))
    w = min(6, len(log_ret))
    rolling = []
    for i in range(w - 1, len(log_ret)):
        seg = log_ret[i - w + 1 : i + 1]
        rolling.append(
            {"end_index": int(i), "volatility": round(float(np.std(seg, ddof=1)), 6)}
        )
    return {
        "log_return_sample_std": round(overall, 6),
        "observations": len(p),
        "return_count": len(log_ret),
        "rolling_window": w,
        "rolling_volatility": rolling,
        "note": "Commodity price volatility proxy from priceHistory (not FX).",
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }