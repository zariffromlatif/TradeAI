const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    commodity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commodity",
      required: true,
    },
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      required: true,
    },
    type: { type: String, enum: ["buy", "sell"], required: true },
    quantity: { type: Number, required: true },
    pricePerUnit: { type: Number, required: true },
    totalValue: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "active", "completed", "cancelled"],
      default: "pending",
    },
    source: {
      type: String,
      enum: ["manual", "rfq"],
      default: "manual",
    },
    rfqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceRfq",
      default: null,
    },
    quoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceQuote",
      default: null,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    settlementStatus: {
      type: String,
      enum: ["unpaid", "partially_settled", "settled", "disputed"],
      default: "unpaid",
    },
    settlementNotes: {
      type: String,
      default: "",
    },
    proofRefs: {
      type: [String],
      default: [],
    },
    notes: { type: String },
    isAnomaly: { type: Boolean, default: false },
    anomalyReason: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", OrderSchema);
