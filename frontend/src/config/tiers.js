/** Must match backend `services/tier.js` ordering. */
export const TIER_ORDER = ["silver", "gold", "diamond"];

export function tierRank(tier) {
  const i = TIER_ORDER.indexOf(String(tier || "").toLowerCase());
  return i >= 0 ? i : 0;
}

export function tierLabel(tier) {
  const t = String(tier || "silver").toLowerCase();
  if (t === "gold") return "Gold";
  if (t === "diamond") return "Diamond";
  return "Silver";
}

export function tierIsPaid(tier) {
  const t = String(tier || "").toLowerCase();
  return t === "gold" || t === "diamond";
}

/** Mirrors backend `services/tier.js` — max volume forecast horizon (months). */
export function maxForecastHorizon(tier) {
  const t = String(tier || "silver").toLowerCase();
  if (t === "diamond") return 12;
  if (t === "gold") return 9;
  return 3;
}
