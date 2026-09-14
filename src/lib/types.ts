// ---------------------------------------------------------------------------
// Domain model
//
// A template is a tree: Template -> Section[] -> Item[] -> Comment[].
// This mirrors Spectora's own "Section > Item > Comment" structure so the
// import mapping is 1:1 and explainable, while remaining a normalized,
// editable schema (NOT one opaque HTML blob).
//
// Rich content (links, bold/italic, images, etc.) lives INSIDE a comment's
// `bodyHtml` field. That HTML is preserved verbatim on import and sanitized
// only at render time. Everything else is plain, structured, editable text.
// ---------------------------------------------------------------------------

export type CommentType = "info" | "limitation" | "defect" | "unknown";

export type Severity = "low" | "medium" | "high" | "none";

export interface Comment {
  id: string;
  name: string;
  /** Original comment HTML from the export, preserved verbatim. */
  bodyHtml: string;
  type: CommentType;
  severity: Severity;
  /** Recommendation text (Spectora "Recommendation" column), if any. */
  recommendation: string | null;
  /** Multiple-choice options, preserved as a list. */
  options: string[];
  /** Ordering within the parent item. */
  position: number;
  /**
   * Fields present in the export that this schema does not model as first-class
   * columns are preserved here rather than dropped, so nothing is lost silently.
   */
  extra: Record<string, string>;
}

export interface Item {
  id: string;
  name: string;
  position: number;
  comments: Comment[];
}

export interface Section {
  id: string;
  name: string;
  position: number;
  items: Item[];
}

export interface Template {
  id: string;
  name: string;
  /** Free-form provenance note: which template, where it came from. */
  source: string | null;
  /** Set when this template was created by copying another. */
  copiedFromId: string | null;
  createdAt: string;
  updatedAt: string;
  sections: Section[];
}

/** Lightweight row for list views (no nested tree). */
export interface TemplateSummary {
  id: string;
  name: string;
  source: string | null;
  copiedFromId: string | null;
  createdAt: string;
  updatedAt: string;
  sectionCount: number;
  itemCount: number;
  commentCount: number;
}
