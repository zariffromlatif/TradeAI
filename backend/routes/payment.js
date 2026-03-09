const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User");

// POST /api/payment/create-session
// Creates a Stripe checkout session for upgrading to premium
router.post("/create-session", async (req, res) => {
  try {
    const { userId, email } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "TradeAI Premium Access" },
            unit_amount: 2999, // $29.99
          },
          quantity: 1,
        },
      ],
      metadata: { userId },
      success_url: "http://localhost:5173/payment/success",
      cancel_url: "http://localhost:5173/payment/cancel",
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payment/webhook
// Stripe calls this when payment is confirmed — upgrades user tier
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      return res.status(400).json({ message: `Webhook error: ${err.message}` });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata.userId;
      await User.findByIdAndUpdate(userId, { tier: "premium" });
    }

    res.json({ received: true });
  },
);

// GET /api/payment/status/:userId
// Returns current tier of a user
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
