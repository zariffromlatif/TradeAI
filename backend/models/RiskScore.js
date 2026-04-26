const mongoose = require("mongoose");

const RiskScoreSchema = new mongoose.Schema(
  {
    countryCode: { type: String, required: true, index: true },
    countryName: { type: String, required: true },
    commodityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commodity",
      default: null,
      index: true,
    },
    aggregateRiskScore: { type: Number, required: true },
    riskCategory: { type: String, required: true },
    riskLabel: { type: String, required: true },
    economicStabilityScore: { type: Number, default: null },
    tradeStabilityScore: { type: Number, default: null },
    fiscalHealthScore: { type: Number, default: null },
    marketVolatilityScore: { type: Number, default: null },
    indicatorsUsed: { type: Number, default: 0 },
    indicatorsMissing: { type: Number, default: 0 },
    confidence: { type: String, default: "LOW" },
    modelVersion: { type: String, default: null },
    source: { type: String, default: "ml_proxy_v2" },
    indicatorPayload: { type: Object, default: {} },
    rawResponse: { type: Object, default: {} },
  },
  { timestamps: true },
);

module.exports = mongoose.model("RiskScore", RiskScoreSchema);
