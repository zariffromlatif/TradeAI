import { useEffect, useState } from "react";
import axios from "axios";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { API_BASE_URL } from "../config/api";

const API = API_BASE_URL;

function Alerts() {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API}/orders/anomalies`)
      .then((res) => setAnomalies(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="text-[#8ab4ff]" size={28} />
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">Risk Notifications</h1>
      </div>

      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        {loading ? (
          <p className="text-neutral-400 text-center py-16">Loading alerts...</p>
        ) : anomalies.length === 0 ? (
          <p className="text-neutral-400 text-center py-16">No active anomalies detected. System is operating normally.</p>
        ) : (
          <div className="divide-y divide-[#2a2a2a]">
            {anomalies.map((alert) => (
              <div key={alert._id} className="p-6 hover:bg-[#171717] transition-colors">
                <div className="flex items-start gap-4">
                  <div className="bg-[#8ab4ff]/10 border border-[#8ab4ff]/20 p-2 rounded-lg mt-1">
                    <AlertTriangle className="text-[#8ab4ff]" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-neutral-100 mb-1">
                      {alert.anomalyReason || "Suspicious Trade Volume Detected"}
                    </h3>
                    <div className="text-sm text-neutral-400 space-y-1">
                      <p>
                        <span className="text-neutral-300 font-medium capitalize">{alert.type}</span> order for 
                        <span className="text-neutral-300 font-medium"> {alert.commodity?.name}</span> associated with 
                        <span className="text-neutral-300 font-medium"> {alert.country?.name}</span>.
                      </p>
                      <p>
                        Quantity: {alert.quantity.toLocaleString()} | Total Value: ${(alert.totalValue).toLocaleString()}
                      </p>
                      <p className="text-xs text-neutral-500 mt-2">
                        Detected: {new Date(alert.createdAt).toLocaleString()} | Order ID: {alert._id}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Alerts;