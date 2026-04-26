const ReportJob = require("../models/ReportJob");
const Notification = require("../models/Notification");
const { emitToUser } = require("../realtime");
const { reportQueue } = require("../queues/reportQueue");
const { buildReportData, buildPdfBuffer } = require("../services/reportBuilder");
const fs = require("node:fs/promises");
const path = require("node:path");

let initialized = false;

function initReportWorker() {
  if (initialized) return;
  initialized = true;

  reportQueue.process(2, async (job) => {
    const reportJobId = job.data?.reportJobId;
    if (!reportJobId) throw new Error("Missing reportJobId");

    const reportJob = await ReportJob.findById(reportJobId);
    if (!reportJob) throw new Error(`ReportJob not found: ${reportJobId}`);

    reportJob.status = "pending";
    reportJob.errorMessage = "";
    await reportJob.save();

    const snapshot = await buildReportData({
      sections: reportJob.sections,
      countryCode: reportJob.countryCode,
      commodityId: reportJob.commodityId,
      dateFrom: reportJob.dateFrom,
      dateTo: reportJob.dateTo,
    });
    const pdfBuffer = await buildPdfBuffer(
      reportJob.title || "TradeAI Intelligence Report",
      snapshot,
    );
    const reportsDir = path.resolve(process.cwd(), "data", "reports");
    await fs.mkdir(reportsDir, { recursive: true });
    const fileName = `tradeai-report-${reportJob._id}.pdf`;
    const filePath = path.join(reportsDir, fileName);
    await fs.writeFile(filePath, pdfBuffer);

    reportJob.snapshot = snapshot;
    reportJob.status = "ready";
    reportJob.generatedAt = new Date();
    reportJob.reportFilePath = filePath;
    reportJob.reportFileName = fileName;
    reportJob.reportMimeType = "application/pdf";
    reportJob.reportFileSize = pdfBuffer.length;
    await reportJob.save();

    await Notification.create({
      userId: reportJob.ownerId,
      type: "report_ready",
      severity: "info",
      message: `Report "${reportJob.title}" is ready for download.`,
    });
    emitToUser(reportJob.ownerId, "report_ready", {
      reportJobId: reportJob._id,
      title: reportJob.title,
    });

    return { reportJobId };
  });

  reportQueue.on("failed", async (job, err) => {
    const reportJobId = job?.data?.reportJobId;
    if (!reportJobId) return;
    try {
      await ReportJob.findByIdAndUpdate(reportJobId, {
        status: "failed",
        errorMessage: String(err?.message || "Report job failed"),
      });
    } catch {
      // no-op
    }
  });

  console.log("Report worker initialized");
}

module.exports = { initReportWorker };
