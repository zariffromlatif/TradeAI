const mongoose = require("mongoose");

const FxRatePointSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  rate: { type: Number, required: true },
});

const FxRateSchema = new mongoose.Schema(
  {
    pair: { type: String, required: true, unique: true }, // e.g. USD/BDT
    baseCurrency: { type: String, required: true },
    quoteCurrency: { type: String, required: true },
    currentRate: { type: Number, default: null },
    history: { type: [FxRatePointSchema], default: [] },
    source: { type: String, default: "frankfurter_api" },
    sourceUrl: { type: String, default: null },
    asOf: { type: Date, default: null },
    ingestedAt: { type: Date, default: null },
    verified: { type: Boolean, default: false },
    qualityFlags: { type: [String], default: [] },
  },
  { timestamps: true },
);

FxRateSchema.index({ baseCurrency: 1, quoteCurrency: 1 });

module.exports = mongoose.model("FxRate", FxRateSchema);
