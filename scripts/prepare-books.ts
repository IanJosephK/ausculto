/** Rebuild the catalogue from reviewed source snapshots and explicit mappings. */
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Book } from '../src/data/types';
import { prepareBook, type BookMapping } from './book-preparation';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const fetchSources = args.includes('--fetch-sources');
  const only = args.filter(a => !a.startsWith('--'));
  const specs = JSON.parse(await readFile(join(ROOT, 'scripts/book-mappings.json'), 'utf8')) as BookMapping[];
  for (const slug of only) if (!specs.some(s => s.slug === slug)) throw new Error(`Unknown book: ${slug}`);
  const selected = specs.filter(s => !only.length || only.includes(s.slug));
  const prepared = [];
  for (const spec of selected) {
    if (!/^[a-z0-9-]+$/.test(spec.slug)) throw new Error('Invalid book slug');
    const snapshot = join(ROOT, 'scripts/book-sources', `${spec.slug}.txt.gz`);
    let raw: string;
    if (fetchSources) {
      const response = await fetch(spec.source.url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`${spec.slug}: HTTP ${response.status}`);
      raw = await response.text();
      if (createHash('sha256').update(raw).digest('hex') !== spec.source.sha256)
        throw new Error(`${spec.slug}: upstream text changed; inspect and review it before updating the pinned source hash`);
      if (!check) await writeFile(snapshot, gzipSync(raw));
    } else raw = gunzipSync(await readFile(snapshot)).toString('utf8');
    const result = prepareBook(spec, raw);
    prepared.push(result);
    console.log(`${spec.slug}: ${result.book.chapters.length} ${result.book.textMapping} chapter mappings`);
  }
  // Validate every selected book before changing any generated chapter/metadata.
  const metadataPath = join(ROOT, 'src/data/books.generated.json');
  const existing = JSON.parse(await readFile(metadataPath, 'utf8')) as Book[];
  const replacement = new Map(prepared.map(p => [p.book.slug, p.book]));
  const merged = specs.map(s => replacement.get(s.slug) ?? existing.find(b => b.slug === s.slug)!);
  if (merged.some(b => !b)) throw new Error('Missing book metadata');
  for (const { book, texts } of prepared) {
    const dir = join(ROOT, 'public/books', book.slug);
    if (!check) await mkdir(dir, { recursive: true });
    for (let i = 0; i < texts.length; i++) {
      const file = join(dir, `${i}.json`);
      const content = JSON.stringify(texts[i]);
      if (check) {
        if (await readFile(file, 'utf8') !== content) throw new Error(`${book.slug}/${i}: generated text is stale`);
      } else await writeFile(file, content, 'utf8');
    }
    for (const name of await readdir(dir)) {
      if (/^\d+\.json$/.test(name) && Number(name.slice(0, -5)) >= texts.length) {
        if (check) throw new Error(`${book.slug}/${name}: obsolete chapter file`);
        await unlink(join(dir, name));
      }
    }
  }
  const metadata = JSON.stringify(merged, null, 2) + '\n';
  if (check) {
    if (await readFile(metadataPath, 'utf8') !== metadata) throw new Error('Generated catalogue metadata is stale');
    console.log('Catalogue and all chapter files match the reviewed sources.');
  } else await writeFile(metadataPath, metadata, 'utf8');
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
