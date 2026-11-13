"""Force-align the exact displayed text, rather than an ASR transcript.

Used by generate-alignments.ts. Install scripts/alignment-requirements.txt in
a Python 3.12 virtual environment; audio, models and intermediate results stay
in scripts/.cache. No speech service or API key is required.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import unicodedata
import urllib.request

import imageio_ffmpeg
import numpy as np
import stable_whisper
import torch

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache" / "alignments"


class AlignmentQualityError(ValueError):
    def __init__(self, index, message):
        self.index = index
        super().__init__(message)


def normalized(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text).lower() if c.isalnum())


def align_book(slug, indices, model_name, remap=False):
    books = json.loads((ROOT / "src/data/books.generated.json").read_text(encoding="utf-8"))
    book = next(b for b in books if b["slug"] == slug)
    CACHE.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(min(8, os.cpu_count() or 4))
    model = None if remap else stable_whisper.load_model(model_name, device="cpu", download_root=str(CACHE / "models"))
    for index in indices if indices is not None else range(len(book["chapters"])):
        chapter = book["chapters"][index]
        chapter_model = model_name
        if len(chapter.get("audioParts", [])) != 1:
            raise ValueError("Generate single-recording chapters first; multipart alignment needs explicit offsets.")
        work = CACHE / slug
        work.mkdir(parents=True, exist_ok=True)
        previous = None
        if remap:
            previous = json.loads((work / f"{index}-mapped.json").read_text(encoding="utf-8"))
            chapter_model = previous["model"].removeprefix("stable-ts/")
        url = chapter["audioUrl"].replace("https://www.archive.org/", "https://archive.org/")
        audio_key = hashlib.sha256(url.encode()).hexdigest()[:12]
        audio = work / f"{index}-{audio_key}.mp3"
        if not remap and not audio.exists():
            print(f"{slug}/{index}: downloading audio", flush=True)
            partial = audio.with_suffix(".part")
            with urllib.request.urlopen(url, timeout=60) as response, partial.open("wb") as target:
                shutil.copyfileobj(response, target)
            partial.replace(audio)
        text = json.loads((ROOT / f"public/books/{slug}/{index}.json").read_text(encoding="utf-8"))
        plain = "\n\n".join(text["paragraphs"])
        # Paragraph numbers and decorative separators are displayed, not spoken.
        spans = [m for m in re.finditer(r"\S+", plain) if normalized(m.group()) and not re.fullmatch(r"\d+\.", m.group())]
        transcript = " ".join(m.group() for m in spans)
        transcript_key = hashlib.sha256(transcript.encode()).hexdigest()[:12]
        result_file = work / f"{index}-{audio_key}-{transcript_key}-{chapter_model}.json"
        if remap:
            if previous["audioUrls"] != [url] or previous["textRevision"] != book["textRevision"]:
                raise ValueError("Cached alignment belongs to a different edition or recording")
            if not result_file.exists():
                raise ValueError("No raw alignment cached; generate this chapter first")
        if not result_file.exists():
            print(f"{slug}/{index}: aligning {len(spans)} words with {model_name}", flush=True)
            decoded = subprocess.run([
                imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(audio),
                "-f", "s16le", "-ac", "1", "-ar", "16000", "pipe:1",
            ], check=True, capture_output=True)
            samples = np.frombuffer(decoded.stdout, np.int16).astype(np.float32) / 32768.0
            result = model.align(samples, transcript, language="en", verbose=None, regroup=False,
                                 suppress_silence=True, failure_threshold=0.05)
            if result is None:
                raise AlignmentQualityError(index, f"{slug}/{index}: alignment failed")
            result.save_as_json(str(result_file))
        raw = json.loads(result_file.read_text(encoding="utf-8"))
        aligned = [w for segment in raw["segments"] for w in segment["words"]]
        # Aligners split punctuation/hyphens differently. Reconcile by character
        # identity; never assign word N to text token N.
        expected = "".join(normalized(m.group()) for m in spans)
        actual = "".join(normalized(w["word"]) for w in aligned)
        if expected != actual:
            if not remap:
                result_file.unlink()
            raise AlignmentQualityError(index, f"{slug}/{index}: incomplete or changed alignment text")
        char_timings = []
        for word in aligned:
            char_timings.extend([(word["start"], word["end"], word.get("probability", 0))] * len(normalized(word["word"])))
        words = []
        cursor = 0
        previous_end = 0
        skipped = 0
        for span_index, span in enumerate(spans):
            size = len(normalized(span.group()))
            timing = char_timings[cursor:cursor + size]
            cursor += size
            start, end = round(timing[0][0], 2), round(timing[-1][1], 2)
            confidence = min(t[2] for t in timing)
            # Omitted words can be forced into credits. Do not highlight a low
            # confidence word, or a weak word following a long narration gap.
            uncertain_ending = span_index >= len(spans) - 12 and confidence < 0.1
            if end <= start or end - start > 3 or confidence < 0.0001 or uncertain_ending or (start - previous_end > 3 and confidence < 0.5):
                skipped += 1
                continue
            if start < previous_end:
                # A hyphenated text token can share one aligner word with its
                # neighbor. Preserve the same timing as a single text range.
                if words and words[-1]["start"] == start:
                    words[-1]["endOffset"] = span.end()
                    words[-1]["word"] = plain[words[-1]["startOffset"]:span.end()]
                    words[-1]["end"] = max(words[-1]["end"], end)
                    previous_end = words[-1]["end"]
                    continue
                start = previous_end
            if end <= start:
                skipped += 1
                continue
            words.append({"word": span.group(), "start": start, "end": end,
                          "startOffset": span.start(), "endOffset": span.end()})
            previous_end = end
        coverage = 1 - skipped / len(spans)
        if coverage < 0.95:
            raise AlignmentQualityError(index, f"{slug}/{index}: only {coverage:.1%} timed words")
        # Browser offsets count UTF-16 units; Python indices count code points.
        utf16 = [0]
        for char in plain:
            utf16.append(utf16[-1] + (2 if ord(char) > 0xFFFF else 1))
        for word in words:
            word["startOffset"] = utf16[word["startOffset"]]
            word["endOffset"] = utf16[word["endOffset"]]
        output = {"version": 1, "textRevision": book["textRevision"], "chapterId": chapter["id"],
                  "audioUrls": [url], "model": f"stable-ts/{chapter_model}", "coverage": round(coverage, 4),
                  "words": words}
        target = work / f"{index}-mapped.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"{slug}/{index}: wrote {len(words)} words, coverage {coverage:.1%}, "
              f"story {words[0]['start']:.2f}–{words[-1]['end']:.2f}s", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("slug")
    parser.add_argument("chapter", nargs="?", type=int)
    parser.add_argument("--model", default="base.en")
    parser.add_argument("--remap", action="store_true", help="Revalidate cached model output without rerunning the model")
    args = parser.parse_args()
    books = json.loads((ROOT / "src/data/books.generated.json").read_text(encoding="utf-8"))
    book = next(b for b in books if b["slug"] == args.slug)
    pending = [args.chapter] if args.chapter is not None else list(range(len(book["chapters"])))
    while pending:
        try:
            align_book(args.slug, pending, args.model, args.remap)
            break
        except AlignmentQualityError as error:
            if args.remap or args.model != "base.en":
                raise
            print(f"{error}; retrying this chapter with small.en", flush=True)
            align_book(args.slug, [error.index], "small.en")
            pending = pending[pending.index(error.index) + 1:]
