import type { Book, ChapterText, WordTiming } from '../data/types';
import { alignmentUrl, validateAlignment } from './readAlong';

const cache = new Map<string, Promise<unknown>>();

export async function loadAlignment(book: Book, chapterIndex: number, text: ChapterText): Promise<WordTiming[] | null> {
  const url = alignmentUrl(book, chapterIndex);
  if (!url) return null;
  let promise = cache.get(url);
  if (!promise) {
    promise = fetch(url, { signal: AbortSignal.timeout(15_000) }).then(res => {
      if (!res.ok) throw new Error(`Alignment unavailable (${res.status})`);
      return res.json() as Promise<unknown>;
    });
    promise.catch(() => cache.delete(url));
    cache.set(url, promise);
  }
  try {
    const data = await promise;
    return validateAlignment(data, book, chapterIndex, text.paragraphs.join('\n\n')) ? data.words : null;
  } catch {
    return null;
  }
}
