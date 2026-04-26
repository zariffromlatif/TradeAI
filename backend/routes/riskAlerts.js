const express = require("express");
const RiskThreshold = require("../models/RiskThreshold");
const RiskAlert = require("../models/RiskAlert");
const Order = require("../models/Order");
const { emitToAdmins } = require("../realtime");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

async function getOrCreateThreshold() {
  let threshold = await RiskThreshold.findOne().sort({ updatedAt: -1 });
  if (!threshold) threshold = await RiskThreshold.create({});
  return threshold;
}

router.get("/thresholds", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const threshold = await getOrCreateThreshold();
    res.json(threshold);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/thresholds", requireAuth, requireAdmin, async (req, res) => {
  try {
    const threshold = await getOrCreateThreshold();
    const updates = {};
    [
      "criticalRiskScore",
      "warningRiskScore",
      "criticalFxVolatility",
      "warningFxVolatility",
    ].forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = Number(req.body[key]);
    });
    Object.assign(threshold, updates, { updatedBy: req.auth.sub });
    await threshold.save();
    // Trigger a lightweight re-evaluation marker alert so admins know thresholds changed.
    await RiskAlert.create({
      type: "risk_score",
      severity: "warning",
      title: "Risk thresholds updated",
      message: "Thresholds updated. Re-evaluate active risk scores against new limits.",
      status: "active",
    });
    emitToAdmins("thresholds_updated", {
      updatedBy: req.auth.sub,
      updatedAt: new Date().toISOString(),
    });
    res.json(threshold);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/evaluate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { countryCode, riskScore, fxVolatility } = req.body;
    const threshold = await getOrCreateThreshold();
    const created = [];

    const riskValue = Number(riskScore);
    if (Number.isFinite(riskValue)) {
      let severity = null;
      let t = null;
      if (riskValue >= threshold.criticalRiskScore) {
        severity = "critical";
        t = threshold.criticalRiskScore;
      } else if (riskValue >= threshold.warningRiskScore) {
        severity = "warning";
        t = threshold.warningRiskScore;
      }
      if (severity) {
        created.push(
          await RiskAlert.create({
            type: "risk_score",
            severity,
            countryCode: countryCode ? String(countryCode).toUpperCase() : null,
            title: `Risk score ${severity}`,
            message: `Risk score ${riskValue.toFixed(2)} crossed threshold ${t}.`,
            value: riskValue,
            threshold: t,
          }),
        );
      }
    }

    const fxValue = Number(fxVolatility);
    if (Number.isFinite(fxValue)) {
      let severity = null;
      let t = null;
      if (fxValue >= threshold.criticalFxVolatility) {
        severity = "critical";
        t = threshold.criticalFxVolatility;
      } else if (fxValue >= threshold.warningFxVolatility) {
        severity = "warning";
        t = threshold.warningFxVolatility;
      }
      if (severity) {
        created.push(
          await RiskAlert.create({
            type: "fx_volatility",
            severity,
            countryCode: countryCode ? String(countryCode).toUpperCase() : null,
            title: `FX volatility ${severity}`,
            message: `FX volatility ${fxValue.toFixed(4)} crossed threshold ${t}.`,
            value: fxValue,
            threshold: t,
          }),
        );
      }
    }

    const anomalyCount = await Order.countDocuments({ isAnomaly: true });
    if (anomalyCount > 0) {
      created.push(
        await RiskAlert.create({
          type: "order_anomaly",
          severity: anomalyCount >= 5 ? "critical" : "warning",
          title: "Anomalous orders detected",
          message: `${anomalyCount} anomalous orders currently active.`,
          value: anomalyCount,
          threshold: anomalyCount >= 5 ? 5 : 1,
        }),
      );
    }

    res.json({ createdCount: created.length, created });
    if (created.length > 0) {
      emitToAdmins("risk_alerts_created", {
        count: created.length,
        alerts: created.map((a) => ({
          id: a._id,
          type: a.type,
          severity: a.severity,
          title: a.title,
        })),
      });
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/active", requireAuth, async (_req, res) => {
  try {
    const rows = await RiskAlert.find({ status: "active" }).sort({ createdAt: -1 }).limit(100);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/dismiss", requireAuth, requireAdmin, async (req, res) => {
  try {
    const row = await RiskAlert.findById(req.params.id);
    if (!row) return res.status(404).json({ message: "Alert not found" });
    row.status = "dismissed";
    row.dismissedBy = req.auth.sub;
    row.dismissedAt = new Date();
    await row.save();
    res.json(row);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
