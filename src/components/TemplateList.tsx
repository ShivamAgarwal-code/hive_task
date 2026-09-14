"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TemplateSummary } from "@/lib/types";
import { copyTemplateAction, deleteTemplateAction } from "@/app/actions";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function TemplateList({ templates }: { templates: TemplateSummary[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function handleCopy(t: TemplateSummary) {
    const name = window.prompt("What should we call the copy?", `${t.name} (copy)`);
    if (!name) return;
    setBusyId(t.id);
    startTransition(async () => {
      const res = await copyTemplateAction(t.id, name);
      setBusyId(null);
      router.push(`/templates/${res.id}`);
    });
  }

  function handleDelete(t: TemplateSummary) {
    if (!window.confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    setBusyId(t.id);
    startTransition(async () => {
      await deleteTemplateAction(t.id);
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => (
        <div
          key={t.id}
          className="flex flex-col rounded-xl border border-cream-300 bg-cream-50 p-5 shadow-card transition-shadow hover:shadow-md"
        >
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/templates/${t.id}`}
                className="font-medium text-stone-900 hover:text-brand-700"
              >
                {t.name}
              </Link>
              {t.copiedFromId && (
                <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                  copy
                </span>
              )}
            </div>
            {t.source && <p className="mt-1 line-clamp-2 text-xs text-stone-500">{t.source}</p>}
            <div className="mt-4 flex gap-4 text-xs text-stone-500">
              <span>
                <span className="font-semibold text-stone-700">{t.sectionCount}</span> sections
              </span>
              <span>
                <span className="font-semibold text-stone-700">{t.itemCount}</span> items
              </span>
              <span>
                <span className="font-semibold text-stone-700">{t.commentCount}</span> comments
              </span>
            </div>
            <p className="mt-2 text-[11px] text-stone-400">Updated {timeAgo(t.updatedAt)}</p>
          </div>
          <div className="mt-5 flex items-center gap-2">
            <Link
              href={`/templates/${t.id}`}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-stone-50"
            >
              Open
            </Link>
            <button
              onClick={() => handleCopy(t)}
              disabled={pending && busyId === t.id}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-stone-50 disabled:opacity-50"
            >
              Duplicate
            </button>
            <button
              onClick={() => handleDelete(t)}
              disabled={pending && busyId === t.id}
              className="ml-auto rounded-lg px-2 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
