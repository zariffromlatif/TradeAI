const mongoose = require("mongoose");

const RiskThresholdSchema = new mongoose.Schema(
  {
    criticalRiskScore: { type: Number, default: 75, min: 0, max: 100 },
    warningRiskScore: { type: Number, default: 55, min: 0, max: 100 },
    criticalFxVolatility: { type: Number, default: 0.03, min: 0 },
    warningFxVolatility: { type: Number, default: 0.015, min: 0 },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("RiskThreshold", RiskThresholdSchema);
