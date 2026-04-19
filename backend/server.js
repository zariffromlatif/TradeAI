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
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middleware
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (corsOrigins.length === 0) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    },
  }),
);
app.use(express.json());
app.use((req, _res, next) => {
  req.requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  req.startTime = Date.now();
  next();
});
app.use((req, res, next) => {
  res.on("finish", () => {
    const elapsedMs = Date.now() - (req.startTime || Date.now());
    console.log(
      JSON.stringify({
        level: "info",
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        elapsedMs,
        userId: req.auth?.sub || null,
      }),
    );
  });
  next();
});

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
app.use((err, req, res, _next) => {
  const status = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error(
    JSON.stringify({
      level: "error",
      requestId: req?.requestId || null,
      path: req?.originalUrl || null,
      message,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    }),
  );
  res.status(status).json({ message });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 TradeAI Backend Server is running on http://localhost:${PORT}`);
});