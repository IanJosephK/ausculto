import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { test } from 'node:test';
import { prepareBook, type BookMapping } from '../scripts/book-preparation';
import { books } from '../src/data/books';
import { fromStoredProgress, toStoredPosition, locateAudioPart, sortByMatch } from '../src/lib/bookMapping';
import { relocateHighlight } from '../src/lib/annotationMapping';
import type { Book, Highlight } from '../src/data/types';

const specs = JSON.parse(readFileSync('scripts/book-mappings.json', 'utf8')) as BookMapping[];
const raw = (slug: string) => gunzipSync(readFileSync(`scripts/book-sources/${slug}.txt.gz`)).toString('utf8');
const generated = JSON.parse(readFileSync('src/data/books.generated.json', 'utf8')) as Book[];
const get = (slug: string) => generated.find(b => b.slug === slug)!;

test('every catalogue file reproduces from pinned sources with complete text/audio coverage', () => {
  assert.equal(specs.length, 19);
  let chapters = 0;
  let recordings = 0;
  for (const spec of specs) {
    const prepared = prepareBook(spec, raw(spec.slug));
    assert.deepEqual(prepared.book, get(spec.slug), spec.slug);
    assert.equal(readdirSync(`public/books/${spec.slug}`).filter(f => /^\d+\.json$/.test(f)).length, prepared.texts.length);
    prepared.texts.forEach((text, i) => {
      assert.deepEqual(JSON.parse(readFileSync(`public/books/${spec.slug}/${i}.json`, 'utf8')), text, `${spec.slug}/${i}`);
      assert.ok(text.paragraphs.length > 0);
      assert.equal(text.paragraphs.length, text.italics!.length);
      assert.doesNotMatch(text.paragraphs.join('\n'), /\[Illustration|\*\*\* START OF|\*\*\* END OF/);
    });
    chapters += prepared.texts.length;
    recordings += prepared.book.chapters.reduce((sum, c) => sum + c.audioParts!.length, 0);
  }
  assert.equal(chapters, 467);
  assert.equal(recordings, 477); // ten alternates and one unmatched editorial introduction excluded
});

test('Pride and Prejudice follows recorded chapter ranges without publisher/preface material', () => {
  const { texts } = prepareBook(specs[0], raw('pride-and-prejudice'));
  assert.match(texts[0].paragraphs[0], /^It is a truth universally acknowledged/);
  assert.deepEqual(get('pride-and-prejudice').chapters[0].textSections, ['I', 'II', 'III']);
  assert.deepEqual(get('pride-and-prejudice').chapters[1].textSections, ['IV', 'V']);
  assert.match(texts[1].paragraphs[0], /^When Jane and Elizabeth were alone/);
  assert.match(texts[2].paragraphs[0], /^The ladies of Longbourn soon waited/);
  assert.doesNotMatch(texts.map(t => t.paragraphs.join(' ')).join(' '), /GEORGE ALLEN PUBLISHER|CHISWICK PRESS|PREFACE\./);
});

test('recorded prefaces remain, contents/book containers and unrecorded end matter do not', () => {
  const prepared = (slug: string) => prepareBook(specs.find(b => b.slug === slug)!, raw(slug)).texts;
  assert.match(prepared('jane-eyre')[0].paragraphs[0], /^A preface to the first edition/);
  assert.equal(prepared('a-tale-of-two-cities').length, 45);
  assert.match(prepared('a-tale-of-two-cities')[0].paragraphs[0], /^It was the best of times/);
  assert.doesNotMatch(prepared('dracula').at(-1)!.paragraphs.join(' '), /GROSSET|There’s More to Follow/);
  assert.doesNotMatch(prepared('walden').map(t => t.paragraphs.join(' ')).join(' '), /ON THE DUTY OF CIVIL DISOBEDIENCE/);
});

test('edition-specific regressions: Kafka, Dorian Gray, Verne, Art of War, Meditations and Time Machine', () => {
  const prepared = (slug: string) => prepareBook(specs.find(b => b.slug === slug)!, raw(slug));
  assert.match(prepared('metamorphosis').texts[0].paragraphs[0], /^One morning, as Gregor Samsa was waking up from anxious dreams/);
  assert.equal(get('metamorphosis').gutenbergId, undefined);
  assert.equal(get('dorian-gray').gutenbergId, 4078);
  assert.equal(get('dorian-gray').chapters.length, 13);
  assert.equal(get('twenty-thousand-leagues').gutenbergId, 2488);
  assert.equal(get('twenty-thousand-leagues').chapters[10].title, 'The Nautilus');
  assert.equal(get('the-art-of-war').gutenbergId, 17405);
  assert.match(prepared('the-art-of-war').texts[0].paragraphs[0], /^1\. Sun Tzŭ said:/);
  assert.equal(get('meditations').gutenbergId, 15877);
  assert.match(prepared('meditations').texts[0].paragraphs[0], /^From my grandfather Verus/);
  assert.equal(prepared('the-time-machine').texts.length, 12);
  assert.match(prepared('the-time-machine').texts.at(-1)!.paragraphs.join(' '), /EPILOGUE/);
});

test('unexpected sources, dropped story sections and duplicate recordings fail preparation', () => {
  const spec = specs[0];
  assert.throws(() => prepareBook(spec, raw(spec.slug) + '\nchanged'), /source changed/);
  const dropped = structuredClone(spec);
  dropped.chapters.pop();
  assert.throws(() => prepareBook(dropped, raw(spec.slug)), /unmapped story text/);
  const duplicated = structuredClone(spec);
  duplicated.chapters[1].audioParts[0] = duplicated.chapters[0].audioParts[0];
  assert.throws(() => prepareBook(duplicated, raw(spec.slug)), /duplicate audio/);
});

test('split recordings form complete literary chapters and alternatives do not repeat playback', () => {
  assert.equal(get('walden').chapters[0].audioParts!.length, 5);
  assert.equal(get('walden').chapters[1].audioParts!.length, 2);
  assert.equal(get('heart-of-darkness').chapters.length, 3);
  assert.ok(get('heart-of-darkness').chapters.every(c => c.audioParts!.length === 2));
  assert.equal(get('count-of-monte-cristo').chapters.length, 117);
  assert.equal(get('count-of-monte-cristo').chapters[33].audioParts!.length, 2);
  assert.equal(get('the-time-machine').chapters.filter(c => c.title === 'Chapter 1').length, 1);
});

test('all selected audio positions round-trip through existing guest/cloud coordinates', () => {
  for (const book of generated) book.chapters.forEach((c, index) => {
    let offset = 0;
    for (const part of c.audioParts!) {
      const position = part.duration / 2;
      const stored = { chapterIndex: part.legacyIndex, position, updatedAt: 123 };
      const restored = fromStoredProgress(book, stored)!;
      assert.equal(restored.chapterIndex, index);
      assert.equal(restored.position, offset + position);
      assert.deepEqual(toStoredPosition(book, index, restored.position), { chapterIndex: part.legacyIndex, position });
      offset += part.duration;
    }
  });
});

test('seeking crosses recording boundaries in both directions and legacy alternatives resume in the canonical chapter', () => {
  const chapter = get('walden').chapters[0];
  const endFirst = chapter.audioParts![0].duration;
  assert.equal(locateAudioPart(chapter, endFirst).index, 1);
  assert.equal(locateAudioPart(chapter, endFirst + 15).position, 15);
  assert.equal(locateAudioPart(chapter, endFirst - 15).index, 0);
  const restored = fromStoredProgress(get('the-time-machine'), { chapterIndex: 1, position: 731, updatedAt: 1 })!;
  assert.equal(restored.chapterIndex, 0);
  assert.equal(restored.position, 586);
});

test('home catalogue ranks complete direct matches first and filtering preserves that order', () => {
  assert.equal(books[0].slug, 'alice-in-wonderland');
  for (let i = 1; i < books.length; i++) assert.ok(books[i - 1].matchRank! >= books[i].matchRank!);
  for (const genre of new Set(books.map(b => b.genre))) {
    const filtered = books.filter(b => b.genre === genre);
    assert.deepEqual(filtered, sortByMatch(filtered));
  }
  const original = [...generated];
  sortByMatch(original);
  assert.deepEqual(original, generated);
});

test('annotations relocate by saved excerpt; ambiguous or removed text keeps its note without highlighting unrelated text', () => {
  const book = { chapters: [{}, {}], legacyChapters: [{ chapterIndex: 0, offset: 0 }] } as Book;
  const highlight = { id: 'saved', chapterIndex: 0, startOffset: 12, endOffset: 19, text: 'passage', note: 'Keep me' } as Highlight;
  assert.deepEqual(relocateHighlight(highlight, book, ['Wrong old split', 'A passage here']), { ...highlight, chapterIndex: 1, startOffset: 2, endOffset: 9, unresolved: false });
  assert.equal(relocateHighlight(highlight, book, ['passage passage', '']).unresolved, true);
  assert.equal(relocateHighlight({ ...highlight, startOffset: 0, endOffset: 7 }, book, ['passage passage', '']).unresolved, true);
  const absent = relocateHighlight(highlight, book, ['Different translation', '']);
  assert.equal(absent.unresolved, true);
  assert.equal(absent.note, 'Keep me');
});
