const mongoose = require("mongoose");

const CountrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true }, // e.g. "BD", "IN"
    region: { type: String },
    GDP: { type: Number },
    inflation: { type: Number },
    tradeBalance: { type: Number }, // exports - imports in USD billions
  },
  { timestamps: true },
);

module.exports = mongoose.model("Country", CountrySchema);
