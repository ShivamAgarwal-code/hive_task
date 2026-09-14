import type { Metadata } from "next";
import Link from "next/link";
import { activeDriver } from "@/lib/storage";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hive Template Importer",
  description: "Bring your Spectora template across, keep every word, and make it yours.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const driver = activeDriver();
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-10 border-b border-cream-300/70 bg-cream-50/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
              <Link href="/" className="flex items-center gap-2.5 font-semibold text-stone-900">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-sm">
                  H
                </span>
                <span className="tracking-tight">Template Importer</span>
              </Link>
              <nav className="flex items-center gap-5 text-sm">
                <Link href="/" className="text-stone-600 transition-colors hover:text-stone-900">
                  Templates
                </Link>
                <Link
                  href="/import"
                  className="rounded-lg bg-brand-600 px-3.5 py-2 font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
                >
                  Import a template
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
          <footer className="border-t border-cream-300/70">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 text-xs text-stone-500">
              <span>Spectora HTML-text importer. Faithful import, an editable schema, your changes kept.</span>
              <span>
                Storage:{" "}
                <span className={driver === "supabase" ? "font-medium text-brand-700" : "font-medium text-amber-700"}>
                  {driver === "supabase" ? "Supabase (Postgres)" : "local file (dev)"}
                </span>
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
