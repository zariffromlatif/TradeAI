import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";

const API = API_BASE_URL;
const TRANSITIONS = {
  draft: ["submitted", "cancelled"],
  submitted: ["payment_pending", "cancelled"],
  payment_pending: ["confirmed", "cancelled"],
  confirmed: ["in_transit", "cancelled"],
  in_transit: ["delivered", "cancelled"],
  delivered: ["settled", "cancelled"],
  settled: [],
  cancelled: [],
};

export default function AdminOrdersAnomalies() {
  const { token } = useAuth();
  const [anomalies, setAnomalies] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([axios.get(`${API}/orders/anomalies`, { headers }), axios.get(`${API}/orders`, { headers })])
      .then(([a, o]) => {
        setAnomalies(a.data || []);
        setOrders(o.data || []);
      })
      .catch(() => {
        setAnomalies([]);
        setOrders([]);
      });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const anomalyAction = async (orderId, action) => {
    await axios.post(
      `${API}/orders/${orderId}/anomaly-action`,
      { action, note: `${action} by admin panel` },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    load();
  };

  const transitionOrder = async (orderId, toStatus) => {
    await axios.patch(
      `${API}/orders/${orderId}/transition`,
      { toStatus },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    load();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-neutral-100">Orders & Anomalies</h1>
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-4">
        <h2 className="text-neutral-100 font-medium mb-2">Flagged Orders</h2>
        {anomalies.length === 0 ? (
          <p className="text-sm text-neutral-400">No anomalies.</p>
        ) : (
          <div className="space-y-2">
            {anomalies.map((o) => (
              <div key={o._id} className="border border-[#2a2a2a] rounded-lg p-3 text-sm text-neutral-300 flex items-center justify-between gap-3">
                <div>
                  <p>{o.anomalyReason || "Anomaly"} - {o.commodity?.name} - ${Number(o.totalValue || 0).toLocaleString()}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Stage: {o.anomalyStage || "rule"} | Status: {o.anomalyStatus || "open"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-ui btn-secondary !h-8" onClick={() => anomalyAction(o._id, "dismiss")}>
                    Dismiss
                  </button>
                  <button className="btn-ui btn-primary !h-8" onClick={() => anomalyAction(o._id, "escalate")}>
                    Escalate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-4">
        <h2 className="text-neutral-100 font-medium mb-2">All Orders</h2>
        <p className="text-sm text-neutral-400 mb-2">Total orders: {orders.length}</p>
        <div className="space-y-2">
          {orders.slice(0, 20).map((o) => (
            <button
              key={o._id}
              type="button"
              onClick={() => setSelected(o)}
              className="w-full text-left border border-[#2a2a2a] rounded-lg p-2 text-sm text-neutral-300 hover:bg-[#171717]"
            >
              {o.commodity?.name} | {o.status} | ${Number(o.totalValue || 0).toLocaleString()}
            </button>
          ))}
        </div>
        {selected && (
          <div className="mt-3 border border-[#2a2a2a] rounded-lg p-3 text-sm text-neutral-300 bg-[#171717]">
            <p className="text-neutral-100 font-medium mb-2">Order details</p>
            <p>ID: {selected._id}</p>
            <p>Status: {selected.status}</p>
            <p>Anomaly flag: {selected.isAnomaly ? "Yes" : "No"}</p>
            <p>Detection stage: {selected.anomalyStage || "none"}</p>
            <p>Reason: {selected.anomalyReason || "-"}</p>
            <p>Anomaly review status: {selected.anomalyStatus || "open"}</p>
            {selected.anomalyReason ? (
              <div className="mt-2">
                <p className="text-neutral-100 mb-1">Detection report</p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-neutral-400">
                  {selected.anomalyReason
                    .split(".")
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .map((line, idx) => (
                      <li key={`${idx}-${line}`}>{line}.</li>
                    ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-3">
              <p className="text-neutral-100 mb-1">Lifecycle transition</p>
              <div className="flex flex-wrap gap-2">
                {(TRANSITIONS[selected.status] || []).map((next) => (
                  <button
                    key={next}
                    className="btn-ui btn-secondary !h-8"
                    onClick={() => transitionOrder(selected._id, next)}
                  >
                    Move to {next}
                  </button>
                ))}
                {(TRANSITIONS[selected.status] || []).length === 0 && (
                  <span className="text-xs text-neutral-500">No further transitions.</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
