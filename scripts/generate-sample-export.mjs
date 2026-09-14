// ---------------------------------------------------------------------------
// Generates a faithful, shareable Spectora "Export HTML Text" spreadsheet.
//
// WHY THIS EXISTS: The brief says to export a template from Spectora
// (Export to spreadsheet -> Export HTML Text) and commit it. This script
// produces a stand-in that matches Spectora's documented HTML-text spreadsheet
// layout (Section / Item / Comment Name / Comment Text[HTML] / Comment Type /
// Category / ... columns), populated with InterNACHI-style residential content
// that contains no real customer information.
//
// Replace the committed file with your real Spectora export at any time - the
// importer resolves columns by header name, so it works with both.
//
// Column layout source: Spectora Info Center, "How to Import a Template from a
// Spreadsheet" (support.spectora.com/en/articles/6198400).
// ---------------------------------------------------------------------------

import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";
import path from "node:path";

const HEADERS = [
  "Section Name",
  "Item Name",
  "Comment Name",
  "Comment Text",
  "Comment Type",
  "Category",
  "Multiple Choice Options",
  "Unit Type Options",
  "Recommendation",
  "Order (w/i item)",
  "Answer Type",
  "Default Value",
  "Default Value 2",
  "Default Unit Type",
  "Default Location",
  "Default Estimate Min/Max",
  "Locked",
  "Simple Format",
  "Disable Photos",
  "Uses",
];

