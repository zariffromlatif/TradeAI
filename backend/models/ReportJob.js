const mongoose = require("mongoose");

const ReportJobSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    scope: { type: String, enum: ["self", "admin_all"], default: "self" },
    title: { type: String, default: "TradeAI Intelligence Report" },
    countryCode: { type: String, default: null, index: true },
    commodityId: { type: mongoose.Schema.Types.ObjectId, ref: "Commodity", default: null },
    sections: {
      type: [String],
      default: ["analytics", "risk", "forecast", "advisory"],
    },
    dateFrom: { type: Date, default: null },
    dateTo: { type: Date, default: null },
    status: {
      type: String,
      enum: ["pending", "ready", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    queueJobId: { type: String, default: null, index: true },
    errorMessage: { type: String, default: "" },
    generatedAt: { type: Date, default: null },
    snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    reportFilePath: { type: String, default: null },
    reportFileName: { type: String, default: null },
    reportMimeType: { type: String, default: "application/pdf" },
    reportFileSize: { type: Number, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ReportJob", ReportJobSchema);
