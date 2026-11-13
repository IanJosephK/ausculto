# Reviewed text sources

Each `{slug}.txt.gz` contains the complete source fetched for this catalogue,
compressed with gzip. Sources retain their original attribution and license
information. They are preparation inputs, not files served by the app.
`scripts/book-mappings.json` records each source URL and the SHA-256 hash of its
uncompressed UTF-8 text. Preparation rejects a changed hash.

Most sources are Project Gutenberg plain text. Exceptions:

- **Metamorphosis** uses Ian Johnston's October 2003 translation from the Kafka
  Project, matching LibriVox recording 527, rather than David Wyllie's text.
  Its HTML article is extracted separately; the app displays source credit.
- **The Time Machine** uses the historical Gutenberg 35 snapshot preserved by
  GITenberg, with twelve chapters and an epilogue matching recording 817.
  The current Gutenberg text has different chapter divisions.
- **Meditations** uses George Long's text in Gutenberg 15877. The recording's
  short editorial introduction has no verified matching text source and is
  excluded from the canonical playthrough; the twelve Books and the two Long
  essays remain. Legacy positions in that introduction restart at Book I.

Corrected Gutenberg editions: Dorian Gray 4078 (thirteen-chapter version),
Twenty Thousand Leagues 2488 (F. P. Walter), Art of War 17405 (Giles without
commentary), and Meditations 15877 (Long).

See [ADDING_BOOKS.md](../../ADDING_BOOKS.md) for extraction, mapping, ranking,
and compatibility rules. Source hashes certify snapshot identity, not a
word-for-word listening review.
