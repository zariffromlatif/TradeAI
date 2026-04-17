import { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Globe, TrendingUp, TrendingDown, Activity, FileDown } from "lucide-react";
import StatCard from "../components/StatCard";

const API = "http://localhost:5000/api";

function Dashboard() {
  const [dashboard, setDashboard] = useState({
    topExporters: [],
    topImporters: [],
    countriesTracked: 0,
    tradeRecordCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [partnerProfiles, setPartnerProfiles] = useState([]);
  const [partnerMeta, setPartnerMeta] = useState({
    count: 0,
    verifiedCount: 0,
    unverifiedCount: 0,
    lastVerifiedAt: null,
  });
  const [partnerLoading, setPartnerLoading] = useState(true);
  const [partnerError, setPartnerError] = useState("");

  const downloadTradeSummaryPdf = async () => {
    setPdfError("");
    setPdfLoading(true);
    try {
      const res = await axios.get(`${API}/reports/trade-summary`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tradeai-trade-summary.pdf";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(
        err.response?.data?.message || err.message || "PDF download failed.",
      );
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    setPartnerLoading(true);
    setPartnerError(""); 
    axios
      .get(`${API}/analytics/dashboard`)
      .then((res) => setDashboard(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

    axios
      .get(`${API}/analytics/partners/BD`)
      .then((res) => {
        setPartnerProfiles(res.data?.data || []);
        setPartnerMeta({
          count: res.data?.count || 0,
          verifiedCount: res.data?.verifiedCount || 0,
          unverifiedCount: res.data?.unverifiedCount || 0,
          lastVerifiedAt: res.data?.lastVerifiedAt || null,
        });
      })
      .catch((err) => setPartnerError(err.response?.data?.message || "Failed to load partner profiles."))
      .finally(() => setPartnerLoading(false));
  }, []);

  if (loading) return <p className="text-neutral-400">Loading dashboard...</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">
          Trade Intelligence Dashboard
        </h1>
        <button
          type="button"
          onClick={downloadTradeSummaryPdf}
          disabled={pdfLoading}
          className="btn-ui btn-secondary inline-flex items-center justify-center gap-2"
        >
          <FileDown size={18} className="text-[#8ab4ff]" />
          {pdfLoading ? "Preparing PDF…" : "Download PDF report"}
        </button>
      </div>
      {pdfError && (
        <p className="text-sm text-red-300">{pdfError}</p>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Globe className="text-[#8ab4ff]" size={20} />}
          title="Top Exporter"
          value={dashboard.topExporters[0]?.country || "—"}
          subtitle="By total export value"
        />
        <StatCard
          icon={<TrendingDown className="text-neutral-300" size={20} />}
          title="Top Importer"
          value={dashboard.topImporters[0]?.country || "—"}
          subtitle="By total import value"
        />
        <StatCard
          icon={<TrendingUp className="text-neutral-300" size={20} />}
          title="Countries Tracked"
          value={dashboard.countriesTracked || "—"}
          subtitle="In country reference data"
        />
        <StatCard
          icon={<Activity className="text-neutral-300" size={20} />}
          title="Verified Records"
          value={dashboard.tradeRecordCount || "0"}
          subtitle="Official trade records loaded"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Exporters */}
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5">
          <h2 className="text-neutral-100 font-semibold mb-4">Top 5 Exporters</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dashboard.topExporters}>
              <XAxis
                dataKey="country"
                tick={{ fill: "#a3a3a3", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "#a3a3a3", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111111",
                  border: "1px solid #2a2a2a",
                  color: "#f5f5f5",
                }}
                labelStyle={{ color: "#e5e5e5" }}
                itemStyle={{ color: "#f5f5f5" }}
                formatter={(v) => [
                  `$${(v / 1000000).toFixed(2)}M`,
                  "Export Value",
                ]}
              />
              <Bar dataKey="totalExportValue" radius={[4, 4, 0, 0]}>
                {dashboard.topExporters.map((_, i) => (
                  <Cell key={i} fill="#8ab4ff" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Importers */}
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5">
          <h2 className="text-neutral-100 font-semibold mb-4">Top 5 Importers</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dashboard.topImporters}>
              <XAxis
                dataKey="country"
                tick={{ fill: "#a3a3a3", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "#a3a3a3", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111111",
                  border: "1px solid #2a2a2a",
                  color: "#f5f5f5",
                }}
                labelStyle={{ color: "#e5e5e5" }}
                itemStyle={{ color: "#f5f5f5" }}
                formatter={(v) => [
                  `$${(v / 1000000).toFixed(2)}M`,
                  "Import Value",
                ]}
              />
              <Bar dataKey="totalImportValue" radius={[4, 4, 0, 0]}>
                {dashboard.topImporters.map((_, i) => (
                  <Cell key={i} fill="#e5e5e5" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Partner Profiles */}
      <section className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4">
          Bangladesh Partner Intelligence
        </h2>
        <p className="text-xs text-neutral-400 mb-4">
          Profiles: {partnerMeta.count} | Verified: {partnerMeta.verifiedCount} | Pending: {partnerMeta.unverifiedCount}
          {partnerMeta.lastVerifiedAt
            ? ` | Last verified: ${new Date(partnerMeta.lastVerifiedAt).toLocaleDateString()}`
            : ""}
        </p>

        {partnerLoading ? (
          <p className="text-neutral-400">Loading partner insights...</p>
        ) : partnerError ? (
          <p className="text-red-300">{partnerError}</p>
        ) : partnerProfiles.length === 0 ? (
          <p className="text-neutral-400">No partner data found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {partnerProfiles.map((p) => {
              const firstStat = (p.stats || []).find((s) => s?.source || s?.asOf);
              return (
                <div
                  key={p.partnerCode}
                  className="rounded-xl border border-[#2a2a2a] p-4 bg-[#171717]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-neutral-100 font-medium">
                      {p.partnerName} ({p.partnerCode})
                    </h3>
                    <span className="text-xs px-2 py-1 rounded bg-[#1f1f1f] text-neutral-300 border border-[#2a2a2a]">
                      {p.relationshipRole}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 mb-2">
                    Source: {firstStat?.source || p.sourceType} | Verified: {p.verified ? "Yes" : "No"}
                    {firstStat?.asOf
                      ? ` | As of: ${new Date(firstStat.asOf).toLocaleDateString()}`
                      : ""}
                  </p>

                  <p className="text-sm text-neutral-300 mb-1">
                    <strong>Imports:</strong> {(p.imports || []).join(", ")}
                  </p>
                  <p className="text-sm text-neutral-300 mb-2">
                    <strong>Exports:</strong> {(p.exports || []).join(", ")}
                  </p>

                  {(p.insights || []).length > 0 && (
                    <p className="text-sm text-[#cfd8e6]">{p.insights[0]}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
