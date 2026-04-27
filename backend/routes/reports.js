const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");
const { requireAuth, attachUser, requireMinTier } = require("../middleware/auth");
const ReportJob = require("../models/ReportJob");
const Country = require("../models/Country");
const { enqueueReportJob, cancelQueueJob, reportQueue } = require("../queues/reportQueue");
const { normalizeSections, buildReportData, buildPdfBuffer } = require("../services/reportBuilder");

const router = express.Router();

async function generateReportInline(reportJob) {
  const reportData = await buildReportData({
    sections: reportJob.sections,
    countryCode: reportJob.countryCode,
    commodityId: reportJob.commodityId,
    dateFrom: reportJob.dateFrom,
    dateTo: reportJob.dateTo,
  });
  const pdfBuffer = await buildPdfBuffer(reportJob.title || "TradeAI Intelligence Report", reportData);
  const reportsDir = path.resolve(process.cwd(), "data", "reports");
  await fs.mkdir(reportsDir, { recursive: true });
  const fileName = `tradeai-report-${reportJob._id}.pdf`;
  const filePath = path.join(reportsDir, fileName);
  await fs.writeFile(filePath, pdfBuffer);

  reportJob.snapshot = reportData;
  reportJob.status = "ready";
  reportJob.generatedAt = new Date();
  reportJob.reportFilePath = filePath;
  reportJob.reportFileName = fileName;
  reportJob.reportMimeType = "application/pdf";
  reportJob.reportFileSize = pdfBuffer.length;
  reportJob.errorMessage = "";
  await reportJob.save();
}

// GET /api/reports/trade-summary — PDF snapshot (Gold+; Silver uses dashboard JSON only)
router.get("/trade-summary", requireAuth, requireMinTier("gold"), async (req, res) => {
  try {
    const reportData = await buildReportData({ sections: ["analytics"] });
    const pdfBuffer = await buildPdfBuffer("TradeAI — Trade summary", reportData);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="tradeai-trade-summary.pdf"',
    );
    res.send(pdfBuffer);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ message: err.message });
    }
  }
});

