"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { Comment, Item, Section, Template } from "@/lib/types";
import type { CommentType, Severity } from "@/lib/types";
import { RichTextEditor } from "./RichTextEditor";
import {
  addCommentAction,
  addItemAction,
  addSectionAction,
  copyTemplateAction,
  deleteCommentAction,
  deleteItemAction,
  deleteSectionAction,
  renameItemAction,
  renameSectionAction,
  updateCommentAction,
  updateTemplateAction,
} from "@/app/actions";

const COMMENT_TYPES: CommentType[] = ["info", "limitation", "defect", "unknown"];
const SEVERITIES: Severity[] = ["none", "low", "medium", "high"];

export function TemplateEditor({ initial }: { initial: Template }) {
  const router = useRouter();
  const [template, setTemplate] = useState<Template>(initial);
  const [saving, setSaving] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback(async (fn: () => Promise<unknown>) => {
    setSaving((n) => n + 1);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That change did not save.");
    } finally {
      setSaving((n) => n - 1);
    }
  }, []);

  // --- local tree mutators -------------------------------------------------
  const patchSection = (sid: string, patch: Partial<Section>) =>
    setTemplate((t) => ({
      ...t,
      sections: t.sections.map((s) => (s.id === sid ? { ...s, ...patch } : s)),
    }));
  const patchItem = (sid: string, iid: string, patch: Partial<Item>) =>
    setTemplate((t) => ({
      ...t,
      sections: t.sections.map((s) =>
        s.id === sid
          ? { ...s, items: s.items.map((i) => (i.id === iid ? { ...i, ...patch } : i)) }
          : s,
      ),
    }));

  // --- template meta -------------------------------------------------------
  const saveMeta = (patch: { name?: string; source?: string | null }) =>
    persist(() => updateTemplateAction(template.id, patch));

  // --- add / delete --------------------------------------------------------
  const addSection = () =>
    persist(async () => {
      const s = await addSectionAction(template.id, "New section");
      setTemplate((t) => ({ ...t, sections: [...t.sections, s] }));
    });
  const deleteSection = (sid: string) =>
    persist(async () => {
      await deleteSectionAction(template.id, sid);
      setTemplate((t) => ({ ...t, sections: t.sections.filter((s) => s.id !== sid) }));
    });
  const addItem = (sid: string) =>
    persist(async () => {
      const i = await addItemAction(template.id, sid, "New item");
      setTemplate((t) => ({
        ...t,
        sections: t.sections.map((s) => (s.id === sid ? { ...s, items: [...s.items, i] } : s)),
      }));
    });
  const deleteItem = (sid: string, iid: string) =>
    persist(async () => {
      await deleteItemAction(template.id, iid);
      setTemplate((t) => ({
        ...t,
        sections: t.sections.map((s) =>
          s.id === sid ? { ...s, items: s.items.filter((i) => i.id !== iid) } : s,
        ),
      }));
    });
  const addComment = (sid: string, iid: string) =>
    persist(async () => {
      const c = await addCommentAction(template.id, iid, "New comment");
      setTemplate((t) => ({
        ...t,
        sections: t.sections.map((s) =>
          s.id === sid
            ? {
                ...s,
                items: s.items.map((i) =>
                  i.id === iid ? { ...i, comments: [...i.comments, c] } : i,
                ),
              }
            : s,
        ),
      }));
    });
  const deleteComment = (sid: string, iid: string, cid: string) =>
    persist(async () => {
      await deleteCommentAction(template.id, cid);
      setTemplate((t) => ({
        ...t,
        sections: t.sections.map((s) =>
          s.id === sid
            ? {
                ...s,
                items: s.items.map((i) =>
                  i.id === iid ? { ...i, comments: i.comments.filter((c) => c.id !== cid) } : i,
                ),
              }
            : s,
        ),
      }));
    });

  const saveComment = (sid: string, iid: string, c: Comment) =>
    persist(() =>
      updateCommentAction(template.id, c.id, {
        name: c.name,
        bodyHtml: c.bodyHtml,
        type: c.type,
        severity: c.severity,
        recommendation: c.recommendation,
      }),
    );

  const duplicate = () => {
    const name = window.prompt("What should we call the copy?", `${template.name} (copy)`);
    if (!name) return;
    persist(async () => {
      const res = await copyTemplateAction(template.id, name);
      router.push(`/templates/${res.id}`);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href="/" className="text-sm text-stone-500 transition-colors hover:text-stone-700">
            &larr; All templates
          </Link>
          <input
            value={template.name}
            onChange={(e) => setTemplate((t) => ({ ...t, name: e.target.value }))}
            onBlur={(e) => saveMeta({ name: e.target.value })}
            className="mt-1 block w-full rounded-md border border-transparent px-1 text-3xl font-semibold tracking-tight hover:border-cream-300 focus:border-brand-300 focus:outline-none"
          />
          <input
            value={template.source ?? ""}
            placeholder="Where it came from (e.g. Spectora export, InterNACHI Residential)"
            onChange={(e) => setTemplate((t) => ({ ...t, source: e.target.value }))}
            onBlur={(e) => saveMeta({ source: e.target.value || null })}
            className="mt-1 block w-full rounded-md border border-transparent px-1 text-sm text-stone-500 hover:border-cream-300 focus:border-brand-300 focus:outline-none"
          />
          {template.copiedFromId && (
            <p className="mt-1 px-1 text-xs text-stone-400">This is a copy of another template.</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-400">
            {saving > 0 ? "Saving..." : "All changes saved"}
          </span>
          <button
            onClick={duplicate}
            className="rounded-lg border border-stone-300 bg-white px-3.5 py-1.5 text-sm transition-colors hover:bg-stone-50"
          >
            Duplicate
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Sections */}
      <div className="space-y-5">
        {template.sections.map((section) => (
          <div key={section.id} className="overflow-hidden rounded-xl border border-cream-300 bg-cream-50 shadow-card">
            <div className="flex items-center gap-2 border-b border-cream-200 bg-cream-200 px-4 py-2.5">
              <input
                value={section.name}
                onChange={(e) => patchSection(section.id, { name: e.target.value })}
                onBlur={(e) => persist(() => renameSectionAction(template.id, section.id, e.target.value))}
                className="flex-1 rounded border border-transparent bg-transparent px-1 font-medium text-stone-800 hover:border-cream-300 focus:border-brand-300 focus:bg-white focus:outline-none"
                placeholder="Section name"
              />
              <button
                onClick={() => addItem(section.id)}
                className="rounded px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
              >
                + Item
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Delete section "${section.name}" and everything in it?`))
                    deleteSection(section.id);
                }}
                className="rounded px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-50"
              >
                Delete
              </button>
            </div>

            <div className="divide-y divide-cream-200">
              {section.items.map((item) => (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={item.name}
                      onChange={(e) => patchItem(section.id, item.id, { name: e.target.value })}
                      onBlur={(e) => persist(() => renameItemAction(template.id, item.id, e.target.value))}
                      className="flex-1 rounded border border-transparent px-1 text-sm font-medium text-stone-700 hover:border-cream-300 focus:border-brand-300 focus:outline-none"
                      placeholder="Item name"
                    />
                    <button
                      onClick={() => addComment(section.id, item.id)}
                      className="rounded px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
                    >
                      + Comment
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete item "${item.name}"?`)) deleteItem(section.id, item.id);
                      }}
                      className="rounded px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="mt-2 space-y-3">
                    {item.comments.map((comment) => (
                      <CommentCard
                        key={comment.id}
                        comment={comment}
                        onLocalChange={(patch) =>
                          setTemplate((t) => ({
                            ...t,
                            sections: t.sections.map((s) =>
                              s.id === section.id
                                ? {
                                    ...s,
                                    items: s.items.map((i) =>
                                      i.id === item.id
                                        ? {
                                            ...i,
                                            comments: i.comments.map((c) =>
                                              c.id === comment.id ? { ...c, ...patch } : c,
                                            ),
                                          }
                                        : i,
                                    ),
                                  }
                                : s,
                            ),
                          }))
                        }
                        onSave={() => saveComment(section.id, item.id, comment)}
                        onDelete={() => {
                          if (window.confirm("Delete this comment?"))
                            deleteComment(section.id, item.id, comment.id);
                        }}
                      />
                    ))}
                    {item.comments.length === 0 && (
                      <p className="text-xs text-stone-400">No comments in this item yet.</p>
                    )}
                  </div>
                </div>
              ))}
              {section.items.length === 0 && (
                <p className="px-4 py-3 text-xs text-stone-400">No items in this section yet.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addSection}
        className="rounded-xl border border-dashed border-cream-300 px-4 py-2.5 text-sm text-stone-600 transition-colors hover:bg-cream-50"
      >
        + Add section
      </button>
    </div>
  );
}

