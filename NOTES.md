# NOTES

Honest notes on what this is, what it is not, and where the time went.

## Read this first: the sample file

The assessment asks you to sign up for a Spectora trial, load a template such as InterNACHI
Residential, and export it with `Export to spreadsheet -> Export HTML Text`, then commit that file.

The committed file at `sample-exports/InterNACHI-Residential-Spectora-HTML-export.xlsx` is a
**faithful, hand-built stand-in**, not a file exported from a live Spectora account. It reproduces
Spectora's documented HTML-text spreadsheet column layout exactly, and fills it with InterNACHI-style
residential content (with links, formatting, an image, and an embedded video) that contains no real
customer data.

Why: this build was done by an AI pair that cannot create a Spectora account. **Before you submit,
generate the real export from your own Spectora trial and drop it in** (either upload it in the app or
replace the file in `sample-exports/`). The importer resolves columns by header name, so a genuine
export with the same headers works without any code changes. That is the whole point of building it
this way.

## What I prioritized

The customer is switching off Spectora with four years of tuning they will not retype. So the bar is
**faithful import and a workflow they can trust**, over originality. In priority order:

1. A parser that preserves text, hierarchy and ordering, and never drops or rewrites content silently.
2. A real, normalized schema (not an HTML blob) that is fully editable.
3. A workflow: import -> preview -> edit -> copy, all persisted to a real backend.
4. The "go further" improvement: making the import easy to **trust**.

## The improvement I chose: a trust-first import

The single biggest risk for a switching customer is a quiet, lossy import that looks fine until they
find a missing comment three weeks later. So before anything is saved, the import preview shows:

- Counts (sections / items / comments / data rows / rows set aside).
- Every note the parser raised, at info / warning / error level.
- A **formatting table**: for each kind of rich content (links, bold, lists, tables, images, video),
  whether it is `preserved`, `degraded`, or `unsupported`, and what that means in plain language.
- A **"set aside" tab** listing every row that did not fit the structure, with the raw cell values, so
  nothing disappears without explanation.
- A **raw-vs-imported tab** showing the first rows exactly as read from the file.

Only after this does the "import it" button do anything. That is the difference between a customer who
trusts the switch and one who does not.

## Supported input

- Spectora `Export HTML Text` spreadsheets in `.xlsx`, `.xls`, or `.csv`.
- Columns resolved by **header name** (robust to re-ordered columns), with a **positional fallback**
  to Spectora's documented layout (A = Section, B = Item, C = Comment Name, D = Comment Text, ...)
  when there is no recognizable header. The positional fallback only kicks in for files at least 6
  columns wide, and raises a visible warning, so an unrelated spreadsheet is not silently turned into
  a template.
- Fill-down: Section and Item cells that repeat down the rows (or are left blank to mean "same as
  above") are handled.
- These modeled fields: Section, Item, Comment Name, Comment Text (HTML), Comment Type, Category
  (severity), Multiple Choice Options, Recommendation.
- Every other column in the file (Answer Type, Locked, Uses, custom columns, etc.) is **preserved** on
  each comment's `extra` bag and shown in the editor, rather than dropped.

## How rich content is handled, and the two kinds of "missing"

Comment HTML is stored **verbatim**. It is sanitized only at render time, so the original markup is
always kept in the database while the browser only ever sees safe HTML.

- **Preserved:** links, bold, italic, underline, lists, paragraphs, headings. Kept and rendered.
- **Degraded:** tables and images. The markup is kept and rendered, but complex tables may look
  different, and images that point at Spectora's CDN depend on those URLs staying reachable.
- **Unsupported:** iframes, video embeds, and scripts. These are **not rendered** (for safety), but
  the original markup is **kept in the stored data and shown as a flagged block**, so it is never lost.

The distinction the brief asks for:

- **Missing from the export** = data Spectora's HTML-text export simply does not include (for example,
  photos are referenced by URL, not embedded; some Spectora-internal metadata is not in the sheet).
  We cannot import what is not there.
- **Not supported by the importer** = content that is in the file but which we choose not to render
  (video/iframe/script). We still keep it; we just do not display it live.

## Failure handling

The importer fails honestly rather than pretending. Covered by tests and easy to demo:

- A non-spreadsheet file (random bytes) returns a clear error, not a crash and not a fake empty
  template.
- A spreadsheet with no Section/Item columns is rejected with an explanation.
- An empty file is reported as empty.
- Malformed / unclosed HTML in a comment is preserved exactly and sanitized at render time.

To see it live: upload any random `.xlsx` or a text file on the import screen.

## How I checked my work

- **Unit + integration tests (`npm test`, 16 tests):**
  - Parser: hierarchy, ordering, HTML preserved verbatim, fill-down, header resolution, positional
    fallback, unmodeled-column preservation, skipped-row reporting, option splitting, and an
    end-to-end parse of the committed sample `.xlsx`.
  - Storage: real persistence via the file driver, edits saved, template deletion cascades, and the
    key guarantee that **a copy edited heavily leaves the original byte-for-byte unchanged** (verified
    by checking the copy shares no ids with the original and mutating/deleting nodes in the copy).
  - Failure cases as above.
- **Build:** `next build` passes clean, including client-side bundling of the HTML sanitizer.
- **Runtime smoke:** seeded the store, started the production server, and confirmed the home, import,
  and editor pages render the imported content over HTTP.

## What I deliberately left out, and why

- **Drag-and-drop reordering** of sections/items/comments. Renaming, editing, adding and deleting are
  in; reordering is a nice-to-have that did not change the core "faithful import + trust" story. The
  schema already has a `position` column, so this is a small addition later.
- **Auth / multi-user.** Out of scope for the assessment and would have traded time away from import
  fidelity. RLS is on and closed; adding user-scoped policies is the natural next step.
- **Round-trip export back to Spectora.** Import is the hard, valuable direction; export was not asked
  for.
- **AI in the import mapping.** I chose a **deterministic parser** over an LLM for import. For a
  customer who will not retype four years of work, predictability and honest failure matter more than
  cleverness: the parser cannot invent sections, hallucinate comments, or silently drop content, and
  every decision it makes is visible in the preview. The brief's cautions about malformed model
  output, invented sections, and dropped content are exactly the failure modes I avoided by not using
  a model here.
- **Binsr / Hive product exploration.** I did not sign up for the trials as part of this build (same
  reason as the sample file). The design is still informed by Spectora's own Section > Item > Comment
  model and by the brief's emphasis on trust; if you explore Binsr and Hive yourself, the natural
  comparison point is how visible each one makes what was skipped on import, which is the exact thing
  this app leans into.

## Approximate time spent

Roughly two focused days of effort: about half a day on understanding the Spectora format and
designing the schema and storage abstraction, a day on the parser, importer, trust preview and editor,
and the remainder on tests, the theme, and documentation.

## Credits

- Built with Claude Code as the AI pair; I am responsible for understanding and checking what ships.
- Spectora column layout from Spectora's public Info Center ("How to Import a Template from a
  Spreadsheet").
- Open-source dependencies are listed in `package.json`. No third-party starter was used.
