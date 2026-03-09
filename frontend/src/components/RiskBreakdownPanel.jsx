/**
 * TradeAI - RiskBreakdownPanel.jsx
 * FR9: Risk Interpretability Panel
 *
 * Shows WHY a country got its score:
 * - Per-indicator contribution (e.g. "High Inflation: +20 points")
 * - Dimension weights visualized
 * - Plain-English explanation per indicator
 *
 * Tech: React + Tailwind + Recharts
 * Endpoint: POST /api/risk/{country_code}/breakdown
 */

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
} from "recharts";

const API_BASE = "http://localhost:5000/api/analytics";

// ── Constants ─────────────────────────────────────────────────────────────────

const RISK_COLORS = {
  LOW: {
    bg: "bg-emerald-900/30",
    border: "border-emerald-500",
    text: "text-emerald-400",
    hex: "#34D399",
    badge: "bg-emerald-500/20 text-emerald-300",
  },
  MODERATE: {
    bg: "bg-yellow-900/30",
    border: "border-yellow-500",
    text: "text-yellow-400",
    hex: "#FBBF24",
    badge: "bg-yellow-500/20 text-yellow-300",
  },
  HIGH: {
    bg: "bg-orange-900/30",
    border: "border-orange-500",
    text: "text-orange-400",
    hex: "#FB923C",
    badge: "bg-orange-500/20 text-orange-300",
  },
  CRITICAL: {
    bg: "bg-red-900/30",
    border: "border-red-500",
    text: "text-red-400",
    hex: "#F87171",
    badge: "bg-red-500/20 text-red-300",
  },
};

const DIMENSION_LABELS = {
  economic_stability: "Economic Stability",
  trade_stability: "Trade Stability",
  fiscal_health: "Fiscal Health",
  market_volatility: "Market Volatility",
};

const DIMENSION_WEIGHTS_DISPLAY = {
  economic_stability: 35,
  trade_stability: 30,
  fiscal_health: 20,
  market_volatility: 15,
};

// ── Helper: generate "why" explanation ───────────────────────────────────────

function generateWhyLabel(indicator, rawValue, normalizedScore, riskLevel) {
  const impact = (normalizedScore * 0.1).toFixed(1); // rough point contribution
  const direction = riskLevel === "LOW" || riskLevel === "MODERATE" ? "▼" : "▲";
  const color =
    riskLevel === "LOW" || riskLevel === "MODERATE"
      ? "text-emerald-400"
      : "text-red-400";

  const shortNames = {
    "GDP Growth Rate (%)": "Low GDP Growth",
    "Inflation Rate (%)": "High Inflation",
    "Unemployment Rate (%)": "High Unemployment",
    "Trade Balance (USD Billions)": "Trade Deficit",
    "Export Growth Rate (%)": "Weak Exports",
    "Import Dependency (% of GDP)": "Import Dependency",
    "Debt-to-GDP Ratio (%)": "High Debt",
    "Foreign Reserves (Months of Cover)": "Low Reserves",
    "FX Volatility Index (0-100)": "FX Instability",
    "Current Account Balance (% GDP)": "Current Account Gap",
  };

  const name = shortNames[indicator] || indicator;
  return { label: `${name}: ${direction} ${impact} pts`, color };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RiskBadge({ level }) {
  const c = RISK_COLORS[level] || RISK_COLORS.MODERATE;
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
      {level}
    </span>
  );
}

function ScoreBar({ score, level }) {
  const c = RISK_COLORS[level] || RISK_COLORS.MODERATE;
  return (
    <div className="w-full bg-gray-800 rounded-full h-2 mt-1">
      <div
        className="h-2 rounded-full transition-all duration-500"
        style={{ width: `${score}%`, background: c.hex }}
      />
    </div>
  );
}

