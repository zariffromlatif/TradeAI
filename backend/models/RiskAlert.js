const mongoose = require("mongoose");

const RiskAlertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["risk_score", "fx_volatility", "order_anomaly"],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["warning", "critical"],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    countryCode: { type: String, default: null, index: true },
    value: { type: Number, default: null },
    threshold: { type: Number, default: null },
    status: {
      type: String,
      enum: ["active", "dismissed"],
      default: "active",
      index: true,
    },
    dismissedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    dismissedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("RiskAlert", RiskAlertSchema);
