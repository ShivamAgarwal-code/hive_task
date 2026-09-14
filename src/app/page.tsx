import Link from "next/link";
import { getRepo } from "@/lib/storage";
import { TemplateList } from "@/components/TemplateList";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const templates = await getRepo().listTemplates();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Your templates</h1>
          <p className="mt-2 text-stone-600">
            Bring a template across from Spectora, tune it the way you like, and make copies you can
            change on their own. Everything you do here is saved and waiting when you come back.
          </p>
        </div>
        <Link
          href="/import"
          className="rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          Import a template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cream-300 bg-cream-50 p-14 text-center shadow-card">
          <p className="text-stone-600">You have not brought any templates in yet.</p>
          <Link
            href="/import"
            className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Import your first Spectora template
          </Link>
        </div>
      ) : (
        <TemplateList templates={templates} />
      )}
    </div>
  );
}
