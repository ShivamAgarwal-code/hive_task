# How AI was used

Per the assessment's request to be open about how the work was done.

## Building the app
The app was built with **Claude Code** as an AI pair. It helped research the Spectora HTML-text
spreadsheet format, design the schema and storage abstraction, write the parser and UI, and write the
tests. Every design decision and the final code were reviewed and checked; the tests and build are the
evidence.

## AI inside the product itself
None in the import path, on purpose. The importer is a **deterministic parser**, not an LLM.

For a customer who will not retype four years of tuning, the failure modes of a model-based importer -
inventing sections, hallucinating comments, dropping content, or returning malformed output - are
exactly the things that break trust. A deterministic parser cannot do any of those, and every choice
it makes is shown in the preview before anything is saved. Validation and honest failure were the goal,
so no model sits in the mapping.

If a model were added later (for example, to suggest cleanups or to guess column mapping on an
unfamiliar export), the right shape would be: run it, validate its output against the strict schema,
diff it against the deterministic parse, and surface both to the user in the same trust preview - never
auto-commit model output.

## Reusable prompt used to research the format

> "Describe the exact spreadsheet column layout Spectora produces for `Export to spreadsheet ->
> Export HTML Text`. List columns A, B, C, D... and what each holds (section, item, comment name,
> comment text/HTML, type, category/severity, options, recommendation, order). Explain how the
> section/item/comment hierarchy is represented across rows, and note how HTML appears in the comment
> text column."

That research is encoded in `src/lib/spectora/columns.ts`, which is the one place to update if
Spectora changes its export.
