"use client";

import { useState } from "react";
import type { ParseResult } from "@/lib/spectora/importTypes";
import { SafeHtml } from "./SafeHtml";

// ---------------------------------------------------------------------------
// The trust screen. Before anything is saved, this shows the inspector exactly
// what the importer understood: counts, every note, what happens to each kind
// of rich content, which rows were set aside (and why), and a raw-vs-imported
// comparison. Nothing is committed until they click through this.
// ---------------------------------------------------------------------------

const supportBadge = {
  preserved: "bg-brand-50 text-brand-700 border-brand-200",
  degraded: "bg-amber-50 text-amber-700 border-amber-200",
  unsupported: "bg-red-50 text-red-700 border-red-200",
} as const;

const issueBadge = {
  info: "bg-stone-100 text-stone-600",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
} as const;

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-cream-300 bg-cream-50 px-4 py-3 shadow-card">
      <div className={`text-2xl font-semibold ${accent && value > 0 ? "text-amber-700" : "text-stone-900"}`}>
        {value}
      </div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}

export function ImportPreview({ result }: { result: ParseResult }) {
  const [tab, setTab] = useState<"structure" | "skipped" | "raw">("structure");
  const { stats, issues, richContent, skipped, template, sampleRows, headerInfo } = result;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Sections" value={stats.sections} />
        <Stat label="Items" value={stats.items} />
        <Stat label="Comments" value={stats.comments} />
        <Stat label="Data rows" value={stats.dataRows} />
        <Stat label="Rows set aside" value={stats.skippedRows} accent />
      </div>

      <p className="text-sm text-stone-500">{headerInfo}</p>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-stone-700">What we noticed</h3>
          <ul className="space-y-1.5">
            {issues.map((iss, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium uppercase ${issueBadge[iss.level]}`}
                >
                  {iss.level}
                </span>
                <span className="text-stone-700">
                  {iss.row ? <span className="text-stone-400">row {iss.row}: </span> : null}
                  {iss.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rich content report */}
      {richContent.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-stone-700">Formatting and rich content</h3>
          <div className="overflow-hidden rounded-xl border border-cream-300 shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-cream-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-3 py-2">Content</th>
                  <th className="px-3 py-2">Count</th>
                  <th className="px-3 py-2">How we handle it</th>
                  <th className="px-3 py-2">What that means</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 bg-cream-50">
                {richContent.map((rc) => (
                  <tr key={rc.kind}>
                    <td className="px-3 py-2 font-medium text-stone-700">{rc.kind}</td>
                    <td className="px-3 py-2 text-stone-600">{rc.count}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded border px-2 py-0.5 text-xs font-medium ${supportBadge[rc.support]}`}>
                        {rc.support}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-stone-600">{rc.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b border-cream-300 text-sm">
          {([
            ["structure", "Parsed structure"],
            ["skipped", `Set aside (${skipped.length})`],
            ["raw", "Raw vs imported"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-3 py-2 transition-colors ${
                tab === key
                  ? "border-brand-600 font-medium text-brand-700"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {tab === "structure" && (
            <div className="space-y-4">
              {template.sections.map((s) => (
                <div key={s.id} className="overflow-hidden rounded-xl border border-cream-300 bg-cream-50 shadow-card">
                  <div className="border-b border-cream-200 bg-cream-200 px-4 py-2 font-medium text-stone-800">
                    {s.name || <span className="text-stone-400">(unnamed section)</span>}
                  </div>
                  <div className="divide-y divide-cream-200">
                    {s.items.map((it) => (
                      <div key={it.id} className="px-4 py-3">
                        <div className="text-sm font-medium text-stone-700">
                          {it.name || <span className="text-stone-400">(unnamed item)</span>}
                        </div>
                        <ul className="mt-2 space-y-2">
                          {it.comments.map((c) => (
                            <li key={c.id} className="rounded-lg border border-cream-200 bg-white p-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-stone-700">
                                  {c.name || <span className="text-stone-400">(unnamed comment)</span>}
                                </span>
                                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] uppercase text-stone-600">
                                  {c.type}
                                </span>
                                {c.severity !== "none" && (
                                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] uppercase text-stone-600">
                                    {c.severity}
                                  </span>
                                )}
                              </div>
                              <SafeHtml html={c.bodyHtml} className="mt-1 text-sm text-stone-600" />
                              {c.recommendation && (
                                <div className="mt-1 text-xs text-stone-500">
                                  <span className="font-medium">Recommendation:</span> {c.recommendation}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "skipped" && (
            <div>
              {skipped.length === 0 ? (
                <p className="text-sm text-stone-500">
                  Good news: every row made it in, nothing was set aside.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-stone-600">
                    These rows did not fit the template structure, so we kept them here for you to see
                    rather than dropping them quietly.
                  </p>
                  {skipped.map((sk) => (
                    <div key={sk.row} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                      <div className="font-medium text-amber-800">
                        Row {sk.row}: {sk.reason}
                      </div>
                      <pre className="mt-1 overflow-x-auto text-xs text-amber-900">
                        {JSON.stringify(sk.raw, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "raw" && (
            <div className="overflow-x-auto rounded-xl border border-cream-300 shadow-card">
              <table className="min-w-full text-xs">
                <thead className="bg-cream-200 text-left uppercase tracking-wide text-stone-500">
                  <tr>
                    {sampleRows[0] &&
                      Object.keys(sampleRows[0]).map((k) => (
                        <th key={k} className="whitespace-nowrap px-3 py-2">
                          {k}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200 bg-cream-50">
                  {sampleRows.map((row, i) => (
                    <tr key={i}>
                      {Object.keys(sampleRows[0] ?? {}).map((k) => (
                        <td key={k} className="max-w-[280px] truncate px-3 py-2 text-stone-600" title={row[k]}>
                          {row[k]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="bg-cream-50 px-3 py-2 text-[11px] text-stone-400">
                Showing the first {sampleRows.length} data rows exactly as we read them from your file.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
