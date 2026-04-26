const mongoose = require("mongoose");

const PAYMENT_REQUEST_STATUSES = ["pending", "approved", "rejected"];

const PaymentRequestSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    note: { type: String, default: "" },
    requestTierUpgrade: { type: Boolean, default: false },
    /** When requestTierUpgrade is true: tier granted on admin approval (Gold or Diamond). */
    requestedTier: {
      type: String,
      enum: ["gold", "diamond"],
      default: undefined,
    },
    status: {
      type: String,
      enum: PAYMENT_REQUEST_STATUSES,
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewNote: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PaymentRequest", PaymentRequestSchema);
