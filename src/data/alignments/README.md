# Word-level alignment data

`{bookSlug}/{chapterIndex}.json` → `[{ "word": "Whoever", "start": 1.02, "end": 1.38 }, …]`

- `start`/`end` are seconds into that chapter's audio.
- The reader maps the Nth entry onto the Nth whitespace-separated word of the
  chapter text, so entry order must match the text (use books with
  `"textMapping": "exact"`).
- Files are lazy-loaded via `import.meta.glob` — they never enter the main
  bundle. A missing file simply means chapter-level sync for that chapter.

Generate with `npm run generate-alignments -- <slug> [chapter]` (Whisper CLI),
or any forced aligner (Aeneas, Gentle) that can emit this shape.
