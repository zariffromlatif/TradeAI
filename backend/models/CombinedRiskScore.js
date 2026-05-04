const mongoose = require("mongoose");

const CombinedRiskScoreSchema = new mongoose.Schema(
  {
    countryCode: { type: String, required: true, index: true },
    countryName: { type: String, required: true },
    commodityId: { type: mongoose.Schema.Types.ObjectId, ref: "Commodity", required: true, index: true },
    commodityName: { type: String, required: true },
    
    // Risk Scores
    countryRiskScore: { type: Number, required: true },
    commodityRiskScore: { type: Number, required: true },
    combinedRiskScore: { type: Number, required: true },
    
    // Risk Category & Label
    riskCategory: { type: String, enum: ["LOW", "MODERATE", "HIGH", "CRITICAL"], required: true },
    riskLabel: { type: String, required: true },
    
    // Country Dimensions
    economicStabilityScore: { type: Number },
    tradeStabilityScore: { type: Number },
    fiscalHealthScore: { type: Number },
    marketVolatilityScore: { type: Number },
    
    // Commodity Dimensions
    supplyRiskScore: { type: Number },
    marketRiskScore: { type: Number },
    structuralRiskScore: { type: Number },
  },
  { timestamps: true }
);

// Index for quick lookups
CombinedRiskScoreSchema.index({ countryCode: 1, commodityId: 1 }, { unique: true });

module.exports = mongoose.model("CombinedRiskScore", CombinedRiskScoreSchema);
