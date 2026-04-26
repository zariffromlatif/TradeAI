import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";

const API = API_BASE_URL;

const DATASETS = {
  countries: { label: "Countries", path: "countries" },
  commodities: { label: "Commodities", path: "commodities" },
  trade: { label: "Trade Records", path: "trade" },
};

const EMPTY_FORMS = {
  countries: {
    name: "",
    code: "",
    region: "",
    GDP: "",
    inflation: "",
    tradeBalance: "",
  },
  commodities: {
    name: "",
    category: "",
    unit: "",
    currentPrice: "",
  },
  trade: {
    reporter: "",
    partner: "",
    commodity: "",
    type: "export",
    volume: "",
    value: "",
    date: "",
  },
};

function asNumberOrUndefined(v) {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toIsoDateInput(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function AdminDatasets() {
  const { token } = useAuth();
  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token],
  );

  const [dataset, setDataset] = useState("countries");
  const [rows, setRows] = useState([]);
  const [countries, setCountries] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORMS.countries);
  const [editingId, setEditingId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeMeta = DATASETS[dataset];

  const loadReferenceData = async () => {
    try {
      const [countryRes, commodityRes] = await Promise.all([
        axios.get(`${API}/countries`, { headers: authHeaders }),
        axios.get(`${API}/commodities`, { headers: authHeaders }),
      ]);
      setCountries(countryRes.data || []);
      setCommodities(commodityRes.data || []);
    } catch {
      // Non-blocking; references are only required for trade form.
    }
  };

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API}/${activeMeta.path}`, {
        headers: authHeaders,
      });
      setRows(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to load ${activeMeta.label}.`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setForm(EMPTY_FORMS[dataset]);
    setEditingId("");
  }, [dataset]);

  useEffect(() => {
    loadRows();
    if (dataset === "trade") loadReferenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, token]);

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayload = () => {
    if (dataset === "countries") {
      return {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        region: form.region.trim(),
        GDP: asNumberOrUndefined(form.GDP),
        inflation: asNumberOrUndefined(form.inflation),
        tradeBalance: asNumberOrUndefined(form.tradeBalance),
      };
    }
    if (dataset === "commodities") {
      return {
        name: form.name.trim(),
        category: form.category.trim(),
        unit: form.unit.trim(),
        currentPrice: asNumberOrUndefined(form.currentPrice),
      };
    }
    return {
      reporter: form.reporter,
      partner: form.partner,
      commodity: form.commodity,
      type: form.type,
      volume: asNumberOrUndefined(form.volume),
      value: asNumberOrUndefined(form.value),
      date: form.date,
    };
  };

  const startEdit = (row) => {
    setEditingId(row._id);
    if (dataset === "countries") {
      setForm({
        name: row.name || "",
        code: row.code || "",
        region: row.region || "",
        GDP: row.GDP ?? "",
        inflation: row.inflation ?? "",
        tradeBalance: row.tradeBalance ?? "",
      });
      return;
    }
    if (dataset === "commodities") {
      setForm({
        name: row.name || "",
        category: row.category || "",
        unit: row.unit || "",
        currentPrice: row.currentPrice ?? "",
      });
      return;
    }
    setForm({
      reporter: row.reporter?._id || row.reporter || "",
      partner: row.partner?._id || row.partner || "",
      commodity: row.commodity?._id || row.commodity || "",
      type: row.type || "export",
      volume: row.volume ?? "",
      value: row.value ?? "",
      date: toIsoDateInput(row.date),
    });
  };

  const resetForm = () => {
    setForm(EMPTY_FORMS[dataset]);
    setEditingId("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = buildPayload();
      if (editingId) {
        await axios.put(`${API}/${activeMeta.path}/${editingId}`, payload, {
          headers: authHeaders,
        });
      } else {
        await axios.post(`${API}/${activeMeta.path}`, payload, {
          headers: authHeaders,
        });
      }
      await loadRows();
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const removeRow = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    setError("");
    try {
      await axios.delete(`${API}/${activeMeta.path}/${id}`, { headers: authHeaders });
      await loadRows();
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err.response?.data?.message || "Delete failed.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-100">Dataset CRUD</h1>
        <select
          value={dataset}
          onChange={(e) => setDataset(e.target.value)}
          className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-neutral-100"
        >
          {Object.entries(DATASETS).map(([key, item]) => (
            <option key={key} value={key}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={submit} className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-4 space-y-3">
        <h2 className="text-neutral-100 font-medium">
          {editingId ? "Edit" : "Add New"} {activeMeta.label.slice(0, -1)}
        </h2>

        {dataset === "countries" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" placeholder="Name" value={form.name} onChange={(e) => onChange("name", e.target.value)} required />
            <input className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" placeholder="Code (ISO)" value={form.code} onChange={(e) => onChange("code", e.target.value)} required />
            <input className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" placeholder="Region" value={form.region} onChange={(e) => onChange("region", e.target.value)} />
            <input type="number" step="any" className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" placeholder="GDP" value={form.GDP} onChange={(e) => onChange("GDP", e.target.value)} />
            <input type="number" step="any" className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" placeholder="Inflation" value={form.inflation} onChange={(e) => onChange("inflation", e.target.value)} />
            <input type="number" step="any" className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" placeholder="Trade Balance" value={form.tradeBalance} onChange={(e) => onChange("tradeBalance", e.target.value)} />
          </div>
        )}

        {dataset === "commodities" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" placeholder="Name" value={form.name} onChange={(e) => onChange("name", e.target.value)} required />
            <input className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" placeholder="Category" value={form.category} onChange={(e) => onChange("category", e.target.value)} />
            <input className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" placeholder="Unit" value={form.unit} onChange={(e) => onChange("unit", e.target.value)} />
            <input type="number" step="any" className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" placeholder="Current Price" value={form.currentPrice} onChange={(e) => onChange("currentPrice", e.target.value)} />
          </div>
        )}

        {dataset === "trade" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" value={form.reporter} onChange={(e) => onChange("reporter", e.target.value)} required>
              <option value="">Reporter country</option>
              {countries.map((c) => (
                <option key={c._id} value={c._id}>{c.name} ({c.code})</option>
              ))}
            </select>
            <select className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" value={form.partner} onChange={(e) => onChange("partner", e.target.value)} required>
              <option value="">Partner country</option>
              {countries.map((c) => (
                <option key={c._id} value={c._id}>{c.name} ({c.code})</option>
              ))}
            </select>
            <select className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" value={form.commodity} onChange={(e) => onChange("commodity", e.target.value)} required>
              <option value="">Commodity</option>
              {commodities.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            <select className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" value={form.type} onChange={(e) => onChange("type", e.target.value)} required>
              <option value="export">export</option>
              <option value="import">import</option>
            </select>
            <input type="number" step="any" className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" placeholder="Volume" value={form.volume} onChange={(e) => onChange("volume", e.target.value)} />
            <input type="number" step="any" className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100" placeholder="Value" value={form.value} onChange={(e) => onChange("value", e.target.value)} />
            <input type="date" className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 md:col-span-2" value={form.date} onChange={(e) => onChange("date", e.target.value)} required />
          </div>
        )}

        <div className="flex gap-2">
          <button type="submit" className="btn-ui btn-primary" disabled={submitting}>
            {submitting ? "Saving..." : editingId ? "Update" : "Add New"}
          </button>
          {editingId && (
            <button type="button" className="btn-ui btn-secondary" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
      </form>

      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl overflow-x-auto">
        {loading ? (
          <p className="text-neutral-400 p-6">Loading {activeMeta.label.toLowerCase()}...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="table-head">
              {dataset === "countries" && (
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Region</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              )}
              {dataset === "commodities" && (
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="px-4 py-3 text-left">Price</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              )}
              {dataset === "trade" && (
                <tr>
                  <th className="px-4 py-3 text-left">Reporter</th>
                  <th className="px-4 py-3 text-left">Partner</th>
                  <th className="px-4 py-3 text-left">Commodity</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {rows.map((row) => (
                <tr key={row._id}>
                  {dataset === "countries" && (
                    <>
                      <td className="px-4 py-3 text-neutral-100">{row.name}</td>
                      <td className="px-4 py-3 text-neutral-300">{row.code}</td>
                      <td className="px-4 py-3 text-neutral-300">{row.region || "-"}</td>
                    </>
                  )}
                  {dataset === "commodities" && (
                    <>
                      <td className="px-4 py-3 text-neutral-100">{row.name}</td>
                      <td className="px-4 py-3 text-neutral-300">{row.category || "-"}</td>
                      <td className="px-4 py-3 text-neutral-300">{row.unit || "-"}</td>
                      <td className="px-4 py-3 text-neutral-300">
                        {row.currentPrice != null ? Number(row.currentPrice).toLocaleString() : "-"}
                      </td>
                    </>
                  )}
                  {dataset === "trade" && (
                    <>
                      <td className="px-4 py-3 text-neutral-100">{row.reporter?.name || "-"}</td>
                      <td className="px-4 py-3 text-neutral-300">{row.partner?.name || "-"}</td>
                      <td className="px-4 py-3 text-neutral-300">{row.commodity?.name || "-"}</td>
                      <td className="px-4 py-3 text-neutral-300">{row.type}</td>
                      <td className="px-4 py-3 text-neutral-300">{toIsoDateInput(row.date)}</td>
                    </>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" className="btn-ui btn-secondary !h-8" onClick={() => startEdit(row)}>
                        Edit
                      </button>
                      <button type="button" className="btn-ui btn-secondary !h-8" onClick={() => removeRow(row._id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={dataset === "trade" ? 6 : 5} className="px-4 py-8 text-center text-neutral-500">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
