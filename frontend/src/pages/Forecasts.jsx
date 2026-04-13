import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { LineChart as LineChartIcon, Activity } from "lucide-react";

const API = "http://localhost:5000/api";

function Forecasts() {
  const [commodities, setCommodities] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const [commodity, setCommodity] = useState("");
  const [country, setCountry] = useState("");
  const [tradeType, setTradeType] = useState("export");
  const [horizon, setHorizon] = useState("3");

  const [volumeResult, setVolumeResult] = useState(null);
  const [volResult, setVolResult] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      axios.get(`${API}/commodities`),
      axios.get(`${API}/countries`),
    ])
      .then(([c, co]) => {
        setCommodities(c.data);
        setCountries(co.data);
        if (c.data.length) setCommodity(c.data[0]._id);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load lists.");
      })
      .finally(() => setLoading(false));
  }, []);

  const runForecast = async (e) => {
    e.preventDefault();
    if (!commodity) {
      setError("Select a commodity.");
      return;
    }
    setError("");
    setRunning(true);
    setVolumeResult(null);
    setVolResult(null);
    const bodyVol = {
      commodity,
      type: tradeType,
      horizon: Number(horizon) || 3,
    };
    if (country) bodyVol.country = country;

    try {
      const [vRes, pRes] = await Promise.all([
        axios.post(`${API}/analytics/forecast/volume`, bodyVol),
        axios.post(`${API}/analytics/forecast/price-volatility`, { commodity }),
      ]);
      setVolumeResult(vRes.data);
      setVolResult(pRes.data);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.message ||
        "Forecast failed (is ML service on :8000?)";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setRunning(false);
    }
  };

  const chartRows =
    volumeResult?.series?.length || volumeResult?.forecast?.length
      ? [
          ...(volumeResult.series || []).map((s) => ({
            label: s.period,
            volume: s.totalVolume,
            kind: "actual",
          })),
          ...(volumeResult.forecast || []).map((f) => ({
            label: `F${f.step}`,
            volume: f.value,
            kind: "forecast",
          })),
        ]
      : [];

  if (loading) {
    return <p className="text-gray-400">Loading…</p>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <LineChartIcon className="text-emerald-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Forecasts</h1>
          <p className="text-gray-400 text-sm">
            Trade volume projection from records; volatility from commodity{" "}
            <code className="text-emerald-400">priceHistory</code> (proxy, not
            FX).
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={runForecast}
        className="bg-gray-900 border border-gray-800 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-400">Commodity</span>
          <select
            value={commodity}
            onChange={(e) => setCommodity(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            required
          >
            {commodities.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-400">Country (optional)</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-400">Trade type</span>
          <select
            value={tradeType}
            onChange={(e) => setTradeType(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="export">Export</option>
            <option value="import">Import</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-400">Forecast horizon (months)</span>
          <input
            type="number"
            min={1}
            max={12}
            value={horizon}
            onChange={(e) => setHorizon(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </label>
        <div className="flex items-end sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            disabled={running}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg"
          >
            {running ? "Running…" : "Run forecast"}
          </button>
        </div>
      </form>

      {volumeResult && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-2">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity size={20} className="text-emerald-400" />
            Volume forecast
          </h2>
          <p className="text-gray-400 text-sm">
            Method:{" "}
            <code className="text-emerald-400">{volumeResult.method}</code>
            {volumeResult.note ? ` — ${volumeResult.note}` : ""}
          </p>
          {chartRows.length > 0 && (
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#9CA3AF", fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "none",
                      color: "#fff",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="volume"
                    name="Volume (units / month)"
                    stroke="#34D399"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {volResult && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-white">
            Price volatility proxy
          </h2>
          <p className="text-gray-400 text-sm">
            {volResult.commodityName && (
              <>
                Commodity:{" "}
                <span className="text-white">{volResult.commodityName}</span>
                <br />
              </>
            )}
            Sample std (log returns):{" "}
            <code className="text-emerald-400">
              {volResult.log_return_sample_std}
            </code>
            <br />
            Window: {volResult.rolling_window} · Returns:{" "}
            {volResult.return_count}
          </p>
          {volResult.rolling_volatility?.length > 0 && (
            <p className="text-gray-500 text-xs">
              Last rolling vol:{" "}
              {
                volResult.rolling_volatility[
                  volResult.rolling_volatility.length - 1
                ]?.volatility
              }
            </p>
          )}
          <p className="text-gray-600 text-xs">{volResult.note}</p>
        </div>
      )}
    </div>
  );
}

export default Forecasts;
