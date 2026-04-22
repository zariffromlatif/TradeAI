import { useState, useEffect } from "react";
import axios from "axios";
import { Sliders, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from "../config/api";

const API = API_BASE_URL;
const inputClass = "bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 w-full focus:outline-none focus:border-[#8ab4ff]";

function SensitivityAnalysis() {
  const [commodities, setCommodities] = useState([]);
  
  // 1. Base Strategy State 
  const [strategy, setStrategy] = useState({
    commodityId: "",
    quantity: "1000",
    targetMargin: "20", 
  });

  // 2. Stress Test State
  const [stress, setStress] = useState({
    costIncrease: 0, 
    priceDrop: 0,    
  });

  // Fetch commodities on load
  useEffect(() => {
    axios.get(`${API}/commodities`)
      .then((res) => {
        // FIX: Strictly filter out any commodities that don't have a valid price
        const tradableCommodities = res.data.filter(c => c.currentPrice != null && c.currentPrice > 0);
        
        setCommodities(tradableCommodities);
        
        // Auto-select the first valid commodity
        if (tradableCommodities.length > 0) {
          setStrategy((s) => ({ ...s, commodityId: tradableCommodities[0]._id }));
        }
      })
      .catch((err) => console.error("Failed to load commodities:", err));
  }, []);

  // --- THE MATH ENGINE ---
  const selected = commodities.find(c => c._id === strategy.commodityId);
  const baseUnitCost = selected ? selected.currentPrice : 0;
  const unitName = selected ? selected.unit : "units";
  
  // Convert strings to numbers safely for math
  const safeQuantity = Number(strategy.quantity) || 0;
  const safeMargin = Number(strategy.targetMargin) || 0;
  
  // Base Goal
  const targetUnitRevenue = baseUnitCost * (1 + safeMargin / 100);
  
  // Stressed Reality
  const stressedUnitCost = baseUnitCost * (1 + stress.costIncrease / 100);
  const stressedUnitRevenue = targetUnitRevenue * (1 - stress.priceDrop / 100);
  
  // TOTALS (Calculated from Quantity)
  const totalCost = stressedUnitCost * safeQuantity;
  const totalRevenue = stressedUnitRevenue * safeQuantity;
  const netProfit = totalRevenue - totalCost;
  const isProfitable = netProfit >= 0;

  // Chart Logic
  const maxBarValue = Math.max(totalRevenue, totalCost, 1); 
  const revHeight = (totalRevenue / maxBarValue) * 100;
  const costHeight = (totalCost / maxBarValue) * 100;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sliders className="text-[#8ab4ff]" size={28} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">Trade Strategy & Stress Test</h1>
          <p className="text-neutral-400 text-sm">
            Set your target margin based on live market costs, then simulate unexpected risks.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Controls */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Step 1: Base Strategy */}
          <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5 space-y-4">
            <h2 className="text-neutral-100 font-medium border-b border-[#2a2a2a] pb-2">1. Deal Setup</h2>
            
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-400">Select Commodity</span>
              <select
                className={inputClass}
                value={strategy.commodityId}
                onChange={(e) => setStrategy({ ...strategy, commodityId: e.target.value })}
              >
                {commodities.length === 0 && <option value="">No priced commodities available</option>}
                {commodities.map(c => (
                  <option key={c._id} value={c._id}>{c.name} (${c.currentPrice} / {c.unit})</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-400">Quantity ({unitName}s)</span>
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={strategy.quantity}
                  onChange={(e) => setStrategy({ ...strategy, quantity: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-400">Target Margin (%)</span>
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={strategy.targetMargin}
                  onChange={(e) => setStrategy({ ...strategy, targetMargin: e.target.value })}
                />
              </label>
            </div>

            {selected && (
              <div className="bg-[#1a1a1a] rounded-lg p-3 text-sm border border-[#2a2a2a]">
                <p className="text-neutral-400">Target Selling Price:</p>
                <p className="text-lg font-semibold text-emerald-400">
                  ${targetUnitRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs text-neutral-500 font-normal">per {unitName}</span>
                </p>
              </div>
            )}
          </div>

          {/* Step 2: Stress Testing */}
          <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5 space-y-6">
            <h2 className="text-neutral-100 font-medium border-b border-[#2a2a2a] pb-2 flex items-center justify-between">
              2. Risk Simulation 
              <span className="text-xs text-neutral-500 font-normal">(Optional)</span>
            </h2>
            
            {/* Cost Increase Slider */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Unexpected Cost Spike (Freight/Duty)</span>
                <span className={stress.costIncrease > 0 ? "text-red-400 font-medium" : "text-neutral-100"}>
                  +{stress.costIncrease}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={stress.costIncrease}
                onChange={(e) => setStress({ ...stress, costIncrease: Number(e.target.value) })}
                className="w-full accent-red-400"
              />
            </div>

            {/* Price Drop Slider */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Market Selling Price Drop</span>
                <span className={stress.priceDrop > 0 ? "text-red-400 font-medium" : "text-neutral-100"}>
                  -{stress.priceDrop}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={stress.priceDrop}
                onChange={(e) => setStress({ ...stress, priceDrop: Number(e.target.value) })}
                className="w-full accent-red-400"
              />
            </div>
            
            <button 
              onClick={() => setStress({ costIncrease: 0, priceDrop: 0 })}
              className="w-full py-2 text-sm text-neutral-400 hover:text-neutral-100 border border-[#2a2a2a] rounded-lg transition-colors"
            >
              Reset Risks to 0%
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: The Visual Chart */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="bg-[#171717] border border-[#2a2a2a] rounded-2xl p-8 overflow-hidden relative shadow-2xl">
            
            {/* Top Stats - Shows PER UNIT and Totals */}
            <div className="flex flex-wrap justify-between items-start mb-16 gap-6">
              <h3 className="text-lg font-semibold text-neutral-100">Simulated Outcome</h3>
              
              <div className="flex flex-wrap gap-4 sm:gap-6 text-right">
                {/* Unit Math */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold mb-1">Unit Cost</p>
                  <p className="text-base font-medium text-neutral-100">${stressedUnitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold mb-1">Unit Rev</p>
                  <p className="text-base font-medium text-neutral-100">${stressedUnitRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>

                <div className="w-px h-10 bg-[#2a2a2a] hidden sm:block"></div>

                {/* Totals Math */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold mb-1">Net Cost</p>
                  <p className="text-base font-medium text-red-400">${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold mb-1">Net Profit</p>
                  <p className={`text-base font-bold ${isProfitable ? "text-emerald-400" : "text-red-400"}`}>
                    {isProfitable ? "+" : ""}${netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </div>

            {/* The Visual Bar Chart */}
            <div className="flex items-end justify-center gap-8 sm:gap-16 h-64 relative border-b-2 border-[#2a2a2a] pb-0 w-full max-w-lg mx-auto mb-8">
              
              {/* Trend Line Connector (Updated to draw from Cost to Revenue) */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                <svg className="w-full h-full" preserveAspectRatio="none">
                  <line 
                    x1="25%" y1={`${100 - costHeight}%`} 
                    x2="75%" y2={`${100 - revHeight}%`} 
                    stroke="white" strokeWidth="2" strokeDasharray="6,6" 
                  />
                </svg>
              </div>

              {/* Cost Bar (Now on the Left) */}
              <div 
                className="w-24 sm:w-32 bg-red-400/90 rounded-t-md relative flex justify-center transition-all duration-500 ease-out"
                style={{ height: `${costHeight}%`, minHeight: '10%' }}
              >
                {/* Total Cost Number (Floating Top) */}
                <div className="absolute -top-8 text-red-400 font-bold text-lg sm:text-xl whitespace-nowrap drop-shadow-md">
                  ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                
                {/* Clean Cost Label (Below Graph Line) */}
                <div className="absolute -bottom-7 text-neutral-400 text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                  Total Cost
                </div>
              </div>

              {/* Center Status Indicator */}
              <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                {isProfitable ? (
                  <TrendingUp className="text-emerald-400 w-10 h-10 sm:w-12 sm:h-12 drop-shadow-lg" />
                ) : (
                  <TrendingDown className="text-red-400 w-10 h-10 sm:w-12 sm:h-12 drop-shadow-lg" />
                )}
              </div>

              {/* Revenue Bar (Now on the Right) */}
              <div 
                className="w-24 sm:w-32 bg-[#8ab4ff] rounded-t-md relative flex justify-center transition-all duration-500 ease-out"
                style={{ height: `${revHeight}%`, minHeight: '10%' }}
              >
                {/* Total Revenue Number (Floating Top) */}
                <div className="absolute -top-8 text-[#8ab4ff] font-bold text-lg sm:text-xl whitespace-nowrap drop-shadow-md">
                  ${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                
                {/* Clean Revenue Label (Below Graph Line) */}
                <div className="absolute -bottom-7 text-neutral-400 text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                  Total Revenue
                </div>
              </div>

            </div>

            {/* Bottom Status Text */}
            <div className="mt-12 text-center space-y-2">
              <h2 className={`text-4xl font-bold tracking-tight ${isProfitable ? "text-emerald-400" : "text-red-400"}`}>
                ${Math.abs(netProfit).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </h2>
              <div className="flex items-center justify-center gap-2">
                {!isProfitable && <AlertTriangle size={18} className="text-red-400" />}
                <p className="text-sm font-medium tracking-widest uppercase text-neutral-400">
                  {isProfitable ? "Profitable Trade" : "Loss-Making Trade"}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default SensitivityAnalysis;