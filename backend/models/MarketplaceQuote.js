const mongoose = require("mongoose");

const FLAG_SEVERITY = ["info", "warning", "critical"];

const GuardFlagSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    severity: { type: String, enum: FLAG_SEVERITY, required: true },
    message: { type: String, required: true },
  },
  { _id: false },
);

const MarketplaceQuoteSchema = new mongoose.Schema(
  {
    rfqId: { type: mongoose.Schema.Types.ObjectId, ref: "MarketplaceRfq", required: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    offeredPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "USD" },
    leadTimeDays: { type: Number, required: true, min: 1 },
    minOrderQty: { type: Number, default: 1, min: 1 },
    validityDate: { type: Date, required: true },

    freight: { type: Number, default: 0, min: 0 },
    insurance: { type: Number, default: 0, min: 0 },
    dutiesEstimate: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: ["submitted", "withdrawn", "accepted", "rejected"], default: "submitted" },
    guardFlags: { type: [GuardFlagSchema], default: [] },
    isPriceAnomaly: { type: Boolean, default: false },
    anomalyPctFromMarket: { type: Number, default: null },

    scoreBreakdown: { type: Object, default: {} },
    compositeScore: { type: Number, default: null },

    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("MarketplaceQuote", MarketplaceQuoteSchema);