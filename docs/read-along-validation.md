# Read-along validation

The initial release includes The Art of War and Metamorphosis, with timing data for every displayed chapter. Both use stable-ts 2.19.1 and Whisper base.en on the pinned catalogue text and recordings.

Coverage counts usable timed text tokens after removing displayed paragraph numbers and ornaments. It is not a timing-accuracy percentage. Uncertain or unspoken words are left unhighlighted.

| Book | Chapters | Timed ranges | Coverage range | Checked clips | Largest sample median error | Largest sample p90 error |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| The Art of War | 7 | 10,173 | 95.9–97.7% | 21 | 0.10 s | 0.36 s |
| Metamorphosis | 3 | 21,526 | 98.5–98.9% | 9 | 0.02 s | 0.19 s |

For each chapter, 15-second clips near the opening, middle and final timed words were transcribed without supplying the book text. Matching words were compared with the generated timestamps. These checks use the same model family and are a diagnostic, not independent ground truth or a full human listening review.

Ending checks caught forced words placed over narrator credits. The generator now removes implausibly long spans, extremely low-confidence words, weak endings and weak words after long gaps. Regressions protect the unspoken closing sentence in Art of War section 2 and the credits in section 7.

The ten chapter assets total 2.60 MB before compression. They load on demand and download with an offline book. Model files, recordings and raw transcription output are not shipped.

Automated checks validate every asset against the exact displayed text, source revision, recording URLs, chronological ordering and content hash. Browser checks exercise highlighting without native timeupdate events, forward/backward seeking, chapter changes, unavailable data and offline reloads.

To regenerate, follow [the alignment guide](../src/data/alignments/README.md). New editions or recording changes remove stale badge eligibility; regenerated assets change cache and download revisions.
