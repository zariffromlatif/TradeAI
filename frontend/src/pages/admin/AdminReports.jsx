import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";

const ALL_SECTIONS = ["analytics", "risk", "forecast", "advisory"];

export default function AdminReports() {
  const { token, user } = useAuth();
  const [title, setTitle] = useState("TradeAI Intelligence Report");
  const [countryCode, setCountryCode] = useState("");
  const [commodityId, setCommodityId] = useState("");
  const [scope, setScope] = useState("self");
  const [sections, setSections] = useState(["analytics", "risk", "forecast", "advisory"]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [commodities, setCommodities] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [metrics, setMetrics] = useState(null);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const loadHistory = async () => {
    try {
      const qs = new URLSearchParams();
      qs.set("scope", "all");
      if (historyStatus) qs.set("status", historyStatus);
      if (historyFrom) qs.set("from", historyFrom);
      if (historyTo) qs.set("to", historyTo);
      const res = await axios.get(`${API_BASE_URL}/reports/history?${qs.toString()}`, {
        headers: authHeaders,
      });
      setRows(res.data || []);
    } catch (e) {
      setErr(e.response?.data?.message || "Failed to load report history.");
    }
  };

  const loadMetrics = async () => {
    if (user?.role !== "admin") return;
    try {
      const res = await axios.get(`${API_BASE_URL}/reports/metrics`, {
        headers: authHeaders,
      });
      setMetrics(res.data);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/commodities`)
      .then((res) => setCommodities(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (token) loadHistory();
    if (token) loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.role]);

  useEffect(() => {
    if (!token) return undefined;
    const timer = setInterval(() => {
      loadHistory();
      loadMetrics();
    }, 8000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.role]);

  const toggleSection = (key) => {
    setSections((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  };

  const createReport = async () => {
    setLoading(true);
    setMsg("");
    setErr("");
    try {
      const payload = {
        title,
        countryCode: countryCode || null,
        commodityId: commodityId || null,
        scope,
        sections,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      };
      await axios.post(`${API_BASE_URL}/reports/generate`, payload, {
        headers: authHeaders,
      });
      setMsg("Report job created. If status is ready, you can download immediately.");
      await loadHistory();
    } catch (e) {
      setErr(e.response?.data?.message || "Failed to create report.");
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (id) => {
    setErr("");
    try {
      const res = await axios.get(`${API_BASE_URL}/reports/${id}/download`, {
        responseType: "blob",
        headers: authHeaders,
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tradeai-report-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e.response?.data?.message || "Download failed.");
    }
  };

  const retryReport = async (id) => {
    setErr("");
    setMsg("");
    setActionLoadingId(id);
    try {
      await axios.post(
        `${API_BASE_URL}/reports/${id}/retry`,
        {},
        { headers: authHeaders },
      );
      setMsg("Report re-queued.");
      await loadHistory();
    } catch (e) {
      setErr(e.response?.data?.message || "Retry failed.");
    } finally {
      setActionLoadingId("");
    }
  };

  const cancelReport = async (id) => {
    setErr("");
    setMsg("");
    setActionLoadingId(id);
    try {
      await axios.post(
        `${API_BASE_URL}/reports/${id}/cancel`,
        {},
        { headers: authHeaders },
      );
      setMsg("Report cancelled.");
      await loadHistory();
    } catch (e) {
      setErr(e.response?.data?.message || "Cancel failed.");
    } finally {
      setActionLoadingId("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5">
        <h1 className="text-xl font-semibold text-neutral-100 mb-1">Automated Intelligence Reports</h1>
        <p className="text-sm text-neutral-400 mb-4">
          Configure report scope/sections, generate a report job, then download from history.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
            placeholder="Report title"
          />
          <input
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
            className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
            placeholder="Country code (optional, e.g. BD)"
          />
          <select
            value={commodityId}
            onChange={(e) => setCommodityId(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
          >
            <option value="">All commodities</option>
            {commodities.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
          >
            <option value="self">Self scope</option>
            <option value="admin_all">Admin all scope</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {ALL_SECTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSection(s)}
              className={`px-3 py-1 rounded-full border text-xs ${
                sections.includes(s)
                  ? "bg-[#8ab4ff] text-black border-[#8ab4ff]"
                  : "bg-[#171717] text-neutral-300 border-[#2a2a2a]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={createReport}
            disabled={loading || sections.length === 0}
            className="btn-ui btn-primary"
          >
            {loading ? "Generating..." : "Generate report"}
          </button>
        </div>
        {msg && <p className="text-sm text-green-300 mt-2">{msg}</p>}
        {err && <p className="text-sm text-red-300 mt-2">{err}</p>}
      </div>

      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5">
        <h2 className="text-lg text-neutral-100 font-semibold mb-3">Report history</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          <select
            value={historyStatus}
            onChange={(e) => setHistoryStatus(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
          >
            <option value="">All statuses</option>
            <option value="pending">pending</option>
            <option value="ready">ready</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
          </select>
          <input
            type="date"
            value={historyFrom}
            onChange={(e) => setHistoryFrom(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
          />
          <input
            type="date"
            value={historyTo}
            onChange={(e) => setHistoryTo(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
          />
        </div>
        <button
          type="button"
          onClick={loadHistory}
          className="btn-ui btn-secondary mb-3"
        >
          Apply history filters
        </button>
        {metrics && user?.role === "admin" ? (
          <p className="text-xs text-neutral-400 mb-3">
            Queue: waiting {metrics.queue?.waiting ?? 0}, active {metrics.queue?.active ?? 0}, delayed{" "}
            {metrics.queue?.delayed ?? 0}, failed {metrics.queue?.failed ?? 0} | Jobs: ready{" "}
            {metrics.jobs?.ready ?? 0}, pending {metrics.jobs?.pending ?? 0}, failed {metrics.jobs?.failed ?? 0},
            cancelled {metrics.jobs?.cancelled ?? 0} | Files: {metrics.storage?.files ?? 0}
          </p>
        ) : null}
        {!rows.length ? (
          <p className="text-sm text-neutral-400">No reports generated yet.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div
                key={r._id}
                className="border border-[#2a2a2a] rounded-lg p-3 bg-[#171717] flex flex-col md:flex-row md:items-center md:justify-between gap-2"
              >
                <div>
                  <p className="text-sm text-neutral-100">{r.title}</p>
                  <p className="text-xs text-neutral-400">
                    Status: {r.status} | Scope: {r.scope} | Sections: {(r.sections || []).join(", ")}
                  </p>
                  {r.errorMessage ? (
                    <p className="text-xs text-red-300">Error: {r.errorMessage}</p>
                  ) : null}
                  <p className="text-xs text-neutral-500">
                    Owner: {r.ownerId?.email || "n/a"} | Created: {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={r.status !== "ready"}
                    onClick={() => downloadReport(r._id)}
                    className="btn-ui btn-secondary disabled:opacity-50"
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    disabled={r.status !== "pending" || actionLoadingId === r._id}
                    onClick={() => cancelReport(r._id)}
                    className="btn-ui btn-secondary disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!["failed", "cancelled"].includes(r.status) || actionLoadingId === r._id}
                    onClick={() => retryReport(r._id)}
                    className="btn-ui btn-secondary disabled:opacity-50"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
