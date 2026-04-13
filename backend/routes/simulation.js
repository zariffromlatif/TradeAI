const express = require("express");

const router = express.Router();

function num(v, fallback) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// POST /api/sim/profitability — tariff on (quantity × unitCostUsd), 0–1
router.post("/profitability", (req, res) => {
  const quantity = num(req.body.quantity, 1);
  const unitRevenueUsd = num(req.body.unitRevenueUsd, 0);
  const unitCostUsd = num(req.body.unitCostUsd, 0);
  let tariffRate = num(req.body.tariffRate, 0);
  const otherCostsUsd = num(req.body.otherCostsUsd, 0);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return res
      .status(400)
      .json({ message: "quantity must be a positive number" });
  }
  if (
    !Number.isFinite(unitRevenueUsd) ||
    !Number.isFinite(unitCostUsd) ||
    !Number.isFinite(tariffRate) ||
    !Number.isFinite(otherCostsUsd)
  ) {
    return res.status(400).json({ message: "Invalid numeric input" });
  }
  if (unitRevenueUsd < 0 || unitCostUsd < 0 || otherCostsUsd < 0) {
    return res
      .status(400)
      .json({ message: "Revenue, cost, and other costs must be non-negative" });
  }
  tariffRate = Math.min(1, Math.max(0, tariffRate));

  const revenueUsd = quantity * unitRevenueUsd;
  const purchaseUsd = quantity * unitCostUsd;
  const importDutyUsd = purchaseUsd * tariffRate;
  const totalCostUsd = purchaseUsd + importDutyUsd + otherCostsUsd;
  const netMarginUsd = revenueUsd - totalCostUsd;
  const marginPercent = revenueUsd > 0 ? (netMarginUsd / revenueUsd) * 100 : 0;

  res.json({
    inputs: {
      quantity,
      unitRevenueUsd,
      unitCostUsd,
      tariffRate,
      otherCostsUsd,
    },
    breakdown: {
      revenueUsd,
      purchaseUsd,
      importDutyUsd,
      otherCostsUsd,
      totalCostUsd,
      netMarginUsd,
      marginPercent: Math.round(marginPercent * 100) / 100,
    },
    note: "Illustrative only. Duty base and accounting rules vary by jurisdiction.",
  });
});

// POST /api/sim/landed-cost — CIF + duty on CIF; optional fxRate (local per 1 USD)
router.post("/landed-cost", (req, res) => {
  const units = num(req.body.units, 1);
  const fobUsd = num(req.body.fobUsd, 0);
  const freightUsd = num(req.body.freightUsd, 0);
  const insuranceUsd = num(req.body.insuranceUsd, 0);
  let dutyRate = num(req.body.dutyRate, 0);
  const fxRate = num(req.body.fxRate, NaN);

  if (!Number.isFinite(units) || units <= 0) {
    return res.status(400).json({ message: "units must be a positive number" });
  }
  if (
    !Number.isFinite(fobUsd) ||
    !Number.isFinite(freightUsd) ||
    !Number.isFinite(insuranceUsd) ||
    !Number.isFinite(dutyRate)
  ) {
    return res.status(400).json({ message: "Invalid numeric input" });
  }
  if (fobUsd < 0 || freightUsd < 0 || insuranceUsd < 0) {
    return res
      .status(400)
      .json({ message: "FOB, freight, insurance must be non-negative" });
  }
  dutyRate = Math.min(1, Math.max(0, dutyRate));

  const cifUsd = fobUsd + freightUsd + insuranceUsd;
  const dutyUsd = cifUsd * dutyRate;
  const landedTotalUsd = cifUsd + dutyUsd;
  const landedPerUnitUsd = landedTotalUsd / units;

  const payload = {
    inputs: { units, fobUsd, freightUsd, insuranceUsd, dutyRate },
    breakdown: {
      cifUsd,
      dutyUsd,
      landedTotalUsd,
      landedPerUnitUsd: Math.round(landedPerUnitUsd * 10000) / 10000,
    },
    note: "Illustrative landed cost. Real customs valuation and surcharges are not modeled.",
  };

  if (Number.isFinite(fxRate) && fxRate > 0) {
    payload.inputs.fxRate = fxRate;
    payload.breakdown.settlementLocalTotal =
      Math.round(landedTotalUsd * fxRate * 100) / 100;
    payload.breakdown.settlementLocalPerUnit =
      Math.round(landedPerUnitUsd * fxRate * 10000) / 10000;
  }

  res.json(payload);
});

module.exports = router;
