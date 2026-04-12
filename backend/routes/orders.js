const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Commodity = require("../models/Commodity");
const { evaluateSimulatedOrder } = require("../services/orderAnomaly");

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
      notes,
      isAnomaly,
      anomalyReason: anomalyReason.trim(),
    });
    const saved = await order.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update order status
router.put("/:id", async (req, res) => {
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