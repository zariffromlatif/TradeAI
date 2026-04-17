const mongoose = require("mongoose");

const MarketplaceQuoteSchema = new mongoose.Schema(
  {
    rfqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceRfq",
      required: true,
      index: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    offeredPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "USD", trim: true },
    leadTimeDays: { type: Number, required: true, min: 1 },
    minOrderQty: { type: Number, default: 1, min: 1 },
    notes: { type: String, default: "", trim: true },
    validityDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["submitted", "withdrawn", "accepted", "rejected"],
      default: "submitted",
    },
  },
  { timestamps: true },
);

MarketplaceQuoteSchema.index({ rfqId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("MarketplaceQuote", MarketplaceQuoteSchema);
