import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { API_BASE_URL } from "../config/api";

const API = API_BASE_URL;

function TradeBalance() {
  const [countries, setCountries] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    axios
      .get(`${API}/countries`)
      .then((res) => {
        const options = (res.data || []).filter((c) => c.code !== "WLD");
        setCountries(options);
      })
      .catch(() => setCountries([]));
  }, []);

  const fetchData = async () => {
    setError("");
    setLoading(true);
    try {
      const params = {};
      if (country) params.country = country;
      if (region.trim()) params.region = region.trim();
      const res = await axios.get(`${API}/analytics/trade-balance`, { params });
      setRows(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load trade balance.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        date: `${r.year}-${String(r.month).padStart(2, "0")}`,
        exportValue: r.exportValue || 0,
        importValue: r.importValue || 0,
        balance: r.balance || 0,
      })),
    [rows],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">
        Trade Balance Analytics
      </h1>

      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5 flex flex-wrap gap-3">
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-neutral-100"
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c._id} value={c.code}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="Region filter (e.g. Asia)"
          className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-neutral-100"
        />
        <button type="button" className="btn-ui btn-primary" onClick={fetchData}>
          Apply
        </button>
      </div>

      {error && <p className="text-red-300 text-sm">{error}</p>}

      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5">
        {loading ? (
          <p className="text-neutral-400 text-center py-12">Loading...</p>
        ) : chartData.length === 0 ? (
          <p className="text-neutral-400 text-center py-12">No trade balance data found.</p>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="date" tick={{ fill: "#a3a3a3", fontSize: 12 }} />
              <YAxis tick={{ fill: "#a3a3a3", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111111",
                  border: "1px solid #2a2a2a",
                  color: "#f5f5f5",
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="exportValue" stroke="#8ab4ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="importValue" stroke="#e5e5e5" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="balance" stroke="#34d399" strokeWidth={2.2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default TradeBalance;