function DimensionCard({ label, score, weight, level }) {
  const c = RISK_COLORS[level] || RISK_COLORS.MODERATE;
  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <span className="text-xs text-gray-500">{weight}% weight</span>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-2xl font-bold ${c.text}`}>
          {score.toFixed(1)}
        </span>
        <RiskBadge level={level} />
      </div>
      <ScoreBar score={score} level={level} />
    </div>
  );
}

function IndicatorRow({ item, index }) {
  const [expanded, setExpanded] = useState(false);
  const c = RISK_COLORS[item.risk_level] || RISK_COLORS.MODERATE;
  const { label, color } = generateWhyLabel(
    item.indicator,
    item.raw_value,
    item.normalized_score,
    item.risk_level,
  );

  return (
    <div
      className={`rounded-lg border ${c.border} ${c.bg} cursor-pointer transition-all duration-200`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Rank */}
        <span className="text-xs text-gray-600 w-5 text-center font-mono">
          {index + 1}
        </span>

        {/* Indicator name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">
              {item.indicator}
            </span>
            <RiskBadge level={item.risk_level} />
          </div>
          {/* WHY label — the key FR9 feature */}
          <span className={`text-xs font-semibold ${color}`}>{label}</span>
        </div>

        {/* Score */}
        <div className="text-right flex-shrink-0">
          <div className={`text-lg font-bold ${c.text}`}>
            {item.normalized_score.toFixed(1)}
          </div>
          <div className="text-xs text-gray-600">/100</div>
        </div>

        {/* Expand arrow */}
        <span className="text-gray-600 text-xs ml-1">
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Score bar */}
      <div className="px-3 pb-2">
        <ScoreBar score={item.normalized_score} level={item.risk_level} />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-700/50 space-y-2">
          <p className="text-xs text-gray-300 leading-relaxed">
            {item.interpretation}
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-black/20 rounded p-2">
              <div className="text-gray-500">Raw Value</div>
              <div className="text-white font-semibold">
                {item.raw_value !== null ? item.raw_value : "N/A"}
              </div>
            </div>
            <div className="bg-black/20 rounded p-2">
              <div className="text-gray-500">Weight</div>
              <div className="text-white font-semibold">
                {(item.weight * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-black/20 rounded p-2">
              <div className="text-gray-500">Contribution</div>
              <div className={`font-semibold ${c.text}`}>
                +{item.weighted_contribution.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Dimension:{" "}
            <span className="text-gray-400">
              {DIMENSION_LABELS[item.dimension] || item.dimension}
            </span>
          </div>
        </div>
      )}
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

export default function RiskBreakdownPanel() {
  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("score"); // score | dimension
  const [activeTab, setActiveTab] = useState("indicators"); // indicators | chart | dimensions

  const handleChange = (field, val) =>
    setIndicators((prev) => ({ ...prev, [field]: val }));

  const handleSubmit = async () => {
    if (!countryCode || !countryName) {
      setError("Country code and name are required.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    const cleaned = {};
    Object.entries(indicators).forEach(([k, v]) => {
      if (v !== "") cleaned[k] = parseFloat(v);
    });

    try {
      const res = await fetch(
        `${API_BASE}/risk/${countryCode.toUpperCase()}/breakdown`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            country_code: countryCode.toUpperCase(),
            country_name: countryName,
            indicators: cleaned,
          }),
        },
      );
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || "Request failed");
      }
      const data = await res.json();
      setResult(data);
      setActiveTab("indicators");
    } catch (err) {
      setError(err.message || "Failed to fetch breakdown.");
    } finally {
      setLoading(false);
    }
  };

  // Sort indicators
  const sortedBreakdown = result
    ? [...result.indicator_breakdown].sort((a, b) =>
        sortBy === "score"
          ? b.normalized_score - a.normalized_score
          : a.dimension.localeCompare(b.dimension),
      )
    : [];

  // Chart data — top contributors
  const chartData = result
    ? [...result.indicator_breakdown]
        .sort((a, b) => b.weighted_contribution - a.weighted_contribution)
        .slice(0, 8)
        .map((b) => ({
          name: b.indicator.split(" ").slice(0, 2).join(" "),
          contribution: parseFloat(b.weighted_contribution.toFixed(2)),
          level: b.risk_level,
        }))
    : [];

  // Dimension data with risk level
  const dimensionData = result
    ? Object.entries(result.dimension_scores).map(([key, score]) => ({
        key,
        label: DIMENSION_LABELS[key],
        score,
        weight: DIMENSION_WEIGHTS_DISPLAY[key],
        level:
          score < 25
            ? "LOW"
            : score < 50
              ? "MODERATE"
              : score < 75
                ? "HIGH"
                : "CRITICAL",
      }))
    : [];

  const aggregateLevel = result
    ? result.aggregate_risk_score < 25
      ? "LOW"
      : result.aggregate_risk_score < 50
        ? "MODERATE"
        : result.aggregate_risk_score < 75
          ? "HIGH"
          : "CRITICAL"
    : "MODERATE";

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">
            Module 2 · FR9
          </div>
          <h1 className="text-3xl font-bold">
            Risk <span className="text-violet-400">Interpretability</span> Panel
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Transparent breakdown of why a country received its risk score — per
            indicator, per dimension.
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
            Country Inputs
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
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
            Enter indicators manually or leave blank to auto-fetch from
            WorldBank API.
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
                  onChange={(e) => handleChange(field, e.target.value)}
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
            {loading ? "Analyzing Risk Factors…" : "Generate Breakdown"}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-5">
            {/* Summary Banner */}
            <div
              className={`rounded-xl border p-5 ${RISK_COLORS[aggregateLevel].bg} ${RISK_COLORS[aggregateLevel].border}`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-xl font-bold text-white">
                    {result.country_name}
                    <span className="text-gray-500 text-sm ml-2">
                      ({result.country_code})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span
                      className={`text-4xl font-black ${RISK_COLORS[aggregateLevel].text}`}
                    >
                      {result.aggregate_risk_score.toFixed(1)}
                    </span>
                    <div>
                      <div className="text-xs text-gray-500">
                        Aggregate Risk Score
                      </div>
                      <RiskBadge level={aggregateLevel} />
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500 space-y-1">
                  <div>
                    Confidence:{" "}
                    <span className="text-gray-300 font-semibold">
                      {result.confidence}
                    </span>
                  </div>
                  <div>
                    Computed:{" "}
                    <span className="text-gray-300">
                      {new Date(result.computed_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-gray-600 italic text-xs">
                    Score explained below ↓
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-800 pb-2">
              {[
                { key: "indicators", label: "📋 Indicator Breakdown" },
                { key: "dimensions", label: "🧩 Dimensions" },
                { key: "chart", label: "📊 Contribution Chart" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`text-sm px-4 py-1.5 rounded-lg transition-colors ${
                    activeTab === key
                      ? "bg-violet-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab: Indicator Breakdown */}
            {activeTab === "indicators" && (
              <div>
                {/* Sort control */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs text-gray-500">Sort by:</span>
                  {["score", "dimension"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSortBy(s)}
                      className={`text-xs px-3 py-1 rounded-lg capitalize transition-colors ${
                        sortBy === s
                          ? "bg-gray-700 text-white"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {s === "score" ? "Risk Score ↓" : "Dimension"}
                    </button>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex gap-3 mb-3 flex-wrap">
                  {["LOW", "MODERATE", "HIGH", "CRITICAL"].map((l) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: RISK_COLORS[l].hex }}
                      />
                      <span className="text-xs text-gray-500">{l}</span>
                    </div>
                  ))}
                  <span className="text-xs text-gray-600 ml-auto">
                    Click any row to expand
                  </span>
                </div>

                <div className="space-y-2">
                  {sortedBreakdown.map((item, i) => (
                    <IndicatorRow key={item.indicator} item={item} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Dimensions */}
            {activeTab === "dimensions" && (
              <div>
                <p className="text-xs text-gray-500 mb-4">
                  The aggregate score is a weighted combination of 4 risk
                  dimensions.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  {dimensionData.map((d) => (
                    <DimensionCard
                      key={d.key}
                      label={d.label}
                      score={d.score}
                      weight={d.weight}
                      level={d.level}
                    />
                  ))}
                </div>

                {/* Weight breakdown */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                    Dimension Weight Distribution
                  </h3>
                  <div className="space-y-2">
                    {dimensionData.map((d) => (
                      <div key={d.key} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-36">
                          {d.label}
                        </span>
                        <div className="flex-1 bg-gray-800 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${d.weight}%`,
                              background: RISK_COLORS[d.level].hex,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">
                          {d.weight}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-3">
                    Formula: Score = (Economic × 35%) + (Trade × 30%) + (Fiscal
                    × 20%) + (Market × 15%)
                  </p>
                </div>
              </div>
            )}

            {/* Tab: Contribution Chart */}
            {activeTab === "chart" && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm text-gray-400 mb-1 uppercase tracking-wider">
                  Top Risk Contributors
                </h3>
                <p className="text-xs text-gray-600 mb-4">
                  Weighted contribution of each indicator to the final score.
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ left: 10, right: 40 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: "#9CA3AF", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fill: "#9CA3AF", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#111827",
                        border: "1px solid #374151",
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: "#F9FAFB" }}
                      formatter={(val) => [`${val} pts`, "Contribution"]}
                    />
                    <Bar dataKey="contribution" radius={[0, 6, 6, 0]}>
                      <LabelList
                        dataKey="contribution"
                        position="right"
                        style={{ fill: "#9CA3AF", fontSize: 11 }}
                      />
                      {chartData.map((entry, index) => {
                        const c =
                          RISK_COLORS[entry.level] || RISK_COLORS.MODERATE;
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
