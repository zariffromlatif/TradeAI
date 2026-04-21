const Country = require("../models/Country");
const TradeRecord = require("../models/TradeRecord");

/** ISO2 code for synthetic "World" partner for national totals. */
const WORLD_CODE = "WLD";

const SOURCE_OK = { $in: ["un_comtrade", "official_api", "world_bank_api"] };

async function ensureWorldCountry() {
  let doc = await Country.findOne({ code: WORLD_CODE });
  if (!doc) {
    doc = await Country.create({
      name: "World (official total)",
      code: WORLD_CODE,
      region: "Aggregate",
      GDP: 0,
      inflation: 0,
      tradeBalance: 0,
    });
  }
  return doc;
}

/**
 * When national (reporter–World) rows exist, aggregates should use them only — not sums of bilateral
 * flows, which are wrong for national totals and often produce identical values across countries.
 */
async function getNationalPartnerMatch(mongooseCommodityId, options = {}) {
  const { relaxed = false } = options;
  const world = await Country.findOne({ code: WORLD_CODE }).select("_id").lean();
  if (!world) return {};

  const q = {
    partner: world._id,
  };
  if (!relaxed) {
    q.isVerified = true;
    q.source = SOURCE_OK;
  }
  if (mongooseCommodityId) {
    q.commodity = mongooseCommodityId;
  }

  const n = await TradeRecord.countDocuments(q);
  return n > 0 ? { partner: world._id } : {};
}

module.exports = {
  WORLD_CODE,
  ensureWorldCountry,
  getNationalPartnerMatch,
};
