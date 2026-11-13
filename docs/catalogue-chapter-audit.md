# Catalogue chapter/audio audit and proposed repair

Audited 13 November 2026 against repository commit `a035e29`.

This describes the baseline before repair. The implemented mapping and
compatibility behavior are documented in [ADDING_BOOKS.md](../ADDING_BOOKS.md).
The repaired catalogue contains 467 displayed chapters across 477 recordings;
split recordings play sequentially inside a complete literary chapter.

The catalogue has **19 books and 488 audio sections/text files**. Fourteen
books use the duration-based `proportional` mapping. A fifteenth,
*Metamorphosis*, uses a different translation despite being marked `exact`.
*Dracula* has correctly separated story chapters but includes publisher
advertising after the ending. Three books have no structural mismatch found:
*Jane Eyre*, *The Great Gatsby*, and *Alice's Adventures in Wonderland*.

This is a structural and source-edition audit, not a word-by-word listening
verification. I read all 488 generated text files, examined their boundaries
and headings against the recording metadata, and checked the online-text
links on all 19 selected LibriVox recording pages. All expected files exist,
contain paragraphs, and have matching paragraph/italics array lengths. The
problem is the content assigned to each recording, rather than missing files.
No word-timing files are currently present in `src/data/alignments/`.

**Why it happens**

