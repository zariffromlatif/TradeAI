import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { tierIsPaid } from "../config/tiers";

const API = API_BASE_URL;

export default function PaymentRequests() {
  const { token, user, refreshTokenClaims } = useAuth();
  const [amount, setAmount] = useState("29.99");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");
  const [requestTierUpgrade, setRequestTierUpgrade] = useState(true);
  const [requestedTier, setRequestedTier] = useState("gold");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (requestTierUpgrade) {
      if (requestedTier === "gold") setAmount("29.99");
      else if (requestedTier === "diamond") setAmount("79.99");
    }
  }, [requestedTier, requestTierUpgrade]);

  const loadMine = () =>
    axios
      .get(`${API}/payment-requests/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(async (res) => {
        const list = res.data || [];
        setRows(list);
        const hasApprovedTierUpgrade = list.some(
          (r) => r.status === "approved" && r.requestTierUpgrade,
        );
        if (hasApprovedTierUpgrade && user && !tierIsPaid(user.tier)) {
          await refreshTokenClaims();
          setInfo("Tier upgrade detected. Session claims refreshed.");
        }
      })
      .catch(() => setRows([]));

  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await axios.post(
        `${API}/payment-requests`,
        {
          amount: Number(amount),
          currency,
          note,
          requestTierUpgrade,
          ...(requestTierUpgrade ? { requestedTier } : {}),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setNote("");
      await loadMine();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit request.");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-100">Payment Requests</h1>
      <form onSubmit={submit} className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
            placeholder="Amount"
          />
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
            placeholder="Currency"
          />
          <button type="submit" className="btn-ui btn-primary">Submit request</button>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={requestTierUpgrade}
            onChange={(e) => setRequestTierUpgrade(e.target.checked)}
          />
          Request paid tier upgrade on approval
        </label>
        {requestTierUpgrade && (
          <label className="flex flex-col gap-1 text-sm max-w-xs">
            <span className="text-neutral-500">Target tier (admin grants on approve)</span>
            <select
              value={requestedTier}
              onChange={(e) => setRequestedTier(e.target.value)}
              className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
            >
              <option value="gold">Gold</option>
              <option value="diamond">Diamond</option>
            </select>
          </label>
        )}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
          placeholder="Optional note"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        {info && <p className="text-sm text-emerald-300">{info}</p>}
      </form>

      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Tier ask</th>
              <th className="px-4 py-3 text-left">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2a2a]">
            {rows.map((r) => (
              <tr key={r._id}>
                <td className="px-4 py-3 text-neutral-300">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-neutral-100">{r.currency} {Number(r.amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-neutral-300">{r.status}</td>
                <td className="px-4 py-3 text-neutral-400">
                  {r.requestTierUpgrade ? r.requestedTier || "gold" : "—"}
                </td>
                <td className="px-4 py-3 text-neutral-400">{r.note || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
