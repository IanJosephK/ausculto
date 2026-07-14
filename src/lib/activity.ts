import { supabase } from './supabase';
import { useStore } from '../store/useStore';
import { todayKey } from './format';

/**
 * Record listening time. Always accumulates locally (stats + streaks work for
 * guests); additionally inserts a reading_activity row when signed in, which
 * powers cross-device stats and the "X people reading" counts.
 */
export function recordActivity(bookSlug: string, chapterIndex: number, seconds: number): void {
  if (seconds <= 0) return;
  useStore.getState().addActivity(todayKey(), Math.round(seconds));

  if (!supabase) return;
  void supabase.auth.getSession().then(({ data }) => {
    const userId = data.session?.user.id;
    if (!userId || !supabase) return;
    void supabase
      .from('reading_activity')
      .insert({
        user_id: userId,
        book_slug: bookSlug,
        chapter_index: chapterIndex,
        duration_seconds: Math.round(seconds),
      })
      .then(({ error }) => {
        if (error) console.warn('[ausculto] activity insert failed:', error.message);
      });
  });
}
