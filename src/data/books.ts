import generated from './books.generated.json';
import type { Book } from './types';

/**
 * Book metadata produced by `npm run prepare-books`. Chapter text is NOT in
 * here — it lives in /public/books/{slug}/{index}.json and is lazy-loaded.
 */
export const books = generated as Book[];

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
