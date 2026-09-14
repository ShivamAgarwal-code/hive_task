import type { Comment, Item, Section, Template } from "../types";
import { COLUMNS, EXTRA_KEYS, normalizeCommentType, normalizeSeverity } from "./columns";
import type { ImportIssue, ParseResult, SkippedRow } from "./importTypes";
import { analyzeCommentHtml, summarizeRichContent } from "./analyze";

// ---------------------------------------------------------------------------
// The parser: grid (string[][]) -> structured, reviewable ParseResult.
//
// Design goals, in priority order:
//   1. Faithful. Preserve text, hierarchy and ordering exactly as they appear.
//   2. Honest. Never silently drop or rewrite. Anything we cannot place becomes
//      a visible skipped row or issue; anything we do not model first-class is
//      preserved on Comment.extra.
//   3. Robust. Work beyond the one committed sample: resolve columns by header
//      name with a positional fallback, tolerate fill-down, blank rows, ragged
//      widths, missing optional columns and duplicated section/item names.
// ---------------------------------------------------------------------------

export interface ParseOptions {
  templateName: string;
  source?: string | null;
  /** Deterministic id factory (tests inject a counter; prod uses uuid). */
  idFactory?: () => string;
}

function normHeader(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

interface ColumnResolution {
  /** canonical key -> column index */
  map: Record<string, number>;
  /** column index -> header label, for unmapped/extra columns */
  extraColumns: { index: number; label: string }[];
  headerRowIndex: number | null;
  info: string;
}

function resolveColumns(grid: string[][]): ColumnResolution {
  const aliasToKey = new Map<string, string>();
  for (const spec of COLUMNS) for (const a of spec.aliases) aliasToKey.set(a, spec.key);

  // Score the first few rows to find a header row.
  let bestRow = -1;
  let bestScore = 0;
  const scanLimit = Math.min(grid.length, 6);
  for (let r = 0; r < scanLimit; r++) {
    let score = 0;
    for (const cell of grid[r]) if (aliasToKey.has(normHeader(cell))) score++;
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }

  const map: Record<string, number> = {};
  const extraColumns: { index: number; label: string }[] = [];

  if (bestScore >= 2) {
    const header = grid[bestRow];
    for (let c = 0; c < header.length; c++) {
      const key = aliasToKey.get(normHeader(header[c]));
      if (key && !(key in map)) {
        map[key] = c;
      } else if (!key && header[c].trim()) {
        extraColumns.push({ index: c, label: header[c].trim() });
      }
    }
    return {
      map,
      extraColumns,
      headerRowIndex: bestRow,
      info: `Matched header row ${bestRow + 1} by column name (${Object.keys(map).length} known columns${
        extraColumns.length ? `, ${extraColumns.length} extra column(s) preserved` : ""
      }).`,
    };
  }

  // Positional fallback: no recognizable header. Only trust the positional
  // layout when the file is at least as wide as a plausible Spectora export
  // (real exports have ~20 columns). Otherwise we would fabricate a template
  // from an unrelated spreadsheet, so we leave the map empty and let the caller
  // reject it with a clear error.
  const width = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const POSITIONAL_MIN_WIDTH = 6;
  if (width < POSITIONAL_MIN_WIDTH) {
    return {
      map,
      extraColumns: [],
      headerRowIndex: null,
      info: `No Spectora header row was found and the file has only ${width} column(s) - too few to safely assume the Spectora layout.`,
    };
  }
  for (const spec of COLUMNS) {
    if (spec.index < width) map[spec.key] = spec.index;
  }
  return {
    map,
    extraColumns: [],
    headerRowIndex: null,
    info: `No header row recognized - fell back to Spectora's positional layout (column A = Section, B = Item, C = Comment Name, D = Comment Text, ...). Review the preview carefully.`,
  };
}

const isBlank = (s: string | undefined) => !s || s.trim() === "";

export function parseGrid(grid: string[][], opts: ParseOptions): ParseResult {
  const idFactory = opts.idFactory ?? (() => cryptoRandom());
  const issues: ImportIssue[] = [];
  const skipped: SkippedRow[] = [];

  const resolution = resolveColumns(grid);
  const { map } = resolution;
  const get = (row: string[], key: string): string => {
    const idx = map[key];
    if (idx === undefined || idx >= row.length) return "";
    return row[idx] ?? "";
  };

  const dataStart = resolution.headerRowIndex === null ? 0 : resolution.headerRowIndex + 1;

  if (map.section === undefined && map.item === undefined) {
    issues.push({
      level: "error",
      code: "no-structure-columns",
      message:
        "Could not find Section or Item columns. This does not look like a Spectora spreadsheet export.",
    });
  } else if (resolution.headerRowIndex === null) {
    issues.push({
      level: "warning",
      code: "guessed-layout",
      message:
        "No column headers were recognized, so the Spectora positional layout was assumed. Check the preview below to confirm sections, items and comments landed in the right place.",
    });
  }

  // Ordered containers, keyed by name so fill-down repeats merge correctly.
  const sections: Section[] = [];
  const sectionByName = new Map<string, Section>();
  const itemByKey = new Map<string, Item>();

  let lastSectionName = "";
  let lastItemName = "";
  let dataRows = 0;
  let commentCount = 0;
  const tagCountsPerComment: Record<string, number>[] = [];
  const sampleRows: Record<string, string>[] = [];

  const rawObject = (row: string[]): Record<string, string> => {
    const obj: Record<string, string> = {};
    for (const spec of COLUMNS) if (map[spec.key] !== undefined) obj[spec.key] = get(row, spec.key);
    for (const ex of resolution.extraColumns) obj[ex.label] = row[ex.index] ?? "";
    return obj;
  };

  for (let r = dataStart; r < grid.length; r++) {
    const row = grid[r];
    const rowNo = r + 1; // 1-based for humans
    const allBlank = row.every(isBlank);
    if (allBlank) continue;

    let sectionName = get(row, "section").trim();
    let itemName = get(row, "item").trim();
    const commentName = get(row, "commentName").trim();
    const commentText = get(row, "commentText"); // keep raw (may contain leading space in HTML)

    // Fill-down: Spectora repeats Section/Item on each comment row, but real
    // exports sometimes leave them blank to mean "same as the row above".
    if (isBlank(sectionName)) sectionName = lastSectionName;
    if (isBlank(itemName)) itemName = lastItemName;

    const hasComment = !isBlank(commentName) || !isBlank(commentText);

    // A comment with no section context we can attach it to -> skip visibly.
    if (hasComment && isBlank(sectionName)) {
      skipped.push({
        row: rowNo,
        reason: "Comment row appears before any section - cannot place it in the hierarchy.",
        raw: rawObject(row),
      });
      continue;
    }

    // A row with neither structure nor a comment (e.g. stray metadata) -> skip.
    if (!hasComment && isBlank(sectionName) && isBlank(itemName)) {
      skipped.push({
        row: rowNo,
        reason: "Row has no Section, Item or Comment content.",
        raw: rawObject(row),
      });
      continue;
    }

    dataRows++;
    if (sampleRows.length < 12) sampleRows.push(rawObject(row));

    lastSectionName = sectionName;
    lastItemName = itemName;

    // Resolve / create section.
    let section = sectionByName.get(sectionName);
    if (!section) {
      section = { id: idFactory(), name: sectionName, position: sections.length, items: [] };
      sections.push(section);
      sectionByName.set(sectionName, section);
    }

    // Resolve / create item. Items with an empty name are allowed (some
    // templates hang comments directly under a section); we use a sentinel.
    const effectiveItemName = isBlank(itemName) ? "" : itemName;
    const itemKey = `${sectionName} ${effectiveItemName}`;
    let item = itemByKey.get(itemKey);
    if (!item) {
      item = { id: idFactory(), name: effectiveItemName, position: section.items.length, comments: [] };
      section.items.push(item);
      itemByKey.set(itemKey, item);
    }

    if (!hasComment) {
      // Structural-only row: it defined a section/item with no comment. Fine.
      continue;
    }

    // Build the comment, preserving HTML verbatim.
    const extra: Record<string, string> = {};
    for (const key of EXTRA_KEYS) {
      const v = get(row, key);
      if (!isBlank(v)) extra[key] = v;
    }
    for (const ex of resolution.extraColumns) {
      const v = row[ex.index];
      if (!isBlank(v)) extra[ex.label] = v;
    }

    const optionsRaw = get(row, "options").trim();
    const recommendation = get(row, "recommendation").trim();

    const comment: Comment = {
      id: idFactory(),
      name: commentName,
      bodyHtml: commentText,
      type: normalizeCommentType(get(row, "commentType")),
      severity: normalizeSeverity(get(row, "category")),
      recommendation: recommendation || null,
      options: optionsRaw ? optionsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
      position: item.comments.length,
      extra,
    };
    item.comments.push(comment);
    commentCount++;

    const analyzed = analyzeCommentHtml(comment.bodyHtml);
    tagCountsPerComment.push(analyzed.tagCounts);

    if (isBlank(commentName) && !isBlank(commentText)) {
      issues.push({
        level: "warning",
        row: rowNo,
        code: "comment-missing-name",
        message: "Comment has text but no name - imported with an empty name; you can rename it in the editor.",
      });
    }
  }

  const itemCount = sections.reduce((n, s) => n + s.items.length, 0);
  const richContent = summarizeRichContent(tagCountsPerComment);

  const now = new Date().toISOString();
  const template: Template = {
    id: idFactory(),
    name: opts.templateName,
    source: opts.source ?? null,
    copiedFromId: null,
    createdAt: now,
    updatedAt: now,
    sections,
  };

  if (commentCount === 0 && sections.length === 0) {
    issues.push({
      level: "error",
      code: "empty-template",
      message: "No sections, items or comments were found in this file.",
    });
  }

  // Informational notes that build trust in the preview.
  if (resolution.extraColumns.length) {
    issues.push({
      level: "info",
      code: "extra-columns-preserved",
      message: `Preserved ${resolution.extraColumns.length} column(s) not modeled first-class (${resolution.extraColumns
        .map((e) => e.label)
        .join(", ")}) on each comment's "extra" data - nothing was dropped.`,
    });
  }

  return {
    ok: !issues.some((i) => i.level === "error"),
    template,
    stats: {
      totalRows: grid.length,
      dataRows,
      sections: sections.length,
      items: itemCount,
      comments: commentCount,
      skippedRows: skipped.length,
    },
    issues,
    skipped,
    richContent,
    headerInfo: resolution.info,
    sampleRows,
  };
}

// Fallback id used only when no idFactory is supplied (non-test runtime).
function cryptoRandom(): string {
  // Avoid importing node:crypto into code paths that might run in the browser.
  // The API routes always pass an explicit idFactory, so this is a safety net.
  return "id-" + Math.abs(hashString(String(counter++))).toString(36);
}
let counter = 1;
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
