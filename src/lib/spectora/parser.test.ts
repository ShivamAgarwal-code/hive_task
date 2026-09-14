import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseGrid } from "./parser";
import { readSpreadsheet } from "./read";

// Deterministic id factory so assertions are stable.
function counterIds() {
  let n = 0;
  return () => `id-${++n}`;
}

const HEADER = [
  "Section Name", "Item Name", "Comment Name", "Comment Text", "Comment Type",
  "Category", "Multiple Choice Options", "Unit Type Options", "Recommendation", "Order (w/i item)",
];

describe("parseGrid - hierarchy, ordering, preservation", () => {
  it("builds Template -> Section -> Item -> Comment and preserves order", () => {
    const grid = [
      HEADER,
      ["Roof", "Coverings", "A", "<p>Alpha</p>", "Info", "0", "", "", "", "1"],
      ["Roof", "Coverings", "B", "<p>Bravo</p>", "Defect", "1", "", "", "Fix it", "2"],
      ["Roof", "Flashing", "C", "<p>Charlie</p>", "Info", "0", "", "", "", "1"],
      ["Exterior", "Siding", "D", "<p>Delta</p>", "Info", "0", "", "", "", "1"],
    ];
    const r = parseGrid(grid, { templateName: "T", idFactory: counterIds() });

    expect(r.ok).toBe(true);
    expect(r.stats.sections).toBe(2);
    expect(r.stats.items).toBe(3);
    expect(r.stats.comments).toBe(4);

    const [roof, exterior] = r.template.sections;
    expect(roof.name).toBe("Roof");
    expect(exterior.name).toBe("Exterior");
    expect(roof.items.map((i) => i.name)).toEqual(["Coverings", "Flashing"]);

    const coverings = roof.items[0];
    expect(coverings.comments.map((c) => c.name)).toEqual(["A", "B"]);
    // HTML preserved verbatim.
    expect(coverings.comments[0].bodyHtml).toBe("<p>Alpha</p>");
    // Type + severity mapped.
    expect(coverings.comments[1].type).toBe("defect");
    expect(coverings.comments[1].severity).toBe("high");
    expect(coverings.comments[1].recommendation).toBe("Fix it");
    // Positions are contiguous within parent.
    expect(coverings.comments.map((c) => c.position)).toEqual([0, 1]);
  });

  it("fills down blank Section/Item cells (repeat semantics)", () => {
    const grid = [
      HEADER,
      ["Roof", "Coverings", "A", "x", "Info", "0", "", "", "", ""],
      ["", "", "B", "y", "Info", "0", "", "", "", ""],
      ["", "Flashing", "C", "z", "Info", "0", "", "", "", ""],
    ];
    const r = parseGrid(grid, { templateName: "T", idFactory: counterIds() });
    expect(r.template.sections).toHaveLength(1);
    const roof = r.template.sections[0];
    expect(roof.items.map((i) => i.name)).toEqual(["Coverings", "Flashing"]);
    expect(roof.items[0].comments.map((c) => c.name)).toEqual(["A", "B"]);
    expect(roof.items[1].comments.map((c) => c.name)).toEqual(["C"]);
  });

  it("resolves columns by header even when reordered", () => {
    const grid = [
      ["Comment Text", "Comment Name", "Item Name", "Section Name"],
      ["<b>Hi</b>", "Greeting", "Doors", "Interior"],
    ];
    const r = parseGrid(grid, { templateName: "T", idFactory: counterIds() });
    expect(r.template.sections[0].name).toBe("Interior");
    expect(r.template.sections[0].items[0].name).toBe("Doors");
    expect(r.template.sections[0].items[0].comments[0].bodyHtml).toBe("<b>Hi</b>");
  });

  it("falls back to positional layout when there is no header", () => {
    const grid = [
      ["Roof", "Coverings", "A", "<p>x</p>", "Info", "0"],
      ["Roof", "Coverings", "B", "<p>y</p>", "Defect", "1"],
    ];
    const r = parseGrid(grid, { templateName: "T", idFactory: counterIds() });
    expect(r.headerInfo).toMatch(/positional/i);
    expect(r.stats.comments).toBe(2);
    expect(r.template.sections[0].items[0].comments[1].severity).toBe("high");
  });

  it("preserves unmodeled columns on comment.extra instead of dropping them", () => {
    const grid = [
      [...HEADER, "Answer Type", "Locked", "WeirdCustomColumn"],
      ["Roof", "Coverings", "A", "x", "Info", "0", "", "", "", "1", "boolean", "true", "keep-me"],
    ];
    const r = parseGrid(grid, { templateName: "T", idFactory: counterIds() });
    const c = r.template.sections[0].items[0].comments[0];
    expect(c.extra.answerType).toBe("boolean");
    expect(c.extra.locked).toBe("true");
    expect(c.extra.WeirdCustomColumn).toBe("keep-me");
    expect(r.issues.some((i) => i.code === "extra-columns-preserved")).toBe(true);
  });

  it("flags a comment that appears before any section as skipped (not dropped)", () => {
    const grid = [
      HEADER,
      ["", "", "Orphan", "<p>no section</p>", "Info", "0", "", "", "", ""],
      ["Roof", "Coverings", "A", "x", "Info", "0", "", "", "", ""],
    ];
    const r = parseGrid(grid, { templateName: "T", idFactory: counterIds() });
    expect(r.stats.skippedRows).toBe(1);
    expect(r.skipped[0].reason).toMatch(/before any section/i);
    // The orphan's content is retained in the skipped report.
    expect(r.skipped[0].raw.commentName).toBe("Orphan");
  });

  it("splits multiple-choice options into a list", () => {
    const grid = [
      HEADER,
      ["Roof", "Gutters", "G", "x", "Limitation", "-1", "Cleaned, Needs cleaning, N/A", "", "", ""],
    ];
    const r = parseGrid(grid, { templateName: "T", idFactory: counterIds() });
    expect(r.template.sections[0].items[0].comments[0].options).toEqual([
      "Cleaned", "Needs cleaning", "N/A",
    ]);
  });
});

describe("end-to-end: parse the committed sample export", () => {
  it("imports the InterNACHI sample xlsx with rich content detected", async () => {
    const p = path.join(
      process.cwd(),
      "sample-exports",
      "InterNACHI-Residential-Spectora-HTML-export.xlsx",
    );
    const buf = readFileSync(p);
    const { grid } = await readSpreadsheet(buf, "InterNACHI-Residential-Spectora-HTML-export.xlsx");
    const r = parseGrid(grid, { templateName: "InterNACHI Residential", idFactory: counterIds() });

    expect(r.ok).toBe(true);
    expect(r.stats.sections).toBeGreaterThanOrEqual(5);
    expect(r.stats.comments).toBe(15);

    // Rich content report picks up links, formatting, an image and an iframe.
    const kinds = new Map(r.richContent.map((x) => [x.kind, x]));
    expect(kinds.get("link")?.support).toBe("preserved");
    expect(kinds.get("image")?.support).toBe("degraded");
    expect(kinds.get("video/embed")?.support).toBe("unsupported");
  });
});
