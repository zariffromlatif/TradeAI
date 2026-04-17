// =============================================
// MUST BE THE VERY FIRST LINES - DNS Fix for MongoDB Atlas
const dns = require('node:dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);   // Cloudflare + Google DNS

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiter for auth routes (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch(err => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

// Routes
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/countries", require("./routes/countries"));
app.use("/api/commodities", require("./routes/commodities"));
app.use("/api/trade", require("./routes/trade"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/marketplace", require("./routes/marketplace"));
app.use("/api/payment", require("./routes/payment"));
app.use("/api/sim", require("./routes/simulation"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/advisory", require("./routes/advisory"));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 TradeAI Backend Server is running on http://localhost:${PORT}`);
});