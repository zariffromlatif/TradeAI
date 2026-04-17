const express = require("express");
const mongoose = require("mongoose");

const MarketplaceRfq = require("../models/MarketplaceRfq");
const MarketplaceQuote = require("../models/MarketplaceQuote");
const Commodity = require("../models/Commodity");
const Country = require("../models/Country");
const Order = require("../models/Order");
const { evaluateSimulatedOrder } = require("../services/orderAnomaly");

const router = express.Router();

const RFQ_STATUSES = new Set(["open", "quoted", "awarded", "closed", "cancelled"]);
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

function getActorId(req) {
  const actor = req.headers["x-user-id"];
  return typeof actor === "string" && actor.trim() ? actor.trim() : null;
}

router.get("/rfqs", async (req, res) => {
  try {
    const { page, limit, skip } = parsePager(req.query);
    const filter = {};
    if (req.query.status && RFQ_STATUSES.has(req.query.status)) filter.status = req.query.status;
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

router.post("/rfqs", async (req, res) => {
  try {
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
      status: "open",
    });

    const created = await MarketplaceRfq.findById(rfq._id)
      .populate("commodity", "name category unit")
      .populate("originCountry destinationCountry", "name code");
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/rfqs/:id", async (req, res) => {
  try {
    const rfq = await MarketplaceRfq.findById(req.params.id)
      .populate("commodity", "name category unit")
      .populate("originCountry destinationCountry", "name code");
    if (!rfq) return res.status(404).json({ message: "RFQ not found." });

    const quotes = await MarketplaceQuote.find({ rfqId: rfq._id })
      .sort({ createdAt: -1 })
      .populate("sellerId", "name email");

    res.json({ rfq, quotes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/rfqs/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!RFQ_STATUSES.has(status)) {
      return res.status(400).json({ message: "Invalid RFQ status." });
    }
    const updated = await MarketplaceRfq.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    )
      .populate("commodity", "name category unit")
      .populate("originCountry destinationCountry", "name code");

    if (!updated) return res.status(404).json({ message: "RFQ not found." });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/rfqs/:id/quotes", async (req, res) => {
  try {
    const { page, limit, skip } = parsePager(req.query);
    const filter = { rfqId: req.params.id };
    if (req.query.status) filter.status = req.query.status;

    const [items, total] = await Promise.all([
      MarketplaceQuote.find(filter)
        .populate("sellerId", "name email")
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

router.post("/rfqs/:id/quotes", async (req, res) => {
  try {
    const rfq = await MarketplaceRfq.findById(req.params.id);
    if (!rfq) return res.status(404).json({ message: "RFQ not found." });
    if (rfq.status !== "open" && rfq.status !== "quoted") {
      return res.status(400).json({ message: "RFQ is not open for new quotes." });
    }

    const { offeredPrice, currency, leadTimeDays, minOrderQty, notes, validityDate } = req.body;
    if (!offeredPrice || !leadTimeDays || !validityDate) {
      return res.status(400).json({ message: "Missing required quote fields." });
    }

    const quote = await MarketplaceQuote.create({
      rfqId: rfq._id,
      sellerId: getActorId(req),
      offeredPrice: Number(offeredPrice),
      currency: String(currency || "USD").trim(),
      leadTimeDays: Number(leadTimeDays),
      minOrderQty: Number(minOrderQty || 1),
      notes: String(notes || "").trim(),
      validityDate: new Date(validityDate),
      status: "submitted",
    });

    if (rfq.status === "open") {
      rfq.status = "quoted";
      await rfq.save();
    }

    const created = await MarketplaceQuote.findById(quote._id).populate(
      "sellerId",
      "name email",
    );
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/quotes/:id/accept", async (req, res) => {
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
    if (rfq.status === "awarded" || rfq.status === "closed" || rfq.status === "cancelled") {
      await session.abortTransaction();
      return res.status(400).json({ message: "RFQ is already locked for awarding." });
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
          status: "active",
          source: "rfq",
          rfqId: rfq._id,
          quoteId: quote._id,
          buyerId: rfq.createdBy,
          sellerId: quote.sellerId,
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

    rfq.status = "awarded";
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

router.get("/deals", async (req, res) => {
  try {
    const { page, limit, skip } = parsePager(req.query);
    const filter = { source: "rfq" };
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

router.put("/deals/:id/settlement", async (req, res) => {
  try {
    const { settlementStatus, settlementNotes, proofRefs } = req.body;
    if (!SETTLEMENT_STATUSES.has(settlementStatus)) {
      return res.status(400).json({ message: "Invalid settlement status." });
    }

    const updated = await Order.findOneAndUpdate(
      { _id: req.params.id, source: "rfq" },
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

module.exports = router;
