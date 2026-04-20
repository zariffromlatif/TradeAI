/**
 * TradeAI - RiskScorePanel.jsx
 *
 * FR8: Automated Risk Scoring UI
 * FR9: Risk Interpretability Panel
 *
 * Tech: React + Tailwind + Recharts
 */

import { useState } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  Legend,
} from "recharts";
import { ANALYTICS_API_BASE_URL } from "../config/api";

const API_BASE = ANALYTICS_API_BASE_URL;

// ── Helpers ──────────────────────────────────────────────────────────────────

const RISK_COLORS = {
  LOW: {
    bg: "bg-[#141b27]",
    border: "border-[#8ab4ff]",
    text: "text-[#8ab4ff]",
    bar: "#8ab4ff",
  },
  MODERATE: {
    bg: "bg-[#161616]",
    border: "border-[#3a3a3a]",
    text: "text-neutral-300",
    bar: "#c7c7c7",
  },
  HIGH: {
    bg: "bg-[#1a1a1a]",
    border: "border-[#4a4a4a]",
    text: "text-neutral-200",
    bar: "#9fa6b2",
  },
  CRITICAL: {
    bg: "bg-[#1d1d1d]",
    border: "border-[#5a5a5a]",
    text: "text-neutral-100",
    bar: "#7a7a7a",
  },
};

