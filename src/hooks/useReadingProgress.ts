import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useAuth } from './useAuth';
import type { Book, BookProgress } from '../data/types';

const PUSH_DEBOUNCE_MS = 8000;

/**
 * Mounted once in App. While signed in, mirrors local progress changes to
 * Supabase (debounced per book). The local store stays the source of truth
 * for the UI, so guests and flaky connections lose nothing.
 */
export function useProgressSync(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !supabase) return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const push = (slug: string, p: BookProgress) => {
      void supabase
        ?.from('reading_progress')
        .upsert(
          {
            user_id: user.id,
            book_slug: slug,
            chapter_index: p.chapterIndex,
            audio_position_seconds: p.position,
            updated_at: new Date(p.updatedAt).toISOString(),
          },
          { onConflict: 'user_id,book_slug' },
        )
        .then(({ error }) => {
          if (error) console.warn('[ausculto] progress sync failed:', error.message);
        });
    };

    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.progress === prev.progress) return;
      for (const [slug, p] of Object.entries(state.progress)) {
        if (prev.progress[slug] === p) continue;
        clearTimeout(timers.get(slug));
        timers.set(slug, setTimeout(() => push(slug, p), PUSH_DEBOUNCE_MS));
      }
    });

    return () => {
      unsubscribe();
      for (const t of timers.values()) clearTimeout(t);
    };
  }, [user]);
}

/** 0–100: how far through the whole book (by audio time) this progress is. */
export function bookPercent(book: Book, progress: BookProgress | undefined): number {
  if (!progress || book.totalDuration === 0) return 0;
  let seconds = progress.position;
  for (let i = 0; i < progress.chapterIndex && i < book.chapters.length; i++) {
    seconds += book.chapters[i].duration;
  }
  return Math.min(100, Math.round((seconds / book.totalDuration) * 100));
}
