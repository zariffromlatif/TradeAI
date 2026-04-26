/**
 * Subscription tiers: Silver (base) < Gold < Diamond.
 * Roles (buyer/seller/admin) are separate from tiers.
 */

const TIER_ORDER = ["silver", "gold", "diamond"];

const PAID_TIERS = new Set(["gold", "diamond"]);

function tierRank(tier) {
  const i = TIER_ORDER.indexOf(String(tier || "").toLowerCase());
  return i >= 0 ? i : 0;
}

function isValidTier(tier) {
  return TIER_ORDER.includes(String(tier || "").toLowerCase());
}

function isPaidTier(tier) {
  return PAID_TIERS.has(String(tier || "").toLowerCase());
}

function isUpgradeTargetTier(tier) {
  return tier === "gold" || tier === "diamond";
}

/** After payment or admin approval: user gets the higher of current and new tier. */
function mergeTierUpgrade(currentTier, purchasedTier) {
  const cur = String(currentTier || "silver").toLowerCase();
  const next = String(purchasedTier || "silver").toLowerCase();
  if (!isValidTier(cur)) return isValidTier(next) ? next : "silver";
  if (!isValidTier(next)) return cur;
  return tierRank(next) >= tierRank(cur) ? next : cur;
}

/** Max trade-volume forecast horizon (months) by subscription tier. */
function maxForecastHorizon(tier) {
  const t = String(tier || "silver").toLowerCase();
  if (t === "diamond") return 12;
  if (t === "gold") return 9;
  return 3;
}

module.exports = {
  TIER_ORDER,
  PAID_TIERS,
  tierRank,
  isValidTier,
  isPaidTier,
  isUpgradeTargetTier,
  mergeTierUpgrade,
  maxForecastHorizon,
};
