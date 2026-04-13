import { useEffect, useState } from "react";
import axios from "axios";
import { Lightbulb, Loader2 } from "lucide-react";

const API = "http://localhost:5000/api";

const severityStyles = {
  high: "border-red-500/50 bg-red-500/10 text-red-200",
  medium: "border-amber-500/50 bg-amber-500/10 text-amber-100",
  low: "border-gray-600 bg-gray-800/50 text-gray-300",
};

function Advisory() {
  const [countries, setCountries] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [countryCode, setCountryCode] = useState("");
  const [commodity, setCommodity] = useState("");
  const [loadingLists, setLoadingLists] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    setLoadingLists(true);
    Promise.all([
      axios.get(`${API}/countries`),
      axios.get(`${API}/commodities`),
    ])
      .then(([co, com]) => {
        setCountries(co.data);
        setCommodities(com.data);
        if (co.data.length) setCountryCode(co.data[0].code);
      })
      .catch(() => setError("Failed to load countries or commodities."))
      .finally(() => setLoadingLists(false));
  }, []);

  const runAdvisory = async (e) => {
    e.preventDefault();
    if (!countryCode) {
      setError("Select a country.");
      return;
    }
    setError("");
    setSubmitting(true);
    setResult(null);
    try {
      const body = { countryCode };
      if (commodity) body.commodity = commodity;
      const res = await axios.post(`${API}/advisory/recommend`, body);
      setResult(res.data);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Advisory request failed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingLists) {
    return <p className="text-gray-400">Loading…</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Lightbulb className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Advisory</h1>
          <p className="text-gray-400 text-sm">
            Rule-based suggestions from ML risk score, macro fields, and optional
            commodity <code className="text-emerald-400">priceHistory</code>{" "}
            volatility. Not professional advice.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={runAdvisory}
        className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-400">Country</span>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              required
            >
              {countries.map((c) => (
                <option key={c._id} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-400">Commodity (optional)</span>
            <select
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="">None — country + risk only</option>
              {commodities.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg"
        >
          {submitting && <Loader2 className="animate-spin" size={18} />}
          {submitting ? "Analyzing…" : "Get recommendations"}
        </button>
      </form>

      {result && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-sm">
            <h2 className="text-white font-semibold mb-3">Signals used</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-gray-400">
              <dt>Risk score</dt>
              <dd className="text-white text-right">
                {result.signals.riskScore ?? "—"}{" "}
                {result.signals.riskLabel && (
                  <span className="text-gray-500">
                    ({result.signals.riskLabel})
                  </span>
                )}
              </dd>
              <dt>Inflation %</dt>
              <dd className="text-right text-white">
                {result.signals.inflation ?? "—"}
              </dd>
              <dt>Trade balance (USD B)</dt>
              <dd className="text-right text-white">
                {result.signals.tradeBalanceUsd ?? "—"}
              </dd>
              <dt>Price vol. (log σ)</dt>
              <dd className="text-right text-white">
                {result.signals.priceVolatilityStd != null
                  ? result.signals.priceVolatilityStd.toFixed(4)
                  : "—"}
              </dd>
            </dl>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">
              Recommendations
            </h2>
            <ul className="space-y-3">
              {result.recommendations.map((r) => (
                <li
                  key={r.id}
                  className={`rounded-xl border px-4 py-3 ${severityStyles[r.severity] || severityStyles.low}`}
                >
                  <div className="font-medium text-white">{r.title}</div>
                  <p className="text-sm mt-1 opacity-90">{r.detail}</p>
                  <span className="text-xs uppercase tracking-wide opacity-60 mt-2 inline-block">
                    {r.severity}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-gray-600 text-xs">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

export default Advisory;
