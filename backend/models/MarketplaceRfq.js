const mongoose = require("mongoose");

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
    status: {
      type: String,
      enum: ["open", "quoted", "awarded", "closed", "cancelled"],
      default: "open",
    },
  },
  { timestamps: true },
);

MarketplaceRfqSchema.index({ status: 1, createdAt: -1 });
MarketplaceRfqSchema.index({ commodity: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("MarketplaceRfq", MarketplaceRfqSchema);
