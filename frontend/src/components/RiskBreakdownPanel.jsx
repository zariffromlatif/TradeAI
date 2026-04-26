/**
 * TradeAI - RiskBreakdownPanel.jsx (Updated with Commodity Support)
 * FR9: Risk Interpretability Panel — now commodity-aware
 */

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  Cell, ResponsiveContainer, LabelList,
} from "recharts";
import { ANALYTICS_API_BASE_URL, API_BASE_URL } from "../config/api";

const API_BASE = ANALYTICS_API_BASE_URL;

const RISK_COLORS = {
  LOW:      { bg: "bg-[#141b27]", border: "border-[#8ab4ff]", text: "text-[#8ab4ff]",   hex: "#8ab4ff",  badge: "bg-[#8ab4ff]/20 text-[#c9dcff]" },
  MODERATE: { bg: "bg-[#161616]", border: "border-[#3a3a3a]", text: "text-neutral-300", hex: "#d4d4d4",  badge: "bg-[#2a2a2a] text-neutral-300" },
  HIGH:     { bg: "bg-[#1a1a1a]", border: "border-[#4a4a4a]", text: "text-neutral-200", hex: "#a3a3a3",  badge: "bg-[#323232] text-neutral-200" },
  CRITICAL: { bg: "bg-[#1d1d1d]", border: "border-[#5a5a5a]", text: "text-neutral-100", hex: "#737373",  badge: "bg-[#3c3c3c] text-neutral-100" },
};

const DIMENSION_LABELS = {
  economic_stability: "Economic Stability",
  trade_stability:    "Trade Stability",
  fiscal_health:      "Fiscal Health",
  market_volatility:  "Market Volatility",
};

const DIMENSION_WEIGHTS_DISPLAY = {
  economic_stability: 35,
  trade_stability:    30,
  fiscal_health:      20,
  market_volatility:  15,
};

function generateWhyLabel(indicator, rawValue, normalizedScore, riskLevel) {
  const impact     = (normalizedScore * 0.1).toFixed(1);
  const direction  = riskLevel === "LOW" || riskLevel === "MODERATE" ? "▼" : "▲";
  const color      = riskLevel === "LOW" || riskLevel === "MODERATE" ? "text-[#8ab4ff]" : "text-neutral-300";
  const shortNames = {
    "GDP Growth Rate (%)":              "Low GDP Growth",
    "Inflation Rate (%)":               "High Inflation",
    "Unemployment Rate (%)":            "High Unemployment",
    "Trade Balance (USD Billions)":     "Trade Deficit",
    "Export Growth Rate (%)":           "Weak Exports",
    "Import Dependency (% of GDP)":     "Import Dependency",
    "Debt-to-GDP Ratio (%)":            "High Debt",
    "Foreign Reserves (Months of Cover)": "Low Reserves",
    "FX Volatility Index (0-100)":      "FX Instability",
    "Current Account Balance (% GDP)":  "Current Account Gap",
  };
  return { label: `${shortNames[indicator] || indicator}: ${direction} ${impact} pts`, color };
}

function RiskBadge({ level }) {
  const c = RISK_COLORS[level] || RISK_COLORS.MODERATE;
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{level}</span>;
}

function ScoreBar({ score, level }) {
  const c = RISK_COLORS[level] || RISK_COLORS.MODERATE;
  return (
    <div className="w-full bg-[#2a2a2a] rounded-full h-2 mt-1">
      <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${score}%`, background: c.hex }} />
    </div>
  );
}

function DimensionCard({ label, score, weight, level }) {
  const c = RISK_COLORS[level] || RISK_COLORS.MODERATE;
  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-neutral-400 font-medium">{label}</span>
        <span className="text-xs text-neutral-500">{weight}% weight</span>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-2xl font-bold ${c.text}`}>{score.toFixed(1)}</span>
        <RiskBadge level={level} />
      </div>
      <ScoreBar score={score} level={level} />
    </div>
  );
}

