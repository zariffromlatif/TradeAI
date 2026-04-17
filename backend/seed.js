// =============================================
// MUST BE THE VERY FIRST LINES - DNS Fix
const dns = require('node:dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);   // Cloudflare + Google

require("dotenv").config();

const mongoose = require("mongoose");

const Country = require("./models/Country");
const Commodity = require("./models/Commodity");
const TradeRecord = require("./models/TradeRecord");

const countries = [
  { name: "Bangladesh", code: "BD", region: "South Asia", GDP: 460, inflation: 9.2, tradeBalance: -20.5 },
  { name: "India",      code: "IN", region: "South Asia", GDP: 3550, inflation: 5.1, tradeBalance: -275.0 },
  { name: "China",      code: "CN", region: "East Asia",  GDP: 17700, inflation: 2.1, tradeBalance: 877.6 },
  { name: "United States", code: "US", region: "North America", GDP: 25500, inflation: 3.4, tradeBalance: -1061.0 },
  { name: "Germany",    code: "DE", region: "Europe",     GDP: 4100, inflation: 2.9, tradeBalance: 220.0 },
];

const commodities = [
  { name: "Crude Oil",   category: "Energy",       unit: "barrel",   currentPrice: 82.5,  priceHistory: generateHistory(82.5, 12) },
  { name: "Natural Gas", category: "Energy",       unit: "MMBtu",    currentPrice: 2.8,   priceHistory: generateHistory(2.8, 12) },
  { name: "Gold",        category: "Metals",       unit: "troy oz",  currentPrice: 2050,  priceHistory: generateHistory(2050, 12) },
  { name: "Wheat",       category: "Agriculture",  unit: "bushel",   currentPrice: 5.4,   priceHistory: generateHistory(5.4, 12) },
  { name: "Cotton",      category: "Agriculture",  unit: "pound",    currentPrice: 0.82,  priceHistory: generateHistory(0.82, 12) },
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
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB for seeding");

    // Clear existing data
    await Country.deleteMany({});
    await Commodity.deleteMany({});
    await TradeRecord.deleteMany({});
    console.log("🗑️  Cleared existing data");

    // Insert countries and commodities
    const savedCountries = await Country.insertMany(countries);
    const savedCommodities = await Commodity.insertMany(commodities);
    console.log(`✅ Inserted ${savedCountries.length} countries and ${savedCommodities.length} commodities`);

    // Generate trade records
    const types = ["import", "export"];
    const tradeRecords = [];

    for (const country of savedCountries) {
      for (const commodity of savedCommodities) {
        for (let m = 0; m < 6; m++) {
          const date = new Date();
          date.setMonth(date.getMonth() - m);
          tradeRecords.push({
            country: country._id,
            commodity: commodity._id,
            type: types[Math.floor(Math.random() * 2)],
            volume: Math.floor(Math.random() * 10000) + 1000,
            value: Math.floor(Math.random() * 5000000) + 100000,
            date,
            source: "seed_demo",
            isVerified: false,
          });
        }
      }
    }

    await TradeRecord.insertMany(tradeRecords);
    console.log(`✅ Inserted ${tradeRecords.length} trade records`);

    console.log("🎉 Database seeded successfully!");
  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

seed();