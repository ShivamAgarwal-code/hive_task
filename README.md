# Hive Template Importer

Bring a Spectora template across into your own system, keep every word of it, and let an inspector
work with it from there. This app imports a Spectora **HTML-text spreadsheet export**, shows you
exactly what came through before saving, stores it in a real relational schema, and lets you edit and
duplicate templates while keeping the originals untouched.

Built for the Hive Inspect "template importer" assessment.

---

## What it does

1. **Import.** Upload a Spectora `Export to spreadsheet -> Export HTML Text` file (`.xlsx` or `.csv`).
   The importer preserves the template's text, hierarchy and ordering, and makes anything it sets
   aside or cannot fully support visible instead of dropping it quietly.
2. **Preview before saving (the trust step).** Before anything is written to the database you get a
   full preview: counts, every note, a table of how each kind of formatting is handled
   (preserved / degraded / unsupported), the rows that were set aside and why, and a raw-vs-imported
   comparison of the source cells.
3. **Edit.** Rename sections, items and comments. Edit comment text with a small visual editor (bold,
   italic, underline, lists, links) or drop to raw HTML. Change comment type, severity and
   recommendation. Add and delete sections, items and comments.
4. **Copy.** Duplicate a template and edit the copy independently. The copy gets brand-new ids on
   every node, so changes to the copy never touch the original.
5. **Store.** Everything persists to a real backend (Supabase / Postgres). Data is still there after
   you close and reopen the app.

---

## Stack

- **Next.js 15** (App Router, React 19, server actions) + **TypeScript**
- **Tailwind CSS** for styling (warm, creamy-white theme)
- **Supabase (Postgres)** as the real backend, via `@supabase/supabase-js` (server-side only)
- **ExcelJS** to read `.xlsx`, plus a small built-in CSV parser
- **sanitize-html** to render comment HTML safely
- **node-html-parser** to analyse rich content in comment HTML
- **Vitest** for tests

There are two storage drivers behind one interface:

- `supabase` - the real backend for the deployed app.
- `file` - a local, on-disk JSON store (`./.data/db.json`) that mirrors the same relational shape.
  It is the default so the app runs with zero configuration for local development and demos.

Select the driver with the `STORAGE_DRIVER` environment variable.

---

## Quick start (local, zero config)

```bash
npm install
npm run gen:sample     # (optional) regenerate the sample Spectora export
npm run seed           # load the sample template into the local file store
npm run dev            # http://localhost:3000
```

With no `.env`, the app uses the local file driver, so it works fully offline. The seed step gives
you a template to explore immediately.

Run the tests:

```bash
npm test
```

---

## Using Supabase (the real backend)

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migration in `supabase/migrations/0001_init.sql`. Two easy options:
   - **Dashboard:** open the SQL Editor, paste the file's contents, and run it.
   - **CLI:** `supabase db push` (if you use the Supabase CLI linked to your project).
3. Copy your project credentials from **Project Settings -> API**.
4. Create `.env.local` (see `.env.example`):

   ```env
   STORAGE_DRIVER=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
   ```

5. Seed the database:

   ```bash
   STORAGE_DRIVER=supabase npm run seed
   ```

6. `npm run dev` and you are now talking to Postgres.

### A note on security

The app reads and writes the database **only from the server** (Next.js server actions), using the
Supabase **service role** key. The migration enables Row Level Security on every table and adds no
public policies, so the anon/public roles cannot read or write directly. The service key must never
be exposed to the browser; keep it in server-side env vars only.

---

## Deploying to Vercel

1. Push this repo to GitHub and import it into [Vercel](https://vercel.com).
2. In the Vercel project's **Environment Variables**, set:
   - `STORAGE_DRIVER = supabase`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy. Then seed the production database once so the live app opens on a template:

   ```bash
   # from your machine, pointing at the same Supabase project
   STORAGE_DRIVER=supabase npm run seed
   ```

No login is required to view the app. If you later add auth, document the access steps here.

---

## The sample export

`sample-exports/InterNACHI-Residential-Spectora-HTML-export.xlsx` is committed so the app can be
tested against a known file. It follows Spectora's documented HTML-text spreadsheet column layout
(`Section Name | Item Name | Comment Name | Comment Text (HTML) | Comment Type | Category |
Multiple Choice Options | ... | Order (w/i item) | ...`) and contains InterNACHI-style residential
content with links, bold/italic text, bulleted lists, an image, and an embedded video, and no real
customer information. It is generated by `scripts/generate-sample-export.mjs`.

The importer resolves columns by **header name** first (so a real Spectora export with the same
headers works out of the box) and falls back to Spectora's **positional** layout when there is no
recognizable header. To test against your own file, just upload it, or drop it into `sample-exports/`
and point the seed script at it.

See `NOTES.md` for exactly what is supported, what is a known limitation, and the difference between
"missing from the export" and "not supported by the importer".

---

## Project structure

```
src/
  app/
    page.tsx                 Template list (home)
    import/page.tsx          Import wizard
    templates/[id]/page.tsx  Editor
    actions.ts               All server-side mutations
  components/                UI (import wizard, preview, editor, rich text)
  lib/
    types.ts                 Domain model (Template/Section/Item/Comment)
    spectora/
      read.ts                File -> 2D grid (xlsx/csv)
      columns.ts             Spectora column map + normalizers
      parser.ts              Grid -> structured, reviewable result
      analyze.ts             Rich-content classification
      importService.ts       read + parse orchestration
    storage/
      types.ts               Storage interface
      supabase.ts            Supabase driver
      file.ts                Local file driver
      deepCopy.ts            Independent deep copy for duplication
    sanitize.ts              Safe rendering of comment HTML
supabase/migrations/0001_init.sql
scripts/
  generate-sample-export.mjs
  seed.ts
```

---

## Credits

Scaffolded and built with Claude Code as the AI pair. The Spectora HTML-text column layout is based
on Spectora's public Info Center article "How to Import a Template from a Spreadsheet". No third-party
starter template was used; dependencies are credited in `package.json`.
