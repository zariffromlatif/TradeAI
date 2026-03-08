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
  },
  { timestamps: true },
);

module.exports = mongoose.model("TradeRecord", TradeRecordSchema);
