import type { WordTiming } from '../data/types';

/**
 * Word-level alignment files live at src/data/alignments/{slug}/{index}.json
 * and are produced by `npm run generate-alignments`. import.meta.glob keeps
 * them out of the main bundle — each file becomes its own lazy chunk.
 */
const modules = import.meta.glob('../data/alignments/*/*.json');

const cache = new Map<string, Promise<WordTiming[] | null>>();

export function loadAlignment(bookSlug: string, chapterIndex: number): Promise<WordTiming[] | null> {
  const key = `../data/alignments/${bookSlug}/${chapterIndex}.json`;
  let promise = cache.get(key);
  if (!promise) {
    const loader = modules[key];
    promise = loader
      ? loader()
          .then((mod) => {
            const data = (mod as { default?: WordTiming[] }).default ?? (mod as WordTiming[]);
            return Array.isArray(data) && data.length > 0 ? data : null;
          })
          .catch(() => null)
      : Promise.resolve(null);
    cache.set(key, promise);
  }
  return promise;
}

/**
 * Binary search: index of the word being spoken at `time`, or -1 if between
 * chapters / before the first word.
 */
export function findWordIndex(words: WordTiming[], time: number): number {
  let lo = 0;
  let hi = words.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].start <= time) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (result === -1) return -1;
  // Past the end of the found word and before the next → keep the found word
  // highlighted anyway; a gap-free highlight reads better than a flickering one.
  return result;
}
