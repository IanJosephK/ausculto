import type { Book, ChapterText } from '../data/types';

const cache = new Map<string, Promise<ChapterText>>();

export function loadChapterText(bookSlug: string, chapterIndex: number): Promise<ChapterText> {
  const key = `${bookSlug}/${chapterIndex}`;
  let promise = cache.get(key);
  if (!promise) {
    promise = fetch(`/books/${bookSlug}/${chapterIndex}.json`).then((res) => {
      if (!res.ok) throw new Error(`Failed to load chapter text (${res.status})`);
      return res.json() as Promise<ChapterText>;
    });
    // Don't poison the cache with a failed fetch (e.g. offline miss)
    promise.catch(() => cache.delete(key));
    cache.set(key, promise);
  }
  return promise;
}

/** Loads every chapter of a book — used to build the search index. */
export function loadAllChapterTexts(book: Book): Promise<ChapterText[]> {
  return Promise.all(book.chapters.map((_, i) => loadChapterText(book.slug, i)));
}
