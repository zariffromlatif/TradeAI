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
  Legend
} from "recharts";

const API = API_BASE_URL;

function ComparativeAnalysis() {
  const [countries, setCountries] = useState([]);
  const [commodities, setCommodities] = useState([]);
  
  // The User Selections
  const [countryA, setCountryA] = useState("");
  const [countryB, setCountryB] = useState("");
  const [commodity, setCommodity] = useState("");
  const [tradeType, setTradeType] = useState("export");
  
  // The Graph Data
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 1. Fetch Dropdowns on page load
  useEffect(() => {
    axios.get(`${API}/countries`).then((res) => {
      const realCountries = res.data.filter(c => c.code !== "WLD" && !c.name.toLowerCase().includes("world"));
      setCountries(realCountries);
    }).catch(err => console.error(err));

    axios.get(`${API}/commodities`).then((res) => {
      const cleanCommodities = res.data.filter(c => !c.name.toLowerCase().includes("hs total") && !c.name.toLowerCase().includes("all"));
      setCommodities(cleanCommodities);
      // Auto-select the first commodity so the user only has to pick countries
      if (cleanCommodities.length > 0) {
        setCommodity(cleanCommodities[0]._id);
      }
    }).catch(err => console.error(err));
  }, []);

  // 2. AUTO-RUN LOGIC: Watch the dropdowns and fetch data instantly
  useEffect(() => {
    // If any of these three are missing, do not run the graph yet
    if (!countryA || !countryB || !commodity) return;
    
    setLoading(true);
    setError("");
    
    axios.get(`${API}/analytics/compare`, {
      params: {
        countries: `${countryA},${countryB}`,
        commodities: commodity,
        type: tradeType
      }
    }).then((res) => {
      setChartData(res.data.trendData || []);
    }).catch(() => {
      setError("Failed to load comparison data.");
    }).finally(() => {
      setLoading(false);
    });
  }, [countryA, countryB, commodity, tradeType]); // React watches these 4 variables!

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
            <option value="">Select Country 1...</option>
            {countries.filter(c => c.code !== countryB).map(c => (
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
            <option value="">Select Country 2...</option>
            {countries.filter(c => c.code !== countryA).map(c => (
              <option key={c._id} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-neutral-400">Product / Commodity</label>
          <select 
            value={commodity} 
            onChange={(e) => setCommodity(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] text-neutral-100 rounded-xl px-4 py-2 outline-none focus:border-[#8ab4ff]"
          >
            <option value="">Select Commodity...</option>
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

      {/* Visualization Graph */}
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5 h-[450px]">
        {error && <p className="text-red-400 mb-4">{error}</p>}
        
        {!countryA || !countryB || !commodity ? (
          <div className="flex items-center justify-center h-full text-neutral-500">
            Select two countries to view the comparative graph.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full text-[#8ab4ff]">
            Loading overlap data...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-500">
            No overlapping trade records found for this combination.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8ab4ff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8ab4ff" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#a3a3a3", fontSize: 12 }} />
              <YAxis tick={{ fill: "#a3a3a3", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111111", border: "1px solid #2a2a2a", borderRadius: "10px", color: "#f5f5f5" }}
                formatter={(value, name) => {
                  const countryName = countries.find(c => c.code === name)?.name || name;
                  return [`$${value.toLocaleString()}`, countryName];
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ color: "#d4d4d4" }} />
              
              {/* Because the seed.js overlaps perfectly, we can put both lines on ONE graph! */}
              {countryA && (
                <Area type="monotone" dataKey={countryA} stroke="#8ab4ff" fillOpacity={1} fill="url(#colorA)" strokeWidth={2.25} connectNulls={true} />
              )}
              {countryB && (
                <Area type="monotone" dataKey={countryB} stroke="#34d399" fillOpacity={1} fill="url(#colorB)" strokeWidth={2.25} connectNulls={true} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default ComparativeAnalysis;