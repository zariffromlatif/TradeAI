const path = require("node:path");
const axios = require("axios");
const mongoose = require("mongoose");
const User = require("../models/User");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000/api";

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

async function ensureUser({ name, email, password, role, tier = "silver" }) {
  try {
    await axios.post(`${API_BASE}/auth/register`, {
      name,
      email,
      password,
      role,
    });
  } catch (err) {
    const message = err.response?.data?.message || "";
    if (!String(message).includes("Email already registered")) {
      throw err;
    }
  }
  const loginRes = await axios.post(`${API_BASE}/auth/login`, { email, password });
  const user = loginRes.data?.user;
  // Update tier if different
  if (user.tier !== tier) {
    await User.findByIdAndUpdate(user.id, { tier });
    // Re-login to get new token
    const newLogin = await axios.post(`${API_BASE}/auth/login`, { email, password });
    return {
      token: newLogin.data?.token,
      user: newLogin.data?.user,
    };
  }
  return {
    token: loginRes.data?.token,
    user,
  };
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const refs = await getSeedRefs();
  const password = "Password123!";
  const runTag = Date.now().toString();
  const buyer = await ensureUser({
    name: "Buyer Verify",
    email: `buyer.verify.${runTag}@tradeai.local`,
    password,
    role: "buyer",
    tier: "gold",
  });
  const sellerA = await ensureUser({
    name: "Seller A Verify",
    email: `seller.a.verify.${runTag}@tradeai.local`,
    password,
    role: "seller",
    tier: "gold",
  });
  const sellerB = await ensureUser({
    name: "Seller B Verify",
    email: `seller.b.verify.${runTag}@tradeai.local`,
    password,
    role: "seller",
    tier: "gold",
  });
  const buyerHeaders = { Authorization: `Bearer ${buyer.token}` };
  const sellerAHeaders = { Authorization: `Bearer ${sellerA.token}` };
  const sellerBHeaders = { Authorization: `Bearer ${sellerB.token}` };

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
    { headers: buyerHeaders },
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
      { headers: sellerAHeaders },
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
      { headers: sellerBHeaders },
    ),
  ]);
  const acceptedCandidate = q2Res.data;
  assert(q1Res.data?._id && acceptedCandidate?._id, "Quote creation failed.");

  const acceptRes = await axios.post(
    `${API_BASE}/marketplace/quotes/${acceptedCandidate._id}/accept`,
    {},
    { headers: buyerHeaders },
  );
  const createdOrder = acceptRes.data?.order;
  assert(createdOrder?._id, "Order creation during quote acceptance failed.");

  const detailRes = await axios.get(`${API_BASE}/marketplace/rfqs/${rfq._id}`, { headers: buyerHeaders });
  const detail = detailRes.data;
  assert(detail?.rfq?.state === "selection", "RFQ state should become selection.");
  const acceptedCount = (detail?.quotes || []).filter((q) => q.status === "accepted").length;
  assert(acceptedCount === 1, "Exactly one quote must be accepted.");

  const settlementRes = await axios.put(
    `${API_BASE}/marketplace/deals/${createdOrder._id}/settlement`,
    {
      settlementStatus: "partially_settled",
      settlementNotes: "Verification partial settlement.",
      proofRefs: ["bank-advice-1.pdf"],
    },
    { headers: buyerHeaders },
  );
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
