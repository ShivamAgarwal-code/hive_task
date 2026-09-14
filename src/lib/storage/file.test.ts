import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { FileRepo } from "./file";
import { parseGrid } from "../spectora/parser";
import { newId } from "../id";

// The FileRepo persists to ./.data/db.json. These tests exercise real
// persistence and, crucially, the copy-independence guarantee.

const DB_PATH = path.join(process.cwd(), ".data", "db.json");

async function resetDb() {
  await fs.rm(DB_PATH, { force: true });
}

function sampleTemplate(name: string) {
  const grid = [
    ["Section Name", "Item Name", "Comment Name", "Comment Text", "Comment Type", "Category"],
    ["Roof", "Coverings", "Shingles", "<p>Original text</p>", "Info", "0"],
    ["Roof", "Flashing", "Sealant", "<p>Reseal</p>", "Defect", "1"],
    ["Exterior", "Siding", "Vinyl", "<p>Serviceable</p>", "Info", "0"],
  ];
  return parseGrid(grid, { templateName: name, idFactory: newId }).template;
}

describe("FileRepo persistence + copy independence", () => {
  beforeEach(resetDb);
  afterAll(resetDb);

  it("persists an imported template and reads it back with full hierarchy", async () => {
    const repo = new FileRepo();
    const t = sampleTemplate("Original");
    await repo.insertTemplate(t);

    const fetched = await repo.getTemplate(t.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.sections).toHaveLength(2);
    expect(fetched!.sections[0].items[0].comments[0].bodyHtml).toBe("<p>Original text</p>");

    // Survives a "restart": a brand-new repo instance reads the same file.
    const repo2 = new FileRepo();
    const again = await repo2.getTemplate(t.id);
    expect(again!.name).toBe("Original");
  });

  it("edits are saved", async () => {
    const repo = new FileRepo();
    const t = sampleTemplate("Editable");
    await repo.insertTemplate(t);
    const commentId = t.sections[0].items[0].comments[0].id;

    await repo.updateComment(commentId, { bodyHtml: "<p>EDITED</p>", name: "Renamed" });
    await repo.updateSection(t.sections[0].id, { name: "Roof System" });

    const fetched = await repo.getTemplate(t.id);
    expect(fetched!.sections[0].name).toBe("Roof System");
    const c = fetched!.sections[0].items[0].comments[0];
    expect(c.bodyHtml).toBe("<p>EDITED</p>");
    expect(c.name).toBe("Renamed");
  });

  it("a copy can be edited without affecting the original", async () => {
    const repo = new FileRepo();
    const original = sampleTemplate("Original");
    await repo.insertTemplate(original);

    const copy = await repo.copyTemplate(original.id, "Copy of Original");

    // Copy shares no ids with the original.
    const origIds = collectIds(await repo.getTemplate(original.id));
    const copyIds = collectIds(await repo.getTemplate(copy.id));
    for (const id of copyIds) expect(origIds.has(id)).toBe(false);
    expect(copy.copiedFromId).toBe(original.id);

    // Edit the copy heavily.
    const copyTree = (await repo.getTemplate(copy.id))!;
    await repo.updateComment(copyTree.sections[0].items[0].comments[0].id, {
      bodyHtml: "<p>CHANGED IN COPY</p>",
    });
    await repo.updateSection(copyTree.sections[0].id, { name: "COPY ROOF" });
    await repo.deleteSection(copyTree.sections[1].id);

    // Original is untouched.
    const origAfter = (await repo.getTemplate(original.id))!;
    expect(origAfter.sections).toHaveLength(2);
    expect(origAfter.sections[0].name).toBe("Roof");
    expect(origAfter.sections[0].items[0].comments[0].bodyHtml).toBe("<p>Original text</p>");

    // Copy reflects the edits.
    const copyAfter = (await repo.getTemplate(copy.id))!;
    expect(copyAfter.sections).toHaveLength(1);
    expect(copyAfter.sections[0].name).toBe("COPY ROOF");
    expect(copyAfter.sections[0].items[0].comments[0].bodyHtml).toBe("<p>CHANGED IN COPY</p>");
  });

  it("deleting a template cascades to sections/items/comments", async () => {
    const repo = new FileRepo();
    const t = sampleTemplate("ToDelete");
    await repo.insertTemplate(t);
    await repo.deleteTemplate(t.id);
    expect(await repo.getTemplate(t.id)).toBeNull();
    const list = await repo.listTemplates();
    expect(list.find((x) => x.id === t.id)).toBeUndefined();
  });
});

function collectIds(t: Awaited<ReturnType<FileRepo["getTemplate"]>>): Set<string> {
  const ids = new Set<string>();
  if (!t) return ids;
  ids.add(t.id);
  for (const s of t.sections) {
    ids.add(s.id);
    for (const i of s.items) {
      ids.add(i.id);
      for (const c of i.comments) ids.add(c.id);
    }
  }
  return ids;
}
