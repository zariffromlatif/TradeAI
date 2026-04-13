import { useEffect, useState } from "react";
import axios from "axios";
import { Package, AlertTriangle } from "lucide-react";

const API = "http://localhost:5000/api";

const STATUS_OPTIONS = ["pending", "active", "completed", "cancelled"];

function Orders() {
  const [orders, setOrders] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    commodity: "",
    country: "",
    type: "buy",
    quantity: "",
    pricePerUnit: "",
    notes: "",
  });

  const loadOrders = () => {
    return axios
      .get(`${API}/orders`)
      .then((res) => setOrders(res.data))
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load orders.");
      });
  };

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      axios.get(`${API}/commodities`),
      axios.get(`${API}/countries`),
      loadOrders(),
    ])
      .then(([resC, resCo]) => {
        setCommodities(resC.data);
        setCountries(resCo.data);
        if (resC.data.length) {
          setForm((f) => ({ ...f, commodity: resC.data[0]._id }));
        }
        if (resCo.data.length) {
          setForm((f) => ({ ...f, country: resCo.data[0]._id }));
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load data.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await axios.post(`${API}/orders`, {
        commodity: form.commodity,
        country: form.country,
        type: form.type,
        quantity: Number(form.quantity),
        pricePerUnit: Number(form.pricePerUnit),
        notes: form.notes.trim() || undefined,
      });
      setForm((f) => ({
        ...f,
        quantity: "",
        pricePerUnit: "",
        notes: "",
      }));
      await loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Create failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/orders/${orderId}`, { status });
      await loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || "Update failed.");
    }
  };

  if (loading) {
    return <p className="text-gray-400">Loading orders…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Package className="text-emerald-400" size={28} />
        <h1 className="text-2xl font-bold text-white">Simulated Orders</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Create form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">New order</h2>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-400">Commodity</span>
            <select
              name="commodity"
              value={form.commodity}
              onChange={handleChange}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              required
            >
              {commodities.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} (${c.currentPrice})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-400">Country</span>
            <select
              name="country"
              value={form.country}
              onChange={handleChange}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              required
            >
              {countries.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-400">Type</span>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-400">Quantity</span>
            <input
              name="quantity"
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={handleChange}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-400">Price per unit</span>
            <input
              name="pricePerUnit"
              type="number"
              min="0"
              step="0.01"
              value={form.pricePerUnit}
              onChange={handleChange}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-gray-400">Notes (optional)</span>
            <input
              name="notes"
              type="text"
              value={form.notes}
              onChange={handleChange}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              placeholder="Internal note"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg"
            >
              {submitting ? "Creating…" : "Create order"}
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">All orders</h2>
          <span className="text-sm text-gray-500">{orders.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800/50 text-gray-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Commodity</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No orders yet.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o._id} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {o.createdAt
                        ? new Date(o.createdAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-white">{o.country?.name}</td>
                    <td className="px-4 py-3 text-white">
                      {o.commodity?.name}
                    </td>
                    <td className="px-4 py-3 capitalize">{o.type}</td>
                    <td className="px-4 py-3 text-right">
                      {o.quantity?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      ${o.totalValue?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={o.status}
                        onChange={(e) => updateStatus(o._id, e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {o.isAnomaly ? (
                        <span
                          className="inline-flex items-center gap-1 text-amber-400 text-xs"
                          title={o.anomalyReason || ""}
                        >
                          <AlertTriangle size={14} />
                          Anomaly
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Orders;
