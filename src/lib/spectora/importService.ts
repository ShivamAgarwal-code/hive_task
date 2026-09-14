import { newId } from "../id";
import { parseGrid } from "./parser";
import { readSpreadsheet, ImportReadError } from "./read";
import type { ParseResult } from "./importTypes";

// ---------------------------------------------------------------------------
// Orchestrates: uploaded file -> grid -> structured ParseResult (not yet saved).
// The route/action layer calls this, shows the result for review, and only then
// commits via the storage layer.
// ---------------------------------------------------------------------------

export interface ParseUploadInput {
  buffer: Buffer;
  filename: string;
  templateName: string;
  source?: string | null;
}

export async function parseUpload(input: ParseUploadInput): Promise<ParseResult> {
  let grid: string[][];
  try {
    const read = await readSpreadsheet(input.buffer, input.filename);
    grid = read.grid;
  } catch (err) {
    const message =
      err instanceof ImportReadError
        ? err.message
        : "Could not read this file. Make sure it is a Spectora spreadsheet export (.xlsx or .csv).";
    // Return a well-formed failed ParseResult rather than throwing, so the UI
    // can present the failure clearly (honest failure handling).
    const now = new Date().toISOString();
    return {
      ok: false,
      template: {
        id: newId(),
        name: input.templateName,
        source: input.source ?? null,
        copiedFromId: null,
        createdAt: now,
        updatedAt: now,
        sections: [],
      },
      stats: { totalRows: 0, dataRows: 0, sections: 0, items: 0, comments: 0, skippedRows: 0 },
      issues: [{ level: "error", code: "read-failed", message }],
      skipped: [],
      richContent: [],
      headerInfo: "File could not be read.",
      sampleRows: [],
    };
  }

  return parseGrid(grid, {
    templateName: input.templateName,
    source: input.source ?? null,
    idFactory: newId,
  });
}
