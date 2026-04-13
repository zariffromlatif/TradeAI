const express = require("express");
const PDFDocument = require("pdfkit");
const { getDashboardAggregates } = require("../services/dashboardStats");

const router = express.Router();

function fmtMoney(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return `$${(n / 1e6).toFixed(2)}M`;
}

// GET /api/reports/trade-summary — PDF snapshot (same figures as dashboard API)
router.get("/trade-summary", async (req, res) => {
  try {
    const { topExporters, topImporters } = await getDashboardAggregates();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="tradeai-trade-summary.pdf"',
    );

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text("TradeAI — Trade summary", { underline: true });
    doc.moveDown();
    doc
      .fontSize(10)
      .fillColor("#666666")
      .text(`Generated: ${new Date().toISOString()}`, { align: "left" });
    doc
      .fontSize(9)
      .text(
        "Illustrative snapshot only — not financial, legal, or compliance advice.",
        { align: "left" },
      );
    doc.moveDown(1.5);
    doc.fillColor("#000000").fontSize(14).text("Top 5 exporters", {
      underline: true,
    });
    doc.moveDown(0.5);
    doc.fontSize(11);
    if (!topExporters.length) {
      doc.text("No export data.");
    } else {
      topExporters.forEach((row, i) => {
        doc.text(
          `${i + 1}. ${row.country} — ${fmtMoney(row.totalExportValue)}`,
        );
      });
    }
    doc.moveDown(1.2);
    doc.fontSize(14).text("Top 5 importers", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    if (!topImporters.length) {
      doc.text("No import data.");
    } else {
      topImporters.forEach((row, i) => {
        doc.text(
          `${i + 1}. ${row.country} — ${fmtMoney(row.totalImportValue)}`,
        );
      });
    }

    doc.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ message: err.message });
    }
  }
});

module.exports = router;
