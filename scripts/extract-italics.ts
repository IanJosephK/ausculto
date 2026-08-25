/**
 * One-off migration: rewrites every public/books/{slug}/{n}.json in place,
 * stripping Gutenberg underscore-italics out of the paragraph text and moving
 * them into a parallel `italics` field (char ranges per paragraph).
 *
 * Idempotent: files that already carry an `italics` field are left untouched,
 * so re-running never erases previously extracted ranges.
 *
 *   npx tsx scripts/extract-italics.ts
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseItalics } from './italics';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BOOKS_DIR = join(ROOT, 'public', 'books');

interface StoredChapter {
  title: string;
  paragraphs: string[];
  italics?: [number, number][][];
}

async function main() {
  const slugs = await readdir(BOOKS_DIR);
  let filesChanged = 0;
  let filesSkipped = 0;
  let spans = 0;

  for (const slug of slugs) {
    const dir = join(BOOKS_DIR, slug);
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const path = join(dir, file);
      const chapter = JSON.parse(await readFile(path, 'utf-8')) as StoredChapter;
      if (chapter.italics) {
        filesSkipped++;
        continue;
      }
      const cleanParagraphs: string[] = [];
      const italics: [number, number][][] = [];
      for (const para of chapter.paragraphs) {
        const parsed = parseItalics(para);
        cleanParagraphs.push(parsed.text);
        italics.push(parsed.italics);
        spans += parsed.italics.length;
      }
      await writeFile(
        path,
        JSON.stringify({ title: chapter.title, paragraphs: cleanParagraphs, italics }),
        'utf-8',
      );
      filesChanged++;
    }
  }

  console.log(
    `Done. ${filesChanged} files rewritten, ${filesSkipped} already migrated, ${spans} italic spans extracted.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
