const express = require("express");
const mongoose = require("mongoose");

const MarketplaceRfq = require("../models/MarketplaceRfq");
const MarketplaceQuote = require("../models/MarketplaceQuote");
const Commodity = require("../models/Commodity");
const Country = require("../models/Country");
const Order = require("../models/Order");
const { requireAuth, attachUser, requireMinTier } = require("../middleware/auth");
const { quoteProfitability, landedCost } = require("../services/quoteFinance");
const { canTransition, assertCanBid, detectPriceAnomaly } = require("../services/rfqGuard");
const { computeBidScore } = require("../services/bidScoring");
const { evaluateSimulatedOrder } = require("../services/orderAnomaly");

const router = express.Router();

const RFQ_STATES = new Set([
  "draft",
  "open",
  "bidding",
  "selection",
  "completed",
  "cancelled",
]);
const SETTLEMENT_STATUSES = new Set([
  "unpaid",
  "partially_settled",
  "settled",
  "disputed",
]);

function parsePager(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

// helper
function pushStateHistory(rfq, from, to, by, reason = "") {
  rfq.stateHistory.push({ from, to, by: by || null, reason, at: new Date() });
}

function getActorId(req) {
  return req.auth?.sub || null;
}

function hasAnyRole(user, roles) {
  return !!user?.role && roles.includes(user.role);
}

function isBuyerRole(user) {
  return hasAnyRole(user, ["buyer", "admin", "user"]);
}

function isSellerRole(user) {
  return hasAnyRole(user, ["seller", "admin"]);
}

router.get("/rfqs", requireAuth, requireMinTier("gold"), async (req, res) => {
  try {
    const { page, limit, skip } = parsePager(req.query);
    const filter = {};
    if (req.query.state && RFQ_STATES.has(req.query.state)) filter.state = req.query.state;
    if (req.query.status && RFQ_STATES.has(req.query.status)) filter.state = req.query.status;
    if (req.query.commodity) filter.commodity = req.query.commodity;
    if (req.query.country) {
      filter.$or = [
        { originCountry: req.query.country },
        { destinationCountry: req.query.country },
      ];
    }

    const [items, total] = await Promise.all([
      MarketplaceRfq.find(filter)
        .populate("commodity", "name category unit")
        .populate("originCountry destinationCountry", "name code")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MarketplaceRfq.countDocuments(filter),
    ]);

    res.json({ items, page, limit, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/rfqs", requireAuth, attachUser, async (req, res) => {
  try {
    if (!req.auth?.sub) {
      return res.status(401).json({ message: "Authentication required." });
    }
    if (!isBuyerRole(req.user)) {
      return res.status(403).json({ message: "Only buyers can create RFQs." });
    }
    const {
      title,
      specs,
      commodity,
      originCountry,
      destinationCountry,
      targetQuantity,
      unit,
      requiredIncoterm,
      preferredDeliveryWindow,
      state,
      biddingWindow,
    } = req.body;

    if (!title || !commodity || !originCountry || !destinationCountry || !targetQuantity || !unit) {
      return res.status(400).json({ message: "Missing required RFQ fields." });
    }

    const [commodityDoc, originDoc, destinationDoc] = await Promise.all([
      Commodity.findById(commodity),
      Country.findById(originCountry),
      Country.findById(destinationCountry),
    ]);

    if (!commodityDoc || !originDoc || !destinationDoc) {
      return res.status(404).json({ message: "Commodity or country not found." });
    }

    const rfq = await MarketplaceRfq.create({
      title: String(title).trim(),
      specs: String(specs || "").trim(),
      commodity,
      originCountry,
      destinationCountry,
      targetQuantity: Number(targetQuantity),
      unit: String(unit).trim(),
      requiredIncoterm: String(requiredIncoterm || "FOB").trim(),
      preferredDeliveryWindow: String(preferredDeliveryWindow || "").trim(),
      createdBy: getActorId(req),
      state: RFQ_STATES.has(state) ? state : "open",
      biddingWindow: biddingWindow || { startsAt: null, endsAt: null },
    });

    const created = await MarketplaceRfq.findById(rfq._id)
      .populate("commodity", "name category unit")
      .populate("originCountry destinationCountry", "name code");
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/rfqs/:id", requireAuth, requireMinTier("gold"), async (req, res) => {
  try {
    const rfq = await MarketplaceRfq.findById(req.params.id)
      .populate("commodity", "name category unit")
      .populate("originCountry destinationCountry", "name code");
    if (!rfq) return res.status(404).json({ message: "RFQ not found." });

    const quotes = await MarketplaceQuote.find({ rfqId: rfq._id })
      .sort({ createdAt: -1 })
      .populate("supplierId", "name email");

    res.json({ rfq, quotes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/rfqs/:id/state", requireAuth, attachUser, async (req, res) => {
  try {
    if (!req.auth?.sub) {
      return res.status(401).json({ message: "Authentication required." });
    }
    const { to, reason = "" } = req.body;
    if (!RFQ_STATES.has(to)) {
      return res.status(400).json({ message: "Invalid RFQ state." });
    }
    const rfq = await MarketplaceRfq.findById(req.params.id);
    if (!rfq) return res.status(404).json({ message: "RFQ not found." });
    if (
      req.auth.role !== "admin" &&
      (!rfq.createdBy || rfq.createdBy.toString() !== req.auth.sub)
    ) {
      return res.status(403).json({ message: "Only RFQ owner can change state." });
    }
    if (!canTransition(rfq.state, to)) {
      return res
        .status(409)
        .json({ message: `Invalid transition ${rfq.state} -> ${to}` });
    }

    const from = rfq.state;
    rfq.state = to;
    if (to === "completed") rfq.completedAt = new Date();
    pushStateHistory(rfq, from, to, getActorId(req), reason);
    await rfq.save();

    res.json(rfq);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/rfqs/:id/quotes", requireAuth, attachUser, async (req, res) => {
  try {
    if (!req.auth?.sub) {
      return res.status(401).json({ message: "Authentication required." });
    }
    if (!isSellerRole(req.user)) {
      return res.status(403).json({ message: "Only sellers can submit quotes." });
    }
    const rfq = await MarketplaceRfq.findById(req.params.id).populate("commodity");
    if (!rfq) return res.status(404).json({ message: "RFQ not found." });
    const guard = assertCanBid(rfq);
    if (!guard.ok) return res.status(409).json({ message: guard.message, code: guard.code });

    const {
      offeredPrice,
      currency,
      leadTimeDays,
      minOrderQty,
      notes,
      validityDate,
      freight,
      insurance,
      dutiesEstimate,
      countryRiskScore,
    } = req.body;
    if (!offeredPrice || !leadTimeDays || !validityDate) {
      return res.status(400).json({ message: "Missing required quote fields." });
    }

    const normalizedPrice = Number(offeredPrice);
    const marketAvg = Number(rfq.commodity?.currentPrice || 0);
    const anomaly = detectPriceAnomaly({
      offeredPrice: normalizedPrice,
      marketAvg,
      thresholdPct: 30,
    });
    const score = computeBidScore({
      quote: { offeredPrice: normalizedPrice, leadTimeDays: Number(leadTimeDays || 30) },
      marketAvg,
      countryRiskScore: Number(countryRiskScore || 50),
    });

    const quote = await MarketplaceQuote.create({
      rfqId: rfq._id,
      supplierId: getActorId(req),
      offeredPrice: normalizedPrice,
      currency: String(currency || "USD").trim(),
      leadTimeDays: Number(leadTimeDays),
      minOrderQty: Number(minOrderQty || 1),
      notes: String(notes || "").trim(),
      validityDate: new Date(validityDate),
      freight: Number(freight || 0),
      insurance: Number(insurance || 0),
      dutiesEstimate: Number(dutiesEstimate || 0),
      status: "submitted",
      isPriceAnomaly: anomaly.isAnomaly,
      anomalyPctFromMarket: anomaly.pct,
      guardFlags: anomaly.isAnomaly
        ? [
            {
              code: "PRICE_DEVIATION",
              severity: "warning",
              message: `Price deviation ${anomaly.pct}% vs market`,
            },
          ]
        : [],
      ...score,
    });

    if (rfq.state === "open") {
      rfq.state = "bidding";
      await rfq.save();
    }

    const created = await MarketplaceQuote.findById(quote._id).populate("supplierId", "name email");
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/rfqs/:id/quotes", requireAuth, requireMinTier("gold"), async (req, res) => {
  try {
    const { page, limit, skip } = parsePager(req.query);
    const filter = { rfqId: req.params.id };
    if (req.query.status) filter.status = req.query.status;

    const [items, total] = await Promise.all([
      MarketplaceQuote.find(filter)
        .populate("supplierId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MarketplaceQuote.countDocuments(filter),
    ]);
    res.json({ items, page, limit, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/quotes/:id/accept", requireAuth, attachUser, async (req, res) => {
  if (!req.auth?.sub) {
    return res.status(401).json({ message: "Authentication required." });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const quote = await MarketplaceQuote.findById(req.params.id).session(session);
    if (!quote) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Quote not found." });
    }
    if (quote.status !== "submitted") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Quote is not in submitted state." });
    }

    const rfq = await MarketplaceRfq.findById(quote.rfqId).session(session);
    if (!rfq) {
      await session.abortTransaction();
      return res.status(404).json({ message: "RFQ not found for quote." });
    }
    if (rfq.state === "completed" || rfq.state === "cancelled") {
      await session.abortTransaction();
      return res.status(400).json({ message: "RFQ is already locked for awarding." });
    }
    if (
      req.auth.role !== "admin" &&
      (!rfq.createdBy || rfq.createdBy.toString() !== req.auth.sub)
    ) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Only RFQ owner can accept bids." });
    }
    if (!isBuyerRole(req.user)) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Only buyers can accept bids." });
    }

    const commodityDoc = await Commodity.findById(rfq.commodity).session(session);
    if (!commodityDoc) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Commodity not found." });
    }

    const orderEval = await evaluateSimulatedOrder({
      commodity: commodityDoc,
      country: rfq.destinationCountry,
      quantity: rfq.targetQuantity,
      pricePerUnit: quote.offeredPrice,
    });

    const order = await Order.create(
      [
        {
          commodity: rfq.commodity,
          country: rfq.destinationCountry,
          type: "buy",
          quantity: rfq.targetQuantity,
          pricePerUnit: quote.offeredPrice,
          totalValue: Number(rfq.targetQuantity) * Number(quote.offeredPrice),
          status: "confirmed",
          source: "rfq",
          rfqId: rfq._id,
          quoteId: quote._id,
          buyerId: rfq.createdBy,
          sellerId: quote.supplierId,
          settlementStatus: "unpaid",
          settlementNotes: "Off-platform settlement initiated.",
          notes: rfq.specs || "",
          isAnomaly: orderEval.isAnomaly,
          anomalyReason: (orderEval.anomalyReason || "").trim(),
        },
      ],
      { session },
    );

    await MarketplaceQuote.updateMany(
      { rfqId: rfq._id, _id: { $ne: quote._id }, status: "submitted" },
      { $set: { status: "rejected" } },
      { session },
    );
    quote.status = "accepted";
    await quote.save({ session });

    rfq.state = "selection";
    rfq.selectedQuoteId = quote._id;
    pushStateHistory(rfq, "bidding", "selection", getActorId(req), "quote_accepted");
    await rfq.save({ session });

    await session.commitTransaction();
    res.status(201).json({ message: "Quote accepted and deal created.", order: order[0] });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

router.get("/rfqs/:id/comparison-matrix", requireAuth, requireMinTier("gold"), async (req, res) => {
  try {
    const quotes = await MarketplaceQuote.find({
      rfqId: req.params.id,
      status: { $in: ["submitted", "accepted"] },
    })
      .populate("supplierId", "name email")
      .sort({ compositeScore: -1, offeredPrice: 1 });

    const rows = quotes.map((q) => ({
      quoteId: q._id,
      supplier: q.supplierId?.name || "Unknown",
      price: q.offeredPrice,
      freight: q.freight,
      insurance: q.insurance,
      dutiesEstimate: q.dutiesEstimate,
      leadTimeDays: q.leadTimeDays,
      totalEstimated: Number(
        (q.offeredPrice + q.freight + q.insurance + q.dutiesEstimate).toFixed(2),
      ),
      compositeScore: q.compositeScore,
      guardFlags: q.guardFlags || [],
      status: q.status,
    }));

    res.json({ rfqId: req.params.id, rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/deals", requireAuth, attachUser, requireMinTier("gold"), async (req, res) => {
  try {
    if (!req.auth?.sub) {
      return res.status(401).json({ message: "Authentication required." });
    }
    const { page, limit, skip } = parsePager(req.query);
    const filter = { source: "rfq" };
    if (req.auth.role !== "admin") {
      filter.$or = [{ buyerId: req.auth.sub }, { sellerId: req.auth.sub }];
    }
    if (req.query.settlementStatus && SETTLEMENT_STATUSES.has(req.query.settlementStatus)) {
      filter.settlementStatus = req.query.settlementStatus;
    }
    if (req.query.status) filter.status = req.query.status;

    const [items, total] = await Promise.all([
      Order.find(filter)
        .populate("commodity", "name category")
        .populate("country", "name code")
        .populate("buyerId sellerId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    res.json({ items, page, limit, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/deals/:id/settlement", requireAuth, attachUser, async (req, res) => {
  try {
    if (!req.auth?.sub) {
      return res.status(401).json({ message: "Authentication required." });
    }
    const { settlementStatus, settlementNotes, proofRefs } = req.body;
    if (!SETTLEMENT_STATUSES.has(settlementStatus)) {
      return res.status(400).json({ message: "Invalid settlement status." });
    }

    const accessFilter =
      req.auth.role === "admin"
        ? { _id: req.params.id, source: "rfq" }
        : {
            _id: req.params.id,
            source: "rfq",
            $or: [{ buyerId: req.auth.sub }, { sellerId: req.auth.sub }],
          };

    const updated = await Order.findOneAndUpdate(
      accessFilter,
      {
        $set: {
          settlementStatus,
          settlementNotes: String(settlementNotes || "").trim(),
          proofRefs: Array.isArray(proofRefs)
            ? proofRefs.map((p) => String(p)).filter(Boolean)
            : [],
        },
      },
      { new: true },
    )
      .populate("commodity", "name category")
      .populate("country", "name code")
      .populate("buyerId sellerId", "name email");

    if (!updated) return res.status(404).json({ message: "Deal not found." });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/quotes/profitability", requireAuth, attachUser, async (req, res) => {
  try {
    const result = quoteProfitability(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/quotes/landed-cost", requireAuth, attachUser, async (req, res) => {
  try {
    const result = landedCost(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET purchase price (commodity + country)
router.get("/price-estimate", async (req, res) => {
  try {
    const { commodityId, countryId } = req.query;

    const commodity = await Commodity.findById(commodityId);
    if (!commodity) {
      return res.status(404).json({ message: "Commodity not found" });
    }

    let basePrice = commodity.currentPrice || 0;

    // simple country adjustment (you can improve later)
    let countryFactor = 1;
    if (countryId) {
      countryFactor = 1.05;
    }

    const estimatedPrice = basePrice * countryFactor;

    res.json({
      commodity: commodity.name,
      basePrice,
      estimatedPrice,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
