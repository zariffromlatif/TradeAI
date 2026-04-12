const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Brute-force slowdown on login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

mongoose.connect(process.env.MONGO_URI);

// Mount routes
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/countries", require("./routes/countries"));
app.use("/api/commodities", require("./routes/commodities"));
app.use("/api/trade", require("./routes/trade"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/payment", require("./routes/payment"));

app.listen(5000, () => console.log("Server on port 5000"));