function ScoreBadge({ category, label, score }) {
  const c = RISK_COLORS[category] || RISK_COLORS.MODERATE;
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold ${c.bg} ${c.border} ${c.text}`}
    >
      <span>{score.toFixed(1)}/100</span>
      <span className="opacity-60">|</span>
      <span>{label}</span>
    </div>
  );
}

function GaugeScore({ score, category }) {
  const c = RISK_COLORS[category] || RISK_COLORS.MODERATE;
  const radius = 80;
  const circumference = Math.PI * radius; // half circle
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="110" viewBox="0 0 200 110">
        {/* Background arc */}
        <path
          d={`M 10 100 A ${radius} ${radius} 0 0 1 190 100`}
          fill="none"
          stroke="#374151"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={`M 10 100 A ${radius} ${radius} 0 0 1 190 100`}
          fill="none"
          stroke={c.bar}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
        />
        {/* Score text */}
        <text
          x="100"
          y="90"
          textAnchor="middle"
          fill="white"
          fontSize="28"
          fontWeight="bold"
        >
          {score.toFixed(1)}
        </text>
        <text x="100" y="108" textAnchor="middle" fill="#9CA3AF" fontSize="11">
          Risk Score
        </text>
      </svg>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const DEFAULT_INDICATORS = {
  gdp_growth_rate: "",
  inflation_rate: "",
  unemployment_rate: "",
  trade_balance_usd: "",
  export_growth_rate: "",
  import_dependency_ratio: "",
  debt_to_gdp_ratio: "",
  foreign_reserves_months: "",
  fx_volatility_index: "",
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

export default function RiskScorePanel() {
  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview"); // overview | breakdown | radar

  const handleIndicatorChange = (field, value) => {
    setIndicators((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!countryCode || !countryName) {
      setError("Country code and name are required.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    // Build indicators — only include non-empty fields
    const cleanedIndicators = {};
    Object.entries(indicators).forEach(([key, val]) => {
      if (val !== "") cleanedIndicators[key] = parseFloat(val);
    });

    try {
      const res = await fetch(`${API_BASE}/risk-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country_code: countryCode.toUpperCase(),
          country_name: countryName,
          indicators: cleanedIndicators,
        }),
      });
      const data = await res.json();
      console.log("API response:", data);
      if (!res.ok) {
        throw new Error(data.detail || "Request failed");
      }
      setResult(data);
      setActiveTab("overview");
    } catch (err) {
      setError(err.message || "Failed to compute risk score.");
    } finally {
      setLoading(false);
    }
  };

  // Prepare Recharts data
  const radarData = result
    ? [
        { dim: "Economic", score: result.economic_stability_score },
        { dim: "Trade", score: result.trade_stability_score },
        { dim: "Fiscal", score: result.fiscal_health_score },
        { dim: "Market", score: result.market_volatility_score },
      ]
    : [];

  const barData = result
    ? result.indicator_breakdown.map((b) => ({
        name:
          b.indicator.length > 22
            ? b.indicator.slice(0, 22) + "…"
            : b.indicator,
        score: b.normalized_score,
        category: b.risk_level,
      }))
    : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="text-xs text-neutral-500 uppercase tracking-widest mb-1">
            Automated risk analysis
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">
            Country Risk <span className="text-[#8ab4ff]">Scoring</span>
          </h1>
          <p className="text-neutral-400 text-sm mt-1">
            Automated aggregate risk score using macroeconomic indicators via
            WorldBank + ExchangeRate APIs.
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-4 uppercase tracking-wider">
            Country Inputs
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">
                Country Code (ISO-3)
              </label>
              <input
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                placeholder="e.g. BGD"
                maxLength={3}
                className="w-full bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 text-sm focus:outline-none focus:border-[#8ab4ff]"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">
                Country Name
              </label>
              <input
                value={countryName}
                onChange={(e) => setCountryName(e.target.value)}
                placeholder="e.g. Bangladesh"
                className="w-full bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 text-sm focus:outline-none focus:border-[#8ab4ff]"
              />
            </div>
          </div>

          <p className="text-xs text-neutral-500 mb-3">
            Macroeconomic indicators — leave blank to auto-fetch from WorldBank
            API.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(INDICATOR_LABELS).map(([field, label]) => (
              <div key={field}>
                <label className="text-xs text-neutral-500 mb-1 block">
                  {label}
                </label>
                <input
                  type="number"
                  value={indicators[field]}
                  onChange={(e) => handleIndicatorChange(field, e.target.value)}
                  placeholder="auto"
                  className="w-full bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 text-sm focus:outline-none focus:border-[#8ab4ff]"
                />
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-2 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-ui btn-primary mt-5 w-full py-3 font-semibold"
          >
            {loading ? "Computing Risk Score…" : "Compute Risk Score"}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Score Summary Card */}
            <div
              className={`rounded-xl border p-6 ${RISK_COLORS[result.risk_category]?.bg} ${RISK_COLORS[result.risk_category]?.border}`}
            >
              <div className="flex flex-col md:flex-row items-center gap-6">
                <GaugeScore
                  score={result.aggregate_risk_score}
                  category={result.risk_category}
                />
                <div className="flex-1">
                  <div className="text-2xl font-semibold text-neutral-100 mb-1">
                    {result.country_name}
                    <span className="text-neutral-500 text-sm ml-2">
                      ({result.country_code})
                    </span>
                  </div>
                  <ScoreBadge
                    category={result.risk_category}
                    label={result.risk_label}
                    score={result.aggregate_risk_score}
                  />
                  <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    {[
                      {
                        label: "Economic Stability",
                        val: result.economic_stability_score,
                      },
                      {
                        label: "Trade Stability",
                        val: result.trade_stability_score,
                      },
                      {
                        label: "Fiscal Health",
                        val: result.fiscal_health_score,
                      },
                      {
                        label: "Market Volatility",
                        val: result.market_volatility_score,
                      },
                    ].map(({ label, val }) => (
                      <div
                        key={label}
                        className="bg-[#171717] rounded-xl px-3 py-2 border border-[#2a2a2a]"
                      >
                        <div className="text-neutral-400 text-xs">{label}</div>
                        <div className="text-neutral-100 font-semibold">
                          {val.toFixed(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-neutral-500">
                    Confidence:{" "}
                    <span className="text-neutral-300">{result.confidence}</span> ·
                    Indicators Used:{" "}
                    <span className="text-neutral-300">
                      {result.indicators_used}/
                      {result.indicators_used + result.indicators_missing}
                    </span>{" "}
                    · Model:{" "}
                    <span className="text-neutral-300">
                      {result.model_version}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-[#2a2a2a] pb-2">
              {["overview", "breakdown", "radar"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`btn-ui capitalize ${
                    activeTab === tab
                      ? "bg-[#8ab4ff] text-black"
                      : "text-neutral-400 hover:text-neutral-100"
                  }`}
                >
                  {tab === "overview"
                    ? "Dimension Overview"
                    : tab === "breakdown"
                      ? "Indicator Breakdown"
                      : "Radar Chart"}
                </button>
              ))}
            </div>

            {/* Tab: Dimension Radar */}
            {activeTab === "radar" && (
              <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6">
                <h3 className="text-sm text-neutral-400 mb-4 uppercase tracking-wider">
                  Risk Dimension Radar
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#2a2a2a" />
                    <PolarAngleAxis
                      dataKey="dim"
                      tick={{ fill: "#a3a3a3", fontSize: 12 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: "#737373", fontSize: 10 }}
                    />
                    <Radar
                      name="Risk"
                      dataKey="score"
                      stroke="#8ab4ff"
                      fill="#8ab4ff"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tab: Dimension Overview bars */}
            {activeTab === "overview" && (
              <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6">
                <h3 className="text-sm text-neutral-400 mb-4 uppercase tracking-wider">
                  Dimension Risk Scores
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={radarData} layout="vertical">
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fill: "#a3a3a3", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="dim"
                      width={120}
                      tick={{ fill: "#a3a3a3", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111111",
                        border: "1px solid #2a2a2a",
                        borderRadius: 8,
                        color: "#f5f5f5",
                      }}
                      labelStyle={{ color: "#e5e5e5", fontWeight: 600 }}
                      itemStyle={{ color: "#f5f5f5" }}
                    />
                    <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                      {radarData.map((entry, index) => {
                        const score = entry.score;
                        const color =
                          score < 25
                            ? "#8ab4ff"
                            : score < 50
                              ? "#d4d4d4"
                              : score < 75
                                ? "#a3a3a3"
                                : "#737373";
                        return <Cell key={index} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === "breakdown" && (
              <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6">
                <h3 className="text-sm text-neutral-400 mb-1 uppercase tracking-wider">
                  Risk Interpretability Panel
                </h3>
                <p className="text-xs text-neutral-600 mb-4">
                  Per-indicator breakdown with scoring rationale.
                </p>
                <div className="space-y-3">
                  {result.indicator_breakdown.map((b) => {
                    const c = RISK_COLORS[b.risk_level] || RISK_COLORS.MODERATE;
                    return (
                      <div
                        key={b.indicator}
                        className={`rounded-lg border p-4 ${c.bg} ${c.border}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-neutral-100">
                            {b.indicator}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${c.text}`}>
                              {b.risk_level}
                            </span>
                            <span className="text-sm font-bold text-neutral-100">
                              {b.normalized_score.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        {/* Score bar */}
                        <div className="h-1.5 bg-[#2a2a2a] rounded-full mb-2">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${b.normalized_score}%`,
                              background: c.bar,
                            }}
                          />
                        </div>
                        <p className="text-xs text-neutral-400">
                          {b.interpretation}
                        </p>
                        <div className="mt-1 text-xs text-neutral-600">
                          Raw: {b.raw_value !== null ? b.raw_value : "N/A"} ·
                          Weight: {(b.weight * 100).toFixed(0)}% · Contribution:{" "}
                          {b.weighted_contribution.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
