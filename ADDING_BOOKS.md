# Adding books to Ausculto

Every book needs two public-domain sources: a **complete LibriVox recording**
(chapter-by-chapter MP3s) and the **Project Gutenberg plain-text edition**.
The prep script fetches both and wires them together.

## 1. Add an entry to the curated list

Open [`scripts/prepare-books.ts`](scripts/prepare-books.ts) and add an object
to the `CURATED` array:

```ts
{
  slug: 'wuthering-heights',            // URL-safe, kebab-case, permanent
  title: 'Wuthering Heights',
  author: 'Emily Brontë',
  authorLastName: 'Brontë',             // used to match the LibriVox author
  year: 1847,
  genre: 'Fiction',                     // one of the GENRES in src/data/books.ts
  description: 'Two or three sentences shown on the book page.',
  gutenbergId: 768,                     // from the gutenberg.org book URL
  librivoxQuery: 'wuthering heights',   // see below
},
```

**Finding the pieces:**

- `gutenbergId` — search [gutenberg.org](https://www.gutenberg.org); the ID is
  in the URL (`/ebooks/768`). Prefer the plain-text ("Plain Text UTF-8") edition.
- `librivoxQuery` — the LibriVox API matches **near-exact titles without the
  leading article** ("The Time Machine" → `time machine`). If a short query
  404s, use the full title as it appears on librivox.org (e.g.
  `frankenstein, or the modern prometheus`).
- If the search heuristic picks the wrong recording (e.g. a dramatic reading),
  pin the exact one with `librivoxId: 1234` — the ID is in the LibriVox
  catalog URL or API response.

## 2. Run the prep script

```bash
npm run prepare-books -- wuthering-heights
```

(Run it with no arguments to regenerate every book.) The script:

1. Finds the LibriVox recording and its per-chapter MP3 URLs.
2. Downloads the Gutenberg text, strips the license boilerplate, and splits it
   into chapters.
3. Writes per-chapter text to `public/books/{slug}/{n}.json` and metadata to
   `src/data/books.generated.json` (merging with existing books).
4. Looks up a cover on Open Library (falls back to a typographic card).

**Read the console output.** The key line is the text mapping:

- `exact` — Gutenberg headings matched the recording's section count 1:1.
  Ideal; nothing to do.
- `proportional` — heading detection didn't line up, so text was distributed
  across chapters by audio playtime. Usually acceptable, but skim a few
  chapters in the app. If a book maps badly, try pinning a different
  `librivoxId` whose section count matches the text's chapter count, or extend
  `HEADING_PATTERNS` in the script for that book's heading style.

## 3. (Optional) Word-level sync

```bash
npm run generate-alignments -- wuthering-heights 0
```

Requires the [Whisper CLI](https://github.com/openai/whisper) (`pip install
openai-whisper`) and ffmpeg. This writes
`src/data/alignments/{slug}/{n}.json`; the reader picks the file up
automatically and highlights each word as it is spoken. Chapters without
alignment data fall back to chapter-level sync — never required.

Only generate alignments for books with `"textMapping": "exact"`; the app maps
the Nth aligned word to the Nth word of the chapter text, so approximate text
splits will drift.

## 4. Verify

```bash
npm run dev
```

- The book appears in its genre on the library screen with a cover.
- Opening it shows chapter text and the audio plays.
- Chapter titles/durations look sane (compare against the LibriVox page).
- `npm run build` still passes.

## Removing a book

Delete its entry from `CURATED`, its object in `src/data/books.generated.json`,
and the `public/books/{slug}/` folder.
