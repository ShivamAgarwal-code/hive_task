import { parse as parseHtml, HTMLElement } from "node-html-parser";
import type { RichContentStat } from "./importTypes";

// ---------------------------------------------------------------------------
// Rich-content analysis.
//
// We classify what lives inside comment HTML so the import preview can tell the
// inspector, honestly, what happens to each kind of content:
//
//   preserved   -> stored and rendered as-is (sanitized) in this app
//   degraded    -> kept in the stored HTML, but may not render identically
//   unsupported -> we cannot faithfully reproduce it; kept as raw HTML so it is
//                  never silently dropped, but flagged loudly
//
// This is the distinction the brief asks for: information *missing from the
// export* vs. content our importer *does not fully support*.
// ---------------------------------------------------------------------------

interface Rule {
  kind: string;
  selectorTags: string[];
  support: RichContentStat["support"];
  note: string;
}

const RULES: Rule[] = [
  { kind: "link", selectorTags: ["a"], support: "preserved", note: "Hyperlinks are kept and clickable." },
  { kind: "bold", selectorTags: ["b", "strong"], support: "preserved", note: "Bold text is kept." },
  { kind: "italic", selectorTags: ["i", "em"], support: "preserved", note: "Italic text is kept." },
  { kind: "underline", selectorTags: ["u"], support: "preserved", note: "Underline is kept." },
  { kind: "list", selectorTags: ["ul", "ol", "li"], support: "preserved", note: "Bulleted / numbered lists are kept." },
  { kind: "paragraph/heading", selectorTags: ["p", "h1", "h2", "h3", "h4", "br"], support: "preserved", note: "Paragraphs and line breaks are kept." },
  { kind: "table", selectorTags: ["table", "tr", "td", "th"], support: "degraded", note: "Tables are preserved in HTML and rendered, but complex layouts may look different." },
  { kind: "image", selectorTags: ["img"], support: "degraded", note: "Image tags are kept; images hosted on Spectora's CDN may require the original URLs to remain reachable." },
  { kind: "video/embed", selectorTags: ["iframe", "video", "embed", "object"], support: "unsupported", note: "Embedded video/iframes are NOT rendered for security; the source markup is preserved so nothing is lost, and shown as a flagged block." },
  { kind: "script", selectorTags: ["script"], support: "unsupported", note: "Scripts are stripped at render time for safety; original markup preserved in stored data." },
];

const TAG_TO_RULE = new Map<string, Rule>();
for (const rule of RULES) {
  for (const tag of rule.selectorTags) TAG_TO_RULE.set(tag, rule);
}

export interface AnalyzedHtml {
  /** Whether the field contained any markup at all. */
  hasHtml: boolean;
  tagCounts: Record<string, number>;
}

export function analyzeCommentHtml(html: string): AnalyzedHtml {
  const tagCounts: Record<string, number> = {};
  if (!html || !/[<][a-zA-Z]/.test(html)) {
    return { hasHtml: false, tagCounts };
  }
  let root: HTMLElement;
  try {
    root = parseHtml(html, { comment: false });
  } catch {
    return { hasHtml: true, tagCounts };
  }
  const walk = (el: HTMLElement) => {
    for (const child of el.childNodes) {
      if (child instanceof HTMLElement) {
        const tag = child.rawTagName?.toLowerCase();
        if (tag) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
        walk(child);
      }
    }
  };
  walk(root);
  return { hasHtml: true, tagCounts };
}

/**
 * Aggregate per-comment tag counts into a template-wide rich-content report.
 */
export function summarizeRichContent(allTagCounts: Record<string, number>[]): RichContentStat[] {
  const perKind = new Map<string, RichContentStat>();
  for (const counts of allTagCounts) {
    for (const [tag, n] of Object.entries(counts)) {
      const rule = TAG_TO_RULE.get(tag);
      if (!rule) continue;
      const existing = perKind.get(rule.kind);
      if (existing) {
        existing.count += n;
      } else {
        perKind.set(rule.kind, { kind: rule.kind, count: n, support: rule.support, note: rule.note });
      }
    }
  }
  // Stable, meaningful ordering: unsupported first (most important to see).
  const order = { unsupported: 0, degraded: 1, preserved: 2 } as const;
  return [...perKind.values()].sort(
    (a, b) => order[a.support] - order[b.support] || b.count - a.count,
  );
}
