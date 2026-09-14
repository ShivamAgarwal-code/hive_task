"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { ParseResult } from "@/lib/spectora/importTypes";
import { parseUploadAction, commitImportAction } from "@/app/actions";
import { ImportPreview } from "./ImportPreview";

export function ImportWizard() {
  const router = useRouter();
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, startParse] = useTransition();
  const [committing, startCommit] = useTransition();
  const [fileName, setFileName] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  function handleParse(formData: FormData) {
    setError(null);
    startParse(async () => {
      try {
        const res = await parseUploadAction(formData);
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "We could not read that file.");
      }
    });
  }

  function handleCommit() {
    if (!result) return;
    startCommit(async () => {
      try {
        const { id } = await commitImportAction(result.template);
        router.push(`/templates/${id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "We could not save the template.");
      }
    });
  }

  const hasErrors = result?.issues.some((i) => i.level === "error") ?? false;

  return (
    <div className="space-y-6">
      {!result && (
        <form
          ref={formRef}
          action={handleParse}
          className="space-y-5 rounded-xl border border-cream-300 bg-cream-50 p-6 shadow-card"
        >
          <div>
            <label className="block text-sm font-medium text-stone-700">Your Spectora export</label>
            <p className="mt-0.5 text-xs text-stone-500">
              In Spectora, choose <em>Export to spreadsheet</em>, then <em>Export HTML Text</em>. Drop
              the resulting file here. We accept .xlsx and .csv.
            </p>
            <input
              type="file"
              name="file"
              required
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
              className="mt-3 block w-full rounded-lg border border-stone-300 bg-white text-sm text-stone-600 file:mr-3 file:border-0 file:bg-brand-600 file:px-4 file:py-2.5 file:text-white hover:file:bg-brand-700"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-stone-700">Template name</label>
              <input
                name="templateName"
                placeholder={fileName ? fileName.replace(/\.[^.]+$/, "") : "e.g. InterNACHI Residential"}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Where it came from</label>
              <input
                name="source"
                placeholder="e.g. Spectora export, InterNACHI Residential"
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={parsing}
            className="rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {parsing ? "Reading your file..." : "Preview the import"}
          </button>
        </form>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {result && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-stone-900">
                Take a look before you save
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Nothing has been saved yet. Have a look through and make sure your content came across.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
                className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm transition-colors hover:bg-stone-50"
              >
                Start over
              </button>
              <button
                onClick={handleCommit}
                disabled={committing || hasErrors}
                title={hasErrors ? "Please resolve the errors above before importing." : undefined}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {committing ? "Saving..." : "Looks good, import it"}
              </button>
            </div>
          </div>

          {hasErrors && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              This file has problems we cannot safely import. Try re-exporting from Spectora, or pick a
              different file.
            </div>
          )}

          <ImportPreview result={result} />
        </>
      )}
    </div>
  );
}
