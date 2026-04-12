import { useEffect, useState } from "react";
import axios from "axios";
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

const API = "http://localhost:5000/api";

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
      <h1 className="text-2xl font-bold text-white">Comparative Intelligence</h1>

      {/* Control Panel */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-wrap gap-6 items-end">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-400">Comparison Country 1</label>
          <select 
            value={countryA} 
            onChange={(e) => setCountryA(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:border-emerald-500"
          >
            {countries.map(c => (
              <option key={c._id} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-400">Comparison Country 2</label>
          <select 
            value={countryB} 
            onChange={(e) => setCountryB(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:border-blue-500"
          >
            {countries.map(c => (
              <option key={c._id} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>

        {/* Product Dropdown */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-400">Product / Commodity</label>
          <select 
            value={commodity} 
            onChange={(e) => setCommodity(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:border-purple-500"
          >
            <option value="all">Overall Total (All Products)</option>
            {commodities.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-400">Trade Flow</label>
          <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
            <button 
              onClick={() => setTradeType("export")}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${tradeType === "export" ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-white"}`}
            >
              Exports
            </button>
            <button 
              onClick={() => setTradeType("import")}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${tradeType === "import" ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-white"}`}
            >
              Imports
            </button>
          </div>
        </div>
      </div>

      {/* Visualization */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-6">
          {/* NEW: Dynamic Chart Title based on selected product */}
          {meta ? `${meta.countryA.name} vs ${meta.countryB.name} — ${tradeType === 'export' ? 'Export' : 'Import'} Volume (${getCommodityLabel()})` : 'Loading Comparison...'}
        </h2>

        {loading ? (
          <p className="text-gray-400 text-center py-16">Crunching comparison data...</p>
        ) : chartData.length === 0 ? (
          <p className="text-gray-400 text-center py-16">No overlapping trade records found for this selection.</p>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34D399" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#34D399" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px", color: "#fff" }}
                formatter={(value, name) => [
                  `$${value.toLocaleString()}`, 
                  name === meta?.countryA.code ? meta?.countryA.name : meta?.countryB.name
                ]}
              />
              <Legend verticalAlign="top" height={36} />
              <Area type="monotone" dataKey={meta?.countryA.code} stroke="#34D399" fillOpacity={1} fill="url(#colorA)" strokeWidth={2} name={meta?.countryA.code} />
              <Area type="monotone" dataKey={meta?.countryB.code} stroke="#60A5FA" fillOpacity={1} fill="url(#colorB)" strokeWidth={2} name={meta?.countryB.code} />
              <Brush 
                dataKey="date" 
                height={30} 
                stroke="#374151" 
                fill="#1F2937"
                tickFormatter={() => ""} 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* KPI Summary Table */}
      {!loading && chartData.length > 0 && meta && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mt-6">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-gray-800/50 text-gray-300">
              <tr>
                {/* NEW: Dynamic Table Header */}
                <th className="px-6 py-4 font-medium">Metric ({tradeType} - {getCommodityLabel()})</th>
                <th className="px-6 py-4 font-medium text-emerald-400">{meta.countryA.name}</th>
                <th className="px-6 py-4 font-medium text-blue-400">{meta.countryB.name}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              <tr>
                <td className="px-6 py-4">Total Value (Period)</td>
                <td className="px-6 py-4 text-white font-medium">
                  ${(chartData.reduce((sum, row) => sum + (row[meta.countryA.code] || 0), 0) / 1000000).toFixed(2)}M
                </td>
                <td className="px-6 py-4 text-white font-medium">
                  ${(chartData.reduce((sum, row) => sum + (row[meta.countryB.code] || 0), 0) / 1000000).toFixed(2)}M
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4">Average Monthly Value</td>
                <td className="px-6 py-4 text-white">
                  ${((chartData.reduce((sum, row) => sum + (row[meta.countryA.code] || 0), 0) / chartData.length) / 1000000).toFixed(2)}M
                </td>
                <td className="px-6 py-4 text-white">
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