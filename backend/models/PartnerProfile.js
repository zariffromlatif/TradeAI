const mongoose = require("mongoose");

const StatSchema = new mongoose.Schema(
  {
    metric: { type: String, required: true },
    minValue: { type: Number, default: null },
    maxValue: { type: Number, default: null },
    value: { type: Number, default: null },
    period: { type: String, default: "latest_available" },
    source: { type: String, default: "curated_user_input" },
    sourceUrl: { type: String, default: null },
    asOf: { type: Date, default: null },
  },
  { _id: false },
);

const PartnerProfileSchema = new mongoose.Schema(
  {
    reporterCode: { type: String, required: true, uppercase: true, trim: true },
    partnerCode: { type: String, required: true, uppercase: true, trim: true },
    partnerName: { type: String, required: true, trim: true },

    relationshipRole: {
      type: String,
      enum: ["import_dominant", "export_dominant", "balanced", "hub"],
      required: true,
    },

    imports: [{ type: String, trim: true }],
    exports: [{ type: String, trim: true }],
    insights: [{ type: String, trim: true }],
    stats: [StatSchema],

    sourceType: {
      type: String,
      enum: ["curated", "official_api", "hybrid"],
      default: "curated",
    },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// one relationship row per reporter+partner pair
PartnerProfileSchema.index(
  { reporterCode: 1, partnerCode: 1 },
  { unique: true },
);

module.exports = mongoose.model("PartnerProfile", PartnerProfileSchema);
