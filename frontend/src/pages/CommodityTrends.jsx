import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const API = "http://localhost:5000/api";

function CommodityTrends() {
  const [commodities, setCommodities] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get(`${API}/commodities`)
      .then((res) => {
        setCommodities(res.data);
        if (res.data.length > 0) {
          setSelected(res.data[0]);
          setSelectedDetails(res.data[0]);
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load commodities.");
      });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError("");
    axios
      .get(`${API}/commodities/${selected._id}`)
      .then((res) => {
        setSelectedDetails(res.data);
        const history = res.data.priceHistory.map((p) => ({
          date: new Date(p.date).toLocaleDateString("en-US", {
            month: "short",
            year: "2-digit",
          }),
          price: p.price,
        }));
        setPriceHistory(history);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load commodity.");
      })
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">
        Commodity Price Trends
      </h1>
      {error && <p className="text-sm text-red-300">{error}</p>}

      {/* Commodity Selector */}
      <div className="flex flex-wrap gap-3">
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

      {/* Chart */}
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5">
        {selectedDetails && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-neutral-100 font-semibold">
              {selectedDetails.name} — Price History
            </h2>
            <div className="flex gap-4 text-sm text-neutral-400">
              <span>
                Category:{" "}
                <span className="text-neutral-100">{selectedDetails.category}</span>
              </span>
              <span>
                Unit: <span className="text-neutral-100">{selectedDetails.unit}</span>
              </span>
              <span>
                Current:{" "}
                <span className="text-[#8ab4ff] font-semibold">
                  ${selectedDetails.currentPrice}
                </span>
              </span>
              <span>
                Status:{" "}
                <span
                  className={`font-semibold ${
                    selectedDetails.isStale ? "text-amber-300" : "text-[#8ab4ff]"
                  }`}
                >
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
            {selectedDetails.asOf
              ? ` | As of: ${new Date(selectedDetails.asOf).toLocaleString()}`
              : ""}
          </p>
        )}

        {loading ? (
          <p className="text-neutral-400 text-center py-16">Loading chart...</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="date" tick={{ fill: "#a3a3a3", fontSize: 12 }} />
              <YAxis tick={{ fill: "#a3a3a3", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111111",
                  border: "1px solid #2a2a2a",
                  color: "#f5f5f5",
                }}
                formatter={(v) => [`$${v}`, "Price"]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#8ab4ff"
                strokeWidth={2.25}
                dot={{ fill: "#8ab4ff", r: 3 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default CommodityTrends;
