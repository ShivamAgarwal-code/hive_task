"use client";

import { renderCommentHtml, extractUnsupportedBlocks } from "@/lib/sanitize";

/**
 * Renders comment HTML safely. The original markup is never mutated in storage;
 * here it is sanitized for display. Content we deliberately do not render
 * (iframes/video/script) is surfaced as a labeled, escaped block so the
 * inspector can see it exists rather than having it silently vanish.
 */
export function SafeHtml({ html, className }: { html: string; className?: string }) {
  const clean = renderCommentHtml(html);
  const unsupported = extractUnsupportedBlocks(html);
  return (
    <div className={className}>
      <div className="comment-html" dangerouslySetInnerHTML={{ __html: clean }} />
      {unsupported.length > 0 && (
        <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
          <div className="font-medium">
            {unsupported.length} embedded block(s) preserved but not rendered (video / iframe / script):
          </div>
          {unsupported.map((u, i) => (
            <pre key={i} className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-[11px]">
              {u}
            </pre>
          ))}
        </div>
      )}
    </div>
  );
}
