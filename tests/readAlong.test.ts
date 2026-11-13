import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { books } from '../src/data/books';
import type { ChapterAlignment, ChapterText } from '../src/data/types';
import { alignmentUrl, downloadRevision, findWordIndex, readAlongForBook, validateAlignment } from '../src/lib/readAlong';
import { loadAlignment } from '../src/lib/alignments';
import { downloadBookForOffline } from '../src/lib/offline';

const synced = books.filter(book => readAlongForBook(book));
const sampleBook = books.find(book => book.slug === 'metamorphosis')!;
const text = (slug: string, i: number) => JSON.parse(readFileSync(`public/books/${slug}/${i}.json`, 'utf8')) as ChapterText;
const timing = (slug: string, i: number) => {
  const book = books.find(b => b.slug === slug)!;
  return JSON.parse(readFileSync(`public${alignmentUrl(book, i)}`, 'utf8')) as ChapterAlignment;
};

test('every badged title has complete, revision-matched and content-addressed word timings', () => {
  assert.deepEqual(synced.map(b => b.slug).sort(), ['metamorphosis', 'the-art-of-war']);
  let chapters = 0;
  for (const book of synced) book.chapters.forEach((_, i) => {
    const url = alignmentUrl(book, i)!;
    const content = readFileSync(`public${url}`, 'utf8');
    const data = JSON.parse(content) as ChapterAlignment;
    assert.equal(validateAlignment(data, book, i, text(book.slug, i).paragraphs.join('\n\n')), true, `${book.slug}/${i}`);
    assert.ok(url.endsWith(`.${createHash('sha256').update(content).digest('hex').slice(0, 12)}.json`));
    assert.ok(data.words.length > 200);
    assert.ok(data.words.every(w => w.end - w.start <= 3.001));
    chapters++;
  });
  assert.equal(chapters, 10);
});

test('book badges disappear when the edition, recording or chapter coverage changes', () => {
  assert.ok(readAlongForBook(sampleBook));
  assert.equal(readAlongForBook({ ...sampleBook, textRevision: 'new-edition' }), null);
  assert.equal(readAlongForBook({ ...sampleBook, chapters: sampleBook.chapters.slice(1) }), null);
  const changed = structuredClone(sampleBook);
  changed.chapters[0].audioParts![0].audioUrl += '?different-recording';
  assert.equal(readAlongForBook(changed), null);
  assert.equal(readAlongForBook(books.find(b => b.slug === 'jane-eyre')!), null);
  assert.notEqual(downloadRevision(sampleBook), sampleBook.textRevision);
  const ordinary = books.find(b => b.slug === 'jane-eyre')!;
  assert.equal(downloadRevision(ordinary), ordinary.textRevision);
});

test('known unspoken endings do not acquire highlights over narrator credits', () => {
  const data = timing('the-art-of-war', 1);
  const plain = text('the-art-of-war', 1).paragraphs.join('\n\n');
  const omitted = plain.indexOf('So much for tactical dispositions');
  assert.ok(omitted > 0);
  assert.ok(data.words.every(word => word.startOffset < omitted));
  assert.equal(findWordIndex(data.words, 457), -1);
  assert.equal(findWordIndex(timing('the-art-of-war', 6).words, 535), -1);
});

test('binary search handles seeking, narration gaps, intro and outro without lingering highlights', () => {
  const words = [
    { word: 'Alice', start: 10, end: 10.5, startOffset: 0, endOffset: 5 },
    { word: 'was', start: 10.6, end: 11, startOffset: 6, endOffset: 9 },
    { word: 'beginning', start: 15, end: 15.5, startOffset: 10, endOffset: 19 },
  ];
  for (const time of [-1, 0, 9.99, 10.5, 11, 14, 15.5, 100, NaN]) assert.equal(findWordIndex(words, time), -1);
  assert.equal(findWordIndex(words, 15.2), 2);
  assert.equal(findWordIndex(words, 10), 0);
  assert.equal(findWordIndex(words, 10.9), 1);
  assert.equal(findWordIndex([], 1), -1);
});

test('timings address the exact displayed text and reject stale, overlapping or malformed ranges', () => {
  const data = timing(sampleBook.slug, 0);
  const plain = text(sampleBook.slug, 0).paragraphs.join('\n\n');
  assert.equal(validateAlignment(data, sampleBook, 0, plain), true);
  assert.equal(validateAlignment(data, sampleBook, 0, 'unrelated text'), false);
  assert.equal(validateAlignment({ ...data, textRevision: 'old' }, sampleBook, 0, plain), false);
  assert.equal(validateAlignment({ ...data, words: [{ ...data.words[0], startOffset: data.words[0].startOffset + 1 }] }, sampleBook, 0, plain), false);
  assert.equal(validateAlignment({ ...data, words: [{ ...data.words[0], start: NaN }] }, sampleBook, 0, plain), false);
  assert.equal(validateAlignment({ ...data, words: [data.words[1], data.words[0]] }, sampleBook, 0, plain), false);
  assert.equal(validateAlignment({ ...data, words: [] }, sampleBook, 0, plain), false);
});

test('missing timing requests fall back to text and can be retried', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response('offline', { status: 503 });
  assert.equal(await loadAlignment(sampleBook, 0, text(sampleBook.slug, 0)), null);
  globalThis.fetch = async () => Response.json(timing(sampleBook.slug, 0));
  assert.ok((await loadAlignment(sampleBook, 0, text(sampleBook.slug, 0)))!.length > 200);
});

test('offline downloads cache every synced chapter and cannot report success if its timing file fails', async t => {
  const stored = new Set<string>();
  for (const [key, value] of Object.entries({
    navigator: { serviceWorker: { controller: {} } },
    caches: { open: async (name: string) => ({ put: async (url: string) => { stored.add(`${name}:${url}`); } }) },
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); });
  }
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes('/alignments/')) return new Response(readFileSync(`public${url}`, 'utf8'));
    if (url.startsWith('/books/')) return new Response(readFileSync(`public${url.split('?')[0]}`, 'utf8'));
    return new Response('complete audio');
  };
  assert.equal(await downloadBookForOffline(sampleBook, () => {}), true);
  sampleBook.chapters.forEach((_, i) => assert.ok(stored.has(`ausculto-alignments:${alignmentUrl(sampleBook, i)}`)));
  globalThis.fetch = async input => new Response('', { status: String(input).includes('/alignments/') ? 503 : 200 });
  assert.equal(await downloadBookForOffline(sampleBook, () => {}), false);
  globalThis.fetch = async () => new Response('<html>SPA fallback</html>');
  assert.equal(await downloadBookForOffline(sampleBook, () => {}), false);
});
