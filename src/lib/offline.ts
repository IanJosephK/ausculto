import type { Book } from '../data/types';

/**
 * Offline caching piggybacks on the Workbox runtime caches configured in
 * vite.config.ts: any audio or chapter-text request that passes through the
 * service worker is stored with a CacheFirst strategy. "Downloading" a book
 * is therefore just fetching everything once while the SW is in control.
 */

export function isServiceWorkerActive(): boolean {
  return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
}

/** Fire-and-forget warm-up of the next chapter's audio. */
export function precacheChapterAudio(book: Book, chapterIndex: number): void {
  if (!isServiceWorkerActive()) return; // dev / first visit: don't double-download
  const chapter = book.chapters[chapterIndex];
  if (!chapter) return;
  fetch(chapter.audioUrl, { mode: 'cors' })
    .then((res) => res.blob())
    .catch(() => {
      /* offline or CORS hiccup — playback will stream normally */
    });
}

/**
 * Download every chapter's audio + text for offline listening.
 * Returns true if everything was fetched.
 */
export async function downloadBookForOffline(
  book: Book,
  onProgress: (done: number, total: number) => void,
): Promise<boolean> {
  const total = book.chapters.length;
  let done = 0;
  let allOk = true;
  for (let i = 0; i < book.chapters.length; i++) {
    try {
      // Text (same-origin, cached by the 'ausculto-text' runtime cache)
      const textRes = await fetch(`/books/${book.slug}/${i}.json`);
      if (!textRes.ok) allOk = false;
      // Audio (cached by the 'ausculto-audio' runtime cache)
      const res = await fetch(book.chapters[i].audioUrl, { mode: 'cors' });
      if (!res.ok) allOk = false;
      await res.blob(); // ensure the body is fully consumed → fully cached
    } catch {
      allOk = false;
    }
    done++;
    onProgress(done, total);
  }
  return allOk;
}
