const ALLOWED_TRANSITIONS = {
  draft: ["open", "cancelled"],
  open: ["bidding", "cancelled"],
  bidding: ["selection", "cancelled"],
  selection: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

function canTransition(from, to) {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

function assertCanBid(rfq) {
  if (!["open", "bidding"].includes(rfq.state)) {
    return {
      ok: false,
      code: "RFQ_CLOSED_FOR_BIDDING",
      message: `Cannot bid when RFQ state is ${rfq.state}`,
    };
  }
  if (
    rfq.biddingWindow?.endsAt &&
    new Date(rfq.biddingWindow.endsAt) < new Date()
  ) {
    return {
      ok: false,
      code: "BIDDING_WINDOW_EXPIRED",
      message: "Bidding window has expired",
    };
  }
  return { ok: true };
}

function detectPriceAnomaly({ offeredPrice, marketAvg, thresholdPct = 30 }) {
  if (!marketAvg || marketAvg <= 0) return { isAnomaly: false, pct: null };
  const pct = ((offeredPrice - marketAvg) / marketAvg) * 100;
  return {
    isAnomaly: Math.abs(pct) > thresholdPct,
    pct: Number(pct.toFixed(2)),
  };
}

module.exports = { canTransition, assertCanBid, detectPriceAnomaly };
