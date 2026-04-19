const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    tier: { type: String, enum: ["free", "premium"], default: "free" },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin", "user"],
      default: "buyer",
    },
    stripeCustomerId: { type: String },
  },
  { timestamps: true },
  
);

module.exports = mongoose.model("User", UserSchema);
