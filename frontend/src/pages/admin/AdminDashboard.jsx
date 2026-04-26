import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";

const API = API_BASE_URL;

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios
      .get(`${API}/admin/dashboard-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-100">Admin Dashboard</h1>
      {!stats ? (
        <p className="text-neutral-400">Loading stats...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            ["Users", stats.users],
            ["Pending payments", stats.pendingPayments],
            ["Flagged orders", stats.flaggedOrders],
            ["Trade records", stats.tradeRecords],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-4">
              <p className="text-sm text-neutral-400">{label}</p>
              <p className="text-2xl text-neutral-100 font-semibold">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
