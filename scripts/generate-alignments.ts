/** Force-align pinned chapter text/audio and publish only complete books. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Book, ChapterAlignment, ChapterText, ReadAlongBook } from '../src/data/types';
import { validateAlignment } from '../src/lib/readAlong';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const remap = process.argv.includes('--remap');
  const cli = process.argv.slice(2).filter(arg => arg !== '--remap');
  const modelIndex = cli.indexOf('--model');
  const model = modelIndex >= 0 ? cli.splice(modelIndex, 2)[1] : 'base.en';
  if (!['tiny.en', 'base.en', 'small.en', 'medium.en'].includes(model)) throw new Error('Choose a supported English Whisper model.');
  const [slug, chapterArg] = cli;
  if (cli.length > 2) throw new Error('Usage: npm run generate-alignments -- <book-slug> [chapter-index] [--model base.en] [--remap]');
  const books = JSON.parse(await readFile(join(ROOT, 'src/data/books.generated.json'), 'utf8')) as Book[];
  const book = books.find(b => b.slug === slug);
  if (!book) throw new Error('Usage: npm run generate-alignments -- <book-slug> [chapter-index]');
  if (chapterArg !== undefined && (!/^\d+$/.test(chapterArg) || !book.chapters[Number(chapterArg)]))
    throw new Error('Chapter index must identify an existing chapter.');
  const localPython = join(ROOT, 'scripts/.cache/readalong-env', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const python = process.env.AUSCULTO_PYTHON || (existsSync(localPython) ? localPython : 'python');
  const args = [join(ROOT, 'scripts/align-audio.py'), slug];
  if (chapterArg !== undefined) args.push(chapterArg);
  if (remap) args.push('--remap');
  args.push('--model', model);
  const result = spawnSync(python, args, { stdio: 'inherit', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Alignment failed; see the Python output above.');

  const outputs = book.chapters.map((_, i) => join(ROOT, `scripts/.cache/alignments/${slug}/${i}-mapped.json`));
  if (outputs.some(path => !existsSync(path))) {
    console.log('Chapter generated. Run without a chapter index to finish this book and publish its badge.');
    return;
  }
  const aligned = await Promise.all(outputs.map(async (path, i) => {
    const data = JSON.parse(await readFile(path, 'utf8')) as ChapterAlignment;
    const text = JSON.parse(await readFile(join(ROOT, `public/books/${slug}/${i}.json`), 'utf8')) as ChapterText;
    if (!validateAlignment(data, book, i, text.paragraphs.join('\n\n')))
      throw new Error(`Invalid or stale timing data for ${slug}/${i}. Regenerate the complete book.`);
    const content = JSON.stringify(data) + '\n';
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
    return { data, content, url: `/alignments/${slug}/${i}.${hash}.json` };
  }));
  const directory = join(ROOT, 'public/alignments', slug);
  await mkdir(directory, { recursive: true });
  for (const { content, url } of aligned) await writeFile(join(ROOT, 'public', url.slice(1)), content);
  const cataloguePath = join(ROOT, 'src/data/alignments/catalogue.json');
  const catalogue = JSON.parse(await readFile(cataloguePath, 'utf8')) as Record<string, ReadAlongBook>;
  catalogue[slug] = {
    textRevision: book.textRevision!,
    chapters: aligned.map(({ data, url }) => ({ id: data.chapterId, audioUrls: data.audioUrls, url, coverage: data.coverage })),
  };
  // Update availability last, after every chapter passes and exists on disk.
  await writeFile(cataloguePath, JSON.stringify(catalogue, null, 2) + '\n');
  console.log(`Published read-along sync for all ${aligned.length} chapters of ${book.title}.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
