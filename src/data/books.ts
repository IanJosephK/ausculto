import generated from './books.generated.json';
import type { Book } from './types';
import { sortByMatch } from '../lib/bookMapping';

/**
 * Book metadata produced by `npm run prepare-books`. Chapter text is NOT in
 * here — it lives in /public/books/{slug}/{index}.json and is lazy-loaded.
 */
export const books: Book[] = sortByMatch((generated as Book[]).map((book) => ({
  ...book,
  chapters: book.chapters.map((chapter) => ({
    ...chapter,
    // The www host redirects without CORS headers. Playback and offline
    // downloads must use the same CORS-safe URL and cache key.
    audioUrl: chapter.audioUrl.replace(/^https:\/\/www\.archive\.org\//i, 'https://archive.org/'),
    audioParts: chapter.audioParts?.map(part => ({ ...part, audioUrl: part.audioUrl.replace(/^https:\/\/www\.archive\.org\//i, 'https://archive.org/') })),
  })),
})));

export const GENRES = [
  'All',
  'Fiction',
  'Horror & Gothic',
  'Mystery & Adventure',
  'Sci-Fi & Fantasy',
  'Philosophy',
  'Novellas',
] as const;

export type Genre = (typeof GENRES)[number];

export function getBook(slug: string | undefined): Book | undefined {
  return slug ? books.find((b) => b.slug === slug) : undefined;
}
