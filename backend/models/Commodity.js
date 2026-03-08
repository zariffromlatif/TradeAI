const mongoose = require("mongoose");

const PriceHistorySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  price: { type: Number, required: true },
});

const CommoditySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String }, // e.g. "Energy", "Agriculture", "Metals"
    unit: { type: String }, // e.g. "barrel", "ton", "troy oz"
    currentPrice: { type: Number },
    priceHistory: [PriceHistorySchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Commodity", CommoditySchema);
