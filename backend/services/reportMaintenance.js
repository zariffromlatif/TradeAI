const fs = require("node:fs/promises");
const ReportJob = require("../models/ReportJob");

let cleanupTimer = null;

async function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // no-op (file may already be gone)
  }
}

async function cleanupOldReports() {
  const retentionDays = Number(process.env.REPORT_RETENTION_DAYS || 30);
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const oldReadyJobs = await ReportJob.find({
    status: "ready",
    generatedAt: { $lt: cutoff },
    reportFilePath: { $ne: null },
  }).select("_id reportFilePath");

  for (const job of oldReadyJobs) {
    await safeUnlink(job.reportFilePath);
    await ReportJob.findByIdAndUpdate(job._id, {
      reportFilePath: null,
      reportFileName: null,
      reportFileSize: null,
    });
  }
}

function initReportMaintenance() {
  if (cleanupTimer) return;
  const intervalMinutes = Number(process.env.REPORT_CLEANUP_INTERVAL_MINUTES || 60);
  const intervalMs = Math.max(5, Number.isFinite(intervalMinutes) ? intervalMinutes : 60) * 60 * 1000;

  cleanupTimer = setInterval(() => {
    cleanupOldReports().catch((err) => {
      console.error(`Report cleanup failed: ${err.message}`);
    });
  }, intervalMs);

  // Run one cleanup shortly after boot.
  setTimeout(() => {
    cleanupOldReports().catch((err) => {
      console.error(`Initial report cleanup failed: ${err.message}`);
    });
  }, 5000);

  console.log("Report maintenance initialized");
}

module.exports = {
  cleanupOldReports,
  initReportMaintenance,
};
