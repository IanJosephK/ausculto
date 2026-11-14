# Word-level alignment data

`catalogue.json` lists books with complete timing coverage. The chapter assets
live in `public/alignments/{slug}/{chapter}.{content-hash}.json` and load only
when needed. They are cached by the service worker and included in explicit
offline downloads, rather than increasing the initial app install.

Each asset pins its schema version, text revision, chapter ID and recording
URLs. Its words contain `word`, `start`, `end`, `startOffset` and `endOffset`.
Times are seconds into the chapter audio. Offsets count UTF-16 code units in
the exact displayed paragraphs joined with `\n\n`; they do not assume that
recognized word N equals text token N. The reader validates the ranges before
using them and leaves the text unhighlighted during intros, silence and outros.

## Generating timings

Use Python 3.12 and a virtual environment. Install the offline generation tools:

```sh
python -m pip install -r scripts/alignment-requirements.txt
npm run generate-alignments -- metamorphosis
npm run generate-alignments -- the-art-of-war
```

Set `AUSCULTO_PYTHON` to the virtual environment's Python executable if it is
not on PATH. The script also discovers `scripts/.cache/readalong-env` locally.
PyTorch runs on CPU; the first run downloads Whisper's `base.en` model.
`imageio-ffmpeg` supplies FFmpeg, so no system FFmpeg install is necessary.

Stable-ts force-aligns the pinned text rather than replacing the displayed book
with a transcription. Paragraph numbers and ornaments are omitted
from the spoken transcript. Punctuation and hyphen splits are reconciled by
character identity. Zero-duration, uncertain endings and implausibly long spans
are omitted, without inventing timings. At least 95% of spoken text tokens must have usable
timings in every chapter. This is coverage, not a claim of 95% timing accuracy.

Downloads, raw model output and mapped intermediates stay in ignored
`scripts/.cache/alignments`. Pass an optional zero-based chapter index to work
on one chapter. A whole-book badge is published only when every chapter exists
and passes validation against the current edition and recording. Currently the
generator supports single-recording chapters; multipart timing needs explicit
per-recording offsets before it can be published.

The generator retries difficult chapters with `small.en` if `base.en` fails
the coverage check. You can also select `--model small.en` explicitly.
`--remap` reapplies validation
and confidence filters to cached output without rerunning the speech model;
it preserves each chapter's chosen model. Failed or incomplete model output
cannot earn a book badge.

Before adding a title, spot-check the opening, middle and ending of every
chapter against the audio or an unprompted transcription. Check poems,
omissions, chapter transitions and narrator credits especially carefully.
`npm test` validates every published asset, its content hash, range ordering,
text identity and revision. Browser regressions cover seeking, fallback and
offline reloads. Changing the text or recording removes stale availability;
regenerating timings changes cache keys and the offline download revision.
