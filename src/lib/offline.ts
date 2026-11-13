import type { Book } from '../data/types';
import { audioParts, chapterTextUrl } from './bookMapping';

/**
 * Offline caching uses the Workbox runtime caches in vite.config.ts. Chapter
 * text and full (200) CORS audio responses are cached; streamed audio ranges
 * (206) are not. Warm-ups and downloads fetch complete files while the SW is
 * in control so it can serve byte ranges from those files offline.
 */

export function isServiceWorkerActive(): boolean {
  return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
}

/** Fire-and-forget warm-up of the next chapter's audio. */
export function precacheChapterAudio(book: Book, chapterIndex: number): void {
  const chapter = book.chapters[chapterIndex];
  if (!chapter) return;
  precacheAudio(audioParts(chapter)[0].audioUrl);
}

export function precacheAudio(url: string): void {
  if (!isServiceWorkerActive()) return;
  fetch(url, { mode: 'cors' })
    .then((res) => res.blob())
    .catch(() => {
      /* offline or CORS hiccup — playback will stream normally */
    });
}

/**
 * Download every chapter's audio + text for offline listening.
 * Returns true only after every full response has been written to CacheStorage.
 */
export async function downloadBookForOffline(
  book: Book,
  onProgress: (done: number, total: number) => void,
): Promise<boolean> {
  if (!isServiceWorkerActive() || !('caches' in globalThis)) return false;
  let textCache: Cache;
  let audioCache: Cache;
  try {
    [textCache, audioCache] = await Promise.all([
      caches.open('ausculto-text'),
      caches.open('ausculto-audio'),
    ]);
  } catch {
    return false;
  }
  const total = book.chapters.length;
  let done = 0;
  let allOk = true;
  for (let i = 0; i < book.chapters.length; i++) {
    try {
      // Text (same-origin, cached by the 'ausculto-text' runtime cache)
      const textUrl = chapterTextUrl(book, i);
      const textRes = await fetch(textUrl);
      if (textRes.status !== 200) throw new Error('Chapter text download failed');
      await textCache.put(textUrl, textRes);
      // Audio (cached by the 'ausculto-audio' runtime cache)
      for (const part of audioParts(book.chapters[i])) {
        const res = await fetch(part.audioUrl, { mode: 'cors' });
        if (res.status !== 200) throw new Error('Complete audio download failed');
        await audioCache.put(part.audioUrl, res);
      }
    } catch {
      allOk = false;
    }
    done++;
    onProgress(done, total);
  }
  return allOk;
}
