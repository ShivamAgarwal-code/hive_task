"use client";

import { useEffect, useRef, useState } from "react";
import { renderCommentHtml } from "@/lib/sanitize";

// ---------------------------------------------------------------------------
// A small WYSIWYG editor for comment bodies, aimed at a non-technical inspector:
// bold / italic / underline / bullet list / link - no HTML knowledge required.
// The initial value is sanitized before it is placed in the editable region;
// on save we hand the raw innerHTML back and it is re-sanitized on render.
//
// Uses document.execCommand which, while deprecated, is still supported across
// browsers and is the pragmatic choice for a lightweight editor. Inspectors who
// want full control can toggle to the raw-HTML view.
// ---------------------------------------------------------------------------

interface Props {
  value: string;
  onChange: (html: string) => void;
}

function ToolbarButton({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault(); // keep selection in the editable region
        onClick();
      }}
      className="rounded px-2 py-1 text-sm text-stone-600 hover:bg-stone-100"
    >
      {label}
    </button>
  );
}

export function RichTextEditor({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"rich" | "html">("rich");

  // Seed the editable region once (and whenever we switch back to rich mode).
  useEffect(() => {
    if (mode === "rich" && ref.current) {
      ref.current.innerHTML = renderCommentHtml(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const exec = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  return (
    <div className="rounded-md border border-stone-300">
      <div className="flex items-center gap-0.5 border-b border-stone-200 bg-stone-50 px-1 py-1">
        {mode === "rich" ? (
          <>
            <ToolbarButton label="B" title="Bold" onClick={() => exec("bold")} />
            <ToolbarButton label="I" title="Italic" onClick={() => exec("italic")} />
            <ToolbarButton label="U" title="Underline" onClick={() => exec("underline")} />
            <ToolbarButton label="• List" title="Bulleted list" onClick={() => exec("insertUnorderedList")} />
            <ToolbarButton
              label="Link"
              title="Insert link"
              onClick={() => {
                const url = window.prompt("Link URL:", "https://");
                if (url) exec("createLink", url);
              }}
            />
            <ToolbarButton label="Clear" title="Remove formatting" onClick={() => exec("removeFormat")} />
          </>
        ) : (
          <span className="px-2 text-xs text-stone-500">Editing raw HTML</span>
        )}
        <button
          type="button"
          onClick={() => setMode((m) => (m === "rich" ? "html" : "rich"))}
          className="ml-auto rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
        >
          {mode === "rich" ? "</> HTML" : "Visual"}
        </button>
      </div>

      {mode === "rich" ? (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
          className="comment-html min-h-[80px] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-500"
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[120px] w-full px-3 py-2 font-mono text-xs outline-none"
        />
      )}
    </div>
  );
}