The decision in [prepare-books.ts](../scripts/prepare-books.ts#L576) is:

1. Detect headings using a short list of paragraph regexes.
2. If the number of detected sections equals the number of audio tracks,
   assign them in order and label the result `exact`.
3. Otherwise, distribute **all** paragraphs according to each recording's
   share of the total audio duration.

Step 3 uses the complete text after Gutenberg's license markers have been
removed. That still includes title pages, prefaces, contents, captions,
commentary, advertisements, and sometimes another work. It also ignores real
chapter boundaries. Narrators read at different speeds, and intros/outros add
audio without corresponding story text, so the boundaries drift even when
there is no front matter.

The heading parser also treats book/part headings and internal Roman-numbered
subsections as peers of chapters. It misses some named headings and cannot
express several chapters per recording or several recordings per chapter.

Step 2 is insufficient evidence of a match: *Metamorphosis* has three sections
in both sources but different wording throughout. The recording selection
checks title, author, and language; it does not establish a matching
translation or edition. Every curated entry currently leaves the recording
ID unpinned, although the generated catalogue stores the selected IDs.

The generator writes the audio section's title onto the generated text file
regardless of the text's actual boundaries. Consequently, matching titles in
the UI or JSON do not validate the underlying match.

The current advice in [ADDING_BOOKS.md](../ADDING_BOOKS.md#L53), which calls
proportional splits usually acceptable and count equality ideal, should be
replaced as part of the repair.

**Findings for every book**

“Tracks” means the current audio-section count, not the literary chapter
count. “Structurally aligned” does not certify every spoken word or timing.

| Book | Tracks; current mapping | Diagnosis | Proposed repair |
| --- | --- | --- | --- |
| Pride and Prejudice | 37; proportional | 61 literary chapters, with recordings grouping different ranges. Publisher pages, an editorial preface, and illustration material enter the split. The first story sentence appears in text file `2.json`, under audio **Chapter 6**. | Remove unrecorded editorial/illustration material; map each of the 37 recordings to its stated chapter range. Keep the selected recording, ID 253. |
| Jane Eyre | 39; exact | Structurally aligned: a preface section followed by chapters 1–38. The first track is labelled “Chapter 00”; its text contains the preface and third-edition note. | Preserve the recorded preface rather than dropping all front matter. Label it clearly and verify whether its third-edition note is spoken during boundary QA. |
| The Great Gatsby | 9; exact | Nine text chapters correspond to nine recording sections. No structural mismatch found. The recording links a scanned source rather than this Gutenberg ID. | Retain the mapping; record the edition provenance and check openings/endings against the scan/audio before certifying word-level correspondence. |
| A Tale of Two Cities | 45; proportional | The 45 story chapters already correspond to 45 tracks. Contents and the three enclosing Book divisions confuse flat heading detection. Chapter numbers restart within each Book. | Parse Book I/II/III as containers, exclude the contents, and map chapters using `(book, chapter)` identities. |
| Frankenstein | 22; proportional | The text has four opening letters and 24 chapters. Audio combines the letters and groups chapters 3–4, 14–15, and 21–22. Duration splits cut across the real boundaries. | Map the opening letters together and the three chapter pairs explicitly; use the remaining chapters individually. |
| Dracula | 27; exact | The 27 story chapters are structurally aligned. The final text file continues after `THE END` into Grosset & Dunlap advertising and a detective-book list. | End the reading text at the story's ending, retaining the narrative concluding NOTE before `THE END`. |
| Dr. Jekyll and Mr. Hyde | 4; proportional | Ten named chapters, without the heading style the generic parser expects. Recordings cover chapters 1–3, 4–7, 8–9, and 10. The contents are included in the first text file. | Identify the ten body headings after the contents and assign exactly those four ranges. |
| The Adventures of Sherlock Holmes | 12; proportional | Twelve story recordings should map to twelve stories. Internal Roman-numbered subdivisions are confused with story headings. The Red-Headed League heading appears inside the first track's text. | Use the twelve top-level story headings; retain their internal subdivisions within each story. |
| The Count of Monte Cristo | 128; proportional | 117 literary chapters, two chapters split into two recordings each, and **nine alternate readings** inserted into the linear playlist. The source also includes contents and endnotes. | Choose one reading per chapter for the main playback sequence: 119 tracks after excluding nine alternates. Map the Colosseum and Promise splits using verified text anchors. Keep alternate choices attached to the same text rather than consuming additional text. |
| Treasure Island | 26; proportional | 34 literary chapters, some paired in the audio. Contents, dedication, and six Part divisions enter the split. Body chapter XVII is printed `XXVII` in this source, so numbers alone are unsafe. | Map the recorded chapter ranges explicitly using body titles/order; handle the chapter XVII numbering error in the book profile. Verify any dedication/poem actually spoken before retaining it. |
| The Time Machine | 13; proportional | Two alternative recordings of Chapter 1 are both in the playlist. The checked-in text uses sixteen numbered sections plus an epilogue, while the recording labels use twelve chapters. | Select one Chapter 1 reading, yielding twelve canonical tracks. Verify content anchors to map the differing chapter divisions and epilogue; renumbering or removing one track alone is insufficient. |
| Twenty Thousand Leagues Under the Sea | 47; proportional | **Wrong text edition/translation**: the recording uses F. P. Walter and links Gutenberg **2488**, while the app uses **164**. The current text has 46 chapters; audio has 47, including “The Nautilus.” | Use 2488, then map its 24 + 23 chapters within the two Parts to the 47 recordings. |
| Alice's Adventures in Wonderland | 12; exact | Twelve chapters correspond to twelve recordings. No structural mismatch found. | Preserve the mapping and add source/boundary validation. |
| Meditations | 15; proportional | **Wrong translation**: the recording credits George Long; the current text is Casaubon's translation. Audio also includes an introduction and two essays, while the current text includes a different introduction, appendix, notes, and glossary. | Replace the text with a verified George Long source. Gutenberg **15877** is a candidate containing the translation, biography, and philosophy essay; verify those against the recorded versions and establish the short introduction's actual text separately. Map sections in audio order. |
| The Art of War | 7; proportional | **Wrong source variant**: the recording links **17405**, the Giles translation without commentary; the app uses **132**, which includes extensive introduction/commentary. Chapter I only appears in the third text file. | Use 17405 and group chapters 1–2, 3–4, 5–6, 7–8, 9–10, 11, and 12–13. |
| Walden | 23; proportional | Eighteen chapters split into 23 recordings: Economy has five parts and Where I Lived has two. Gutenberg 205 also contains **On the Duty of Civil Disobedience**, which is not in this recording. That essay starts inside the penultimate track's text. | Select only Walden, ending after Conclusion. Map named chapters and verify the six internal cut points needed for the split recordings. |
| Metamorphosis | 3; exact | **False exact match / wrong translation**: recording ID 527 uses Ian Johnston; Gutenberg 5200 uses David Wyllie. Matching I/II/III headings hide the mismatch. | Preserve the recording and use Johnston's actual text, available at the Kafka Project, with its source acknowledgement. This requires supporting a text-source URL beyond just `gutenbergId`. |
| The Picture of Dorian Gray | 13; proportional | **Wrong edition**: the recording links Gutenberg **4078**, the 1890 thirteen-chapter version. The app uses **174**, the expanded twenty-chapter text with a preface. | Use 4078 and map its thirteen chapters directly. |
| Heart of Darkness | 6; proportional | Three literary sections, each recorded in two parts. Title/contents enter the proportional split, and the internal cut points have no chapter headings. | Map each pair within its literary section, using three verified text anchors for the internal cuts. |

The fourteen proportional books account for **398 text files**. Including
*Metamorphosis*, fifteen books / 401 files require replacing or validating
their mappings or source text. This does not mean every boundary in every
such file is wrong; it means their current assignment is unreliable or their
source is incompatible. *Dracula* additionally needs final-chapter cleanup.

**Direct evidence and source checks**

- [Pride and Prejudice: first text file](../public/books/pride-and-prejudice/0.json)
  begins with publisher/illustration material. The next file is still
  prefatory material. The novel's first sentence is paragraph index 35 of
  [file 2](../public/books/pride-and-prejudice/2.json), whose metadata names
  Chapter 6. The [recording's section table](https://librivox.org/pride-and-prejudice-by-jane-austen/)
  instead starts with chapters 1–3, then 4–5, then 6.
- [Dracula: final file](../public/books/dracula/26.json) contains `THE END`
  at paragraph index 80, followed by advertising at indices 81–106. The
  narrative NOTE at indices 74–79 is part of the story's conclusion.
- [Walden: file 21](../public/books/walden/21.json) introduces Civil
  Disobedience at paragraph index 16, even though the
  [selected recording](https://librivox.org/walden-by-henry-david-thoreau/)
  ends with Walden chapter 18.
- [Monte Cristo's recording page](https://librivox.org/the-count-of-monte-cristo-by-alexandre-dumas/)
  explicitly describes alternate readings. All nine alternate-labelled
  entries appear in `books.generated.json` as successive chapters.
- [The Time Machine's recording page](https://librivox.org/the-time-machine-by-hg-wells/)
  explicitly identifies the two Chapter 1 readings as alternatives.
- The [Dorian Gray recording](https://librivox.org/the-picture-of-dorian-gray-by-oscar-wilde/)
  links [4078](https://www.gutenberg.org/ebooks/4078), which Gutenberg
  identifies as the 1890 thirteen-chapter version. The local text contains
  twenty chapter headings.
- The [Verne recording](https://librivox.org/twenty-thousand-leagues-under-the-sea-by-jules-verne/)
  credits Walter and links [2488](https://www.gutenberg.org/ebooks/2488).
- The [Art of War recording](https://librivox.org/the-art-of-war-by-sun-tzu/)
  links [17405](https://www.gutenberg.org/ebooks/17405); Gutenberg explicitly
  distinguishes this text-only version from the commentary in 132.
- The [Meditations recording](https://librivox.org/the-meditations-of-marcus-aurelius/)
  credits Long. The notes in [the current source](https://www.gutenberg.org/cache/epub/2680/pg2680-images.html)
  identify Casaubon's translation. [15877](https://www.gutenberg.org/ebooks/15877)
  credits Long and [includes the biography and philosophy essay](https://www.gutenberg.org/cache/epub/15877/pg15877-images.html).
  The recording's old Bartleby source link returned 403 during this audit;
  15877 is a candidate, not a certified replacement for every track.
- The [Kafka recording](https://librivox.org/the-metamorphosis-by-franz-kafka/)
  credits Johnston; [5200](https://www.gutenberg.org/ebooks/5200) credits
  Wyllie. The old Kafka source link returns 404, but
  [Johnston's text is available at its current address](https://www.kafka.org/translations/english/the-metamorphosis-transl-ian-johnston/).

**Recommended implementation**

Keep the current recording choices where possible and replace the importer’s
guess with a reviewed mapping for each book. This is a manageable curated
catalogue; explicit mappings are easier to verify than an increasingly broad
heading regex.

1. **Pin source pairs.** Set each curated `librivoxId` to the recording
   already selected in the generated catalogue. Store the text-source URL,
   edition/translator, retrieval information, and content hash. Apply the
   five source corrections above: Verne, Dorian Gray, Art of War,
   Meditations, and Metamorphosis. Cache source snapshots so a later
   Gutenberg update cannot silently change the mapping.
2. **Extract a hierarchy of real text sections.** Prefer Gutenberg
   HTML/EPUB body anchors and structure, with book-specific rules where
   needed. Separate contents/navigation, book/part containers, actual
   chapters, and supplementary material. Remove illustration captions and
   editorial material where they are not spoken. A preface or epilogue that
   is recorded must remain available and mapped explicitly.
3. **Describe audio-to-text ranges explicitly.** One recording may cover
   several text sections, or an anchored slice of one section. Use stable
   LibriVox section IDs/audio identities and stable text-section IDs, rather
   than equality of array lengths. Treat alternate readings as choices for
   the same text, and maintain a separate canonical playback order.
4. **Fail unresolved generation.** Remove the duration-based fallback.
   Reject a book with an unresolved section, ambiguous anchor, unexpected
   source hash, empty slice, skipped story text, or unintended overlap.
   Report the unmatched sections and write generated data only after the
   full book passes validation. Distinguish `verified` from `unresolved`;
   chapter counts alone must never produce a verified status.
5. **Verify boundaries.** For Walden, Heart of Darkness, Monte Cristo,
   and The Time Machine's differing divisions, transcribe/listen around
   section starts and ends to establish opening/closing phrase anchors.
   Use these anchors to make deterministic text slices. Duration can flag
   suspicious results, but must not choose text boundaries.

For example, the first three Pride and Prejudice mappings should be:

| Recording section | Text to include |
| --- | --- |
| 1: Chapters 1–3 | Complete body chapters 1, 2, and 3 |
| 2: Chapters 4–5 | Complete body chapters 4 and 5 |
| 3: Chapter 6 | Complete body chapter 6 |

The first generated file should begin with chapter 1's narrative, and end at
chapter 3's ending. It should contain neither the editorial preface nor
chapter 4. The same rule applies to all 37 recording sections.

**Rollout and acceptance criteria**

Repairing the text files is not sufficient by itself:

- The service worker uses `CacheFirst` for `/books/...json`, with the
  `ausculto-text` cache lasting up to a year
  ([vite.config.ts](../vite.config.ts#L51)). Add a content revision to text
  URLs and update both the reader loader and offline downloader. Existing
  installations must request the corrected revision, including after an
  offline download is refreshed.
- Progress, bookmarks, and highlights currently use numeric chapter indices;
  highlights also store offsets into that chapter's text
  ([types.ts](../src/data/types.ts#L46)). Preserve audio identities and
  playback positions when changing text. For Monte Cristo and The Time
  Machine, map legacy indices onto the selected canonical recording before
  removing alternates from playback order. Migrate both guest storage and
  cloud data, and handle old chapter-index links.
- Re-anchor highlights using the saved text snippet plus surrounding context
  in the corrected edition; keep notes attached. If an old highlight cannot
  be located uniquely, retain it as a legacy annotation with its text/note
  rather than applying its old offsets to unrelated new text. Text-only
  bookmarks need an explicit relocation policy because their audio index
  may have been displaying the wrong passage.
- Add importer regressions for contents, recorded/unrecorded prefaces,
  repeated chapter numbers within Books, grouped chapters, split chapters,
  alternative readings, edition/translation mismatches, and the Treasure
  Island numbering anomaly. Validate every one of the nineteen source pairs
  and every canonical audio/text boundary, including the first and final
  passages. Smoke-test resumed playback, saved annotations, and offline
  upgrades as well as a fresh install.
- Correct [ADDING_BOOKS.md](../ADDING_BOOKS.md#L53) so new books require
  validated source pairs and mappings. Make unresolved catalogue mappings a
  failing preparation/CI check.

Word-level timing is a subsequent step. The current Whisper script emits
recognized words, while the reader assigns timing entry N to text token N.
Even corrected chapter boundaries do not guarantee those token sequences
match, especially across LibriVox introductions or omitted headings. Future
timing generation should align against the chosen canonical text and record
its text revision; it cannot repair a wrong edition or chapter split.

Suggested delivery order: source pinning and strict importer validation;
Pride and Prejudice as the first complete regression; the remaining full and
grouped chapter mappings plus source corrections; anchored splits and
alternate-reading playback; then migration/offline verification before
shipping the regenerated catalogue. No application or catalogue repair is
implemented by this report.
