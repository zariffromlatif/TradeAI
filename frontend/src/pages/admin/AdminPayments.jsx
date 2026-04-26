import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import { tierIsPaid } from "../../config/tiers";

const API = API_BASE_URL;

export default function AdminPayments() {
  const { token } = useAuth();
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);

  const loadRows = () =>
    axios
      .get(`${API}/payment-requests`, {
        params: status ? { status } : {},
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setRows(res.data || []))
      .catch(() => setRows([]));

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const review = async (id, decision) => {
    const res = await axios.post(
      `${API}/payment-requests/${id}/review`,
      { decision, reviewNote: `${decision} by admin` },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (
      decision === "approved" &&
      res.data?.request?.requestTierUpgrade &&
      tierIsPaid(res.data?.request?.requesterId?.tier)
    ) {
      alert(`Tier upgraded to ${res.data.request.requesterId.tier}`);
    }
    loadRows();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-100">Payment Requests</h1>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-neutral-100"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Upgrade</th>
              <th className="px-4 py-3 text-left">Tier ask</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2a2a]">
            {rows.map((r) => (
              <tr key={r._id}>
                <td className="px-4 py-3 text-neutral-100">{r.requesterId?.email}</td>
                <td className="px-4 py-3 text-neutral-300">{r.currency} {Number(r.amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-neutral-300">{r.status}</td>
                <td className="px-4 py-3 text-neutral-300">{r.requestTierUpgrade ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-neutral-400">
                  {r.requestTierUpgrade ? r.requestedTier || "gold" : "—"}
                </td>
                <td className="px-4 py-3">
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <button className="btn-ui btn-primary !h-8" onClick={() => review(r._id, "approved")}>
                        Approve
                      </button>
                      <button className="btn-ui btn-secondary !h-8" onClick={() => review(r._id, "rejected")}>
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
