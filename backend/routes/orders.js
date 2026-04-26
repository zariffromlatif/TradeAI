const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Commodity = require("../models/Commodity");
const Notification = require("../models/Notification");
const { emitToAdmins, emitToUser } = require("../realtime");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { evaluateSimulatedOrder } = require("../services/orderAnomaly");

const VALID_TRANSITIONS = {
  draft: ["submitted", "cancelled"],
  submitted: ["payment_pending", "cancelled"],
  payment_pending: ["confirmed", "cancelled"],
  confirmed: ["in_transit", "cancelled"],
  in_transit: ["delivered", "cancelled"],
  delivered: ["settled", "cancelled"],
  settled: [],
  cancelled: [],
};

// GET anomalous orders
router.get("/anomalies", async (req, res) => {
  try {
    const anomalousOrders = await Order.find({ isAnomaly: true })
      .populate("commodity", "name category currentPrice")
      .populate("country", "name code");
    res.json(anomalousOrders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all orders
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("commodity", "name category currentPrice")
      .populate("country", "name code");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single order
router.get("/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("commodity", "name category currentPrice")
      .populate("country", "name code");
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create order
router.post("/", async (req, res) => {
  try {
    const { commodity, country, type, quantity, pricePerUnit, notes } = req.body;

    const commodityDoc = await Commodity.findById(commodity);
    if (!commodityDoc) {
      return res.status(404).json({ message: "Commodity not found" });
    }

    const { isAnomaly, anomalyReason } = await evaluateSimulatedOrder({
      commodity: commodityDoc,
      country,
      quantity,
      pricePerUnit,
    });

    const totalValue = quantity * pricePerUnit;
    const order = new Order({
      commodity,
      country,
      type,
      quantity,
      pricePerUnit,
      totalValue,
      status: "submitted",
      notes,
      isAnomaly,
      anomalyStage: isAnomaly ? "rule" : "none",
      anomalyReason: anomalyReason.trim(),
    });
    const saved = await order.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update order (general)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const updated = await Order.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH strict lifecycle transition
router.patch("/:id/transition", requireAuth, async (req, res) => {
  try {
    const { toStatus } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(toStatus)) {
      return res.status(409).json({
        message: `Invalid transition ${order.status} -> ${toStatus}`,
      });
    }
    order.status = toStatus;
    await order.save();
    emitToAdmins("order_transitioned", {
      orderId: order._id,
      status: order.status,
      by: req.auth.sub,
    });
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST anomaly review action: dismiss / escalate
router.post("/:id/anomaly-action", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { action, note = "" } = req.body;
    if (!["dismiss", "escalate"].includes(action)) {
      return res.status(400).json({ message: "action must be dismiss or escalate" });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.isAnomaly) return res.status(409).json({ message: "Order is not flagged as anomaly" });

    order.anomalyStatus = action === "dismiss" ? "dismissed" : "escalated";
    order.anomalyReviewedBy = req.auth.sub;
    order.anomalyReviewedAt = new Date();
    order.anomalyReviewNote = String(note || "").trim();
    if (action === "escalate") {
      order.status = "cancelled";
      order.settlementNotes = `${order.settlementNotes || ""} Escalated anomaly review.`.trim();
    }
    await order.save();

    if (order.buyerId) {
      await Notification.create({
        userId: order.buyerId,
        type: "order_anomaly_review",
        severity: action === "escalate" ? "critical" : "info",
        message: `Order ${order._id} anomaly ${action}d by admin.`,
      });
      emitToUser(order.buyerId, "order_anomaly_review", {
        orderId: order._id,
        action,
      });
    }
    if (order.sellerId) {
      await Notification.create({
        userId: order.sellerId,
        type: "order_anomaly_review",
        severity: action === "escalate" ? "critical" : "info",
        message: `Order ${order._id} anomaly ${action}d by admin.`,
      });
      emitToUser(order.sellerId, "order_anomaly_review", {
        orderId: order._id,
        action,
      });
    }
    emitToAdmins("order_anomaly_reviewed", {
      orderId: order._id,
      action,
      reviewedBy: req.auth.sub,
    });

    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE order
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Order.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;