const mongoose = require("mongoose");

/**
 * Normalized bilateral trade fact (Option C).
 * - reporter: country that declares the flow (Comtrade reporter).
 * - partner: counterparty country.
 * - type: "export" = reporter exports to partner; "import" = reporter imports from partner.
 */
const TradeRecordSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      required: true,
      index: true,
    },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      required: true,
      index: true,
    },
    commodity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commodity",
      required: true,
    },
    type: { type: String, enum: ["import", "export"], required: true },
    volume: { type: Number },
    value: { type: Number },
    date: { type: Date, required: true },
    source: { type: String, default: null },
    sourceUrl: { type: String, default: null },
    asOf: { type: Date, default: null },
    ingestedAt: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

TradeRecordSchema.index({ reporter: 1, partner: 1, commodity: 1, type: 1, date: 1 });

module.exports = mongoose.model("TradeRecord", TradeRecordSchema);
