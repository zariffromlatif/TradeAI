const mongoose = require("mongoose");

const CountrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true }, // e.g. "BD", "IN"
    region: { type: String },
    GDP: { type: Number }, // GDP in billions (used for some calculations)
    gdpGrowthRate: { type: Number }, // annual GDP growth percentage
    inflation: { type: Number }, // inflation rate percentage
    unemployment: { type: Number }, // unemployment rate percentage
    tradeBalance: { type: Number }, // exports - imports in USD billions
    exportGrowth: { type: Number }, // export growth rate percentage
    importDependency: { type: Number }, // imports as % of GDP
    debtToGdp: { type: Number }, // debt-to-GDP ratio percentage
    foreignReserves: { type: Number }, // months of imports covered
    fxVolatility: { type: Number }, // currency volatility index
    currentAccount: { type: Number }, // current account balance as % of GDP
  },
  { timestamps: true },
);

module.exports = mongoose.model("Country", CountrySchema);