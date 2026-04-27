const express = require("express");
const mongoose = require("mongoose");
const Stripe = require("stripe");
const User = require("../models/User");
const PaymentRequest = require("../models/PaymentRequest");
const {
  isUpgradeTargetTier,
  mergeTierUpgrade,
} = require("../services/tier");
const { requireAuth, attachUser } = require("../middleware/auth");

const router = express.Router();

let stripeSingleton = null;
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const err = new Error("Stripe is not configured (missing STRIPE_SECRET_KEY).");
    err.statusCode = 503;
    throw err;
  }
  if (!stripeSingleton) stripeSingleton = new Stripe(key);
  return stripeSingleton;
}

function frontendBaseUrl() {
  const explicit = process.env.FRONTEND_PUBLIC_URL || process.env.FRONTEND_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const cors = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (cors.length) return cors[0].replace(/\/$/, "");
  return "http://localhost:5173";
}

const GOLD_CENTS = Number(process.env.STRIPE_GOLD_AMOUNT_CENTS) || 2999;
const DIAMOND_CENTS = Number(process.env.STRIPE_DIAMOND_AMOUNT_CENTS) || 7999;

function lineItemForTier(tier) {
  const t = String(tier).toLowerCase();
  if (t === "diamond") {
    return {
      price_data: {
        currency: "usd",
        product_data: { name: "TradeAI Diamond plan" },
        unit_amount: DIAMOND_CENTS,
      },
      quantity: 1,
    };
  }
  return {
    price_data: {
      currency: "usd",
      product_data: { name: "TradeAI Gold plan" },
      unit_amount: GOLD_CENTS,
    },
    quantity: 1,
  };
}

// POST /api/payment/create-session
// Authenticated: charges the logged-in user; tier must be gold or diamond.
router.post("/create-session", requireAuth, attachUser, async (req, res) => {
  try {
    const { tier, email } = req.body;
    const targetTier = String(tier || "").toLowerCase();
    if (!isUpgradeTargetTier(targetTier)) {
      return res.status(400).json({
        message: "tier must be gold or diamond",
      });
    }
    const userId = req.user._id.toString();
    const customerEmail = email || req.user.email;
    const base = frontendBaseUrl();
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: customerEmail,
      line_items: [lineItemForTier(targetTier)],
      metadata: { userId, targetTier },
      success_url: `${base}/payment/success`,
      cancel_url: `${base}/payment/cancel`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ message: err.message });
  }
});

// POST /api/payment/demo-upgrade
// Local/demo only. Body: { targetTier: "gold" | "diamond" }.
// Creates a pending payment request; tier is upgraded only after admin approval.
router.post("/demo-upgrade", requireAuth, attachUser, async (req, res) => {
  if (process.env.DEMO_PAYMENT !== "true") {
    return res.status(403).json({ message: "Demo payment is disabled" });
  }
  try {
    const targetTier = String(req.body.targetTier || req.body.tier || "gold").toLowerCase();
    if (!isUpgradeTargetTier(targetTier)) {
      return res.status(400).json({ message: "targetTier must be gold or diamond" });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const merged = mergeTierUpgrade(user.tier, targetTier);
    if (merged === user.tier) {
      return res.status(409).json({ message: "You already meet or exceed this plan." });
    }

    const created = await PaymentRequest.create({
      requesterId: user._id,
      orderId: null,
      amount: 0,
      currency: "USD",
      note: `Demo upgrade request to ${targetTier}. Pending admin approval.`,
      requestTierUpgrade: true,
      requestedTier: targetTier,
      status: "pending",
    });

    return res.status(201).json({
      ok: true,
      message: "Demo upgrade request submitted. Your tier will update after admin approval.",
      paymentRequestId: created._id,
      requestedTier: targetTier,
      status: created.status,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payment/webhook
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      const status = err.statusCode === 503 ? 503 : 400;
      return res.status(status).json({ message: `Webhook error: ${err.message}` });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      let targetTier = String(session.metadata?.targetTier || "gold").toLowerCase();
      if (!isUpgradeTargetTier(targetTier)) targetTier = "gold";
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        const user = await User.findById(userId);
        if (user) {
          user.tier = mergeTierUpgrade(user.tier, targetTier);
          await user.save();
        }
      }
    }

    res.json({ received: true });
  },
);

router.get("/status/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "name email tier",
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
