import { useEffect, useState } from "react";
import axios from "axios";
import { AlertTriangle, ShieldAlert } from "lucide-react";

const API = "http://localhost:5000/api";

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
        <ShieldAlert className="text-red-500" size={28} />
        <h1 className="text-2xl font-bold text-white">Risk Notifications</h1>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-gray-400 text-center py-16">Loading alerts...</p>
        ) : anomalies.length === 0 ? (
          <p className="text-gray-400 text-center py-16">No active anomalies detected. System is operating normally.</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {anomalies.map((alert) => (
              <div key={alert._id} className="p-6 hover:bg-gray-800/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="bg-red-500/10 p-2 rounded-lg mt-1">
                    <AlertTriangle className="text-red-400" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white mb-1">
                      {alert.anomalyReason || "Suspicious Trade Volume Detected"}
                    </h3>
                    <div className="text-sm text-gray-400 space-y-1">
                      <p>
                        <span className="text-gray-300 font-medium capitalize">{alert.type}</span> order for 
                        <span className="text-gray-300 font-medium"> {alert.commodity?.name}</span> associated with 
                        <span className="text-gray-300 font-medium"> {alert.country?.name}</span>.
                      </p>
                      <p>
                        Quantity: {alert.quantity.toLocaleString()} | Total Value: ${(alert.totalValue).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
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