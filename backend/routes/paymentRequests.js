const express = require("express");
const PaymentRequest = require("../models/PaymentRequest");
const Order = require("../models/Order");
const User = require("../models/User");
const Notification = require("../models/Notification");
const jwt = require("jsonwebtoken");
const { emitToUser, emitToAdmins } = require("../realtime");
const { requireAuth, attachUser, requireAdmin } = require("../middleware/auth");
const { isUpgradeTargetTier, mergeTierUpgrade } = require("../services/tier");

const router = express.Router();
function signTierToken(user) {
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || "1d";
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, tier: user.tier },
    process.env.JWT_SECRET,
    { expiresIn },
  );
}

router.post("/", requireAuth, attachUser, async (req, res) => {
  try {
    const {
      orderId,
      amount,
      currency = "USD",
      note = "",
      requestTierUpgrade = false,
      requestedTier = null,
    } = req.body;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ message: "amount must be a non-negative number" });
    }

    let order = null;
    if (orderId) {
      order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (
        req.user.role !== "admin" &&
        String(order.buyerId || "") !== String(req.user._id) &&
        String(order.sellerId || "") !== String(req.user._id)
      ) {
        return res.status(403).json({ message: "You are not authorized for this order" });
      }
    }

    let tierField = null;
    if (requestTierUpgrade) {
      const rt = String(requestedTier || "gold").toLowerCase();
      if (!isUpgradeTargetTier(rt)) {
        return res.status(400).json({
          message: "requestedTier must be gold or diamond when requesting a tier upgrade",
        });
      }
      tierField = rt;
    }

    const created = await PaymentRequest.create({
      requesterId: req.user._id,
      orderId: order?._id || null,
      amount: numericAmount,
      currency,
      note: String(note || "").trim(),
      requestTierUpgrade: !!requestTierUpgrade,
      requestedTier: tierField,
    });

    const row = await PaymentRequest.findById(created._id)
      .populate("requesterId", "name email role tier")
      .populate("orderId", "status settlementStatus totalValue");

    res.status(201).json(row);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/mine", requireAuth, async (req, res) => {
  try {
    const rows = await PaymentRequest.find({ requesterId: req.auth.sub })
      .populate("orderId", "status settlementStatus totalValue")
      .sort({ createdAt: -1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const rows = await PaymentRequest.find(filter)
      .populate("requesterId", "name email role tier")
      .populate("orderId", "status settlementStatus totalValue")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/review", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { decision, reviewNote = "" } = req.body;
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "decision must be approved or rejected" });
    }

    const row = await PaymentRequest.findById(req.params.id);
    if (!row) return res.status(404).json({ message: "Payment request not found" });
    if (row.status !== "pending") {
      return res.status(409).json({ message: "Payment request already reviewed" });
    }

    row.status = decision;
    row.reviewedBy = req.auth.sub;
    row.reviewedAt = new Date();
    row.reviewNote = String(reviewNote || "").trim();
    await row.save();

    let tierGranted = null;
    if (decision === "approved") {
      if (row.orderId) {
        await Order.findByIdAndUpdate(row.orderId, {
          status: "confirmed",
          settlementStatus: "settled",
          settlementNotes: "Approved via payment request workflow.",
        });
      }
      if (row.requestTierUpgrade) {
        tierGranted = isUpgradeTargetTier(row.requestedTier)
          ? row.requestedTier
          : "gold";
        const requesterUser = await User.findById(row.requesterId);
        if (requesterUser) {
          requesterUser.tier = mergeTierUpgrade(requesterUser.tier, tierGranted);
          await requesterUser.save();
        }
      }
    }

    let refreshedToken = null;
    if (decision === "approved" && row.requestTierUpgrade) {
      const requesterFresh = await User.findById(row.requesterId).select("name email role tier");
      if (requesterFresh) refreshedToken = signTierToken(requesterFresh);
    }

    await Notification.create({
      userId: row.requesterId,
      type: "payment_status_change",
      severity: decision === "approved" ? "info" : "warning",
      message:
        decision === "approved"
          ? row.requestTierUpgrade && tierGranted
            ? `Payment approved. Tier upgraded to ${tierGranted}.`
            : "Payment approved. Linked trade contract confirmed."
          : `Payment rejected${row.reviewNote ? `: ${row.reviewNote}` : "."}`,
    });
    emitToUser(row.requesterId, "payment_status_change", {
      paymentRequestId: row._id,
      decision,
      requestTierUpgrade: row.requestTierUpgrade,
      reviewNote: row.reviewNote,
    });
    emitToAdmins("payment_reviewed", {
      paymentRequestId: row._id,
      decision,
      reviewedBy: req.auth.sub,
    });

    const updated = await PaymentRequest.findById(row._id)
      .populate("requesterId", "name email role tier")
      .populate("orderId", "status settlementStatus totalValue")
      .populate("reviewedBy", "name email");

    res.json({ request: updated, refreshedToken });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
