import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseUpload } from "./importService";
import { parseGrid } from "./parser";

describe("parseUpload happy path (read + parse)", () => {
  it("reads and parses the committed sample xlsx into a valid template", async () => {
    const p = path.join(
      process.cwd(),
      "sample-exports",
      "InterNACHI-Residential-Spectora-HTML-export.xlsx",
    );
    const buffer = readFileSync(p);
    const r = await parseUpload({
      buffer,
      filename: "InterNACHI-Residential-Spectora-HTML-export.xlsx",
      templateName: "InterNACHI Residential",
      source: "sample",
    });
    expect(r.ok).toBe(true);
    expect(r.stats.comments).toBe(15);
    expect(r.template.name).toBe("InterNACHI Residential");
    expect(r.template.source).toBe("sample");
  });
});

// Failure handling: the importer must fail HONESTLY - never crash, never
// silently produce an empty/garbage template that looks successful.

describe("honest failure handling", () => {
  it("a non-spreadsheet binary file yields ok:false with a clear error, not a throw", async () => {
    const junk = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
    const r = await parseUpload({ buffer: junk, filename: "notes.bin", templateName: "X" });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.level === "error")).toBe(true);
    expect(r.stats.comments).toBe(0);
  });

  it("a file with no Section/Item columns is rejected with an explanatory error", () => {
    const grid = [
      ["Foo", "Bar", "Baz"],
      ["1", "2", "3"],
    ];
    const r = parseGrid(grid, { templateName: "X", idFactory: () => "id" });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "no-structure-columns")).toBe(true);
  });

  it("an empty file is reported as empty rather than a success", () => {
    const r = parseGrid([[]], { templateName: "X", idFactory: () => "id" });
    expect(r.ok).toBe(false);
    expect(r.stats.comments).toBe(0);
  });

  it("wrapped/garbled HTML in a comment is preserved verbatim, never rewritten", () => {
    const messy = '<p>Unclosed <strong>bold and a <a href="http://x">link</p>';
    const grid = [
      ["Section Name", "Item Name", "Comment Name", "Comment Text"],
      ["Roof", "Cover", "Messy", messy],
    ];
    const r = parseGrid(grid, { templateName: "X", idFactory: () => "id" });
    // Stored exactly as-is; sanitization happens only at render time.
    expect(r.template.sections[0].items[0].comments[0].bodyHtml).toBe(messy);
  });
});