// POST /api/reports/generate
// Creates report job metadata and enqueues async generation.
router.post("/generate", requireAuth, attachUser, async (req, res) => {
  try {
    const sections = normalizeSections(req.body.sections);
    const countryCode = req.body.countryCode
      ? String(req.body.countryCode).toUpperCase()
      : null;
    const commodityId = req.body.commodityId || null;
    const title = String(req.body.title || "TradeAI Intelligence Report").trim();
    const scope = req.user.role === "admin" && req.body.scope === "admin_all" ? "admin_all" : "self";

    if (countryCode) {
      const exists = await Country.findOne({ code: countryCode }).select("_id").lean();
      if (!exists) return res.status(404).json({ message: "Country not found for report." });
    }

    const job = await ReportJob.create({
      ownerId: req.user._id,
      scope,
      title,
      countryCode,
      commodityId,
      sections,
      status: "pending",
      dateFrom: req.body.dateFrom || null,
      dateTo: req.body.dateTo || null,
    });

    let queueState = "enqueued";
    try {
      const queueJob = await enqueueReportJob(job._id);
      job.queueJobId = String(queueJob.id);
      await job.save();
    } catch (queueErr) {
      // Fallback mode: if Redis/queue is unavailable, generate immediately.
      await generateReportInline(job);
      queueState = "inline_fallback";
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Report queue unavailable; generated inline: ${queueErr.message}`);
      }
    }

    res.status(201).json({
      ...job.toObject(),
      queueState,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/reports/:id/status
router.get("/:id/status", requireAuth, attachUser, async (req, res) => {
  try {
    const job = await ReportJob.findById(req.params.id).select(
      "_id ownerId status queueJobId generatedAt errorMessage createdAt updatedAt reportFileName reportFileSize",
    );
    if (!job) return res.status(404).json({ message: "Report job not found" });
    if (req.user.role !== "admin" && String(job.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not allowed to access this report job" });
    }
    return res.json(job);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/reports/history
router.get("/history", requireAuth, attachUser, async (req, res) => {
  try {
    const filter = req.user.role === "admin" && req.query.scope === "all"
      ? {}
      : { ownerId: req.user._id };
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.countryCode) filter.countryCode = String(req.query.countryCode).toUpperCase();
    if (req.user.role === "admin" && req.query.ownerId) {
      filter.ownerId = String(req.query.ownerId);
    }
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }
    const rows = await ReportJob.find(filter)
      .populate("ownerId", "name email role tier")
      .populate("commodityId", "name")
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reports/metrics
router.get("/metrics", requireAuth, attachUser, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin role required" });
    }

    const [pendingCount, readyCount, failedCount, cancelledCount, filesAgg] = await Promise.all([
      ReportJob.countDocuments({ status: "pending" }),
      ReportJob.countDocuments({ status: "ready" }),
      ReportJob.countDocuments({ status: "failed" }),
      ReportJob.countDocuments({ status: "cancelled" }),
      ReportJob.aggregate([
        { $match: { reportFileSize: { $ne: null } } },
        { $group: { _id: null, totalBytes: { $sum: "$reportFileSize" }, fileCount: { $sum: 1 } } },
      ]),
    ]);

    let waitingJobs = 0;
    let activeJobs = 0;
    let delayedJobs = 0;
    let failedJobs = 0;
    let queueAvailable = true;
    try {
      [waitingJobs, activeJobs, delayedJobs, failedJobs] = await Promise.all([
        reportQueue.getWaitingCount(),
        reportQueue.getActiveCount(),
        reportQueue.getDelayedCount(),
        reportQueue.getFailedCount(),
      ]);
    } catch {
      queueAvailable = false;
    }

    return res.json({
      jobs: {
        pending: pendingCount,
        ready: readyCount,
        failed: failedCount,
        cancelled: cancelledCount,
      },
      queue: {
        waiting: waitingJobs,
        active: activeJobs,
        delayed: delayedJobs,
        failed: failedJobs,
        available: queueAvailable,
      },
      storage: {
        files: filesAgg[0]?.fileCount || 0,
        totalBytes: filesAgg[0]?.totalBytes || 0,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/reports/:id/retry
router.post("/:id/retry", requireAuth, attachUser, async (req, res) => {
  try {
    const job = await ReportJob.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Report job not found" });
    if (req.user.role !== "admin" && String(job.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not allowed to retry this report job" });
    }
    if (!["failed", "cancelled"].includes(job.status)) {
      return res.status(409).json({ message: "Only failed/cancelled jobs can be retried" });
    }
    job.status = "pending";
    job.errorMessage = "";
    job.snapshot = null;
    job.generatedAt = null;
    await job.save();

    try {
      const queueJob = await enqueueReportJob(job._id);
      job.queueJobId = String(queueJob.id);
      await job.save();
    } catch {
      await generateReportInline(job);
    }
    return res.json(job);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/reports/:id/cancel
router.post("/:id/cancel", requireAuth, attachUser, async (req, res) => {
  try {
    const job = await ReportJob.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Report job not found" });
    if (req.user.role !== "admin" && String(job.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not allowed to cancel this report job" });
    }
    if (job.status !== "pending") {
      return res.status(409).json({ message: "Only pending jobs can be cancelled" });
    }
    try {
      await cancelQueueJob(job.queueJobId);
    } catch {
      // Queue may be unavailable; still allow metadata cancellation.
    }
    job.status = "cancelled";
    job.errorMessage = "Cancelled by user";
    await job.save();
    return res.json(job);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/reports/:id/download
router.get("/:id/download", requireAuth, attachUser, async (req, res) => {
  try {
    const job = await ReportJob.findById(req.params.id).populate("commodityId", "name");
    if (!job) return res.status(404).json({ message: "Report job not found" });
    if (req.user.role !== "admin" && String(job.ownerId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not allowed to download this report" });
    }
    if (job.status !== "ready") {
      return res.status(409).json({ message: `Report status is ${job.status}` });
    }

    const reportData =
      job.snapshot ||
      (await buildReportData({
        sections: job.sections,
        countryCode: job.countryCode,
        commodityId: job.commodityId?._id || null,
        dateFrom: job.dateFrom,
        dateTo: job.dateTo,
      }));
    const filename = `tradeai-report-${job._id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${job.reportFileName || filename}"`,
    );
    let pdfBuffer = null;
    if (job.reportFilePath) {
      try {
        pdfBuffer = await fs.readFile(job.reportFilePath);
      } catch {
        pdfBuffer = null;
      }
    }
    if (!pdfBuffer) {
      pdfBuffer = await buildPdfBuffer(job.title || "TradeAI Intelligence Report", reportData);
    }
    res.send(pdfBuffer);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
});

module.exports = router;
