import { useState } from "react";
import axios from "axios";
import { Calculator } from "lucide-react";

const API = "http://localhost:5000/api";

const inputClass =
  "bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white w-full";

function Simulation() {
  const [tab, setTab] = useState("profit");

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

  const [profitResult, setProfitResult] = useState(null);
  const [landedResult, setLandedResult] = useState(null);
  const [error, setError] = useState("");
  const [loadingProfit, setLoadingProfit] = useState(false);
  const [loadingLanded, setLoadingLanded] = useState(false);

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

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => {
        setTab(id);
        setError("");
      }}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        tab === id
          ? "bg-emerald-600 text-white"
          : "bg-gray-800 text-gray-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="text-emerald-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Trade simulations</h1>
          <p className="text-gray-400 text-sm">
            Margin and landed-cost calculators (illustrative formulas, not tax
            or legal advice).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabBtn("profit", "Profitability")}
        {tabBtn("landed", "Landed cost")}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {tab === "profit" && (
        <form
          onSubmit={runProfitability}
          className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4"
        >
          <p className="text-gray-400 text-sm">
            <code className="text-emerald-400">tariffRate</code> is 0–1 (e.g.{" "}
            <code className="text-emerald-400">0.05</code> = 5%) on purchase
            value (
            <code className="text-emerald-400">quantity × unitCostUsd</code>).
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
                <span className="text-gray-400">{label}</span>
                <input
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
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg"
          >
            {loadingProfit ? "Calculating…" : "Calculate margin"}
          </button>
          {profitResult && (
            <div className="mt-4 rounded-lg border border-gray-700 bg-gray-950/50 p-4 text-sm space-y-2">
              <h3 className="text-white font-semibold">Result</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-300">
                <dt>Revenue (USD)</dt>
                <dd className="text-right text-white">
                  {profitResult.breakdown.revenueUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </dd>
                <dt>Purchase (USD)</dt>
                <dd className="text-right">
                  {profitResult.breakdown.purchaseUsd.toLocaleString(
                    undefined,
                    {
                      maximumFractionDigits: 2,
                    },
                  )}
                </dd>
                <dt>Import duty (USD)</dt>
                <dd className="text-right">
                  {profitResult.breakdown.importDutyUsd.toLocaleString(
                    undefined,
                    {
                      maximumFractionDigits: 2,
                    },
                  )}
                </dd>
                <dt>Other costs (USD)</dt>
                <dd className="text-right">
                  {profitResult.breakdown.otherCostsUsd.toLocaleString(
                    undefined,
                    {
                      maximumFractionDigits: 2,
                    },
                  )}
                </dd>
                <dt>Total cost (USD)</dt>
                <dd className="text-right">
                  {profitResult.breakdown.totalCostUsd.toLocaleString(
                    undefined,
                    {
                      maximumFractionDigits: 2,
                    },
                  )}
                </dd>
                <dt className="text-emerald-400">Net margin (USD)</dt>
                <dd className="text-right text-emerald-400 font-medium">
                  {profitResult.breakdown.netMarginUsd.toLocaleString(
                    undefined,
                    {
                      maximumFractionDigits: 2,
                    },
                  )}
                </dd>
                <dt>Margin %</dt>
                <dd className="text-right font-medium">
                  {profitResult.breakdown.marginPercent}%
                </dd>
              </dl>
              <p className="text-gray-500 text-xs pt-2">{profitResult.note}</p>
            </div>
          )}
        </form>
      )}

      {tab === "landed" && (
        <form
          onSubmit={runLanded}
          className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4"
        >
          <p className="text-gray-400 text-sm">
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
                <span className="text-gray-400">{label}</span>
                <input
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
              <span className="text-gray-400">
                FX rate (optional, local per 1 USD)
              </span>
              <input
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
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg"
          >
            {loadingLanded ? "Calculating…" : "Calculate landed cost"}
          </button>
          {landedResult && (
            <div className="mt-4 rounded-lg border border-gray-700 bg-gray-950/50 p-4 text-sm space-y-2">
              <h3 className="text-white font-semibold">Result</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-300">
                <dt>CIF (USD)</dt>
                <dd className="text-right text-white">
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
                <dd className="text-right font-medium text-white">
                  {landedResult.breakdown.landedTotalUsd.toLocaleString(
                    undefined,
                    {
                      maximumFractionDigits: 2,
                    },
                  )}
                </dd>
                <dt>Landed / unit (USD)</dt>
                <dd className="text-right font-medium text-emerald-400">
                  {landedResult.breakdown.landedPerUnitUsd.toLocaleString(
                    undefined,
                    {
                      maximumFractionDigits: 4,
                    },
                  )}
                </dd>
                {landedResult.breakdown.settlementLocalTotal != null && (
                  <>
                    <dt>Settlement total (local)</dt>
                    <dd className="text-right">
                      {landedResult.breakdown.settlementLocalTotal.toLocaleString(
                        undefined,
                        { maximumFractionDigits: 2 },
                      )}
                    </dd>
                    <dt>Settlement / unit (local)</dt>
                    <dd className="text-right">
                      {landedResult.breakdown.settlementLocalPerUnit.toLocaleString(
                        undefined,
                        { maximumFractionDigits: 4 },
                      )}
                    </dd>
                  </>
                )}
              </dl>
              <p className="text-gray-500 text-xs pt-2">{landedResult.note}</p>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export default Simulation;
