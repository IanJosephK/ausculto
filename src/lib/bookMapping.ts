import type { AudioPart, Book, BookProgress, Chapter } from '../data/types';

export function audioParts(chapter: Chapter): AudioPart[] {
  return chapter.audioParts ?? [{ id: chapter.audioUrl, audioUrl: chapter.audioUrl, duration: chapter.duration, legacyIndex: 0 }];
}

export function locateAudioPart(chapter: Chapter, position: number) {
  const parts = audioParts(chapter);
  let offset = 0;
  for (let i = 0; i < parts.length; i++) {
    if (position < offset + parts[i].duration || i === parts.length - 1)
      return { index: i, offset, position: Math.max(0, Math.min(parts[i].duration, position - offset)), part: parts[i] };
    offset += parts[i].duration;
  }
  throw new Error('Chapter has no audio');
}

export function currentChapterIndex(book: Book, storedIndex: number): number {
  return book.legacyChapters?.[storedIndex]?.chapterIndex ?? Math.max(0, Math.min(storedIndex, book.chapters.length - 1));
}

export function storedChapterIndex(book: Book, index: number): number {
  return book.chapters[index]?.audioParts?.[0].legacyIndex ?? index;
}

/** Storage keeps its original recording coordinates, including in Supabase. */
export function fromStoredProgress(book: Book, progress: BookProgress | undefined): BookProgress | undefined {
  if (!progress) return undefined;
  const map = book.legacyChapters?.[progress.chapterIndex];
  return map ? { ...progress, chapterIndex: map.chapterIndex, position: map.offset + progress.position * (map.scale ?? 1) } : progress;
}

export function toStoredPosition(book: Book, chapterIndex: number, position: number) {
  const chapter = book.chapters[chapterIndex];
  if (!chapter?.audioParts) return { chapterIndex, position };
  const located = locateAudioPart(chapter, position);
  return { chapterIndex: located.part.legacyIndex, position: located.position };
}

export function chapterTextUrl(book: Pick<Book, 'slug' | 'textRevision'>, index: number): string {
  return `/books/${book.slug}/${index}.json${book.textRevision ? `?v=${encodeURIComponent(book.textRevision)}` : ''}`;
}

/** Complete single-chapter pairs first; ties retain the curated order. */
export function sortByMatch(books: readonly Book[]): Book[] {
  return [...books].sort((a, b) => (b.matchRank ?? 0) - (a.matchRank ?? 0));
}
