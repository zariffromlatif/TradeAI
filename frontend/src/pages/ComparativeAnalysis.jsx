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
  
  const [countryA, setCountryA] = useState("");
  const [countryB, setCountryB] = useState("");
  const [commodity, setCommodity] = useState("all");
  const [tradeType, setTradeType] = useState("export");
  
  const [chartData, setChartData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch available countries and commodities for the dropdowns
  useEffect(() => {
    axios.get(`${API}/countries`).then((res) => {
      setCountries(res.data);
      if (res.data.length >= 2) {
        setCountryA(res.data[0].code);
        setCountryB(res.data[1].code);
      }
    }).catch(err => console.error("Failed to load countries:", err));

    axios.get(`${API}/commodities`).then((res) => {
      setCommodities(res.data);
    }).catch(err => console.error("Failed to load commodities:", err));
  }, []);

  // Fetch comparative data when selections change
  useEffect(() => {
    if (!countryA || !countryB) return;
    
    setLoading(true);
    const url = `${API}/analytics/compare?countryA=${countryA}&countryB=${countryB}&type=${tradeType}&commodity=${commodity}`;
    
    axios
      .get(url)
      .then((res) => {
        setChartData(res.data.data);
        setMeta(res.data.meta);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [countryA, countryB, tradeType, commodity]);

  // NEW: Helper function to get the display name of the selected product
  const getCommodityLabel = () => {
    if (commodity === "all") return "Overall Total (All Products)";
    const found = commodities.find((c) => c._id === commodity);
    return found ? found.name : "Selected Product";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">Comparative Intelligence</h1>

      {/* Control Panel */}
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5 flex flex-wrap gap-6 items-end">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-neutral-400">Comparison Country 1</label>
          <select 
            value={countryA} 
            onChange={(e) => setCountryA(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] text-neutral-100 rounded-xl px-4 py-2 outline-none focus:border-[#8ab4ff]"
          >
            {countries.map(c => (
              <option key={c._id} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-neutral-400">Comparison Country 2</label>
          <select 
            value={countryB} 
            onChange={(e) => setCountryB(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] text-neutral-100 rounded-xl px-4 py-2 outline-none focus:border-[#8ab4ff]"
          >
            {countries.map(c => (
              <option key={c._id} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>

        {/* Product Dropdown */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-neutral-400">Product / Commodity</label>
          <select 
            value={commodity} 
            onChange={(e) => setCommodity(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] text-neutral-100 rounded-xl px-4 py-2 outline-none focus:border-[#8ab4ff]"
          >
            <option value="all">Overall Total (All Products)</option>
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
      </div>

      {/* Visualization */}
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-neutral-100 font-semibold">
          {/* NEW: Dynamic Chart Title based on selected product */}
            {meta ? `${meta.countryA.name} vs ${meta.countryB.name} — ${tradeType === 'export' ? 'Export' : 'Import'} Volume (${getCommodityLabel()})` : 'Loading Comparison...'}
          </h2>
          {meta && (
            <span
              className={`text-xs px-2.5 py-1 rounded-full border ${
                meta.usesNationalTotals
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-300 border-amber-500/30"
              }`}
            >
              {meta.usesNationalTotals ? "Official data" : "Fallback data"}
            </span>
          )}
        </div>
        {meta?.usesNationalTotals && (
          <p className="text-neutral-500 text-xs mb-4">
            Values are official national totals (reporter vs world) from synced data — not sums of bilateral partner flows.
          </p>
        )}
        {meta?.commodityFallbackApplied && (
          <p className="text-neutral-500 text-xs mb-4">
            No records found for the selected commodity across both countries; showing Overall Total (All Products) instead.
          </p>
        )}
        {meta && meta.usesNationalTotals === false && (
          <p className="text-neutral-500 text-xs mb-4">
            Using bilateral trade rows only. Run <code className="text-[#8ab4ff]">syncTradeFlows</code> after upgrading so national (World) totals are stored — compare will prefer those automatically.
          </p>
        )}

        {loading ? (
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
                formatter={(value, name) => [
                  `$${value.toLocaleString()}`, 
                  name === meta?.countryA.code ? meta?.countryA.name : meta?.countryB.name
                ]}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ color: "#d4d4d4" }} />
              <Area type="monotone" dataKey={meta?.countryA.code} stroke="#8ab4ff" fillOpacity={1} fill="url(#colorA)" strokeWidth={2.25} name={meta?.countryA.code} />
              <Area type="monotone" dataKey={meta?.countryB.code} stroke="#e5e5e5" fillOpacity={1} fill="url(#colorB)" strokeWidth={2.25} name={meta?.countryB.code} />
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

      {/* KPI Summary Table */}
      {!loading && chartData.length > 0 && meta && (
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl overflow-hidden mt-6">
          <table className="w-full text-left text-sm text-neutral-400">
            <thead className="table-head">
              <tr>
                {/* NEW: Dynamic Table Header */}
                <th className="px-6 py-4 font-medium">Metric ({tradeType} - {getCommodityLabel()})</th>
                <th className="px-6 py-4 font-medium text-[#8ab4ff]">{meta.countryA.name}</th>
                <th className="px-6 py-4 font-medium text-neutral-200">{meta.countryB.name}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              <tr>
                <td className="px-6 py-4">Total Value (Period)</td>
                <td className="px-6 py-4 text-neutral-100 font-medium">
                  ${(chartData.reduce((sum, row) => sum + (row[meta.countryA.code] || 0), 0) / 1000000).toFixed(2)}M
                </td>
                <td className="px-6 py-4 text-neutral-100 font-medium">
                  ${(chartData.reduce((sum, row) => sum + (row[meta.countryB.code] || 0), 0) / 1000000).toFixed(2)}M
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4">Average Monthly Value</td>
                <td className="px-6 py-4 text-neutral-100">
                  ${((chartData.reduce((sum, row) => sum + (row[meta.countryA.code] || 0), 0) / chartData.length) / 1000000).toFixed(2)}M
                </td>
                <td className="px-6 py-4 text-neutral-100">
                  ${((chartData.reduce((sum, row) => sum + (row[meta.countryB.code] || 0), 0) / chartData.length) / 1000000).toFixed(2)}M
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ComparativeAnalysis;