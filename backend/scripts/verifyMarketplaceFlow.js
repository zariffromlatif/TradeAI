const path = require("node:path");
const axios = require("axios");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000/api";
const ACTOR = process.env.MARKETPLACE_TEST_USER_ID || "000000000000000000000001";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function getSeedRefs() {
  const [commoditiesRes, countriesRes] = await Promise.all([
    axios.get(`${API_BASE}/commodities`),
    axios.get(`${API_BASE}/countries`),
  ]);
  const commodities = commoditiesRes.data || [];
  const countries = countriesRes.data || [];
  assert(commodities.length > 0, "No commodities found. Seed or sync commodities first.");
  assert(countries.length >= 2, "Need at least two countries for RFQ route.");
  return {
    commodityId: commodities[0]._id,
    originCountryId: countries[0]._id,
    destinationCountryId: countries[1]._id,
  };
}

async function run() {
  const refs = await getSeedRefs();

  const rfqRes = await axios.post(
    `${API_BASE}/marketplace/rfqs`,
    {
      title: "Verification RFQ",
      specs: "Auto-generated verification RFQ",
      commodity: refs.commodityId,
      originCountry: refs.originCountryId,
      destinationCountry: refs.destinationCountryId,
      targetQuantity: 250,
      unit: "MT",
      requiredIncoterm: "FOB",
      preferredDeliveryWindow: "Q3",
    },
    { headers: { "x-user-id": ACTOR } },
  );
  const rfq = rfqRes.data;
  assert(rfq?._id, "RFQ creation failed.");

  const [q1Res, q2Res] = await Promise.all([
    axios.post(
      `${API_BASE}/marketplace/rfqs/${rfq._id}/quotes`,
      {
        offeredPrice: 470,
        currency: "USD",
        leadTimeDays: 18,
        minOrderQty: 100,
        notes: "Verification quote A",
        validityDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { headers: { "x-user-id": "00000000000000000000000a" } },
    ),
    axios.post(
      `${API_BASE}/marketplace/rfqs/${rfq._id}/quotes`,
      {
        offeredPrice: 460,
        currency: "USD",
        leadTimeDays: 22,
        minOrderQty: 120,
        notes: "Verification quote B",
        validityDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { headers: { "x-user-id": "00000000000000000000000b" } },
    ),
  ]);
  const acceptedCandidate = q2Res.data;
  assert(q1Res.data?._id && acceptedCandidate?._id, "Quote creation failed.");

  const acceptRes = await axios.post(`${API_BASE}/marketplace/quotes/${acceptedCandidate._id}/accept`);
  const createdOrder = acceptRes.data?.order;
  assert(createdOrder?._id, "Order creation during quote acceptance failed.");

  const detailRes = await axios.get(`${API_BASE}/marketplace/rfqs/${rfq._id}`);
  const detail = detailRes.data;
  assert(detail?.rfq?.status === "awarded", "RFQ status should become awarded.");
  const acceptedCount = (detail?.quotes || []).filter((q) => q.status === "accepted").length;
  assert(acceptedCount === 1, "Exactly one quote must be accepted.");

  const settlementRes = await axios.put(`${API_BASE}/marketplace/deals/${createdOrder._id}/settlement`, {
    settlementStatus: "partially_settled",
    settlementNotes: "Verification partial settlement.",
    proofRefs: ["bank-advice-1.pdf"],
  });
  assert(
    settlementRes.data?.settlementStatus === "partially_settled",
    "Settlement status update failed.",
  );

  console.log("Marketplace verification passed.");
  console.log(`RFQ: ${rfq._id}`);
  console.log(`Accepted quote: ${acceptedCandidate._id}`);
  console.log(`Deal: ${createdOrder._id}`);
}

run().catch((err) => {
  console.error("Marketplace verification failed:", err.response?.data?.message || err.message);
  process.exit(1);
});
