const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    tier: {
      type: String,
      enum: ["silver", "gold", "diamond"],
      default: function () {
        return this.role === "admin" ? undefined : "silver";
      },
    },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin", "user"],
      default: "buyer",
    },
    stripeCustomerId: { type: String },
  },
  { timestamps: true },
);

UserSchema.pre("save", function (next) {
  if (this.role === "admin") {
    this.tier = undefined;
  } else if (!this.tier) {
    this.tier = "silver";
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);
