const express = require("express");
const User = require("../models/User");
const PaymentRequest = require("../models/PaymentRequest");
const Order = require("../models/Order");
const TradeRecord = require("../models/TradeRecord");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/dashboard-stats", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [users, pendingPayments, flaggedOrders, tradeRecords] = await Promise.all([
      User.countDocuments({}),
      PaymentRequest.countDocuments({ status: "pending" }),
      Order.countDocuments({ isAnomaly: true }),
      TradeRecord.countDocuments({}),
    ]);
    res.json({ users, pendingPayments, flaggedOrders, tradeRecords });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    const rows = await User.find(filter)
      .select("name email role tier createdAt")
      .sort({ createdAt: -1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
