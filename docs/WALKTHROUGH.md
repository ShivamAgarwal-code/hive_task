# Walkthrough video script (8-10 minutes)

An outline you can talk to while screen-sharing. Camera on for the intro, optional after.

## 1. You (30s)
- Who you are and what you have worked on.

## 2. What you built (3 min) - spend the most time here
- Open the live app on the seeded InterNACHI template.
- Go to **Import**, upload `sample-exports/InterNACHI-Residential-Spectora-HTML-export.xlsx`.
- Walk through the **preview**: counts, the formatting table (links preserved, image degraded, video
  unsupported-but-kept), the "set aside" tab, and raw-vs-imported. Emphasize nothing is saved yet.
- Click **import it**. Land in the editor.
- **Edit:** rename a section, change a comment's text with the visual editor, save. Refresh to show it
  persisted.
- **Copy:** duplicate the template. In the copy, change a comment and delete a section. Open the
  original and show it is unchanged.

## 3. The repo (1 min)
- `src/lib/spectora` (parser), `src/lib/storage` (two drivers behind one interface),
  `src/app` (pages + server actions).
- Mention the stack and that Claude Code was the AI pair.

## 4. The data model (1.5 min)
- `supabase/migrations/0001_init.sql`: templates -> sections -> items -> comments, cascade deletes,
  RLS on. HTML lives inside `comments.body_html`; everything else is normalized.
- The import mapping: one row per comment, section/item repeated and filled down.
- How you checked content survived: `npm test` (parser preservation + copy independence), and the
  preview screen.

## 5. Your decisions (1.5 min)
- Why trust-first import was the improvement worth building for a switching customer.
- Why a deterministic parser instead of an LLM for the mapping.
- What you cut (reordering, auth, export) and why.

## 6. The hard part (1 min)
- The hardest import problem: faithfully preserving comment HTML (links, formatting, embedded video)
  without either rendering something unsafe or dropping it. Show a comment with an embedded video: the
  markup is kept and flagged, not silently removed.
- Show one failure case live: upload a random file and show the honest error.

## 7. Hive feedback (30s)
- Be direct and specific about anything you would improve in Hive Inspect after using it.

## Recording tips
- OBS or a Zoom call with yourself both work. Upload unlisted to YouTube or share a Loom.
