import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend, // Added Legend so users know which color is which
} from "recharts";

const API = API_BASE_URL;

// Color palette for the multi-line chart
const CHART_COLORS = [
  "#8ab4ff", // Blue
  "#34d399", // Emerald
  "#f87171", // Red
  "#fbbf24", // Amber
  "#c084fc", // Purple
  "#60a5fa", // Light Blue
  "#f472b6"  // Pink
];

function CommodityTrends() {
  const [commodities, setCommodities] = useState([]);
  const [selected, setSelected] = useState("all"); // Default to "all"
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 1. Initial Load: Fetch and Filter Commodities
  useEffect(() => {
    axios
      .get(`${API}/commodities`)
      .then((res) => {
        // FILTER: Remove the fake aggregate totals from the database
        const cleanCommodities = res.data.filter(c => 
          !c.name.toLowerCase().includes("hs total") && 
          !c.name.toLowerCase().includes("all commodities")
        );
        
        setCommodities(cleanCommodities);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load commodities.");
      });
  }, []);

  // 2. Fetch Data based on Selection ("all" vs single)
  useEffect(() => {
    if (!selected) return;

    setLoading(true);
    setError("");

    if (selected === "all") {
      // IF "ALL": We must wait for commodities to load first
      if (commodities.length === 0) {
        setLoading(false);
        return;
      }
      
      // Fetch all price histories simultaneously
      const requests = commodities.map(c => axios.get(`${API}/commodities/${c._id}`));
      
      Promise.all(requests)
        .then(responses => {
          const dateMap = {};
          
          // Group all prices by their Date
          responses.forEach(res => {
            const name = res.data.name;
            res.data.priceHistory.forEach(p => {
               const dateStr = new Date(p.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
               if (!dateMap[dateStr]) dateMap[dateStr] = { date: dateStr, _rawDate: new Date(p.date) };
               dateMap[dateStr][name] = p.price;
            });
          });
          
          // Sort the final timeline chronologically
          const history = Object.values(dateMap).sort((a,b) => a._rawDate - b._rawDate);
          
          setPriceHistory(history);
          setSelectedDetails(null); // Clear single details since we are showing all
        })
        .catch(() => setError("Failed to load aggregate commodities."))
        .finally(() => setLoading(false));

    } else {
      // IF SINGLE COMMODITY: Fetch just that one
      axios
        .get(`${API}/commodities/${selected._id}`)
        .then((res) => {
          setSelectedDetails(res.data);
          
          // Format data exactly how Recharts likes it
          const history = res.data.priceHistory.map((p) => ({
            date: new Date(p.date).toLocaleDateString("en-US", {
              month: "short",
              year: "2-digit",
            }),
            [res.data.name]: p.price, // Dynamically use the commodity name as the key
          }));
          setPriceHistory(history);
        })
        .catch((err) => {
          setError(err.response?.data?.message || "Failed to load commodity.");
        })
        .finally(() => setLoading(false));
    }
  }, [selected, commodities]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">
        Commodity Price Trends
      </h1>
      {error && <p className="text-sm text-red-300">{error}</p>}

      {/* Commodity Selector */}
      <div className="flex flex-wrap gap-3">
        {/* NEW: The Master "All Commodities" Button */}
        <button
          onClick={() => setSelected("all")}
          className={`btn-ui border ${
            selected === "all"
              ? "bg-[#8ab4ff] border-[#8ab4ff] text-black"
              : "bg-[#121212] border-[#2a2a2a] text-neutral-400 hover:text-neutral-100"
          }`}
        >
          All Commodities
        </button>

        {/* Individual Buttons */}
        {commodities.map((c) => (
          <button
            key={c._id}
            onClick={() => setSelected(c)}
            className={`btn-ui border ${
              selected?._id === c._id
                ? "bg-[#8ab4ff] border-[#8ab4ff] text-black"
                : "bg-[#121212] border-[#2a2a2a] text-neutral-400 hover:text-neutral-100"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Chart Panel */}
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5">
        
        {/* Dynamic Header */}
        {selected === "all" ? (
          <div className="flex items-center justify-between mb-4 border-b border-[#2a2a2a] pb-4">
             <h2 className="text-neutral-100 font-semibold">Global Market Overview — All Commodities</h2>
          </div>
        ) : selectedDetails && (
          <div className="flex items-center justify-between mb-4 border-b border-[#2a2a2a] pb-4">
            <h2 className="text-neutral-100 font-semibold">
              {selectedDetails.name} — Price History
            </h2>
            <div className="flex gap-4 text-sm text-neutral-400">
              <span>Category: <span className="text-neutral-100">{selectedDetails.category}</span></span>
              <span>Unit: <span className="text-neutral-100">{selectedDetails.unit}</span></span>
              <span>Current: <span className="text-[#8ab4ff] font-semibold">${selectedDetails.currentPrice}</span></span>
              <span>
                Status:{" "}
                <span className={`font-semibold ${selectedDetails.isStale ? "text-amber-300" : "text-[#8ab4ff]"}`}>
                  {selectedDetails.isStale ? "Stale" : "Fresh"}
                </span>
              </span>
            </div>
          </div>
        )}

        {selectedDetails && (
          <p className="text-xs text-neutral-400 mb-4">
            Source: {selectedDetails.source || "unknown"} | Verified:{" "}
            {selectedDetails.verified ? "Yes" : "No"}
            {selectedDetails.asOf ? ` | As of: ${new Date(selectedDetails.asOf).toLocaleString()}` : ""}
          </p>
        )}

        {loading ? (
          <p className="text-neutral-400 text-center py-16">Loading market data...</p>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={priceHistory} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="date" tick={{ fill: "#a3a3a3", fontSize: 12 }} />
              <YAxis tick={{ fill: "#a3a3a3", fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111111", border: "1px solid #2a2a2a", color: "#f5f5f5", borderRadius: "8px" }}
                formatter={(value, name) => [`$${value.toLocaleString()}`, name]}
              />
              
              {/* Only show legend if multiple lines are rendering */}
              {selected === "all" && <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />}

              {/* Dynamic Line Rendering */}
              {selected === "all" ? (
                commodities.map((c, i) => (
                  <Line
                    key={c._id}
                    type="monotone"
                    dataKey={c.name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS[i % CHART_COLORS.length], r: 2 }}
                    activeDot={{ r: 5 }}
                  />
                ))
              ) : (
                <Line
                  type="monotone"
                  dataKey={selectedDetails?.name || "price"}
                  stroke="#8ab4ff"
                  strokeWidth={2.25}
                  dot={{ fill: "#8ab4ff", r: 3 }}
                  activeDot={{ r: 6 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default CommodityTrends;