// Each row: [section, item, commentName, commentHtml, type, category, options,
//            unitType, recommendation, order]
// (remaining columns left blank, like a typical export)
const ROWS = [
  // ---- ROOF -------------------------------------------------------------
  ["Roof", "Coverings", "Asphalt Shingles - Serviceable",
    "<p>The roof covering is <strong>3-tab asphalt shingles</strong>. At the time of inspection the covering was in <em>serviceable condition</em> with normal wear consistent with its age.</p>",
    "Info", "0", "", "", "", "1"],
  ["Roof", "Coverings", "Shingles - Damaged / Missing",
    "<p>One or more shingles were observed to be <strong>damaged, curled, or missing</strong>. This can allow water intrusion.</p><ul><li>Have a qualified roofing contractor evaluate and repair.</li><li>See maintenance guidance: <a href=\"https://www.nachi.org/roofing.htm\">InterNACHI roofing resources</a>.</li></ul>",
    "Defect", "1", "", "", "Recommend evaluation and repair by a licensed roofing contractor.", "2"],
  ["Roof", "Flashing", "Flashing - Deteriorated Sealant",
    "<p>Sealant at roof flashing/penetrations was <u>deteriorated</u>. Reseal to prevent moisture entry.</p>",
    "Defect", "0", "", "", "Reseal flashing penetrations as part of routine maintenance.", "1"],
  ["Roof", "Gutters & Downspouts", "Gutters - Debris",
    "<p>Gutters contained <strong>debris</strong> and should be cleaned to maintain proper drainage.</p>",
    "Limitation", "-1", "Cleaned,Needs cleaning,Not accessible", "", "", "1"],

  // ---- EXTERIOR ---------------------------------------------------------
  ["Exterior", "Siding, Flashing & Trim", "Siding - Vinyl Serviceable",
    "<p>Exterior wall covering is <strong>vinyl siding</strong>, generally in serviceable condition.</p>",
    "Info", "0", "", "", "", "1"],
  ["Exterior", "Siding, Flashing & Trim", "Siding - Cracked Panels",
    "<p>Cracked siding panels were noted on the <em>south elevation</em>. Recommend repair/replacement of affected panels.</p><p>Reference photo of typical damage:</p><p><img src=\"https://inspection-samples.hiveinspect.dev/siding-crack.jpg\" alt=\"Cracked vinyl siding panel\" width=\"320\" /></p>",
    "Defect", "0", "", "", "Repair or replace cracked panels.", "2"],
  ["Exterior", "Walkways & Driveway", "Driveway - Cracking",
    "<p>The concrete driveway exhibits <strong>settlement cracking</strong>. Monitor and seal cracks to limit water intrusion and freeze-thaw damage.</p>",
    "Defect", "-1", "", "", "Seal cracks; monitor for further movement.", "1"],
  ["Exterior", "Vegetation & Grading", "Grading - Negative Slope",
    "<p>Grading slopes <strong>toward the foundation</strong> in areas. Improve grading to direct water away from the structure.</p>",
    "Defect", "1", "", "", "Regrade to achieve positive drainage away from the foundation (min. 6\" over 10 ft).", "1"],

  // ---- ELECTRICAL -------------------------------------------------------
  ["Electrical", "Service & Panel", "Panel - Manufacturer / Rating",
    "<p>Main service panel manufacturer and rating recorded below. Overcurrent protection appeared appropriate for conductor sizes observed.</p>",
    "Info", "0", "", "Amps", "", "1"],
  ["Electrical", "Service & Panel", "Panel - Double-Tapped Breaker",
    "<p>A <strong>double-tapped breaker</strong> was observed (two conductors under one lug not rated for it). This is a potential fire hazard.</p>",
    "Defect", "1", "", "", "Correction by a licensed electrician is recommended.", "2"],
  ["Electrical", "Devices & Fixtures", "GFCI - Missing at Wet Locations",
    "<p><strong>GFCI protection</strong> was not present at one or more required wet locations (kitchen, bath, exterior). Modern safety standards recommend GFCI protection here.</p><p>Video overview of GFCI testing:</p><iframe src=\"https://www.youtube.com/embed/dQw4w9WgXcQ\" width=\"560\" height=\"315\"></iframe>",
    "Defect", "1", "", "", "Install GFCI protection at all required locations.", "1"],

  // ---- PLUMBING ---------------------------------------------------------
  ["Plumbing", "Water Heater", "Water Heater - TPR Discharge",
    "<p>The temperature/pressure relief (TPR) discharge pipe was <strong>improperly terminated</strong>. It should terminate 6\" above the floor and be full-diameter.</p>",
    "Defect", "0", "", "", "Correct TPR discharge routing per manufacturer/plumbing code.", "1"],
  ["Plumbing", "Fixtures", "Faucet - Drip",
    "<p>A faucet was observed <em>dripping</em>. Replace washer/cartridge as needed.</p>",
    "Limitation", "-1", "Present,Not present", "", "", "1"],

  // ---- INTERIOR ---------------------------------------------------------
  ["Interior", "Walls, Ceilings & Floors", "Ceiling - Prior Repair",
    "<p>Evidence of a <strong>prior ceiling repair/stain</strong> was noted. No active moisture detected at inspection. Monitor.</p>",
    "Info", "0", "", "", "", "1"],
  ["Interior", "Doors & Windows", "Window - Failed Seal",
    "<p>A window showed signs of a <strong>failed thermal seal</strong> (fogging between panes). Consider glass unit replacement.</p>",
    "Defect", "-1", "", "", "Replace insulated glass unit.", "1"],
];

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hive Template Importer sample generator";
  const ws = wb.addWorksheet("Template");

  ws.addRow(HEADERS);
  ws.getRow(1).font = { bold: true };

  for (const r of ROWS) {
    const full = [...r];
    while (full.length < HEADERS.length) full.push("");
    ws.addRow(full);
  }

  // Reasonable column widths.
  ws.columns.forEach((col, i) => {
    col.width = i === 3 ? 70 : i < 3 ? 26 : 16;
  });

  const outDir = path.join(process.cwd(), "sample-exports");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "InterNACHI-Residential-Spectora-HTML-export.xlsx");
  await wb.xlsx.writeFile(outPath);
  console.log("Wrote", outPath, `(${ROWS.length} comment rows across sections)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