function CommentCard({
  comment,
  onLocalChange,
  onSave,
  onDelete,
}: {
  comment: Comment;
  onLocalChange: (patch: Partial<Comment>) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const change = (patch: Partial<Comment>) => {
    onLocalChange(patch);
    setDirty(true);
  };
  const extraKeys = Object.keys(comment.extra ?? {});

  return (
    <div className="rounded-lg border border-cream-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={comment.name}
          onChange={(e) => change({ name: e.target.value })}
          placeholder="Comment name"
          className="flex-1 rounded border border-stone-200 px-2 py-1 text-sm font-medium outline-none focus:border-brand-400"
        />
        <select
          value={comment.type}
          onChange={(e) => change({ type: e.target.value as CommentType })}
          className="rounded border border-stone-200 px-2 py-1 text-xs"
        >
          {COMMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={comment.severity}
          onChange={(e) => change({ severity: e.target.value as Severity })}
          className="rounded border border-stone-200 px-2 py-1 text-xs"
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2">
        <RichTextEditor value={comment.bodyHtml} onChange={(html) => change({ bodyHtml: html })} />
      </div>

      <input
        value={comment.recommendation ?? ""}
        onChange={(e) => change({ recommendation: e.target.value || null })}
        placeholder="Recommendation (optional)"
        className="mt-2 w-full rounded border border-stone-200 px-2 py-1 text-sm outline-none focus:border-brand-400"
      />

      {extraKeys.length > 0 && (
        <details className="mt-2 text-xs text-stone-500">
          <summary className="cursor-pointer">Fields we kept from the export ({extraKeys.length})</summary>
          <dl className="mt-1 grid grid-cols-2 gap-x-4">
            {extraKeys.map((k) => (
              <div key={k} className="flex gap-1">
                <dt className="font-medium">{k}:</dt>
                <dd className="truncate">{comment.extra[k]}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => {
            onSave();
            setDirty(false);
          }}
          disabled={!dirty}
          className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
        >
          {dirty ? "Save comment" : "Saved"}
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
