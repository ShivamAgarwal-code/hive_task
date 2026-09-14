import type { Template } from "../types";

// ---------------------------------------------------------------------------
// Types describing the OUTPUT of parsing an export, before it is committed.
// The importer never commits blindly: it produces a report the user reviews.
// ---------------------------------------------------------------------------

export type IssueLevel = "info" | "warning" | "error";

export interface ImportIssue {
  level: IssueLevel;
  /** 1-based row number in the source spreadsheet, when applicable. */
  row?: number;
  code: string;
  message: string;
}

/**
 * A single kind of rich content we detected in comment HTML, with whether we
 * support it. This is what powers the "what survives / what is degraded /
 * what is unsupported" section of the preview - the trust improvement.
 */
export interface RichContentStat {
  kind: string; // e.g. "link", "bold", "image", "iframe/video"
  count: number;
  support: "preserved" | "degraded" | "unsupported";
  note: string;
}

export interface SkippedRow {
  row: number;
  reason: string;
  raw: Record<string, string>;
}

export interface ImportStats {
  totalRows: number;
  dataRows: number;
  sections: number;
  items: number;
  comments: number;
  skippedRows: number;
}

export interface ParseResult {
  ok: boolean;
  /** The structured template, ready to persist (id fields are provisional). */
  template: Template;
  stats: ImportStats;
  issues: ImportIssue[];
  skipped: SkippedRow[];
  richContent: RichContentStat[];
  /** Detected header row (or the positional-fallback note). */
  headerInfo: string;
  /** The raw source rows, for the raw-vs-imported side-by-side view. */
  sampleRows: Record<string, string>[];
}
