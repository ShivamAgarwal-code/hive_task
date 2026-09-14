import ExcelJS from "exceljs";

// ---------------------------------------------------------------------------
// File reading: turn an uploaded spreadsheet into a plain 2D grid of strings.
//
// Kept deliberately separate from parsing so the parser can be unit-tested with
// hand-written grids and so we can support .xlsx, .xls and .csv behind one API.
// ---------------------------------------------------------------------------

export interface ReadResult {
  grid: string[][];
  sheetName: string | null;
  format: "xlsx" | "csv";
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  // Rich text
  if (typeof value === "object") {
    const v = value as unknown as Record<string, unknown>;
    if ("richText" in v && Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[]).map((r) => r.text ?? "").join("");
    }
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v) return v.result === undefined ? "" : String(v.result);
    if ("hyperlink" in v && typeof v.hyperlink === "string") return String(v.hyperlink);
    if ("formula" in v) return "";
  }
  return String(value);
}

async function readXlsx(buffer: Buffer): Promise<ReadResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new ImportReadError("The spreadsheet has no worksheets.");
  const grid: string[][] = [];
  let maxCols = 0;
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    // row.values is 1-based with a leading undefined at index 0.
    const values = row.values as ExcelJS.CellValue[];
    for (let c = 1; c < values.length; c++) {
      cells.push(cellToString(values[c]).replace(/\r\n/g, "\n"));
    }
    maxCols = Math.max(maxCols, cells.length);
    grid.push(cells);
  });
  // Normalize ragged rows.
  for (const r of grid) while (r.length < maxCols) r.push("");
  return { grid, sheetName: ws.name, format: "xlsx" };
}

/** Minimal RFC-4180-ish CSV parser (handles quotes, embedded commas/newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  // flush last field/row if any content
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // normalize width
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  for (const r of rows) while (r.length < maxCols) r.push("");
  return rows;
}

export class ImportReadError extends Error {}

export async function readSpreadsheet(buffer: Buffer, filename: string): Promise<ReadResult> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = buffer.toString("utf8");
    return { grid: parseCsv(text), sheetName: null, format: "csv" };
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm")) {
    return readXlsx(buffer);
  }
  // Content sniffing fallback: xlsx is a zip (starts with "PK").
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return readXlsx(buffer);
  }
  // Otherwise assume CSV/TSV text.
  const text = buffer.toString("utf8");
  return { grid: parseCsv(text), sheetName: null, format: "csv" };
}
