import type { TemplateRepo } from "./types";
import { FileRepo } from "./file";
import { SupabaseRepo } from "./supabase";

// ---------------------------------------------------------------------------
// Driver selection. STORAGE_DRIVER chooses the backend:
//   "supabase" -> real Postgres (deployed app)
//   "file"     -> local JSON on disk (offline dev/demo)
// Defaults to "file" so the app runs with zero configuration out of the box,
// while the deployed environment sets STORAGE_DRIVER=supabase.
// ---------------------------------------------------------------------------

let cached: TemplateRepo | null = null;

export function getRepo(): TemplateRepo {
  if (cached) return cached;
  const driver = (process.env.STORAGE_DRIVER ?? "file").toLowerCase();
  cached = driver === "supabase" ? new SupabaseRepo() : new FileRepo();
  return cached;
}

export function activeDriver(): "supabase" | "file" {
  return (process.env.STORAGE_DRIVER ?? "file").toLowerCase() === "supabase" ? "supabase" : "file";
}

export type { TemplateRepo };
