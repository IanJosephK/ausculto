import catalogue from '../data/alignments/catalogue.json';
import type { Book, ChapterAlignment, ReadAlongBook, WordTiming } from '../data/types';
import { audioParts } from './bookMapping';

const syncedBooks = catalogue as Record<string, ReadAlongBook>;

/** A whole-book badge is earned only by complete, current timing data. */
export function readAlongForBook(book: Book): ReadAlongBook | null {
  const entry = syncedBooks[book.slug];
  if (!entry || !book.textRevision || entry.textRevision !== book.textRevision ||
      entry.chapters.length !== book.chapters.length) return null;
  return entry.chapters.every((c, i) => c.id === book.chapters[i].id && c.coverage >= 0.95 &&
    JSON.stringify(c.audioUrls) === JSON.stringify(audioParts(book.chapters[i]).map(p => p.audioUrl))) ? entry : null;
}

export function alignmentUrl(book: Book, chapterIndex: number): string | null {
  return readAlongForBook(book)?.chapters[chapterIndex]?.url ?? null;
}

/** Existing text-only downloads need refreshing when word timings are added. */
export function downloadRevision(book: Book | undefined): string {
  const revision = book?.textRevision ?? 'legacy';
  const synced = book && readAlongForBook(book);
  return synced ? `${revision}:${synced.chapters.map(c => c.url).join('|')}` : revision;
}

/** Reject stale or corrupt data instead of highlighting unrelated text. */
export function validateAlignment(value: unknown, book: Book, chapterIndex: number, plain: string): value is ChapterAlignment {
  if (!value || typeof value !== 'object') return false;
  const data = value as ChapterAlignment;
  const chapter = book.chapters[chapterIndex];
  if (!chapter || data.version !== 1 || data.textRevision !== book.textRevision ||
      data.chapterId !== chapter.id || !Number.isFinite(data.coverage) || data.coverage < 0.95 || data.coverage > 1 ||
      JSON.stringify(data.audioUrls) !== JSON.stringify(audioParts(chapter).map(p => p.audioUrl)) ||
      !Array.isArray(data.words) || !data.words.length) return false;
  let end = 0;
  let endOffset = 0;
  return data.words.every(w => {
    if (!w || !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.start < end ||
        w.end <= w.start || w.end - w.start > 3.001 || w.end > chapter.duration + 2 || !Number.isInteger(w.startOffset) ||
        !Number.isInteger(w.endOffset) || w.startOffset < endOffset || w.endOffset <= w.startOffset ||
        w.endOffset > plain.length || plain.slice(w.startOffset, w.endOffset) !== w.word) return false;
    end = w.end;
    endOffset = w.endOffset;
    return true;
  });
}

/** Silence, narration credits and the outro have no active text word. */
export function findWordIndex(words: WordTiming[], time: number): number {
  if (!Number.isFinite(time)) return -1;
  let lo = 0;
  let hi = words.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].start <= time) { result = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return result >= 0 && time < words[result].end ? result : -1;
}
