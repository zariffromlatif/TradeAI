import { useState, useEffect } from "react";
import axios from "axios";
import { Calculator } from "lucide-react";
import { API_BASE_URL } from "../config/api";

const API = API_BASE_URL;

const inputClass =
  "bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 w-full";

function Simulation() {
  // Set the new 'price' tab as the default open tab
  const [tab, setTab] = useState("price");

  // Fetch commodities from database
  const [commodities, setCommodities] = useState([]);

  // Form States
  const [priceForm, setPriceForm] = useState({
    commodityId: "",
    quantity: "100",
  });

  const [profitForm, setProfitForm] = useState({
    quantity: "100",
    unitRevenueUsd: "25",
    unitCostUsd: "14",
    tariffRate: "0.05",
    otherCostsUsd: "120",
  });
  
  const [landedForm, setLandedForm] = useState({
    units: "100",
    fobUsd: "1400",
    freightUsd: "350",
    insuranceUsd: "40",
    dutyRate: "0.06",
    fxRate: "110",
  });

  // Result States
  const [priceResult, setPriceResult] = useState(null);
  const [profitResult, setProfitResult] = useState(null);
  const [landedResult, setLandedResult] = useState(null);
  const [error, setError] = useState("");
  
  // Loading States
  const [loadingProfit, setLoadingProfit] = useState(false);
  const [loadingLanded, setLoadingLanded] = useState(false);

  // Load commodities on mount
  useEffect(() => {
    axios
      .get(`${API}/commodities`)
      .then((res) => {
        // FIX: Filter out commodities that don't have a valid price
        const pricedCommodities = res.data.filter(c => c.currentPrice != null && c.currentPrice > 0);
        
        setCommodities(pricedCommodities);
        
        // Automatically select the first priced commodity if available
        if (pricedCommodities.length > 0) {
          setPriceForm((f) => ({ ...f, commodityId: pricedCommodities[0]._id }));
        }
      })
      .catch((err) => console.error("Failed to load commodities:", err));
  }, []);

  // Helper to get the currently selected commodity object
  const selectedCommodity = commodities.find(c => c._id === priceForm.commodityId) || null;

  // --- Calculation Functions ---

  const runPriceEstimator = (e) => {
    e.preventDefault();
    setError("");
    setPriceResult(null);

    if (!selectedCommodity) {
      setError("Please select a commodity first.");
      return;
    }
    if (!selectedCommodity.currentPrice) {
      setError("Price data is not available for this commodity.");
      return;
    }

    const total = Number(priceForm.quantity) * selectedCommodity.currentPrice;
    
    setPriceResult({
      commodityName: selectedCommodity.name,
      unit: selectedCommodity.unit,
      quantity: Number(priceForm.quantity),
      pricePerUnit: selectedCommodity.currentPrice,
      totalUsd: total
    });
  };

  const runProfitability = async (e) => {
    e.preventDefault();
    setError("");
    setLoadingProfit(true);
    setProfitResult(null);
    try {
      const body = {
        quantity: Number(profitForm.quantity),
        unitRevenueUsd: Number(profitForm.unitRevenueUsd),
        unitCostUsd: Number(profitForm.unitCostUsd),
        tariffRate: Number(profitForm.tariffRate),
        otherCostsUsd: Number(profitForm.otherCostsUsd),
      };
      const res = await axios.post(`${API}/sim/profitability`, body);
      setProfitResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Request failed.");
    } finally {
      setLoadingProfit(false);
    }
  };

  const runLanded = async (e) => {
    e.preventDefault();
    setError("");
    setLoadingLanded(true);
    setLandedResult(null);
    try {
      const body = {
        units: Number(landedForm.units),
        fobUsd: Number(landedForm.fobUsd),
        freightUsd: Number(landedForm.freightUsd),
        insuranceUsd: Number(landedForm.insuranceUsd),
        dutyRate: Number(landedForm.dutyRate),
      };
      const fx = landedForm.fxRate.trim();
      if (fx !== "") body.fxRate = Number(fx);
      const res = await axios.post(`${API}/sim/landed-cost`, body);
      setLandedResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Request failed.");
    } finally {
      setLoadingLanded(false);
    }
  };

  // --- UI Components ---

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => {
        setTab(id);
        setError("");
      }}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        tab === id
          ? "bg-[#8ab4ff] text-[#0a0a0a]"
          : "bg-[#171717] text-neutral-400 hover:text-neutral-100 border border-[#2a2a2a]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="text-[#8ab4ff]" size={28} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">Trade simulations</h1>
          <p className="text-neutral-400 text-sm">
            Margin, landed-cost, and base price calculators (illustrative formulas).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* New Tab Placed First */}
        {tabBtn("price", "Price Estimator")}
        {tabBtn("profit", "Profitability")}
        {tabBtn("landed", "Landed cost")}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* --- 1. NEW PRICE ESTIMATOR TAB --- */}
      {tab === "price" && (
        <form
          onSubmit={runPriceEstimator}
          className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6 space-y-4"
        >
          <p className="text-neutral-400 text-sm">
            Select a commodity to view its current market price and calculate the total base cost.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-400">Product / Commodity</span>
              <select
                className={inputClass}
                value={priceForm.commodityId}
                onChange={(e) => setPriceForm({ ...priceForm, commodityId: e.target.value })}
                required
              >
                {/* FIX: Add fallback if array is empty */}
                {commodities.length === 0 && <option value="">No priced commodities available</option>}
                {commodities.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-400">
                Quantity {selectedCommodity ? `(${selectedCommodity.unit})` : ""}
              </span>
              <input
                type="number"
                min="1"
                step="any"
                className={inputClass}
                value={priceForm.quantity}
                onChange={(e) => setPriceForm({ ...priceForm, quantity: e.target.value })}
                required
              />
            </label>

            {selectedCommodity && (
              <div className="sm:col-span-2 text-sm text-[#8ab4ff] bg-[#8ab4ff]/10 border border-[#8ab4ff]/20 p-3 rounded-lg">
                Current Market Price: <strong>${selectedCommodity.currentPrice.toLocaleString()}</strong> per {selectedCommodity.unit}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-[#8ab4ff] text-[#0a0a0a] font-medium py-2 rounded-lg hover:bg-[#a1c4ff] transition-colors"
          >
            Calculate Total Price
          </button>

          {priceResult && (
            <div className="mt-4 rounded-xl border border-[#2a2a2a] bg-[#171717] p-4 text-sm space-y-2">
              <h3 className="text-neutral-100 font-semibold">Base Price Result</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-neutral-300">
                <dt>Commodity</dt>
                <dd className="text-right text-neutral-100">{priceResult.commodityName}</dd>
                <dt>Total Volume</dt>
                <dd className="text-right">{priceResult.quantity.toLocaleString()} {priceResult.unit}s</dd>
                <dt className="text-[#8ab4ff] mt-2">Total Base Cost (USD)</dt>
                <dd className="text-right text-[#8ab4ff] font-medium mt-2 text-lg">
                  ${priceResult.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </dd>
              </dl>
            </div>
          )}
        </form>
      )}

      {/* --- 2. PROFITABILITY TAB --- */}
      {tab === "profit" && (
        <form
          onSubmit={runProfitability}
          className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6 space-y-4"
        >
          <p className="text-neutral-400 text-sm">
            <code className="text-[#8ab4ff]">tariffRate</code> is 0–1 (e.g.{" "}
            <code className="text-[#8ab4ff]">0.05</code> = 5%) on purchase
            value (
            <code className="text-[#8ab4ff]">quantity × unitCostUsd</code>).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ["quantity", "Quantity (units)"],
              ["unitRevenueUsd", "Revenue / unit (USD)"],
              ["unitCostUsd", "Purchase cost / unit (USD)"],
              ["tariffRate", "Tariff rate (0–1)"],
              ["otherCostsUsd", "Other costs (USD, total)"],
            ].map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-400">{label}</span>
                <input
                  type="number"
                  step="any"
                  className={inputClass}
                  value={profitForm[key]}
                  onChange={(e) =>
                    setProfitForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  required
                />
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={loadingProfit}
            className="w-full bg-[#8ab4ff] text-[#0a0a0a] font-medium py-2 rounded-lg hover:bg-[#a1c4ff] transition-colors disabled:opacity-50"
          >
            {loadingProfit ? "Calculating…" : "Calculate margin"}
          </button>
          {profitResult && (
            <div className="mt-4 rounded-xl border border-[#2a2a2a] bg-[#171717] p-4 text-sm space-y-2">
              <h3 className="text-neutral-100 font-semibold">Result</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-neutral-300">
                <dt>Revenue (USD)</dt>
                <dd className="text-right text-neutral-100">
                  {profitResult.breakdown.revenueUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </dd>
                <dt>Purchase (USD)</dt>
                <dd className="text-right">
                  {profitResult.breakdown.purchaseUsd.toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )}
                </dd>
                <dt>Import duty (USD)</dt>
                <dd className="text-right">
                  {profitResult.breakdown.importDutyUsd.toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )}
                </dd>
                <dt>Other costs (USD)</dt>
                <dd className="text-right">
                  {profitResult.breakdown.otherCostsUsd.toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )}
                </dd>
                <dt>Total cost (USD)</dt>
                <dd className="text-right">
                  {profitResult.breakdown.totalCostUsd.toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )}
                </dd>
                <dt className="text-[#8ab4ff]">Net margin (USD)</dt>
                <dd className="text-right text-[#8ab4ff] font-medium">
                  {profitResult.breakdown.netMarginUsd.toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )}
                </dd>
                <dt>Margin %</dt>
                <dd className="text-right font-medium">
                  {profitResult.breakdown.marginPercent}%
                </dd>
              </dl>
              <p className="text-neutral-500 text-xs pt-2">{profitResult.note}</p>
            </div>
          )}
        </form>
      )}

      {/* --- 3. LANDED COST TAB --- */}
      {tab === "landed" && (
        <form
          onSubmit={runLanded}
          className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6 space-y-4"
        >
          <p className="text-neutral-400 text-sm">
            CIF = FOB + freight + insurance. Duty applies to CIF. Leave FX empty
            to skip local settlement lines.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ["units", "Units in shipment"],
              ["fobUsd", "FOB total (USD)"],
              ["freightUsd", "Freight (USD)"],
              ["insuranceUsd", "Insurance (USD)"],
              ["dutyRate", "Duty rate on CIF (0–1)"],
            ].map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-400">{label}</span>
                <input
                  type="number"
                  step="any"
                  className={inputClass}
                  value={landedForm[key]}
                  onChange={(e) =>
                    setLandedForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  required
                />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-neutral-400">
                FX rate (optional, local per 1 USD)
              </span>
              <input
                type="number"
                step="any"
                className={inputClass}
                value={landedForm.fxRate}
                onChange={(e) =>
                  setLandedForm((f) => ({ ...f, fxRate: e.target.value }))
                }
                placeholder="e.g. 110"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={loadingLanded}
            className="w-full bg-[#8ab4ff] text-[#0a0a0a] font-medium py-2 rounded-lg hover:bg-[#a1c4ff] transition-colors disabled:opacity-50"
          >
            {loadingLanded ? "Calculating…" : "Calculate landed cost"}
          </button>
          {landedResult && (
            <div className="mt-4 rounded-xl border border-[#2a2a2a] bg-[#171717] p-4 text-sm space-y-2">
              <h3 className="text-neutral-100 font-semibold">Result</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-neutral-300">
                <dt>CIF (USD)</dt>
                <dd className="text-right text-neutral-100">
                  {landedResult.breakdown.cifUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </dd>
                <dt>Duty (USD)</dt>
                <dd className="text-right">
                  {landedResult.breakdown.dutyUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </dd>
                <dt>Landed total (USD)</dt>
                <dd className="text-right font-medium text-neutral-100">
                  {landedResult.breakdown.landedTotalUsd.toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )}
                </dd>
                <dt>Landed / unit (USD)</dt>
                <dd className="text-right font-medium text-[#8ab4ff]">
                  {landedResult.breakdown.landedPerUnitUsd.toLocaleString(
                    undefined,
                    { maximumFractionDigits: 4 }
                  )}
                </dd>
                {landedResult.breakdown.settlementLocalTotal != null && (
                  <>
                    <dt>Settlement total (local)</dt>
                    <dd className="text-right">
                      {landedResult.breakdown.settlementLocalTotal.toLocaleString(
                        undefined,
                        { maximumFractionDigits: 2 }
                      )}
                    </dd>
                    <dt>Settlement / unit (local)</dt>
                    <dd className="text-right">
                      {landedResult.breakdown.settlementLocalPerUnit.toLocaleString(
                        undefined,
                        { maximumFractionDigits: 4 }
                      )}
                    </dd>
                  </>
                )}
              </dl>
              <p className="text-neutral-500 text-xs pt-2">{landedResult.note}</p>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export default Simulation;