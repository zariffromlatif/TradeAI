import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Brush
} from "recharts";

const API = API_BASE_URL;

function ComparativeAnalysis() {
  const [countries, setCountries] = useState([]);
  const [commodities, setCommodities] = useState([]);

  const [selectedCountries, setSelectedCountries] = useState([]);
  const [selectedCommodities, setSelectedCommodities] = useState([]);
  const [tradeType, setTradeType] = useState("export");

  const [chartData, setChartData] = useState([]);
  const [cards, setCards] = useState([]);
  const [priceDiffs, setPriceDiffs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`${API}/countries`).then((res) => {
      const realCountries = res.data.filter(c => 
        c.code !== "WLD" && 
        !c.name.toLowerCase().includes("world")
      );
      setCountries(realCountries);
    }).catch(err => console.error("Failed to load countries:", err));

    axios.get(`${API}/commodities`).then((res) => {
      const cleanCommodities = res.data.filter(c => 
        !c.name.toLowerCase().includes("hs total") && 
        !c.name.toLowerCase().includes("all commodities")
      );
      setCommodities(cleanCommodities);
      setSelectedCommodities(cleanCommodities.slice(0, 1).map((c) => c._id));
    }).catch(err => console.error("Failed to load commodities:", err));
  }, []);

  const fetchComparison = () => {
    if (selectedCountries.length < 2) return;
    setLoading(true);
    setError("");
    axios
      .get(`${API}/analytics/compare`, {
        params: {
          countries: selectedCountries.join(","),
          commodities: selectedCommodities.join(","),
          type: tradeType,
        },
      })
      .then((res) => {
        setChartData(res.data.trendData || []);
        setCards(res.data.comparisonCards || []);
        setPriceDiffs(res.data.priceDifferentials || []);
        setMeta(res.data.meta);
      })
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.message || "Comparison failed.");
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">Comparative Intelligence</h1>

      {/* Control Panel */}
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5 flex flex-wrap gap-6 items-end">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-neutral-400">Countries (2-4)</label>
          <select
            multiple
            value={selectedCountries}
            onChange={(e) =>
              setSelectedCountries(
                Array.from(e.target.selectedOptions).map((x) => x.value).slice(0, 4),
              )
            }
            className="bg-[#171717] border border-[#2a2a2a] text-neutral-100 rounded-xl px-4 py-2 min-w-[260px] h-28 outline-none focus:border-[#8ab4ff]"
          >
            {countries.map(c => (
              <option key={c._id} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-neutral-400">Commodities (up to 3)</label>
          <select
            multiple
            value={selectedCommodities}
            onChange={(e) =>
              setSelectedCommodities(
                Array.from(e.target.selectedOptions).map((x) => x.value).slice(0, 3),
              )
            }
            className="bg-[#171717] border border-[#2a2a2a] text-neutral-100 rounded-xl px-4 py-2 min-w-[260px] h-28 outline-none focus:border-[#8ab4ff]"
          >
            {commodities.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-neutral-400">Trade Flow</label>
          <div className="flex bg-[#171717] rounded-xl p-1 border border-[#2a2a2a]">
            <button 
              onClick={() => setTradeType("export")}
              className={`btn-ui ${tradeType === "export" ? "bg-[#8ab4ff] text-black shadow border border-[#8ab4ff]" : "text-neutral-400 hover:text-neutral-100 border border-transparent"}`}
            >
              Exports
            </button>
            <button 
              onClick={() => setTradeType("import")}
              className={`btn-ui ${tradeType === "import" ? "bg-[#8ab4ff] text-black shadow border border-[#8ab4ff]" : "text-neutral-400 hover:text-neutral-100 border border-transparent"}`}
            >
              Imports
            </button>
          </div>
        </div>
        <button className="btn-ui btn-primary" onClick={fetchComparison}>
          Run compare
        </button>
      </div>

      {/* Visualization */}
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-neutral-100 font-semibold">
            {selectedCountries.length < 2
              ? "Select at least 2 countries"
              : meta 
                ? `${tradeType === "export" ? "Export" : "Import"} trend (${meta.commodities?.[0]?.name || "Primary commodity"})`
                : "Loading comparison..."}
          </h2>
        </div>
        {error && <p className="text-red-300 text-sm mb-3">{error}</p>}

        {selectedCountries.length < 2 ? (
          <p className="text-neutral-400 text-center py-16">Waiting for country selection...</p>
        ) : loading ? (
          <p className="text-neutral-400 text-center py-16">Crunching comparison data...</p>
        ) : chartData.length === 0 ? (
          <p className="text-neutral-400 text-center py-16">No overlapping trade records found for this selection.</p>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8ab4ff" stopOpacity={0.28}/>
                  <stop offset="95%" stopColor="#8ab4ff" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e5e5e5" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#e5e5e5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#a3a3a3", fontSize: 12 }} />
              <YAxis tick={{ fill: "#a3a3a3", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111111", border: "1px solid #2a2a2a", borderRadius: "10px", color: "#f5f5f5" }}
                formatter={(value, name) => {
                  const countryName = name === meta?.countryA.code ? meta?.countryA.name : meta?.countryB.name;
                  return [`$${value.toLocaleString()}`, countryName];
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ color: "#d4d4d4" }} />
              {(meta?.countries || []).map((c, idx) => (
                <Area
                  key={c.code}
                  type="monotone"
                  dataKey={c.code}
                  stroke={idx % 2 === 0 ? "#8ab4ff" : "#e5e5e5"}
                  fillOpacity={1}
                  fill={idx % 2 === 0 ? "url(#colorA)" : "url(#colorB)"}
                  strokeWidth={2.25}
                  name={c.code}
                />
              ))}
              <Brush 
                dataKey="date" 
                height={30} 
                stroke="#2a2a2a" 
                fill="#111111"
                tickFormatter={() => ""} 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {!loading && cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((card, idx) => (
            <div key={`${card.country.code}-${card.commodity.id}-${idx}`} className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-4">
              <h3 className="text-neutral-100 font-medium">{card.country.name} - {card.commodity.name}</h3>
              <p className="text-sm text-neutral-400 mt-2">
                Total value: ${Number(card.totalValue || 0).toLocaleString()}
              </p>
              <p className="text-sm text-neutral-400">
                Avg unit price: {card.avgUnitPrice != null ? `$${card.avgUnitPrice.toFixed(2)}` : "-"}
              </p>
              <p className="text-sm text-neutral-400">
                YoY growth: {card.yoyGrowthPct != null ? `${card.yoyGrowthPct.toFixed(2)}%` : "-"}
              </p>
              <p className="text-sm text-neutral-400">
                Risk score (proxy): {card.riskScore.toFixed(1)}
              </p>
            </div>
          ))}
        </div>
      )}

      {!loading && priceDiffs.length > 0 && (
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5">
          <h2 className="text-neutral-100 font-semibold mb-3">Commodity Price Differentials</h2>
          <div className="space-y-2 text-sm">
            {priceDiffs.map((row) => (
              <div key={row.commodity.id} className="text-neutral-300">
                {row.commodity.name}: min{" "}
                {row.avgPriceMin != null ? `$${row.avgPriceMin.toFixed(2)}` : "-"}
                {" | "}max {row.avgPriceMax != null ? `$${row.avgPriceMax.toFixed(2)}` : "-"}
                {" | "}diff{" "}
                {row.avgPriceDiffPct != null ? `${row.avgPriceDiffPct.toFixed(2)}%` : "-"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ComparativeAnalysis;