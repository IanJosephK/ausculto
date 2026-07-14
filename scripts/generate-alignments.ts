/**
 * generate-alignments.ts
 *
 * Produces word-level alignment data for the reader's karaoke-style
 * text highlighting:
 *
 *   src/data/alignments/{bookSlug}/{chapterIndex}.json
 *   → [{ "word": "Whoever", "start": 1.02, "end": 1.38 }, ...]
 *
 * The app maps the Nth alignment entry onto the Nth whitespace token of the
 * chapter text, so alignments only make sense for chapters whose text matches
 * the recording well (textMapping === "exact" is a good signal).
 *
 * This implementation shells out to OpenAI Whisper's CLI with word timestamps
 * (pip install openai-whisper; ffmpeg required). For higher-fidelity forced
 * alignment against the actual Gutenberg text, Aeneas
 * (https://github.com/readbeyond/aeneas) or Gentle
 * (https://github.com/lowerquality/gentle) are drop-in alternatives — emit
 * the same JSON shape and the app needs no changes.
 *
 * Usage:
 *   npm run generate-alignments -- <bookSlug> [chapterIndex]
 *   npm run generate-alignments -- the-time-machine 0
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

interface GeneratedBook {
  slug: string;
  chapters: { title: string; audioUrl: string; duration: number }[];
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

interface WhisperOutput {
  segments?: { words?: WhisperWord[] }[];
}

function assertWhisperAvailable(): void {
  try {
    execFileSync('whisper', ['--help'], { stdio: 'ignore' });
  } catch {
    console.error(
      [
        'The `whisper` CLI was not found on PATH.',
        '',
        'Install it with:  pip install openai-whisper   (ffmpeg is also required)',
        'Alternatively, generate the same JSON shape with Aeneas or Gentle and',
        'place files at src/data/alignments/{slug}/{chapterIndex}.json.',
      ].join('\n'),
    );
    process.exit(1);
  }
}

async function alignChapter(slug: string, chapterIndex: number, audioUrl: string): Promise<void> {
  console.log(`  chapter ${chapterIndex}: downloading audio…`);
  const res = await fetch(audioUrl, { signal: AbortSignal.timeout(300_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${audioUrl}`);
  const workDir = join(tmpdir(), `ausculto-align-${slug}-${chapterIndex}`);
  await mkdir(workDir, { recursive: true });
  const audioPath = join(workDir, 'chapter.mp3');
  await writeFile(audioPath, Buffer.from(await res.arrayBuffer()));

  console.log(`  chapter ${chapterIndex}: running whisper (this takes a while)…`);
  execFileSync(
    'whisper',
    [
      audioPath,
      '--model', 'base.en',
      '--language', 'en',
      '--word_timestamps', 'True',
      '--output_format', 'json',
      '--output_dir', workDir,
    ],
    { stdio: 'inherit' },
  );

  const output = JSON.parse(await readFile(join(workDir, 'chapter.json'), 'utf-8')) as WhisperOutput;
  const words: WhisperWord[] = [];
  for (const segment of output.segments ?? []) {
    for (const w of segment.words ?? []) {
      const word = w.word.trim();
      if (word) words.push({ word, start: round(w.start), end: round(w.end) });
    }
  }
  if (!words.length) throw new Error('whisper produced no word timestamps');

  const outDir = join(ROOT, 'src', 'data', 'alignments', slug);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, `${chapterIndex}.json`), JSON.stringify(words), 'utf-8');
  await rm(workDir, { recursive: true, force: true });
  console.log(`  chapter ${chapterIndex}: wrote ${words.length} words`);
}

const round = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const [slug, chapterArg] = process.argv.slice(2);
  if (!slug) {
    console.error('Usage: npm run generate-alignments -- <bookSlug> [chapterIndex]');
    process.exit(1);
  }
  const booksPath = join(ROOT, 'src', 'data', 'books.generated.json');
  if (!existsSync(booksPath)) {
    console.error('Run `npm run prepare-books` first.');
    process.exit(1);
  }
  const books = JSON.parse(await readFile(booksPath, 'utf-8')) as GeneratedBook[];
  const book = books.find((b) => b.slug === slug);
  if (!book) {
    console.error(`Unknown book slug "${slug}".`);
    process.exit(1);
  }

  assertWhisperAvailable();

  const indices =
    chapterArg !== undefined ? [Number(chapterArg)] : book.chapters.map((_, i) => i);
  console.log(`Aligning ${indices.length} chapter(s) of "${slug}"…`);
  for (const i of indices) {
    if (!book.chapters[i]) {
      console.warn(`  chapter ${i} does not exist, skipping`);
      continue;
    }
    await alignChapter(slug, i, book.chapters[i].audioUrl);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
