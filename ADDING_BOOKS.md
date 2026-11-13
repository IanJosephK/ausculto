# Adding and maintaining books

Book preparation uses reviewed mappings in
[`scripts/book-mappings.json`](scripts/book-mappings.json), not duration-based
text estimates. Each entry pins a recording ID, its section IDs/URLs, a text
edition and SHA-256 hash, and the exact text sections assigned to each chapter.
The source snapshots in `scripts/book-sources/` make regeneration reproducible
without network access.

## Regenerate or check the catalogue

```sh
npm run prepare-books                         # rebuild all books offline
npm run prepare-books -- pride-and-prejudice   # rebuild one book
npm run check-books                           # fail if generated files differ
npm test
npm run build
npm run test:browser                          # installed Edge; see below
```

`--fetch-sources` explicitly re-downloads pinned source URLs. It rejects a
changed hash instead of silently accepting a different edition. Review source
changes, extraction rules, and mappings before updating the hash/snapshot.
The importer validates every selected book before writing generated text or
catalogue metadata. Unknown slugs fail. Partial runs preserve other books.

## Add a book

1. Select a complete recording and inspect its LibriVox `url_text_source` and
   translator/edition. A matching title or chapter count is insufficient.
   Keep the recording ID, individual section IDs, URLs, and measured durations.
2. Save the complete original source as UTF-8, including source attribution and
   license information, gzip it into `scripts/book-sources/{slug}.txt.gz`, and
   record its SHA-256 hash **before compression**. For non-Gutenberg sources,
   record the source URL and required acknowledgement.
3. Add an edition-specific extractor to
   [`scripts/book-text.ts`](scripts/book-text.ts). Distinguish body chapters
   from contents and book/part containers. Exclude unrecorded editorial
   material; retain recorded prefaces and epilogues. Validate the expected
   section identities and complete story coverage.
4. Add the entry to `book-mappings.json`. `textSections` explicitly identifies
   which body sections belong to a displayed chapter. `audioParts` lists its
   recordings in playback order. Group several source chapters when one
   recording reads them together. Combine sequential recordings of one
   literary chapter into that chapter's audio parts, rather than estimating
   paragraph cuts. Alternate readings are excluded from the main sequence.
5. Set a documented `matchRank` using the policy below. Add regressions for
   the opening/ending passages and unusual structure, then regenerate and run
   the checks. Verify audio at chapter starts/ends before treating its wording
   as fully checked. Structural matching is distinct from word timing.

The initial manifest has an `excludedAudio` list and `legacyCount` because the
previous catalogue included duplicate readings. Its `legacyIndex` values are
permanent storage coordinates: **do not renumber them**. New recordings need
new unused indices. See the compatibility notes below before changing audio.

## Home-screen order

The catalogue is sorted by descending `matchRank`; genre and title filters
retain that order. Ranks express structural match quality, not a percentage of
word accuracy:

| Rank | Current basis |
| --- | --- |
| 110 | Alice in Wonderland: direct, complete match and preferred first demonstration |
| 100 | Direct chapter pairs with matching source structure |
| 90 | Exact chapter ranges grouped into single recordings |
| 85 | Direct pairs with historical editions, text variants, or additional footnotes |
| 80 | Whole chapters played across several recordings |
| 70 | Meditations: corrected Long translation, with source variants/supplementary essays |

Ties retain curated order. Reassess rank when source or boundary validation
improves; do not raise it merely because section counts agree. Continue
reading remains ordered by the reader's recent activity.

## Existing users and offline text

Preparation generates a content-based `textRevision`. The loader and offline
downloader use `/books/{slug}/{n}.json?v={textRevision}`, so the service worker
does not serve an old edition from its year-long text cache. Saved downloads
are considered ready only for the current revision; cached audio can be reused
when the reader refreshes a download.

Guest and Supabase progress/bookmarks retain original recording coordinates.
[`bookMapping.ts`](src/lib/bookMapping.ts) translates them into current
chapters and cumulative multipart times, and back on save. This avoids a
database migration and keeps old clients' stored coordinates meaningful.
Positions in an excluded alternate reading map proportionally into the chosen
reading of the same chapter; an unmatched introductory track maps to the start
of the book. New deep links carry the text revision; older chapter-index links
are interpreted using the legacy map.

Saved highlights are checked against the current text and, when necessary,
located by their excerpt across the book. A missing or ambiguous excerpt keeps
its saved text and note in My Library but is not painted onto unrelated prose.
No stored annotations are deleted during migration.

## Browser checks

After `npm run build`, `npm run test:browser` launches headless Microsoft Edge,
a Vite development server in guest mode, and the production preview. The media
mock makes playback transitions and restored positions
deterministic; it does not certify spoken wording. These tests cover catalogue
ordering, Pride and Prejudice, multipart playback/seeking, legacy positions,
alternate recordings, saved highlights/bookmarks, and service-worker text
updates followed by offline reloads. Set another Playwright
browser/channel in `playwright.config.ts` when Edge is unavailable.

## Word timing

Chapter matching does not imply word-level alignment. LibriVox introductions,
spoken headings, and transcription differences must be accounted for before
assigning timestamp entry N to text token N. Use a forced aligner against the
canonical text and include its text revision; do not use chapter-count equality
as evidence that Whisper tokens match the text.

## Remove a book

Remove its manifest entry, source snapshot, generated metadata, and text folder.
Consider existing saved progress/annotations before reusing a slug or recording
index. Slugs and legacy storage indices identify existing readers' data.
