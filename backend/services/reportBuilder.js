const PDFDocument = require("pdfkit");
const { getDashboardAggregates } = require("./dashboardStats");
const RiskScore = require("../models/RiskScore");
const Commodity = require("../models/Commodity");
const FxRate = require("../models/FxRate");

function fmtMoney(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return `$${(n / 1e6).toFixed(2)}M`;
}

function normalizeSections(sections) {
  const allowed = new Set(["analytics", "risk", "forecast", "advisory"]);
  const arr = Array.isArray(sections) ? sections : [];
  const normalized = [...new Set(arr.map((x) => String(x).toLowerCase()).filter((x) => allowed.has(x)))];
  return normalized.length ? normalized : ["analytics", "risk", "forecast", "advisory"];
}

async function buildReportData(config) {
  const sections = normalizeSections(config.sections);
  const data = { sections };

  if (sections.includes("analytics")) {
    const agg = await getDashboardAggregates();
    data.analytics = {
      topExporters: agg.topExporters || [],
      topImporters: agg.topImporters || [],
      countriesTracked: agg.countriesTracked || 0,
      tradeRecordCount: agg.tradeRecordCount || 0,
    };
  }

  if (sections.includes("risk")) {
    if (config.countryCode) {
      const latest = await RiskScore.findOne({ countryCode: config.countryCode.toUpperCase() })
        .sort({ createdAt: -1 })
        .lean();
      data.risk = latest ? [latest] : [];
    } else {
      const latestPerCountry = await RiskScore.aggregate([
        { $sort: { countryCode: 1, createdAt: -1 } },
        {
          $group: {
            _id: "$countryCode",
            countryName: { $first: "$countryName" },
            aggregateRiskScore: { $first: "$aggregateRiskScore" },
            riskCategory: { $first: "$riskCategory" },
            createdAt: { $first: "$createdAt" },
          },
        },
        { $sort: { aggregateRiskScore: -1 } },
        { $limit: 5 },
      ]);
      data.risk = latestPerCountry;
    }
  }

  if (sections.includes("forecast")) {
    let fxSnapshot = null;
    const fxDoc = await FxRate.findOne({ pair: "USD/BDT" }).select("pair currentRate asOf").lean();
    if (fxDoc) fxSnapshot = fxDoc;
    let commoditySnapshot = null;
    if (config.commodityId) {
      const commodity = await Commodity.findById(config.commodityId).select("name currentPrice").lean();
      if (commodity) commoditySnapshot = commodity;
    }
    data.forecast = { fxSnapshot, commoditySnapshot };
  }

  if (sections.includes("advisory")) {
    const advisoryItems = [];
    if (data.risk?.length) {
      const first = data.risk[0];
      const score = Number(first.aggregateRiskScore || 0);
      advisoryItems.push({
        title: "Risk posture",
        detail:
          score >= 70
            ? "Current country risk is elevated; tighten payment/contract safeguards."
            : score >= 50
              ? "Country risk is moderate; maintain active monitoring."
              : "Country risk is in lower band; baseline controls are typically sufficient.",
      });
    }
    if (data.forecast?.fxSnapshot?.currentRate) {
      advisoryItems.push({
        title: "FX watch",
        detail: `Latest FX snapshot ${data.forecast.fxSnapshot.pair}: ${data.forecast.fxSnapshot.currentRate}. Consider staged conversion windows for volatility control.`,
      });
    }
    if (data.forecast?.commoditySnapshot?.currentPrice != null) {
      advisoryItems.push({
        title: "Commodity pricing",
        detail: `${data.forecast.commoditySnapshot.name} current reference price: ${data.forecast.commoditySnapshot.currentPrice}. Cross-check bid margins against recent trend data.`,
      });
    }
    data.advisory = advisoryItems;
  }

  return data;
}

function writeReportPdf(doc, title, reportData) {
  doc.fontSize(20).text(title, { underline: true });
  doc.moveDown();
  doc
    .fontSize(10)
    .fillColor("#666666")
    .text(`Generated: ${new Date().toISOString()}`, { align: "left" });
  doc
    .fontSize(9)
    .text(
      "Educational snapshot only — not financial, legal, or compliance advice.",
      { align: "left" },
    );
  doc.moveDown(1.2);

  if (reportData.sections.includes("analytics")) {
    doc.fillColor("#000000").fontSize(14).text("Analytics summary", { underline: true });
    doc.moveDown(0.4);
    const a = reportData.analytics || {};
    doc.fontSize(11).text(`Countries tracked: ${a.countriesTracked || 0}`);
    doc.text(`Verified trade records: ${a.tradeRecordCount || 0}`);
    doc.moveDown(0.4);
    doc.text("Top exporters:");
    (a.topExporters || []).slice(0, 5).forEach((row, i) => {
      doc.text(`  ${i + 1}. ${row.country} — ${fmtMoney(row.totalExportValue)}`);
    });
    doc.moveDown(0.4);
    doc.text("Top importers:");
    (a.topImporters || []).slice(0, 5).forEach((row, i) => {
      doc.text(`  ${i + 1}. ${row.country} — ${fmtMoney(row.totalImportValue)}`);
    });
    doc.moveDown(1);
  }

  if (reportData.sections.includes("risk")) {
    doc.fontSize(14).text("Risk snapshot", { underline: true });
    doc.moveDown(0.4);
    const rows = reportData.risk || [];
    if (!rows.length) {
      doc.fontSize(11).text("No risk snapshots available.");
    } else {
      rows.forEach((r) => {
        const countryName = r.countryName || r._id || r.countryCode || "Unknown";
        doc.fontSize(11).text(
          `${countryName}: ${Number(r.aggregateRiskScore || 0).toFixed(1)} (${r.riskCategory || "n/a"})`,
        );
      });
    }
    doc.moveDown(1);
  }

  if (reportData.sections.includes("forecast")) {
    doc.fontSize(14).text("Forecast snapshot", { underline: true });
    doc.moveDown(0.4);
    const f = reportData.forecast || {};
    if (f.fxSnapshot) {
      doc.fontSize(11).text(
        `FX: ${f.fxSnapshot.pair} = ${f.fxSnapshot.currentRate || "n/a"} (as of ${f.fxSnapshot.asOf || "n/a"})`,
      );
    } else {
      doc.fontSize(11).text("FX: no snapshot available.");
    }
    if (f.commoditySnapshot) {
      doc.text(`Commodity: ${f.commoditySnapshot.name} current ${f.commoditySnapshot.currentPrice ?? "n/a"}`);
    }
    doc.moveDown(1);
  }

  if (reportData.sections.includes("advisory")) {
    doc.fontSize(14).text("Advisory recommendations", { underline: true });
    doc.moveDown(0.4);
    const tips = reportData.advisory || [];
    if (!tips.length) {
      doc.fontSize(11).text("No advisory recommendations available.");
    } else {
      tips.forEach((tip, i) => {
        doc.fontSize(11).text(`${i + 1}. ${tip.title}: ${tip.detail}`);
      });
    }
    doc.moveDown(1);
  }
}

function buildPdfBuffer(title, reportData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    writeReportPdf(doc, title, reportData);
    doc.end();
  });
}

module.exports = {
  normalizeSections,
  buildReportData,
  writeReportPdf,
  buildPdfBuffer,
};
