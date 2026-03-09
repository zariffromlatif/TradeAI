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
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/commodities`).then((res) => {
      setCommodities(res.data);
      if (res.data.length > 0) setSelected(res.data[0]);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    axios
      .get(`${API}/commodities/${selected._id}`)
      .then((res) => {
        const history = res.data.priceHistory.map((p) => ({
          date: new Date(p.date).toLocaleDateString("en-US", {
            month: "short",
            year: "2-digit",
          }),
          price: p.price,
        }));
        setPriceHistory(history);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Commodity Price Trends</h1>

      {/* Commodity Selector */}
      <div className="flex flex-wrap gap-3">
        {commodities.map((c) => (
          <button
            key={c._id}
            onClick={() => setSelected(c)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              selected?._id === c._id
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "bg-gray-900 border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        {selected && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">
              {selected.name} — Price History
            </h2>
            <div className="flex gap-4 text-sm text-gray-400">
              <span>
                Category:{" "}
                <span className="text-white">{selected.category}</span>
              </span>
              <span>
                Unit: <span className="text-white">{selected.unit}</span>
              </span>
              <span>
                Current:{" "}
                <span className="text-emerald-400 font-bold">
                  ${selected.currentPrice}
                </span>
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading chart...</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "none",
                  color: "#fff",
                }}
                formatter={(v) => [`$${v}`, "Price"]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#34D399"
                strokeWidth={2}
                dot={{ fill: "#34D399", r: 3 }}
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
