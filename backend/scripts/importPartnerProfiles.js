const path = require("node:path");
const fs = require("node:fs/promises");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const PartnerProfile = require("../models/PartnerProfile");
const Country = require("../models/Country");

const FALLBACK_REGION = {
  CN: "East Asia",
  IN: "South Asia",
  US: "North America",
  DE: "Europe",
  GB: "Europe",
  AE: "Middle East",
};

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  const filePath = path.join(__dirname, "../data/partnerProfiles.bd.json");
  const raw = await fs.readFile(filePath, "utf-8");
  const rows = JSON.parse(raw);

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("partnerProfiles.bd.json must be a non-empty JSON array");
  }

  await mongoose.connect(process.env.MONGO_URI);

  let upserts = 0;
  let countryUpserts = 0;
  for (const row of rows) {
    await PartnerProfile.updateOne(
      { reporterCode: row.reporterCode, partnerCode: row.partnerCode },
      { $set: row },
      { upsert: true },
    );
    upserts += 1;

    // Keep Country collection aligned with partner profiles
    await Country.updateOne(
      { code: row.partnerCode.toUpperCase() },
      {
        $setOnInsert: {
          name: row.partnerName,
          code: row.partnerCode.toUpperCase(),
          region: FALLBACK_REGION[row.partnerCode.toUpperCase()] || "Unknown",
        },
      },
      { upsert: true },
    );
    countryUpserts += 1;
  }

  console.log(
    `Imported/updated ${upserts} partner profile(s); aligned ${countryUpserts} country reference row(s).`,
  );
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Import failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
