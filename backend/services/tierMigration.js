const User = require("../models/User");

/**
 * One-time style migration: legacy enum values -> Silver / Gold / Diamond.
 * Safe to run on every startup (idempotent).
 */
async function migrateLegacyUserTiers() {
  try {
    const freeToSilver = await User.updateMany(
      { tier: "free" },
      { $set: { tier: "silver" } },
    );
    const premiumToGold = await User.updateMany(
      { tier: "premium" },
      { $set: { tier: "gold" } },
    );
    const modified =
      (freeToSilver.modifiedCount || 0) + (premiumToGold.modifiedCount || 0);
    if (modified > 0) {
      console.log(
        JSON.stringify({
          level: "info",
          msg: "tier_migration",
          freeToSilver: freeToSilver.modifiedCount,
          premiumToGold: premiumToGold.modifiedCount,
        }),
      );
    }
  } catch (e) {
    console.error("tier_migration failed:", e.message);
  }
}

module.exports = { migrateLegacyUserTiers };
