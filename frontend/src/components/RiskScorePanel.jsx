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

const API_BASE = "http://localhost:5000/api/analytics";

// ── Helpers ──────────────────────────────────────────────────────────────────

const RISK_COLORS = {
  LOW: {
    bg: "bg-emerald-900/40",
    border: "border-emerald-500",
    text: "text-emerald-400",
    bar: "#34D399",
  },
  MODERATE: {
    bg: "bg-yellow-900/40",
    border: "border-yellow-500",
    text: "text-yellow-400",
    bar: "#FBBF24",
  },
  HIGH: {
    bg: "bg-orange-900/40",
    border: "border-orange-500",
    text: "text-orange-400",
    bar: "#FB923C",
  },
  CRITICAL: {
    bg: "bg-red-900/40",
    border: "border-red-500",
    text: "text-red-400",
    bar: "#F87171",
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
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">
            Module 2 · FR8 + FR9
          </div>
          <h1 className="text-3xl font-bold text-white">
            Country Risk <span className="text-violet-400">Scoring</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Automated aggregate risk score using macroeconomic indicators via
            WorldBank + ExchangeRate APIs.
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
            Country Inputs
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Country Code (ISO-3)
              </label>
              <input
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                placeholder="e.g. BGD"
                maxLength={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Country Name
              </label>
              <input
                value={countryName}
                onChange={(e) => setCountryName(e.target.value)}
                placeholder="e.g. Bangladesh"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-3">
            Macroeconomic indicators — leave blank to auto-fetch from WorldBank
            API.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(INDICATOR_LABELS).map(([field, label]) => (
              <div key={field}>
                <label className="text-xs text-gray-500 mb-1 block">
                  {label}
                </label>
                <input
                  type="number"
                  value={indicators[field]}
                  onChange={(e) => handleIndicatorChange(field, e.target.value)}
                  placeholder="auto"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 bg-red-900/30 border border-red-700 rounded-lg px-4 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-5 w-full bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
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
                  <div className="text-2xl font-bold text-white mb-1">
                    {result.country_name}
                    <span className="text-gray-500 text-sm ml-2">
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
                        className="bg-black/20 rounded-lg px-3 py-2"
                      >
                        <div className="text-gray-400 text-xs">{label}</div>
                        <div className="text-white font-semibold">
                          {val.toFixed(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    Confidence:{" "}
                    <span className="text-gray-300">{result.confidence}</span> ·
                    Indicators Used:{" "}
                    <span className="text-gray-300">
                      {result.indicators_used}/
                      {result.indicators_used + result.indicators_missing}
                    </span>{" "}
                    · Model:{" "}
                    <span className="text-gray-300">
                      {result.model_version}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-800 pb-2">
              {["overview", "breakdown", "radar"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-sm px-4 py-1.5 rounded-lg capitalize transition-colors ${
                    activeTab === tab
                      ? "bg-violet-600 text-white"
                      : "text-gray-400 hover:text-white"
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
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm text-gray-400 mb-4 uppercase tracking-wider">
                  Risk Dimension Radar
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#374151" />
                    <PolarAngleAxis
                      dataKey="dim"
                      tick={{ fill: "#9CA3AF", fontSize: 12 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: "#6B7280", fontSize: 10 }}
                    />
                    <Radar
                      name="Risk"
                      dataKey="score"
                      stroke="#A78BFA"
                      fill="#A78BFA"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tab: Dimension Overview bars */}
            {activeTab === "overview" && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm text-gray-400 mb-4 uppercase tracking-wider">
                  Dimension Risk Scores
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={radarData} layout="vertical">
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fill: "#9CA3AF", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="dim"
                      width={120}
                      tick={{ fill: "#9CA3AF", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#111827",
                        border: "1px solid #374151",
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: "#F9FAFB" }}
                    />
                    <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                      {radarData.map((entry, index) => {
                        const score = entry.score;
                        const color =
                          score < 25
                            ? "#34D399"
                            : score < 50
                              ? "#FBBF24"
                              : score < 75
                                ? "#FB923C"
                                : "#F87171";
                        return <Cell key={index} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tab: Indicator Breakdown (FR9 - Interpretability Panel) */}
            {activeTab === "breakdown" && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm text-gray-400 mb-1 uppercase tracking-wider">
                  Risk Interpretability Panel
                </h3>
                <p className="text-xs text-gray-600 mb-4">
                  FR9 — per-indicator breakdown with scoring rationale.
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
                          <span className="text-sm font-medium text-white">
                            {b.indicator}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${c.text}`}>
                              {b.risk_level}
                            </span>
                            <span className="text-sm font-bold text-white">
                              {b.normalized_score.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        {/* Score bar */}
                        <div className="h-1.5 bg-gray-700 rounded-full mb-2">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${b.normalized_score}%`,
                              background: c.bar,
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-400">
                          {b.interpretation}
                        </p>
                        <div className="mt-1 text-xs text-gray-600">
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
