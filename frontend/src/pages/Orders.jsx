import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Package, MessagesSquare, Handshake, AlertTriangle } from "lucide-react";
import BidComparisonMatrix from "../components/BidComparisonMatrix";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config/api";

const API = API_BASE_URL;

const RFQ_STATUS_OPTIONS = ["draft", "open", "bidding", "selection", "completed", "cancelled"];
const SETTLEMENT_OPTIONS = ["unpaid", "partially_settled", "settled", "disputed"];
function Orders() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState("rfqs");
  const [rfqs, setRfqs] = useState([]);
  const [deals, setDeals] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [countries, setCountries] = useState([]);
  const [selectedRfqId, setSelectedRfqId] = useState("");
  const [rfqDetail, setRfqDetail] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [comparisonRows, setComparisonRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingRfq, setSubmittingRfq] = useState(false);
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [error, setError] = useState("");
  const [optimalRange, setOptimalRange] = useState(null);
  const [profitResult, setProfitResult] = useState(null);

  const [rfqForm, setRfqForm] = useState({
    title: "",
    specs: "",
    commodity: "",
    originCountry: "",
    destinationCountry: "",
    targetQuantity: "",
    unit: "MT",
    requiredIncoterm: "FOB",
    preferredDeliveryWindow: "",
  });

  const [quoteForm, setQuoteForm] = useState({
    offeredPrice: "",
    currency: "USD",
    leadTimeDays: "",
    minOrderQty: "1",
    freight: "0",
    insurance: "0",
    dutiesEstimate: "0",
    unitProcurementCost: "",
    fxRate: "1",
    validityDate: "",
    notes: "",
  });

  const [filters, setFilters] = useState({
    rfqStatus: "",
    commodity: "",
    country: "",
    settlementStatus: "",
  });
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const loadRfqs = () => {
    const params = {};
    if (filters.rfqStatus) params.status = filters.rfqStatus;
    if (filters.commodity) params.commodity = filters.commodity;
    if (filters.country) params.country = filters.country;

    return axios
      .get(`${API}/marketplace/rfqs`, {
        params: { ...params, state: params.status },
        headers: authHeaders,
      })
      .then((res) => setRfqs(res.data.items || []))
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load RFQs.");
      });
  };

  const loadDeals = () => {
    const params = {};
    if (filters.settlementStatus) params.settlementStatus = filters.settlementStatus;
    return axios
      .get(`${API}/marketplace/deals`, { params, headers: authHeaders })
      .then((res) => setDeals(res.data.items || []))
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load deals.");
      });
  };

  const loadRfqDetail = (rfqId) => {
    if (!rfqId) {
      setRfqDetail(null);
      setQuotes([]);
      return Promise.resolve();
    }
    return axios
      .get(`${API}/marketplace/rfqs/${rfqId}`, { headers: authHeaders })
      .then((res) => {
        setRfqDetail(res.data.rfq);
        setQuotes(res.data.quotes || []);
        setOptimalRange(null);
      })
      .then(() =>
        axios
          .get(`${API}/marketplace/rfqs/${rfqId}/comparison-matrix`, { headers: authHeaders })
          .then((matrixRes) => setComparisonRows(matrixRes.data.rows || [])),
      )
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load RFQ detail.");
      });
  };

  const loadOptimalRange = async (rfq) => {
    try {
      const commodityObj = commodities.find((c) => c._id === rfq?.commodity?._id);
      const historicalPrices = (commodityObj?.priceHistory || [])
        .map((p) => Number(p.price))
        .filter((x) => Number.isFinite(x) && x > 0)
        .slice(-24);

      if (historicalPrices.length < 5) {
        setOptimalRange({
          note: "Need at least 5 historical price points for optimal range.",
        });
        return;
      }
      const fxVol = 0.25;
      const response = await axios.post(`${API}/analytics/forecast/optimal-bid-range`, {
        historical_prices: historicalPrices,
        fx_volatility: fxVol,
        shipping_cost_index: 1.0,
      });
      setOptimalRange(response.data);
    } catch (err) {
      setOptimalRange({
        note: err.response?.data?.message || "Optimal range service unavailable.",
      });
    }
  };

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      axios.get(`${API}/commodities`),
      axios.get(`${API}/countries`),
      loadRfqs(),
      loadDeals(),
    ])
      .then(([resCommodities, resCountries]) => {
        setCommodities(resCommodities.data);
        setCountries(resCountries.data);
      })
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load marketplace data.");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadRfqs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.rfqStatus, filters.commodity, filters.country]);

  useEffect(() => {
    loadDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.settlementStatus]);

  useEffect(() => {
    if (selectedRfqId) {
      loadRfqDetail(selectedRfqId).then(() => {
        const selected = rfqs.find((x) => x._id === selectedRfqId);
        if (selected) loadOptimalRange(selected);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRfqId, rfqs]);

  const rfqStatusBadge = (state) => {
    if (state === "selection" || state === "completed") return "text-[#8ab4ff]";
    if (state === "bidding" || state === "open") return "text-neutral-200";
    if (state === "cancelled") return "text-neutral-500";
    return "text-neutral-300";
  };

  const handleRfqFormChange = (e) => {
    const { name, value } = e.target;
    setRfqForm((f) => ({ ...f, [name]: value }));
  };

  const handleQuoteFormChange = (e) => {
    const { name, value } = e.target;
    setQuoteForm((f) => ({ ...f, [name]: value }));
  };

  const createRfq = async (e) => {
    e.preventDefault();
    setSubmittingRfq(true);
    setError("");
    try {
      const payload = {
        ...rfqForm,
        targetQuantity: Number(rfqForm.targetQuantity),
      };
      const res = await axios.post(`${API}/marketplace/rfqs`, payload, {
        headers: authHeaders,
      });
      setRfqForm((f) => ({
        ...f,
        title: "",
        specs: "",
        targetQuantity: "",
        preferredDeliveryWindow: "",
      }));
      setSelectedRfqId(res.data._id);
      await Promise.all([loadRfqs(), loadRfqDetail(res.data._id)]);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "RFQ create failed.");
    } finally {
      setSubmittingRfq(false);
    }
  };

  const submitQuote = async (e) => {
    e.preventDefault();
    if (!selectedRfqId) return;
    setSubmittingQuote(true);
    setError("");
    try {
      await axios.post(
        `${API}/marketplace/rfqs/${selectedRfqId}/quotes`,
        {
          ...quoteForm,
          offeredPrice: Number(quoteForm.offeredPrice),
          leadTimeDays: Number(quoteForm.leadTimeDays),
          minOrderQty: Number(quoteForm.minOrderQty),
          freight: Number(quoteForm.freight),
          insurance: Number(quoteForm.insurance),
          dutiesEstimate: Number(quoteForm.dutiesEstimate),
        },
        { headers: authHeaders },
      );
      setQuoteForm((f) => ({
        ...f,
        offeredPrice: "",
        leadTimeDays: "",
        notes: "",
        unitProcurementCost: "",
      }));
      await Promise.all([loadRfqDetail(selectedRfqId), loadRfqs()]);
    } catch (err) {
      setError(err.response?.data?.message || "Quote submit failed.");
    } finally {
      setSubmittingQuote(false);
    }
  };

  const simulateProfit = async () => {
    if (!rfqDetail) return;
    try {
      const response = await axios.post(
        `${API}/marketplace/quotes/profitability`,
        {
          unitSellPrice: Number(quoteForm.offeredPrice || 0),
          unitProcurementCost: Number(quoteForm.unitProcurementCost || 0),
          qty: Number(rfqDetail.targetQuantity || 0),
          fxRate: Number(quoteForm.fxRate || 1),
          freight: Number(quoteForm.freight || 0),
          insurance: Number(quoteForm.insurance || 0),
          duties: Number(quoteForm.dutiesEstimate || 0),
        },
        { headers: authHeaders },
      );
      setProfitResult(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Profit simulation failed.");
    }
  };

  const acceptQuote = async (quoteId) => {
    try {
      await axios.post(`${API}/marketplace/quotes/${quoteId}/accept`, null, {
        headers: authHeaders,
      });
      await Promise.all([loadRfqDetail(selectedRfqId), loadRfqs(), loadDeals()]);
      setActiveTab("deals");
    } catch (err) {
      setError(err.response?.data?.message || "Accept quote failed.");
    }
  };

  const updateSettlement = async (dealId, settlementStatus) => {
    try {
      await axios.put(
        `${API}/marketplace/deals/${dealId}/settlement`,
        {
          settlementStatus,
          settlementNotes: `Updated to ${settlementStatus} from marketplace UI.`,
        },
        { headers: authHeaders },
      );
      await loadDeals();
    } catch (err) {
      setError(err.response?.data?.message || "Settlement update failed.");
    }
  };

  const selectedCommodity = useMemo(
    () => commodities.find((c) => c._id === rfqForm.commodity),
    [commodities, rfqForm.commodity],
  );

  if (loading) {
    return <p className="text-neutral-400">Loading marketplace…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Package className="text-[#8ab4ff]" size={28} />
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">RFQ Marketplace</h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-[#202020] pb-2">
        {[
          { id: "rfqs", label: "RFQ Board", icon: <MessagesSquare size={14} /> },
          { id: "deals", label: "My Deals", icon: <Handshake size={14} /> },
        ].map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn-ui ${activeTab === tab.id ? "btn-primary" : "btn-secondary"} !h-9`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "rfqs" && (
        <>
          <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-neutral-100 mb-4">Create RFQ</h2>
            <form
              onSubmit={createRfq}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-400">Title</span>
                <input
                  name="title"
                  value={rfqForm.title}
                  onChange={handleRfqFormChange}
                  className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
                  placeholder="Example: Refined sugar for July shipment"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-400">Commodity</span>
                <select
                  name="commodity"
                  value={rfqForm.commodity}
                  onChange={handleRfqFormChange}
                  className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
                  required
                >
                  <option value="">Select commodity</option>
                  {commodities.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-400">Target quantity</span>
                <input
                  name="targetQuantity"
                  type="number"
                  min="1"
                  step="1"
                  value={rfqForm.targetQuantity}
                  onChange={handleRfqFormChange}
                  className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-400">Origin country</span>
                <select
                  name="originCountry"
                  value={rfqForm.originCountry}
                  onChange={handleRfqFormChange}
                  className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
                  required
                >
                  <option value="">Select origin</option>
                  {countries.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-400">Destination country</span>
                <select
                  name="destinationCountry"
                  value={rfqForm.destinationCountry}
                  onChange={handleRfqFormChange}
                  className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
                  required
                >
                  <option value="">Select destination</option>
                  {countries.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-400">Unit</span>
                <input
                  name="unit"
                  value={rfqForm.unit}
                  onChange={handleRfqFormChange}
                  className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-400">Incoterm</span>
                <input
                  name="requiredIncoterm"
                  value={rfqForm.requiredIncoterm}
                  onChange={handleRfqFormChange}
                  className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-400">Delivery window</span>
                <input
                  name="preferredDeliveryWindow"
                  value={rfqForm.preferredDeliveryWindow}
                  onChange={handleRfqFormChange}
                  className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
                  placeholder="Jul 2026 - Aug 2026"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm md:col-span-2 lg:col-span-3">
                <span className="text-neutral-400">Specs</span>
                <input
                  name="specs"
                  value={rfqForm.specs}
                  onChange={handleRfqFormChange}
                  className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
                  placeholder="Purity, packaging, quality standards"
                />
              </label>
              <div className="lg:col-span-3 flex items-center justify-between gap-4">
                <p className="text-xs text-neutral-500">
                  Off-platform settlement enabled. Commodity baseline: {selectedCommodity?.name || "N/A"}
                </p>
                <button type="submit" disabled={submittingRfq} className="btn-ui btn-primary">
                  {submittingRfq ? "Creating…" : "Create RFQ"}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap gap-3">
              <select
                value={filters.rfqStatus}
                onChange={(e) => setFilters((f) => ({ ...f, rfqStatus: e.target.value }))}
                className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-200 text-sm"
              >
                <option value="">All statuses</option>
                {RFQ_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                value={filters.commodity}
                onChange={(e) => setFilters((f) => ({ ...f, commodity: e.target.value }))}
                className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-200 text-sm"
              >
                <option value="">All commodities</option>
                {commodities.map((commodity) => (
                  <option key={commodity._id} value={commodity._id}>
                    {commodity.name}
                  </option>
                ))}
              </select>
              <select
                value={filters.country}
                onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
                className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-200 text-sm"
              >
                <option value="">All countries</option>
                {countries.map((country) => (
                  <option key={country._id} value={country._id}>
                    {country.name} ({country.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="border border-[#2a2a2a] rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="table-head">
                    <tr>
                      <th className="px-4 py-3">RFQ</th>
                      <th className="px-4 py-3">Route</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2a]">
                    {rfqs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-neutral-500">
                          No RFQs found.
                        </td>
                      </tr>
                    ) : (
                      rfqs.map((rfq) => (
                        <tr
                          key={rfq._id}
                          className={`cursor-pointer hover:bg-[#171717] ${
                            selectedRfqId === rfq._id ? "bg-[#171717]" : ""
                          }`}
                          onClick={() => setSelectedRfqId(rfq._id)}
                        >
                          <td className="px-4 py-3 text-neutral-100">
                            <div className="font-medium">{rfq.title}</div>
                            <div className="text-xs text-neutral-500">{rfq.commodity?.name}</div>
                          </td>
                          <td className="px-4 py-3 text-neutral-300">
                            {rfq.originCountry?.code} → {rfq.destinationCountry?.code}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-100">
                            {rfq.targetQuantity?.toLocaleString()} {rfq.unit}
                          </td>
                          <td className={`px-4 py-3 capitalize ${rfqStatusBadge(rfq.state)}`}>
                            {rfq.state}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border border-[#2a2a2a] rounded-xl p-4 space-y-4">
                {!rfqDetail ? (
                  <p className="text-sm text-neutral-500">Select an RFQ to view and quote.</p>
                ) : (
                  <>
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-neutral-100">{rfqDetail.title}</h3>
                      <p className="text-xs text-neutral-500">
                        {rfqDetail.commodity?.name} • {rfqDetail.originCountry?.name} to{" "}
                        {rfqDetail.destinationCountry?.name}
                      </p>
                      <p className="text-sm text-neutral-300">
                        {rfqDetail.specs || "No additional specifications."}
                      </p>
                    </div>

                    <form onSubmit={submitQuote} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        name="offeredPrice"
                        value={quoteForm.offeredPrice}
                        onChange={handleQuoteFormChange}
                        type="number"
                        min="0"
                        step="0.01"
                        className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
                        placeholder="Offered price"
                        required
                      />
                      <input
                        name="currency"
                        value={quoteForm.currency}
                        onChange={handleQuoteFormChange}
                        className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
                        placeholder="Currency"
                        required
                      />
                      <input
                        name="leadTimeDays"
                        value={quoteForm.leadTimeDays}
                        onChange={handleQuoteFormChange}
                        type="number"
                        min="1"
                        className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
                        placeholder="Lead time (days)"
                        required
                      />
                      <input
                        name="minOrderQty"
                        value={quoteForm.minOrderQty}
                        onChange={handleQuoteFormChange}
                        type="number"
                        min="1"
                        className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
                        placeholder="Min order qty"
                      />
                      <input
                        name="freight"
                        value={quoteForm.freight}
                        onChange={handleQuoteFormChange}
                        type="number"
                        min="0"
                        step="0.01"
                        className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
                        placeholder="Freight"
                      />
                      <input
                        name="insurance"
                        value={quoteForm.insurance}
                        onChange={handleQuoteFormChange}
                        type="number"
                        min="0"
                        step="0.01"
                        className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
                        placeholder="Insurance"
                      />
                      <input
                        name="dutiesEstimate"
                        value={quoteForm.dutiesEstimate}
                        onChange={handleQuoteFormChange}
                        type="number"
                        min="0"
                        step="0.01"
                        className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
                        placeholder="Duties estimate"
                      />
                      <input
                        name="unitProcurementCost"
                        value={quoteForm.unitProcurementCost}
                        onChange={handleQuoteFormChange}
                        type="number"
                        min="0"
                        step="0.01"
                        className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
                        placeholder="Procurement cost / unit"
                      />
                      <input
                        name="fxRate"
                        value={quoteForm.fxRate}
                        onChange={handleQuoteFormChange}
                        type="number"
                        min="0"
                        step="0.0001"
                        className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100"
                        placeholder="FX rate"
                      />
                      <input
                        name="validityDate"
                        value={quoteForm.validityDate}
                        onChange={handleQuoteFormChange}
                        type="date"
                        className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100 md:col-span-2"
                        required
                      />
                      <input
                        name="notes"
                        value={quoteForm.notes}
                        onChange={handleQuoteFormChange}
                        className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-neutral-100 md:col-span-2"
                        placeholder="Quote notes"
                      />
                      <div className="md:col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={simulateProfit}
                          className="btn-ui btn-secondary mr-2"
                        >
                          Simulate margin
                        </button>
                        <button type="submit" disabled={submittingQuote} className="btn-ui btn-primary">
                          {submittingQuote ? "Submitting…" : "Submit quote"}
                        </button>
                      </div>
                    </form>
                    {profitResult && (
                      <div className="rounded-lg border border-[#2a2a2a] bg-[#171717] px-3 py-2 text-xs text-neutral-300">
                        Margin {profitResult.marginPct}% · Gross{" "}
                        {profitResult.grossMargin?.toLocaleString?.()} · Revenue{" "}
                        {profitResult.revenueBase?.toLocaleString?.()}
                      </div>
                    )}
                    {optimalRange && (
                      <div className="rounded-lg border border-[#2a2a2a] bg-[#171717] px-3 py-2 text-xs text-neutral-300">
                        {optimalRange.recommended_min != null ? (
                          <>
                            Optimal price range: {optimalRange.recommended_min} -{" "}
                            {optimalRange.recommended_max}
                          </>
                        ) : (
                          optimalRange.note
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-neutral-200">Quotes</h4>
                      <div className="space-y-2">
                        {quotes.length === 0 ? (
                          <p className="text-xs text-neutral-500">No quotes yet.</p>
                        ) : (
                          quotes.map((quote) => (
                            <div
                              key={quote._id}
                              className="rounded-lg border border-[#2a2a2a] bg-[#171717] px-3 py-2 flex items-center justify-between gap-3"
                            >
                              <div>
                                <p className="text-sm text-neutral-100">
                                  {quote.currency} {Number(quote.offeredPrice || 0).toLocaleString()} / unit
                                </p>
                                <p className="text-xs text-neutral-500">
                                  Lead {quote.leadTimeDays} days • status {quote.status}
                                </p>
                              </div>
                              {quote.status === "submitted" &&
                              !["selection", "completed", "cancelled"].includes(rfqDetail.state) ? (
                                <button
                                  type="button"
                                  onClick={() => acceptQuote(quote._id)}
                                  className="btn-ui btn-secondary !h-8"
                                  disabled={
                                    !["buyer", "admin", "user"].includes(user?.role || "")
                                  }
                                >
                                  Accept
                                </button>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-neutral-200">
                        Bid comparison matrix
                      </h4>
                      <BidComparisonMatrix rows={comparisonRows} onSelect={acceptQuote} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "deals" && (
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-100">Awarded Deals</h2>
            <select
              value={filters.settlementStatus}
              onChange={(e) =>
                setFilters((f) => ({ ...f, settlementStatus: e.target.value }))
              }
              className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-200 text-sm"
            >
              <option value="">All settlement statuses</option>
              {SETTLEMENT_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Commodity</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Deal status</th>
                  <th className="px-4 py-3">Settlement</th>
                  <th className="px-4 py-3">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-neutral-500">
                      No awarded deals yet.
                    </td>
                  </tr>
                ) : (
                  deals.map((deal) => (
                    <tr key={deal._id} className="hover:bg-[#171717]">
                      <td className="px-4 py-3 text-neutral-400 whitespace-nowrap">
                        {deal.createdAt ? new Date(deal.createdAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-100">
                        {deal.commodity?.name}
                        <div className="text-xs text-neutral-500">{deal.country?.name}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-100">
                        ${Number(deal.totalValue || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 capitalize text-neutral-200">{deal.status}</td>
                      <td className="px-4 py-3">
                        <select
                          value={deal.settlementStatus || "unpaid"}
                          onChange={(e) => updateSettlement(deal._id, e.target.value)}
                          className="bg-[#171717] border border-[#2a2a2a] rounded-lg px-2 py-1 text-neutral-100 text-xs"
                        >
                          {SETTLEMENT_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {deal.isAnomaly ? (
                          <span
                            className="inline-flex items-center gap-1 text-[#8ab4ff] text-xs"
                            title={deal.anomalyReason || ""}
                          >
                            <AlertTriangle size={14} />
                            Anomaly
                          </span>
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Orders;
