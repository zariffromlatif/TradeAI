const mongoose = require("mongoose");

const TradeRecordSchema = new mongoose.Schema(
  {
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      required: true,
    },
    commodity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commodity",
      required: true,
    },
    type: { type: String, enum: ["import", "export"], required: true },
    volume: { type: Number }, // quantity in units
    value: { type: Number }, // total value in USD
    date: { type: Date, required: true },
    source: { type: String, default: null },
    sourceUrl: { type: String, default: null },
    asOf: { type: Date, default: null },
    ingestedAt: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("TradeRecord", TradeRecordSchema);
