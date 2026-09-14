// ---------------------------------------------------------------------------
// Spectora "Export to spreadsheet -> Export HTML Text" column layout.
//
// Source: Spectora Info Center, "How to Import a Template from a Spreadsheet"
// (support.spectora.com/en/articles/6198400). Each ROW is one comment; the
// Section Name / Item Name cells repeat (or are filled down) across the rows
// that belong to them. The HTML-text export keeps comment formatting in the
// "Comment Text" column as HTML.
//
// We resolve columns by HEADER NAME first (robust to column re-ordering that
// happens in real-world exports) and fall back to POSITIONAL index (A, B, C,
// D...) when a file has no usable header row.
// ---------------------------------------------------------------------------

export interface ColumnSpec {
  /** Canonical field key used internally. */
  key: string;
  /** Header names we accept (lower-cased, trimmed) - several aliases each. */
  aliases: string[];
  /** Positional fallback, 0-based (A=0, B=1, ...). */
  index: number;
}

export const COLUMNS: ColumnSpec[] = [
  { key: "section", aliases: ["section name", "section"], index: 0 },
  { key: "item", aliases: ["item name", "item"], index: 1 },
  { key: "commentName", aliases: ["comment name", "comment title", "name"], index: 2 },
  { key: "commentText", aliases: ["comment text", "comment", "text", "html", "comment html"], index: 3 },
  { key: "commentType", aliases: ["comment type", "type"], index: 4 },
  { key: "category", aliases: ["category", "severity", "rating"], index: 5 },
  { key: "options", aliases: ["multiple choice options", "options", "multiple choice"], index: 6 },
  { key: "unitType", aliases: ["unit type options", "unit type"], index: 7 },
  { key: "recommendation", aliases: ["recommendation", "recommendations"], index: 8 },
  { key: "order", aliases: ["order (w/i item)", "order", "order within item"], index: 9 },
  { key: "answerType", aliases: ["answer type"], index: 10 },
  { key: "defaultValue", aliases: ["default value"], index: 11 },
  { key: "defaultValue2", aliases: ["default value 2"], index: 12 },
  { key: "defaultUnitType", aliases: ["default unit type"], index: 13 },
  { key: "defaultLocation", aliases: ["default location"], index: 14 },
  { key: "defaultEstimate", aliases: ["default estimate min/max", "default estimate"], index: 15 },
  { key: "locked", aliases: ["locked"], index: 16 },
  { key: "simpleFormat", aliases: ["simple format"], index: 17 },
  { key: "disablePhotos", aliases: ["disable photos"], index: 18 },
  { key: "uses", aliases: ["uses"], index: 19 },
];

/**
 * "extra" columns: any recognized-but-not-first-class fields we still want to
 * preserve on the Comment.extra bag rather than drop. Keyed by canonical key.
 */
export const EXTRA_KEYS = [
  "unitType",
  "answerType",
  "defaultValue",
  "defaultValue2",
  "defaultUnitType",
  "defaultLocation",
  "defaultEstimate",
  "locked",
  "simpleFormat",
  "disablePhotos",
  "uses",
];

/** Map a Spectora "Comment Type" cell to our CommentType. */
export function normalizeCommentType(raw: string | undefined): import("../types").CommentType {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "unknown";
  if (v.startsWith("info")) return "info";
  if (v.startsWith("lim")) return "limitation";
  if (v.startsWith("def") || v.startsWith("mm")) return "defect";
  return "unknown";
}

/**
 * Map a Spectora "Category" cell to a severity.
 * Spectora uses -1 = Low, 0 = Med, 1 = High. Some exports use words.
 */
export function normalizeSeverity(raw: string | undefined): import("../types").Severity {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "none";
  if (v === "-1" || v.startsWith("low")) return "low";
  if (v === "0" || v.startsWith("med")) return "medium";
  if (v === "1" || v.startsWith("high")) return "high";
  return "none";
}