function IndicatorRow({ item, index }) {
  const [expanded, setExpanded] = useState(false);
  const c = RISK_COLORS[item.risk_level] || RISK_COLORS.MODERATE;
  const { label, color } = generateWhyLabel(item.indicator, item.raw_value, item.normalized_score, item.risk_level);
  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} cursor-pointer transition-all duration-200`}
      onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-3 p-3">
        <span className="text-xs text-neutral-600 w-5 text-center font-mono">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-neutral-100 truncate">{item.indicator}</span>
            <RiskBadge level={item.risk_level} />
          </div>
          <span className={`text-xs font-semibold ${color}`}>{label}</span>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-lg font-bold ${c.text}`}>{item.normalized_score.toFixed(1)}</div>
          <div className="text-xs text-neutral-600">/100</div>
        </div>
        <span className="text-neutral-600 text-xs ml-1">{expanded ? "▲" : "▼"}</span>
      </div>
      <div className="px-3 pb-2">
        <ScoreBar score={item.normalized_score} level={item.risk_level} />
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[#2a2a2a] space-y-2">
          <p className="text-xs text-neutral-300 leading-relaxed">{item.interpretation}</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-[#171717] rounded p-2 border border-[#2a2a2a]">
              <div className="text-neutral-500">Raw Value</div>
              <div className="text-neutral-100 font-semibold">{item.raw_value !== null ? item.raw_value : "N/A"}</div>
            </div>
            <div className="bg-[#171717] rounded p-2 border border-[#2a2a2a]">
              <div className="text-neutral-500">Weight</div>
              <div className="text-neutral-100 font-semibold">{(item.weight * 100).toFixed(0)}%</div>
            </div>
            <div className="bg-[#171717] rounded p-2 border border-[#2a2a2a]">
              <div className="text-neutral-500">Contribution</div>
              <div className={`font-semibold ${c.text}`}>+{item.weighted_contribution.toFixed(2)}</div>
            </div>
          </div>
          <div className="text-xs text-neutral-500">
            Dimension: <span className="text-neutral-400">{DIMENSION_LABELS[item.dimension] || item.dimension}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_INDICATORS = {
  gdp_growth_rate: "", inflation_rate: "", unemployment_rate: "",
  trade_balance_usd: "", export_growth_rate: "", import_dependency_ratio: "",
  debt_to_gdp_ratio: "", foreign_reserves_months: "", fx_volatility_index: "",
  current_account_balance_pct: "",
};

const INDICATOR_LABELS = {
  gdp_growth_rate: "GDP Growth Rate (%)",
  inflation_rate: "Inflation Rate (%)",
  unemployment_rate: "Unemployment Rate (%)",
  trade_balance_usd: "Trade Balance (USD Billions)",
  export_growth_rate: "Export Growth Rate (%)",
  import_dependency_ratio: "Import Dependency (% of GDP)",
  debt_to_gdp_ratio: "Debt-to-GDP Ratio (%)",
  foreign_reserves_months: "Foreign Reserves (Months)",
  fx_volatility_index: "FX Volatility Index (0–100)",
  current_account_balance_pct: "Current Account (% of GDP)",
};

export default function RiskBreakdownPanel() {
  const [countries, setCountries]     = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");
  const [countryId, setCountryId]     = useState("");
  const [commodityId, setCommodityId] = useState("");
  const [indicators, setIndicators]   = useState(DEFAULT_INDICATORS);
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [sortBy, setSortBy]           = useState("score");
  const [activeTab, setActiveTab]     = useState("indicators");

  useEffect(() => {
    fetch(`${API_BASE_URL}/countries`)
      .then((r) => r.json())
      .then((data) => setCountries(data.filter((c) => c.code !== "WLD" && !c.name.toLowerCase().includes("world"))))
      .catch(() => {});

    fetch(`${API_BASE_URL}/commodities`)
      .then((r) => r.json())
      .then((data) => setCommodities(data.filter((c) => !c.name.toLowerCase().includes("total"))))
      .catch(() => {});
  }, []);

  const handleCountrySelect = (e) => {
    const code = e.target.value;
    if (!code) { setCountryCode(""); setCountryName(""); setCountryId(""); return; }
    const obj = countries.find((c) => c.code === code);
    if (obj) { setCountryCode(obj.code); setCountryName(obj.name); setCountryId(obj._id || ""); }
  };

  const handleChange = (field, val) => setIndicators((prev) => ({ ...prev, [field]: val }));

  const handleSubmit = async () => {
    if (!countryCode || !countryName) { setError("Country code and name are required."); return; }
    setLoading(true); setError(null); setResult(null);

    const cleaned = {};
    Object.entries(indicators).forEach(([k, v]) => { if (v !== "") cleaned[k] = parseFloat(v); });

    try {
      let res;

      // If no indicators are filled in, read from database using GET endpoints
      if (Object.keys(cleaned).length === 0) {

        // If commodity is selected, use commodity risk endpoint
        if (commodityId) {
          console.log(`📍 Calling commodity risk endpoint for breakdown: ${countryCode} + ${commodityId}`);
          res = await fetch(`${API_BASE}/commodity-risk/${countryCode.toUpperCase()}/${commodityId}`);
        } else {
          // No commodity, just get country risk
          console.log(`📍 Calling country risk endpoint for breakdown: ${countryCode}`);
          res = await fetch(`${API_BASE}/risk/${countryCode.toUpperCase()}`);
        }
      } else {
        // User filled in custom indicators, use POST endpoint
        console.log("📍 Using custom indicators via POST endpoint for breakdown");
        res = await fetch(`${API_BASE}/risk/${countryCode.toUpperCase()}/breakdown`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            country_code: countryCode.toUpperCase(),
            country_name: countryName,
            indicators: cleaned,
            ...(commodityId && { commodityId }),
            ...(countryId   && { countryId }),
          }),
        });
      }

      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || e.message || "Request failed"); }
      const data = await res.json();
      console.log("📊 API Response from breakdown endpoint:", data);
      console.log("🔍 dimension_scores:", data.dimension_scores);
      console.log("🔍 indicator_breakdown:", data.indicator_breakdown);
      setResult(data);
      setActiveTab("indicators");
    } catch (err) {
      setError(err.message || "Failed to fetch breakdown.");
    } finally {
      setLoading(false);
    }
  };

  const sortedBreakdown = result
    ? [...result.indicator_breakdown].sort((a, b) =>
        sortBy === "score" ? b.normalized_score - a.normalized_score : a.dimension.localeCompare(b.dimension))
    : [];

  const chartData = result
    ? [...result.indicator_breakdown]
        .sort((a, b) => b.weighted_contribution - a.weighted_contribution).slice(0, 8)
        .map((b) => ({ name: b.indicator.split(" ").slice(0, 2).join(" "), contribution: parseFloat(b.weighted_contribution.toFixed(2)), level: b.risk_level }))
    : [];

  const dimensionData = result
    ? Object.entries(result.dimension_scores || result.dimension || {}).map(([key, score]) => ({
        key, label: DIMENSION_LABELS[key], score,
        weight: DIMENSION_WEIGHTS_DISPLAY[key],
        level: score < 25 ? "LOW" : score < 50 ? "MODERATE" : score < 75 ? "HIGH" : "CRITICAL",
      }))
    : [];

  const aggregateLevel = result
    ? result.aggregate_risk_score < 25 ? "LOW" : result.aggregate_risk_score < 50 ? "MODERATE"
      : result.aggregate_risk_score < 75 ? "HIGH" : "CRITICAL"
    : "MODERATE";

  const commodityCtx  = result?.commodity_context;
  const hasAdjustment = commodityCtx?.is_commodity_adjusted && commodityCtx?.adjustment;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Indicator breakdown</div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Risk <span className="text-[#8ab4ff]">Interpretability</span> Panel
          </h1>
          <p className="text-neutral-400 text-sm mt-1">
            Transparent breakdown of why a country received its risk score. Select a commodity for adjusted scoring.
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-4 uppercase tracking-wider">Country Inputs</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">Country Code (ISO)</label>
              <select value={countryCode} onChange={handleCountrySelect}
                className="w-full bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 text-sm focus:outline-none focus:border-[#8ab4ff]">
                <option value="">Select Code...</option>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">Country Name</label>
              <select value={countryCode} onChange={handleCountrySelect}
                className="w-full bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 text-sm focus:outline-none focus:border-[#8ab4ff]">
                <option value="">Select Country...</option>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>

            {/* NEW: Commodity dropdown */}
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">
                Commodity <span className="text-[#8ab4ff]">(optional)</span>
              </label>
              <select value={commodityId} onChange={(e) => setCommodityId(e.target.value)}
                className="w-full bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 text-sm focus:outline-none focus:border-[#8ab4ff]">
                <option value="">None — base score only</option>
                {commodities.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <p className="text-xs text-neutral-500 mb-3">Enter indicators manually or leave blank to use stored values.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(INDICATOR_LABELS).map(([field, label]) => (
              <div key={field}>
                <label className="text-xs text-neutral-500 mb-1 block">{label}</label>
                <input type="number" value={indicators[field]} onChange={(e) => handleChange(field, e.target.value)} placeholder="auto"
                  className="w-full bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 text-sm focus:outline-none focus:border-[#8ab4ff]" />
              </div>
            ))}
          </div>

          {error && <div className="mt-4 bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-2 text-red-300 text-sm">{error}</div>}

          <button onClick={handleSubmit} disabled={loading} className="btn-ui btn-primary mt-5 w-full py-3 font-semibold">
            {loading ? "Analyzing Risk Factors…" : "Generate Breakdown"}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-5">

            {/* Summary Banner */}
            <div className={`rounded-xl border p-5 ${RISK_COLORS[aggregateLevel].bg} ${RISK_COLORS[aggregateLevel].border}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold text-neutral-100">
                    {result.country_name}
                    <span className="text-neutral-500 text-sm ml-2">({result.country_code})</span>
                    {commodityCtx?.commodity_name && (
                      <span className="ml-2 text-xs bg-[#8ab4ff]/20 text-[#8ab4ff] px-2 py-0.5 rounded-full">
                        {commodityCtx.commodity_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-4xl font-black ${RISK_COLORS[aggregateLevel].text}`}>
                      {result.aggregate_risk_score.toFixed(1)}
                    </span>
                    <div>
                      <div className="text-xs text-neutral-500">Aggregate Risk Score</div>
                      <RiskBadge level={aggregateLevel} />
                    </div>
                    {/* Show base vs adjusted */}
                    {hasAdjustment && result.base_risk_score !== result.aggregate_risk_score && (
                      <div className="text-xs text-neutral-500 ml-2">
                        Base: <span className="text-neutral-300">{result.base_risk_score?.toFixed(1)}</span>
                        <span className={`ml-1 font-semibold ${commodityCtx.adjustment.total_adjustment > 0 ? "text-orange-400" : "text-emerald-400"}`}>
                          ({commodityCtx.adjustment.total_adjustment > 0 ? "+" : ""}{commodityCtx.adjustment.total_adjustment.toFixed(1)})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-neutral-500 space-y-1">
                  <div>Confidence: <span className="text-neutral-300 font-semibold">{result.confidence}</span></div>
                  <div>Computed: <span className="text-neutral-300">{new Date(result.computed_at).toLocaleTimeString()}</span></div>
                </div>
              </div>
            </div>

            {/* Commodity Adjustment Signals */}
            {hasAdjustment && commodityCtx.adjustment.signals_applied?.length > 0 && (
              <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5">
                <h3 className="text-sm text-neutral-400 uppercase tracking-wider mb-3">
                  Commodity Signals — {commodityCtx.commodity_name}
                </h3>
                <div className="space-y-2">
                  {commodityCtx.adjustment.signals_applied.map((sig, i) => (
                    <div key={i} className="flex items-start gap-3 bg-[#171717] border border-[#2a2a2a] rounded-xl px-4 py-3">
                      <span className={`text-sm font-bold flex-shrink-0 ${parseFloat(sig.adjustment) > 0 ? "text-orange-400" : "text-emerald-400"}`}>
                        {sig.adjustment} pts
                      </span>
                      <div>
                        <div className="text-xs text-neutral-400 font-semibold">{sig.signal}: {sig.value}</div>
                        <div className="text-xs text-neutral-500">{sig.reason}</div>
                      </div>
                    </div>
                  ))}
                  <div className="text-xs text-neutral-600 pt-1">
                    Total commodity adjustment: <span className={commodityCtx.adjustment.total_adjustment > 0 ? "text-orange-400" : "text-emerald-400"}>
                      {commodityCtx.adjustment.total_adjustment > 0 ? "+" : ""}{commodityCtx.adjustment.total_adjustment.toFixed(1)} pts
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-[#2a2a2a] pb-2">
              {[{ key: "indicators", label: "📋 Indicator Breakdown" }, { key: "dimensions", label: "🧩 Dimensions" }, { key: "chart", label: "📊 Contribution Chart" }]
                .map(({ key, label }) => (
                  <button key={key} onClick={() => setActiveTab(key)}
                    className={`btn-ui transition-colors ${activeTab === key ? "bg-[#8ab4ff] text-black" : "text-neutral-400 hover:text-neutral-100"}`}>
                    {label}
                  </button>
                ))}
            </div>

            {/* Indicator Breakdown */}
            {activeTab === "indicators" && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs text-neutral-500">Sort by:</span>
                  {["score", "dimension"].map((s) => (
                    <button key={s} onClick={() => setSortBy(s)}
                      className={`btn-ui text-xs px-3 py-1 capitalize ${sortBy === s ? "bg-[#8ab4ff] text-black" : "text-neutral-500 hover:text-neutral-300"}`}>
                      {s === "score" ? "Risk Score ↓" : "Dimension"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 mb-3 flex-wrap">
                  {["LOW", "MODERATE", "HIGH", "CRITICAL"].map((l) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: RISK_COLORS[l].hex }} />
                      <span className="text-xs text-neutral-500">{l}</span>
                    </div>
                  ))}
                  <span className="text-xs text-neutral-600 ml-auto">Click any row to expand</span>
                </div>
                <div className="space-y-2">
                  {sortedBreakdown.map((item, i) => <IndicatorRow key={item.indicator} item={item} index={i} />)}
                </div>
              </div>
            )}

            {/* Dimensions */}
            {activeTab === "dimensions" && (
              <div>
                <p className="text-xs text-neutral-500 mb-4">Aggregate score is a weighted combination of 4 risk dimensions.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  {dimensionData.map((d) => <DimensionCard key={d.key} label={d.label} score={d.score} weight={d.weight} level={d.level} />)}
                </div>
                <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5">
                  <h3 className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Dimension Weight Distribution</h3>
                  <div className="space-y-2">
                    {dimensionData.map((d) => (
                      <div key={d.key} className="flex items-center gap-3">
                        <span className="text-xs text-neutral-400 w-36">{d.label}</span>
                        <div className="flex-1 bg-[#2a2a2a] rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${d.weight}%`, background: RISK_COLORS[d.level].hex }} />
                        </div>
                        <span className="text-xs text-neutral-400 w-8 text-right">{d.weight}%</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-neutral-600 mt-3">
                    Formula: Score = (Economic × 35%) + (Trade × 30%) + (Fiscal × 20%) + (Market × 15%)
                  </p>
                </div>
              </div>
            )}

            {/* Chart */}
            {activeTab === "chart" && (
              <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6">
                <h3 className="text-sm text-neutral-400 mb-1 uppercase tracking-wider">Top Risk Contributors</h3>
                <p className="text-xs text-neutral-600 mb-4">Weighted contribution of each indicator to the final score.</p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 40 }}>
                    <XAxis type="number" tick={{ fill: "#a3a3a3", fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#a3a3a3", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#111111", border: "1px solid #2a2a2a", borderRadius: 8 }}
                      labelStyle={{ color: "#f5f5f5" }} formatter={(val) => [`${val} pts`, "Contribution"]} />
                    <Bar dataKey="contribution" radius={[0, 6, 6, 0]}>
                      <LabelList dataKey="contribution" position="right" style={{ fill: "#a3a3a3", fontSize: 11 }} />
                      {chartData.map((entry, index) => {
                        const c = RISK_COLORS[entry.level] || RISK_COLORS.MODERATE;
                        return <Cell key={index} fill={c.hex} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}