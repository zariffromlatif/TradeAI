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
  });
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");

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
    axios
      .get(`${API}/analytics/dashboard`)
      .then((res) => setDashboard(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">Loading dashboard...</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">
          Trade Intelligence Dashboard
        </h1>
        <button
          type="button"
          onClick={downloadTradeSummaryPdf}
          disabled={pdfLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <FileDown size={18} className="text-emerald-400" />
          {pdfLoading ? "Preparing PDF…" : "Download PDF report"}
        </button>
      </div>
      {pdfError && (
        <p className="text-sm text-red-400">{pdfError}</p>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Globe className="text-emerald-400" size={20} />}
          title="Top Exporter"
          value={dashboard.topExporters[0]?.country || "—"}
          subtitle="By total export value"
        />
        <StatCard
          icon={<TrendingDown className="text-blue-400" size={20} />}
          title="Top Importer"
          value={dashboard.topImporters[0]?.country || "—"}
          subtitle="By total import value"
        />
        <StatCard
          icon={<TrendingUp className="text-yellow-400" size={20} />}
          title="Countries Tracked"
          value={dashboard.topExporters.length}
          subtitle="In export rankings"
        />
        <StatCard
          icon={<Activity className="text-purple-400" size={20} />}
          title="Data Points"
          value="150+"
          subtitle="Trade records loaded"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Exporters */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Top 5 Exporters</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dashboard.topExporters}>
              <XAxis
                dataKey="country"
                tick={{ fill: "#9CA3AF", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "none",
                  color: "#fff",
                }}
                formatter={(v) => [
                  `$${(v / 1000000).toFixed(2)}M`,
                  "Export Value",
                ]}
              />
              <Bar dataKey="totalExportValue" radius={[4, 4, 0, 0]}>
                {dashboard.topExporters.map((_, i) => (
                  <Cell key={i} fill="#34D399" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Importers */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Top 5 Importers</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dashboard.topImporters}>
              <XAxis
                dataKey="country"
                tick={{ fill: "#9CA3AF", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "none",
                  color: "#fff",
                }}
                formatter={(v) => [
                  `$${(v / 1000000).toFixed(2)}M`,
                  "Import Value",
                ]}
              />
              <Bar dataKey="totalImportValue" radius={[4, 4, 0, 0]}>
                {dashboard.topImporters.map((_, i) => (
                  <Cell key={i} fill="#60A5FA" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
