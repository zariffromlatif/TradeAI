const path = require("node:path");
const axios = require("axios");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000/api";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function ensureUser({ name, email, password, role }) {
  try {
    await axios.post(`${API_BASE}/auth/register`, {
      name,
      email,
      password,
      role,
    });
  } catch (err) {
    const message = err.response?.data?.message || "";
    if (!String(message).includes("Email already registered")) throw err;
  }
  const login = await axios.post(`${API_BASE}/auth/login`, { email, password });
  return login.data?.token;
}

async function run() {
  const password = "Password123!";
  const runTag = Date.now().toString();
  const buyerToken = await ensureUser({
    name: "Buyer Guard",
    email: `buyer.guard.${runTag}@tradeai.local`,
    password,
    role: "buyer",
  });
  const sellerToken = await ensureUser({
    name: "Seller Guard",
    email: `seller.guard.${runTag}@tradeai.local`,
    password,
    role: "seller",
  });

  const buyerHeaders = { Authorization: `Bearer ${buyerToken}` };
  const sellerHeaders = { Authorization: `Bearer ${sellerToken}` };

  const [commoditiesRes, countriesRes] = await Promise.all([
    axios.get(`${API_BASE}/commodities`),
    axios.get(`${API_BASE}/countries`),
  ]);
  const commodity = commoditiesRes.data?.[0]?._id;
  const originCountry = countriesRes.data?.[0]?._id;
  const destinationCountry = countriesRes.data?.[1]?._id;
  assert(commodity && originCountry && destinationCountry, "Seed refs missing");

  const rfqRes = await axios.post(
    `${API_BASE}/marketplace/rfqs`,
    {
      title: "Guard Test RFQ",
      specs: "Guard checks",
      commodity,
      originCountry,
      destinationCountry,
      targetQuantity: 100,
      unit: "MT",
      state: "open",
    },
    { headers: buyerHeaders },
  );

  const rfqId = rfqRes.data?._id;
  assert(rfqId, "RFQ create failed");

  await axios.patch(
    `${API_BASE}/marketplace/rfqs/${rfqId}/state`,
    { to: "cancelled", reason: "guard_test_close" },
    { headers: buyerHeaders },
  );

  let blockedBadTransition = false;
  try {
    await axios.patch(
      `${API_BASE}/marketplace/rfqs/${rfqId}/state`,
      { to: "open", reason: "invalid_transition_test" },
      { headers: buyerHeaders },
    );
  } catch (err) {
    blockedBadTransition = err.response?.status === 409;
  }
  assert(blockedBadTransition, "State transition guard failed");

  let blockedClosedBid = false;
  try {
    await axios.post(
      `${API_BASE}/marketplace/rfqs/${rfqId}/quotes`,
      {
        offeredPrice: 10,
        leadTimeDays: 10,
        validityDate: new Date(Date.now() + 86400000).toISOString(),
      },
      { headers: sellerHeaders },
    );
  } catch (err) {
    blockedClosedBid = err.response?.status === 409;
  }
  assert(blockedClosedBid, "Closed RFQ bid guard failed");

  console.log("Marketplace guard verification passed.");
}

run().catch((err) => {
  console.error(
    "Marketplace guard verification failed:",
    err.response?.data?.message || err.message,
  );
  process.exit(1);
});
