// ---------------------------------------------------------------------------
// Seed script - imports the committed Spectora sample export into whichever
// backend STORAGE_DRIVER points at (local file or Supabase), so the app opens
// with something to explore.
//
//   npm run seed              # seeds the active driver
//   STORAGE_DRIVER=supabase npm run seed   # seed the deployed database
//
// Idempotent: skips if a template with the same name already exists.
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import path from "node:path";
import { getRepo, activeDriver } from "../src/lib/storage/index";
import { parseUpload } from "../src/lib/spectora/importService";

const SAMPLE = path.join(
  process.cwd(),
  "sample-exports",
  "InterNACHI-Residential-Spectora-HTML-export.xlsx",
);
const TEMPLATE_NAME = "InterNACHI Residential (Spectora import)";

async function main() {
  const repo = getRepo();
  console.log(`Seeding via "${activeDriver()}" driver…`);

  const existing = await repo.listTemplates();
  if (existing.some((t) => t.name === TEMPLATE_NAME)) {
    console.log(`Template "${TEMPLATE_NAME}" already exists - nothing to do.`);
    return;
  }

  const buffer = readFileSync(SAMPLE);
  const result = await parseUpload({
    buffer,
    filename: path.basename(SAMPLE),
    templateName: TEMPLATE_NAME,
    source: "Spectora export → Export HTML Text · InterNACHI Residential (sample, no customer data)",
  });

  if (!result.ok) {
    console.error("Parse failed:", result.issues);
    process.exit(1);
  }

  await repo.insertTemplate(result.template);
  console.log(
    `Seeded "${TEMPLATE_NAME}": ${result.stats.sections} sections, ${result.stats.items} items, ${result.stats.comments} comments.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
