const mongoose = require("mongoose");
require("dotenv").config();

const Country = require("./models/Country");
const Commodity = require("./models/Commodity");
const TradeRecord = require("./models/TradeRecord");

const countries = [
  {
    name: "Bangladesh",
    code: "BD",
    region: "South Asia",
    gdpGrowthRate: 6.2,
    inflation: 9.2,
    unemployment: 3.2,
    tradeBalance: -20.5,
    exportGrowth: 5.1,
    importDependency: 28.4,
    debtToGdp: 39.0,
    foreignReserves: 4.5,
    fxVolatility: 38,
    currentAccount: -3.2,
  },
  {
    name: "India",
    code: "IN",
    region: "South Asia",
    gdpGrowthRate: 6.8,
    inflation: 5.1,
    unemployment: 3.8,
    tradeBalance: -275.0,
    exportGrowth: 4.3,
    importDependency: 22.1,
    debtToGdp: 82.5,
    foreignReserves: 8.2,
    fxVolatility: 42,
    currentAccount: -1.5,
  },
  {
    name: "China",
    code: "CN",
    region: "East Asia",
    gdpGrowthRate: 5.2,
    inflation: 2.1,
    unemployment: 4.1,
    tradeBalance: 877.6,
    exportGrowth: 3.8,
    importDependency: 18.5,
    debtToGdp: 77.0,
    foreignReserves: 12.8,
    fxVolatility: 35,
    currentAccount: 1.8,
  },
  {
    name: "United States",
    code: "US",
    region: "North America",
    gdpGrowthRate: 2.5,
    inflation: 3.4,
    unemployment: 3.9,
    tradeBalance: -1061.0,
    exportGrowth: 1.2,
    importDependency: 15.2,
    debtToGdp: 123.0,
    foreignReserves: 14.5,
    fxVolatility: 28,
    currentAccount: -3.8,
  },
  {
    name: "Germany",
    code: "DE",
    region: "Europe",
    gdpGrowthRate: 1.8,
    inflation: 2.9,
    unemployment: 2.6,
    tradeBalance: 220.0,
    exportGrowth: 2.1,
    importDependency: 32.5,
    debtToGdp: 66.0,
    foreignReserves: 6.2,
    fxVolatility: 25,
    currentAccount: 2.4,
  },
];

const commodities = [
  {
    name: "Crude Oil",
    category: "Energy",
    unit: "barrel",
    currentPrice: 82.5,
    priceHistory: generateHistory(82.5, 12),
  },
  {
    name: "Natural Gas",
    category: "Energy",
    unit: "MMBtu",
    currentPrice: 2.8,
    priceHistory: generateHistory(2.8, 12),
  },
  {
    name: "Gold",
    category: "Metals",
    unit: "troy oz",
    currentPrice: 2050,
    priceHistory: generateHistory(2050, 12),
  },
  {
    name: "Wheat",
    category: "Agriculture",
    unit: "bushel",
    currentPrice: 5.4,
    priceHistory: generateHistory(5.4, 12),
  },
  {
    name: "Cotton",
    category: "Agriculture",
    unit: "pound",
    currentPrice: 0.82,
    priceHistory: generateHistory(0.82, 12),
  },
];

function generateHistory(currentPrice, months) {
  const history = [];
  for (let i = months; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const fluctuation = (Math.random() - 0.5) * 0.1; // ±5% variation
    history.push({
      date,
      price: parseFloat((currentPrice * (1 + fluctuation)).toFixed(2)),
    });
  }
  return history;
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // Clear existing data
  await Country.deleteMany({});
  await Commodity.deleteMany({});
  await TradeRecord.deleteMany({});
  console.log("Cleared existing data");

  // Insert countries and commodities
  const savedCountries = await Country.insertMany(countries);
  const savedCommodities = await Commodity.insertMany(commodities);
  console.log("Inserted countries and commodities");

  // Generate trade records
  const tradeRecords = [];

  for (const country of savedCountries) {
    for (const commodity of savedCommodities) {
      for (let m = 0; m < 6; m++) {
        const date = new Date();
        date.setMonth(date.getMonth() - m);

        // Pick a random partner country
        const partnerCountry = savedCountries[Math.floor(Math.random() * savedCountries.length)];

        // For exports: reporter is the exporting country, partner is importing country
        // For imports: reporter is the exporting country, partner is the importing country
        const isExport = Math.random() > 0.5;

        tradeRecords.push({
          reporter: isExport ? country._id : partnerCountry._id,
          partner: isExport ? partnerCountry._id : country._id,
          commodity: commodity._id,
          type: isExport ? "export" : "import",
          volume: Math.floor(Math.random() * 10000) + 1000,
          value: Math.floor(Math.random() * 5000000) + 100000,
          date,
          isVerified: true,
          source: "seed_demo",
        });
      }
    }
  }

  await TradeRecord.insertMany(tradeRecords);
  console.log(`Inserted ${tradeRecords.length} trade records`);

  mongoose.disconnect();
  console.log("Done! Database seeded successfully.");
}

seed().catch((err) => {
  console.error(err);
  mongoose.disconnect();
});
