import sanitizeHtml from "sanitize-html";

// ---------------------------------------------------------------------------
// Comment HTML is stored VERBATIM (faithful import). It is sanitized only at
// render time, so the stored data always keeps the inspector's original markup
// while the browser only ever sees safe HTML.
// ---------------------------------------------------------------------------

const ALLOWED_TAGS = [
  "p", "br", "div", "span",
  "b", "strong", "i", "em", "u", "s", "sub", "sup",
  "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "a", "img",
  "table", "thead", "tbody", "tr", "td", "th",
  "blockquote", "code", "pre", "hr",
];

export function renderCommentHtml(dirty: string): string {
  if (!dirty) return "";
  return sanitizeHtml(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      "*": ["style"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    // Force safe link behavior.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }, true),
    },
    // Keep style but only a safe subset (no url()/expression()).
    allowedStyles: {
      "*": {
        "font-weight": [/^bold$|^\d{3}$/],
        "font-style": [/^italic$|^normal$/],
        "text-decoration": [/^underline$|^line-through$|^none$/],
        "text-align": [/^left$|^right$|^center$|^justify$/],
        color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
      },
    },
  });
}

/**
 * Detect content that we deliberately DO NOT render (video/iframe/script/etc.)
 * so the UI can show a flagged "unsupported markup preserved" block instead of
 * silently swallowing it.
 */
export function extractUnsupportedBlocks(dirty: string): string[] {
  if (!dirty) return [];
  const blocks: string[] = [];
  const re = /<(iframe|video|embed|object|script)[\s\S]*?<\/\1>|<(iframe|video|embed|object|script)[^>]*\/?>/gi;
  const matches = dirty.match(re);
  if (matches) blocks.push(...matches);
  return blocks;
}
