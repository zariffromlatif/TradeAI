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
import { API_BASE_URL } from "../config/api";

const API = API_BASE_URL;

function Forecasts() {
  const [commodities, setCommodities] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const [commodity, setCommodity] = useState("");
  const [fxPairs, setFxPairs] = useState([]);
  const [fxPair, setFxPair] = useState("USD/BDT");
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
      axios.get(`${API}/analytics/fx/pairs`).catch(() => ({ data: [] })),
    ])
      .then(([c, co, fx]) => {
        setCommodities(c.data);
        setCountries(co.data);
        setFxPairs(fx.data || []);
        if (c.data.length) {
          const aggregate = c.data.find((x) => x.name === "All Commodities (HS TOTAL)");
          setCommodity((aggregate || c.data[0])._id);
        }
        if (fx.data?.length) setFxPair(fx.data[0].pair);
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
        axios.post(`${API}/analytics/forecast/price-volatility`, { fxPair }),
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
    return <p className="text-neutral-400">Loading…</p>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <LineChartIcon className="text-[#8ab4ff]" size={28} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">Forecasts</h1>
          <p className="text-neutral-400 text-sm">
            Volume forecast uses monthly totals from trade records (USD value when quantity is absent); FX volatility uses real{" "}
            <code className="text-[#8ab4ff]">FX historical rates</code>.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={runForecast}
        className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Commodity</span>
          <select
            value={commodity}
            onChange={(e) => setCommodity(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
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
          <span className="text-neutral-400">Country (optional)</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
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
          <span className="text-neutral-400">FX pair</span>
          <select
            value={fxPair}
            onChange={(e) => setFxPair(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
            required
          >
            {fxPairs.length === 0 ? (
              <option value="USD/BDT">USD/BDT (sync FX first)</option>
            ) : (
              fxPairs.map((p) => (
                <option key={p.pair} value={p.pair}>
                  {p.pair} {p.currentRate ? `(${p.currentRate})` : ""}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Trade type</span>
          <select
            value={tradeType}
            onChange={(e) => setTradeType(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
          >
            <option value="export">Export</option>
            <option value="import">Import</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Forecast horizon (months)</span>
          <input
            type="number"
            min={1}
            max={12}
            value={horizon}
            onChange={(e) => setHorizon(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
          />
        </label>
        <div className="flex items-end sm:col-span-2 lg:col-span-5">
          <button
            type="submit"
            disabled={running}
            className="btn-ui btn-primary"
          >
            {running ? "Running…" : "Run forecast"}
          </button>
        </div>
      </form>

      {volumeResult && (
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6 space-y-2">
          <h2 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
            <Activity size={20} className="text-[#8ab4ff]" />
            Volume forecast
          </h2>
          <p className="text-neutral-400 text-sm">
            Method:{" "}
            <code className="text-[#8ab4ff]">{volumeResult.method}</code>
            {volumeResult.note ? ` — ${volumeResult.note}` : ""}
          </p>
          {volumeResult.sourceNote && (
            <p className="text-neutral-500 text-xs mt-1">{volumeResult.sourceNote}</p>
          )}
          {volumeResult.expansionNote && (
            <p className="text-neutral-500 text-xs mt-1">{volumeResult.expansionNote}</p>
          )}
          {chartRows.length > 0 && (
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#a3a3a3", fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: "#a3a3a3", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111111",
                      border: "1px solid #2a2a2a",
                      color: "#f5f5f5",
                    }}
                  />
                  <Legend wrapperStyle={{ color: "#d4d4d4" }} />
                  <Line
                    type="monotone"
                    dataKey="volume"
                    name="Monthly total (USD value or units)"
                    stroke="#8ab4ff"
                    strokeWidth={2.25}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {volResult && (
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-neutral-100">
            FX volatility
          </h2>
          <p className="text-neutral-400 text-sm">
            {volResult.pair && (
              <>
                Pair: <span className="text-neutral-100">{volResult.pair}</span>
                <br />
              </>
            )}
            Sample std (log returns):{" "}
            <code className="text-[#8ab4ff]">
              {volResult.log_return_sample_std}
            </code>
            <br />
            Window: {volResult.rolling_window} · Returns:{" "}
            {volResult.return_count}
          </p>
          {volResult.rolling_volatility?.length > 0 && (
            <p className="text-neutral-500 text-xs">
              Last rolling vol:{" "}
              {
                volResult.rolling_volatility[
                  volResult.rolling_volatility.length - 1
                ]?.volatility
              }
            </p>
          )}
          <p className="text-neutral-600 text-xs">{volResult.note}</p>
        </div>
      )}
    </div>
  );
}

export default Forecasts;
