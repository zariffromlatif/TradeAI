import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";

const API = API_BASE_URL;

export default function AdminRiskAlerts() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [thresholds, setThresholds] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [form, setForm] = useState({
    countryCode: "BD",
    riskScore: "60",
    fxVolatility: "0.02",
  });

  const load = () =>
    Promise.all([
      axios.get(`${API}/risk-alerts/thresholds`, { headers }),
      axios.get(`${API}/risk-alerts/active`, { headers }),
    ])
      .then(([t, a]) => {
        setThresholds(t.data);
        setAlerts(a.data || []);
      })
      .catch(() => {
        setThresholds(null);
        setAlerts([]);
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const saveThresholds = async () => {
    if (!thresholds) return;
    await axios.put(
      `${API}/risk-alerts/thresholds`,
      {
        criticalRiskScore: Number(thresholds.criticalRiskScore),
        warningRiskScore: Number(thresholds.warningRiskScore),
        criticalFxVolatility: Number(thresholds.criticalFxVolatility),
        warningFxVolatility: Number(thresholds.warningFxVolatility),
      },
      { headers },
    );
    load();
  };

  const evaluate = async () => {
    await axios.post(
      `${API}/risk-alerts/evaluate`,
      {
        countryCode: form.countryCode,
        riskScore: Number(form.riskScore),
        fxVolatility: Number(form.fxVolatility),
      },
      { headers },
    );
    load();
  };

  const dismiss = async (id) => {
    await axios.post(`${API}/risk-alerts/${id}/dismiss`, {}, { headers });
    load();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-neutral-100">Risk & Alerts</h1>
      {thresholds && (
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
          <h2 className="text-neutral-100 font-medium">Thresholds</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              "criticalRiskScore",
              "warningRiskScore",
              "criticalFxVolatility",
              "warningFxVolatility",
            ].map((key) => (
              <input
                key={key}
                value={thresholds[key]}
                onChange={(e) => setThresholds((p) => ({ ...p, [key]: e.target.value }))}
                className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 text-sm"
              />
            ))}
          </div>
          <button className="btn-ui btn-primary" onClick={saveThresholds}>Save thresholds</button>
        </div>
      )}

      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
        <h2 className="text-neutral-100 font-medium">Evaluate & Trigger Alerts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            value={form.countryCode}
            onChange={(e) => setForm((p) => ({ ...p, countryCode: e.target.value }))}
            placeholder="Country code"
            className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 text-sm"
          />
          <input
            value={form.riskScore}
            onChange={(e) => setForm((p) => ({ ...p, riskScore: e.target.value }))}
            placeholder="Risk score"
            className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 text-sm"
          />
          <input
            value={form.fxVolatility}
            onChange={(e) => setForm((p) => ({ ...p, fxVolatility: e.target.value }))}
            placeholder="FX volatility"
            className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 text-sm"
          />
        </div>
        <button className="btn-ui btn-secondary" onClick={evaluate}>Run evaluation</button>
      </div>

      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-4">
        <h2 className="text-neutral-100 font-medium mb-3">Active Alerts</h2>
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a._id} className="border border-[#2a2a2a] rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-neutral-100">{a.title}</p>
                <p className="text-xs text-neutral-400">{a.message}</p>
              </div>
              <button className="btn-ui btn-secondary !h-8" onClick={() => dismiss(a._id)}>Dismiss</button>
            </div>
          ))}
          {alerts.length === 0 && <p className="text-sm text-neutral-400">No active alerts.</p>}
        </div>
      </div>
    </div>
  );
}
