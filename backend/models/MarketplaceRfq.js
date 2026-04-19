const mongoose = require("mongoose");

const STATE = [
  "draft",
  "open",
  "bidding",
  "selection",
  "completed",
  "cancelled",
];

const StateHistorySchema = new mongoose.Schema(
  {
    from: { type: String, enum: STATE, required: true },
    to: { type: String, enum: STATE, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const MarketplaceRfqSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    specs: { type: String, default: "", trim: true },
    commodity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commodity",
      required: true,
    },
    originCountry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      required: true,
    },
    destinationCountry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      required: true,
    },
    targetQuantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true, trim: true },
    requiredIncoterm: { type: String, default: "FOB", trim: true },
    preferredDeliveryWindow: { type: String, default: "", trim: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    state: { type: String, enum: STATE, default: "draft" },
    biddingWindow: {
      startsAt: { type: Date, default: null },
      endsAt: { type: Date, default: null },
    },
    selectedQuoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceQuote",
      default: null,
    },
    completedAt: { type: Date, default: null },
    stateHistory: { type: [StateHistorySchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("MarketplaceRfq", MarketplaceRfqSchema);
